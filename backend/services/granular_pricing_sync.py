"""Granular Cloud Pricing Sync Service
=====================================
Fetches per-instance-type pricing from Azure, AWS, and GCP.

Separate from cloud_pricing_sync.py (summary data, 1-hour TTL).
This service uses a 6-hour TTL cache for the larger granular catalog.

Public API:
  get_cached_catalog()       - dict with entries, synced_at, source
  get_live_catalog()         - same, forces fresh fetch
  invalidate_catalog_cache() - clears cache
"""
import asyncio
import logging
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

CATALOG_TTL_SECONDS = 21600  # 6 hours

# -- Cache --

@dataclass
class GranularCatalogCache:
    entries: list = field(default_factory=list)
    fetched_at: Optional[datetime] = None
    source: str = "fallback"


_catalog_cache = GranularCatalogCache()


def _catalog_is_fresh() -> bool:
    if _catalog_cache.fetched_at is None:
        return False
    age = (datetime.now(timezone.utc) - _catalog_cache.fetched_at).total_seconds()
    return age < CATALOG_TTL_SECONDS


def _catalog_is_fresh_at_elapsed(elapsed_seconds: int) -> bool:
    """Testable version of freshness check given elapsed seconds."""
    return elapsed_seconds < CATALOG_TTL_SECONDS


def invalidate_catalog_cache():
    global _catalog_cache
    _catalog_cache = GranularCatalogCache()

# -- Parsing utilities --

def parseAzureSkuSpecs(sku_name: str) -> tuple[int, float]:
    """Extract (vcpu, memory_gb) from Azure VM SKU names. Returns (0, 0.0) for unrecognized patterns."""
    s = sku_name.strip()
    m = re.match(r'^B(\d+)(ms|ls|s)\b', s, re.IGNORECASE)
    if m:
        n = int(m.group(1))
        suffix = m.group(2).lower()
        if suffix == 'ms': return (n, float(n * 4))
        elif suffix == 'ls': return (n, float(n) * 0.5)
        else: return (n, float(n * 2))
    m = re.match(r'^D(\d+)[a-z]*s[_ ]?v\d+', s, re.IGNORECASE)
    if m: return (int(m.group(1)), float(int(m.group(1)) * 4))
    m = re.match(r'^E(\d+)[a-z]*s[_ ]?v\d+', s, re.IGNORECASE)
    if m: return (int(m.group(1)), float(int(m.group(1)) * 8))
    m = re.match(r'^F(\d+)[a-z]*s', s, re.IGNORECASE)
    if m: return (int(m.group(1)), float(int(m.group(1)) * 2))
    return (0, 0.0)

def parseAwsMemoryString(mem_str: str) -> float:
    """Parse AWS memory strings like "4 GiB" -> 4.0. Returns 0.0 on failure."""
    try:
        parts = mem_str.strip().split()
        if len(parts) >= 1: return float(parts[0])
    except (ValueError, AttributeError): pass
    return 0.0

def parseGcpMachineType(machine_type: str) -> tuple[int, float]:
    """Extract (vcpu, memory_gb) from GCP machine type names. Returns (0, 0.0) for unrecognized patterns."""
    mt = machine_type.lower().strip()
    if mt == 'e2-micro': return (1, 1.0)
    if mt == 'e2-small': return (1, 2.0)
    if mt == 'e2-medium': return (2, 4.0)
    m = re.match(r'^([a-z0-9]+)-([a-z]+)-(\d+)$', mt)
    if not m: return (0, 0.0)
    n = int(m.group(3))
    size_type = m.group(2)
    ratios = {'standard': 4.0, 'highmem': 8.0, 'highcpu': 1.0}
    ratio = ratios.get(size_type)
    if ratio is None: return (0, 0.0)
    return (n, float(n) * ratio)

# -- Static fallback data --

def _make_instance(provider, category, service_name, instance_type, vcpu, memory_gb,
                unit, price_usd, tier_label, os=None, storage=None):
    return {
        "provider": provider,
        "category": category,
        "service_name": service_name,
        "instance_type": instance_type,
        "vcpu": vcpu,
        "memory_gb": memory_gb,
        "unit": unit,
        "price_usd": price_usd,
        "tier_label": tier_label,
        "os": os,
        "storage": storage,
    }

AWS_STATIC_INSTANCES = [('t3.nano', 2, 0.5, 0.0052), ('t3.micro', 2, 1.0, 0.0104), ('t3.small', 2, 2.0, 0.0208), ('t3.medium', 2, 4.0, 0.0416), ('t3.large', 2, 8.0, 0.0832), ('t3.xlarge', 4, 16.0, 0.1664), ('t3.2xlarge', 8, 32.0, 0.3328), ('t4g.nano', 2, 0.5, 0.0042), ('t4g.micro', 2, 1.0, 0.0084), ('t4g.small', 2, 2.0, 0.0168), ('t4g.medium', 2, 4.0, 0.0336), ('t4g.large', 2, 8.0, 0.0672), ('t4g.xlarge', 4, 16.0, 0.1344), ('m5.large', 2, 8.0, 0.096), ('m5.xlarge', 4, 16.0, 0.192), ('m5.2xlarge', 8, 32.0, 0.384), ('m5.4xlarge', 16, 64.0, 0.768), ('m6i.large', 2, 8.0, 0.096), ('m6i.xlarge', 4, 16.0, 0.192), ('m6i.2xlarge', 8, 32.0, 0.384), ('c5.large', 2, 4.0, 0.085), ('c5.xlarge', 4, 8.0, 0.17), ('c5.2xlarge', 8, 16.0, 0.34), ('c5.4xlarge', 16, 32.0, 0.68), ('c6i.large', 2, 4.0, 0.085), ('c6i.xlarge', 4, 8.0, 0.17), ('c6i.2xlarge', 8, 16.0, 0.34), ('r5.large', 2, 16.0, 0.126), ('r5.xlarge', 4, 32.0, 0.252), ('r5.2xlarge', 8, 64.0, 0.504), ('r6i.large', 2, 16.0, 0.126), ('r6i.xlarge', 4, 32.0, 0.252), ('r6i.2xlarge', 8, 64.0, 0.504)]

AZURE_STATIC_INSTANCES = [('B1s', 1, 1.0, 0.0104), ('B2s', 2, 4.0, 0.0416), ('B2ms', 2, 8.0, 0.0832), ('B4ms', 4, 16.0, 0.1664), ('B8ms', 8, 32.0, 0.3328), ('D2s v3', 2, 8.0, 0.096), ('D4s v3', 4, 16.0, 0.192), ('D8s v3', 8, 32.0, 0.384), ('D16s v3', 16, 64.0, 0.768), ('D2s v5', 2, 8.0, 0.096), ('D4s v5', 4, 16.0, 0.192), ('D8s v5', 8, 32.0, 0.384), ('E2s v3', 2, 16.0, 0.126), ('E4s v3', 4, 32.0, 0.252), ('E8s v3', 8, 64.0, 0.504), ('F2s v2', 2, 4.0, 0.085), ('F4s v2', 4, 8.0, 0.17), ('F8s v2', 8, 16.0, 0.34)]

GCP_STATIC_INSTANCES = [('e2-micro', 1, 1.0, 0.0084), ('e2-small', 1, 2.0, 0.0168), ('e2-medium', 2, 4.0, 0.0335), ('e2-standard-2', 2, 8.0, 0.0671), ('e2-standard-4', 4, 16.0, 0.1342), ('e2-standard-8', 8, 32.0, 0.2684), ('e2-standard-16', 16, 64.0, 0.5368), ('e2-highmem-2', 2, 16.0, 0.0904), ('e2-highmem-4', 4, 32.0, 0.1808), ('e2-highcpu-2', 2, 2.0, 0.0497), ('e2-highcpu-4', 4, 4.0, 0.0994), ('n2-standard-2', 2, 8.0, 0.0971), ('n2-standard-4', 4, 16.0, 0.1942), ('n2-standard-8', 8, 32.0, 0.3884), ('n2-standard-16', 16, 64.0, 0.7768), ('n2-highmem-2', 2, 16.0, 0.131), ('n2-highmem-4', 4, 32.0, 0.262), ('n2-highcpu-2', 2, 2.0, 0.0717), ('n2-highcpu-4', 4, 4.0, 0.1434), ('c2-standard-4', 4, 16.0, 0.2088), ('c2-standard-8', 8, 32.0, 0.4176), ('c2-standard-16', 16, 64.0, 0.8352)]

NON_VM_STATIC_ENTRIES = [('AWS', 'Managed Kubernetes', 'EKS', 'control-plane', 'per hour', 0.1, 'Standard'), ('AWS', 'Managed Kubernetes', 'EKS', 'node-t3.medium', 'per hour', 0.0416, 'On-Demand'), ('AWS', 'Managed Kubernetes', 'EKS', 'node-m5.large', 'per hour', 0.096, 'On-Demand'), ('Azure', 'Managed Kubernetes', 'AKS', 'free-tier', 'per hour', 0.0, 'Free'), ('Azure', 'Managed Kubernetes', 'AKS', 'standard', 'per hour', 0.1, 'Standard'), ('Azure', 'Managed Kubernetes', 'AKS', 'premium', 'per hour', 0.2, 'Premium'), ('GCP', 'Managed Kubernetes', 'GKE', 'autopilot', 'per hour', 0.1, 'Autopilot'), ('GCP', 'Managed Kubernetes', 'GKE', 'standard', 'per hour', 0.1, 'Standard'), ('GCP', 'Managed Kubernetes', 'GKE', 'enterprise', 'per hour', 0.25, 'Enterprise'), ('AWS', 'Object Storage', 'S3', 'standard', 'per GB/month', 0.023, 'Standard'), ('AWS', 'Object Storage', 'S3', 'intelligent-tiering', 'per GB/month', 0.023, 'Intelligent-Tiering'), ('AWS', 'Object Storage', 'S3', 'glacier', 'per GB/month', 0.004, 'Glacier'), ('AWS', 'Object Storage', 'S3', 'deep-archive', 'per GB/month', 0.00099, 'Deep Archive'), ('Azure', 'Object Storage', 'Blob Storage', 'hot', 'per GB/month', 0.018, 'Hot'), ('Azure', 'Object Storage', 'Blob Storage', 'cool', 'per GB/month', 0.01, 'Cool'), ('Azure', 'Object Storage', 'Blob Storage', 'archive', 'per GB/month', 0.00099, 'Archive'), ('Azure', 'Object Storage', 'Blob Storage', 'premium', 'per GB/month', 0.15, 'Premium'), ('GCP', 'Object Storage', 'Cloud Storage', 'standard', 'per GB/month', 0.02, 'Standard'), ('GCP', 'Object Storage', 'Cloud Storage', 'nearline', 'per GB/month', 0.01, 'Nearline'), ('GCP', 'Object Storage', 'Cloud Storage', 'coldline', 'per GB/month', 0.004, 'Coldline'), ('GCP', 'Object Storage', 'Cloud Storage', 'archive', 'per GB/month', 0.0012, 'Archive'), ('AWS', 'Managed Databases', 'RDS', 'db.t3.micro', 'per hour', 0.017, 'On-Demand'), ('AWS', 'Managed Databases', 'RDS', 'db.t3.small', 'per hour', 0.034, 'On-Demand'), ('AWS', 'Managed Databases', 'RDS', 'db.t3.medium', 'per hour', 0.068, 'On-Demand'), ('AWS', 'Managed Databases', 'RDS', 'db.m5.large', 'per hour', 0.171, 'On-Demand'), ('AWS', 'Managed Databases', 'RDS', 'db.r5.large', 'per hour', 0.24, 'On-Demand'), ('Azure', 'Managed Databases', 'Azure SQL', 'Basic', 'per hour', 0.0067, 'Basic'), ('Azure', 'Managed Databases', 'Azure SQL', 'S1', 'per hour', 0.03, 'Standard'), ('Azure', 'Managed Databases', 'Azure SQL', 'S2', 'per hour', 0.075, 'Standard'), ('Azure', 'Managed Databases', 'Azure SQL', 'GP-2vcore', 'per hour', 0.368, 'General Purpose'), ('Azure', 'Managed Databases', 'Azure SQL', 'BC-2vcore', 'per hour', 1.006, 'Business Critical'), ('GCP', 'Managed Databases', 'Cloud SQL', 'db-f1-micro', 'per hour', 0.015, 'On-Demand'), ('GCP', 'Managed Databases', 'Cloud SQL', 'db-g1-small', 'per hour', 0.05, 'On-Demand'), ('GCP', 'Managed Databases', 'Cloud SQL', 'db-n1-standard-1', 'per hour', 0.0965, 'On-Demand'), ('GCP', 'Managed Databases', 'Cloud SQL', 'db-n1-standard-2', 'per hour', 0.193, 'On-Demand'), ('AWS', 'Container Registry', 'ECR', 'standard', 'per GB/month', 0.1, 'Standard'), ('AWS', 'Container Registry', 'ECR', 'private', 'per GB/month', 0.1, 'Private'), ('Azure', 'Container Registry', 'ACR', 'basic', 'per GB/month', 0.167, 'Basic'), ('Azure', 'Container Registry', 'ACR', 'standard', 'per GB/month', 0.667, 'Standard'), ('Azure', 'Container Registry', 'ACR', 'premium', 'per GB/month', 1.667, 'Premium'), ('GCP', 'Container Registry', 'Artifact Registry', 'standard', 'per GB/month', 0.1, 'Standard'), ('GCP', 'Container Registry', 'Artifact Registry', 'premium', 'per GB/month', 0.2, 'Premium'), ('AWS', 'Load Balancers', 'ALB', 'alb-standard', 'per hour', 0.008, 'On-Demand'), ('AWS', 'Load Balancers', 'NLB', 'nlb-standard', 'per hour', 0.006, 'On-Demand'), ('AWS', 'Load Balancers', 'CLB', 'clb-standard', 'per hour', 0.025, 'On-Demand'), ('Azure', 'Load Balancers', 'Azure LB', 'basic', 'per hour', 0.0, 'Basic'), ('Azure', 'Load Balancers', 'Azure LB', 'standard', 'per hour', 0.005, 'Standard'), ('Azure', 'Load Balancers', 'Azure LB', 'gateway', 'per hour', 0.01, 'Gateway'), ('GCP', 'Load Balancers', 'Cloud LB', 'https', 'per hour', 0.008, 'On-Demand'), ('GCP', 'Load Balancers', 'Cloud LB', 'tcp-ssl', 'per hour', 0.008, 'On-Demand'), ('GCP', 'Load Balancers', 'Cloud LB', 'internal', 'per hour', 0.008, 'On-Demand'), ('AWS', 'Serverless Functions', 'Lambda', 'first-1M-free', 'per million invocations', 0.0, 'Free Tier'), ('AWS', 'Serverless Functions', 'Lambda', 'standard', 'per million invocations', 0.2, 'Pay-as-you-go'), ('AWS', 'Serverless Functions', 'Lambda', 'provisioned', 'per million invocations', 0.4, 'Provisioned'), ('Azure', 'Serverless Functions', 'Azure Functions', 'consumption', 'per million invocations', 0.2, 'Consumption'), ('Azure', 'Serverless Functions', 'Azure Functions', 'premium', 'per hour', 0.173, 'Premium'), ('Azure', 'Serverless Functions', 'Azure Functions', 'dedicated', 'per million invocations', 0.1, 'Dedicated'), ('GCP', 'Serverless Functions', 'Cloud Functions', 'gen1', 'per million invocations', 0.4, 'Gen1'), ('GCP', 'Serverless Functions', 'Cloud Functions', 'gen2', 'per million invocations', 0.4, 'Gen2'), ('GCP', 'Serverless Functions', 'Cloud Functions', 'min-instances', 'per instance-hour', 2e-05, 'Min Instances'), ('AWS', 'CDN', 'CloudFront', 'first-10TB', 'per GB egress', 0.0085, 'On-Demand'), ('AWS', 'CDN', 'CloudFront', 'next-40TB', 'per GB egress', 0.008, 'On-Demand'), ('AWS', 'CDN', 'CloudFront', 'next-100TB', 'per GB egress', 0.006, 'On-Demand'), ('Azure', 'CDN', 'Azure CDN', 'standard-microsoft', 'per GB egress', 0.0075, 'Standard'), ('Azure', 'CDN', 'Azure CDN', 'standard-akamai', 'per GB egress', 0.0075, 'Standard'), ('Azure', 'CDN', 'Azure CDN', 'premium-verizon', 'per GB egress', 0.017, 'Premium'), ('GCP', 'CDN', 'Cloud CDN', 'first-10TB', 'per GB egress', 0.008, 'On-Demand'), ('GCP', 'CDN', 'Cloud CDN', 'next-90TB', 'per GB egress', 0.006, 'On-Demand'), ('GCP', 'CDN', 'Cloud CDN', 'next-400TB', 'per GB egress', 0.005, 'On-Demand'), ('AWS', 'VPC / Networking', 'NAT Gateway', 'nat-gateway', 'per hour', 0.045, 'On-Demand'), ('AWS', 'VPC / Networking', 'VPN Gateway', 'vpn-gateway', 'per hour', 0.05, 'On-Demand'), ('AWS', 'VPC / Networking', 'Transit Gateway', 'transit-gateway', 'per hour', 0.05, 'On-Demand'), ('Azure', 'VPC / Networking', 'NAT Gateway', 'nat-gateway', 'per hour', 0.045, 'Standard'), ('Azure', 'VPC / Networking', 'VPN Gateway', 'vpn-basic', 'per hour', 0.027, 'Basic'), ('Azure', 'VPC / Networking', 'VPN Gateway', 'vpn-vpngw1', 'per hour', 0.19, 'VpnGw1'), ('GCP', 'VPC / Networking', 'Cloud NAT', 'cloud-nat', 'per hour', 0.044, 'On-Demand'), ('GCP', 'VPC / Networking', 'Cloud VPN', 'cloud-vpn', 'per hour', 0.05, 'On-Demand'), ('GCP', 'VPC / Networking', 'Cloud Router', 'cloud-router', 'per hour', 0.01, 'On-Demand'), ('AWS', 'Networking Egress', 'Data Transfer', 'internet', 'per GB', 0.09, 'Standard'), ('AWS', 'Networking Egress', 'Data Transfer', 'inter-region', 'per GB', 0.02, 'Standard'), ('AWS', 'Networking Egress', 'Data Transfer', 'same-region', 'per GB', 0.0, 'Free'), ('Azure', 'Networking Egress', 'Bandwidth', 'internet', 'per GB', 0.087, 'Standard'), ('Azure', 'Networking Egress', 'Bandwidth', 'inter-region', 'per GB', 0.02, 'Standard'), ('Azure', 'Networking Egress', 'Bandwidth', 'same-region', 'per GB', 0.0, 'Free'), ('GCP', 'Networking Egress', 'Network Egress', 'internet', 'per GB', 0.08, 'Standard'), ('GCP', 'Networking Egress', 'Network Egress', 'inter-region', 'per GB', 0.01, 'Standard'), ('GCP', 'Networking Egress', 'Network Egress', 'same-region', 'per GB', 0.0, 'Free'), ('AWS', 'Managed Cache', 'ElastiCache', 'cache.t3.micro', 'per hour', 0.017, 'On-Demand'), ('AWS', 'Managed Cache', 'ElastiCache', 'cache.t3.small', 'per hour', 0.034, 'On-Demand'), ('AWS', 'Managed Cache', 'ElastiCache', 'cache.r6g.large', 'per hour', 0.166, 'On-Demand'), ('Azure', 'Managed Cache', 'Azure Cache for Redis', 'C0', 'per hour', 0.022, 'Basic'), ('Azure', 'Managed Cache', 'Azure Cache for Redis', 'C1', 'per hour', 0.055, 'Standard'), ('Azure', 'Managed Cache', 'Azure Cache for Redis', 'C2', 'per hour', 0.185, 'Standard'), ('Azure', 'Managed Cache', 'Azure Cache for Redis', 'P1', 'per hour', 0.554, 'Premium'), ('GCP', 'Managed Cache', 'Memorystore', 'M1', 'per hour', 0.049, 'Standard'), ('GCP', 'Managed Cache', 'Memorystore', 'M2', 'per hour', 0.098, 'Standard'), ('GCP', 'Managed Cache', 'Memorystore', 'M3', 'per hour', 0.196, 'Standard'), ('GCP', 'Managed Cache', 'Memorystore', 'M4', 'per hour', 0.392, 'Standard'), ('AWS', 'Messaging & Queues', 'SQS', 'standard', 'per million messages', 0.4, 'Standard'), ('AWS', 'Messaging & Queues', 'SQS', 'fifo', 'per million messages', 0.5, 'FIFO'), ('Azure', 'Messaging & Queues', 'Service Bus', 'basic', 'per million messages', 0.05, 'Basic'), ('Azure', 'Messaging & Queues', 'Service Bus', 'standard', 'per million messages', 0.1, 'Standard'), ('Azure', 'Messaging & Queues', 'Service Bus', 'premium', 'per hour', 0.928, 'Premium'), ('GCP', 'Messaging & Queues', 'Cloud Pub/Sub', 'first-10GB-free', 'per million messages', 0.0, 'Free Tier'), ('GCP', 'Messaging & Queues', 'Cloud Pub/Sub', 'standard', 'per million messages', 0.04, 'Standard'), ('GCP', 'Messaging & Queues', 'Cloud Pub/Sub', 'snapshot', 'per million messages', 0.04, 'Snapshot'), ('AWS', 'Managed Kafka / Streaming', 'MSK', 'kafka.t3.small', 'per hour', 0.054, 'On-Demand'), ('AWS', 'Managed Kafka / Streaming', 'MSK', 'kafka.m5.large', 'per hour', 0.21, 'On-Demand'), ('AWS', 'Managed Kafka / Streaming', 'MSK', 'kafka.m5.xlarge', 'per hour', 0.42, 'On-Demand'), ('Azure', 'Managed Kafka / Streaming', 'Event Hubs', 'basic', 'per hour', 0.015, 'Basic'), ('Azure', 'Managed Kafka / Streaming', 'Event Hubs', 'standard', 'per hour', 0.015, 'Standard'), ('Azure', 'Managed Kafka / Streaming', 'Event Hubs', 'premium', 'per hour', 0.926, 'Premium'), ('Azure', 'Managed Kafka / Streaming', 'Event Hubs', 'dedicated', 'per hour', 6.806, 'Dedicated'), ('GCP', 'Managed Kafka / Streaming', 'Pub/Sub Streaming', 'per-GB', 'per GB', 0.06, 'Pay-as-you-go'), ('GCP', 'Managed Kafka / Streaming', 'Pub/Sub Streaming', 'throughput-unit', 'per hour', 0.5, 'Throughput Unit'), ('AWS', 'Block Storage (Disks)', 'EBS', 'gp2', 'per GB/month', 0.1, 'General Purpose'), ('AWS', 'Block Storage (Disks)', 'EBS', 'gp3', 'per GB/month', 0.08, 'General Purpose'), ('AWS', 'Block Storage (Disks)', 'EBS', 'io1', 'per GB/month', 0.125, 'Provisioned IOPS'), ('AWS', 'Block Storage (Disks)', 'EBS', 'st1', 'per GB/month', 0.045, 'Throughput Optimized'), ('AWS', 'Block Storage (Disks)', 'EBS', 'sc1', 'per GB/month', 0.025, 'Cold HDD'), ('Azure', 'Block Storage (Disks)', 'Managed Disks', 'standard-HDD', 'per GB/month', 0.04, 'Standard HDD'), ('Azure', 'Block Storage (Disks)', 'Managed Disks', 'standard-SSD', 'per GB/month', 0.096, 'Standard SSD'), ('Azure', 'Block Storage (Disks)', 'Managed Disks', 'premium-SSD', 'per GB/month', 0.17, 'Premium SSD'), ('Azure', 'Block Storage (Disks)', 'Managed Disks', 'ultra', 'per GB/month', 0.125, 'Ultra Disk'), ('GCP', 'Block Storage (Disks)', 'Persistent Disk', 'standard', 'per GB/month', 0.04, 'Standard'), ('GCP', 'Block Storage (Disks)', 'Persistent Disk', 'balanced', 'per GB/month', 0.1, 'Balanced'), ('GCP', 'Block Storage (Disks)', 'Persistent Disk', 'ssd', 'per GB/month', 0.17, 'SSD'), ('GCP', 'Block Storage (Disks)', 'Persistent Disk', 'extreme', 'per GB/month', 0.125, 'Extreme'), ('AWS', 'Monitoring & Logging', 'CloudWatch', 'logs', 'per GB ingested', 0.5, 'Pay-as-you-go'), ('AWS', 'Monitoring & Logging', 'CloudWatch', 'metrics', 'per GB ingested', 0.3, 'Pay-as-you-go'), ('AWS', 'Monitoring & Logging', 'CloudWatch', 'dashboards', 'per dashboard/month', 3.0, 'Pay-as-you-go'), ('Azure', 'Monitoring & Logging', 'Azure Monitor', 'logs', 'per GB ingested', 0.25, 'Pay-as-you-go'), ('Azure', 'Monitoring & Logging', 'Azure Monitor', 'metrics', 'per GB ingested', 0.1, 'Pay-as-you-go'), ('Azure', 'Monitoring & Logging', 'Azure Monitor', 'alerts', 'per rule/month', 0.1, 'Pay-as-you-go'), ('GCP', 'Monitoring & Logging', 'Cloud Logging', 'first-50GB-free', 'per GB ingested', 0.0, 'Free Tier'), ('GCP', 'Monitoring & Logging', 'Cloud Logging', 'standard', 'per GB ingested', 0.01, 'Standard'), ('GCP', 'Monitoring & Logging', 'Cloud Logging', 'long-term', 'per GB ingested', 0.01, 'Long-term'), ('AWS', 'Secret Management', 'Secrets Manager', 'standard', 'per secret/month', 0.4, 'Pay-as-you-go'), ('AWS', 'Secret Management', 'Secrets Manager', 'rotation', 'per rotation', 0.05, 'Pay-as-you-go'), ('Azure', 'Secret Management', 'Key Vault', 'standard', 'per secret/month', 0.03, 'Standard'), ('Azure', 'Secret Management', 'Key Vault', 'premium', 'per secret/month', 0.06, 'Premium'), ('Azure', 'Secret Management', 'Key Vault', 'hsm', 'per key/month', 1.6, 'HSM'), ('GCP', 'Secret Management', 'Secret Manager', 'standard', 'per secret/month', 0.06, 'Pay-as-you-go'), ('GCP', 'Secret Management', 'Secret Manager', 'access', 'per 10K accesses', 0.03, 'Pay-as-you-go'), ('AWS', 'Data Warehousing', 'Redshift', 'dc2.large', 'per hour', 0.25, 'On-Demand'), ('AWS', 'Data Warehousing', 'Redshift', 'dc2.8xlarge', 'per hour', 4.8, 'On-Demand'), ('AWS', 'Data Warehousing', 'Redshift', 'ra3.xlplus', 'per hour', 1.086, 'On-Demand'), ('Azure', 'Data Warehousing', 'Synapse Analytics', 'serverless', 'per TB queried', 5.0, 'Serverless'), ('Azure', 'Data Warehousing', 'Synapse Analytics', 'dedicated-DW100c', 'per hour', 1.2, 'Dedicated'), ('Azure', 'Data Warehousing', 'Synapse Analytics', 'dedicated-DW500c', 'per hour', 6.0, 'Dedicated'), ('GCP', 'Data Warehousing', 'BigQuery', 'on-demand', 'per TB queried', 5.0, 'On-Demand'), ('GCP', 'Data Warehousing', 'BigQuery', 'flat-rate-100slots', 'per month', 2000.0, 'Flat Rate'), ('GCP', 'Data Warehousing', 'BigQuery', 'bi-engine', 'per GB/hour', 0.04, 'BI Engine'), ('AWS', 'DNS', 'Route 53', 'hosted-zone', 'per hosted zone/month', 0.5, 'Standard'), ('AWS', 'DNS', 'Route 53', 'health-check', 'per check/month', 0.5, 'Standard'), ('AWS', 'DNS', 'Route 53', 'traffic-policy', 'per policy/month', 50.0, 'Standard'), ('Azure', 'DNS', 'Azure DNS', 'public-zone', 'per hosted zone/month', 0.5, 'Standard'), ('Azure', 'DNS', 'Azure DNS', 'private-zone', 'per hosted zone/month', 0.5, 'Private'), ('Azure', 'DNS', 'Azure DNS', 'resolver', 'per hosted zone/month', 0.3, 'Resolver'), ('GCP', 'DNS', 'Cloud DNS', 'public-zone', 'per hosted zone/month', 0.2, 'Standard'), ('GCP', 'DNS', 'Cloud DNS', 'dnssec', 'per hosted zone/month', 0.1, 'DNSSEC'), ('GCP', 'DNS', 'Cloud DNS', 'private-zone', 'per hosted zone/month', 0.1, 'Private'), ('AWS', 'Email / Notifications', 'SES', 'standard', 'per million emails', 0.1, 'Pay-as-you-go'), ('AWS', 'Email / Notifications', 'SNS', 'standard', 'per million messages', 0.5, 'Pay-as-you-go'), ('AWS', 'Email / Notifications', 'SES', 'dedicated-IP', 'per month', 24.95, 'Dedicated IP'), ('Azure', 'Email / Notifications', 'Communication Services', 'email', 'per million emails', 0.85, 'Pay-as-you-go'), ('Azure', 'Email / Notifications', 'Communication Services', 'sms', 'per message', 0.0075, 'Pay-as-you-go'), ('Azure', 'Email / Notifications', 'Communication Services', 'voice', 'per minute', 0.013, 'Pay-as-you-go'), ('GCP', 'Email / Notifications', 'Pub/Sub Notifications', 'standard', 'per million messages', 0.04, 'Pay-as-you-go'), ('GCP', 'Email / Notifications', 'Firebase Cloud Messaging', 'free', 'per million messages', 0.0, 'Free'), ('AWS', 'API Gateway', 'API Gateway', 'rest', 'per million API calls', 3.5, 'REST'), ('AWS', 'API Gateway', 'API Gateway', 'http', 'per million API calls', 1.0, 'HTTP'), ('AWS', 'API Gateway', 'API Gateway', 'websocket', 'per million API calls', 1.0, 'WebSocket'), ('Azure', 'API Gateway', 'API Management', 'consumption', 'per million API calls', 0.35, 'Consumption'), ('Azure', 'API Gateway', 'API Management', 'developer', 'per hour', 0.07, 'Developer'), ('Azure', 'API Gateway', 'API Management', 'basic', 'per hour', 0.14, 'Basic'), ('GCP', 'API Gateway', 'Cloud Endpoints', 'standard', 'per million API calls', 3.0, 'Standard'), ('GCP', 'API Gateway', 'API Gateway', 'standard', 'per million API calls', 3.5, 'Standard'), ('GCP', 'API Gateway', 'Apigee', 'standard', 'per 1K calls', 0.03, 'Standard'), ('AWS', 'Container Orchestration (Serverless)', 'ECS Fargate', 'fargate-standard', 'per vCPU/hour', 0.04048, 'On-Demand'), ('AWS', 'Container Orchestration (Serverless)', 'ECS Fargate', 'fargate-spot', 'per vCPU/hour', 0.01218, 'Spot'), ('AWS', 'Container Orchestration (Serverless)', 'ECS Fargate', 'fargate-windows', 'per vCPU/hour', 0.09148, 'Windows'), ('Azure', 'Container Orchestration (Serverless)', 'Container Instances', 'linux', 'per vCPU-second', 1.35e-05, 'Linux'), ('Azure', 'Container Orchestration (Serverless)', 'Container Instances', 'windows', 'per vCPU-second', 1.49e-05, 'Windows'), ('GCP', 'Container Orchestration (Serverless)', 'Cloud Run', 'standard', 'per vCPU-second', 2.4e-05, 'Pay-as-you-go'), ('GCP', 'Container Orchestration (Serverless)', 'Cloud Run', 'min-instances', 'per vCPU-second', 2.4e-05, 'Min Instances'), ('GCP', 'Container Orchestration (Serverless)', 'Cloud Run', 'always-on', 'per vCPU-second', 4.8e-05, 'Always On'), ('AWS', 'Identity & Access (IAM)', 'Cognito', 'first-50K-free', 'per MAU', 0.0, 'Free Tier'), ('AWS', 'Identity & Access (IAM)', 'Cognito', 'standard', 'per MAU', 0.0055, 'Pay-as-you-go'), ('AWS', 'Identity & Access (IAM)', 'Cognito', 'advanced-security', 'per MAU', 0.05, 'Advanced Security'), ('Azure', 'Identity & Access (IAM)', 'Azure AD B2C', 'first-50K-free', 'per MAU', 0.0, 'Free Tier'), ('Azure', 'Identity & Access (IAM)', 'Azure AD B2C', 'standard', 'per MAU', 0.0016, 'Pay-as-you-go'), ('Azure', 'Identity & Access (IAM)', 'Azure AD B2C', 'mfa', 'per auth', 0.03, 'MFA'), ('GCP', 'Identity & Access (IAM)', 'Cloud Identity', 'free', 'per MAU', 0.0, 'Free'), ('GCP', 'Identity & Access (IAM)', 'Cloud Identity', 'premium', 'per MAU', 0.003, 'Premium'), ('GCP', 'Identity & Access (IAM)', 'Cloud Identity', 'enterprise', 'per MAU', 0.006, 'Enterprise'), ('AWS', 'CI/CD Pipeline', 'CodePipeline', 'pipeline', 'per pipeline/month', 1.0, 'Standard'), ('AWS', 'CI/CD Pipeline', 'CodeBuild', 'build-min', 'per build-minute', 0.005, 'Pay-as-you-go'), ('Azure', 'CI/CD Pipeline', 'Azure DevOps', 'free-tier', 'per build-minute', 0.0, 'Free'), ('Azure', 'CI/CD Pipeline', 'Azure DevOps', 'standard', 'per build-minute', 0.008, 'Pay-as-you-go'), ('Azure', 'CI/CD Pipeline', 'Azure DevOps', 'hosted-parallel', 'per month', 40.0, 'Hosted Parallel'), ('GCP', 'CI/CD Pipeline', 'Cloud Build', 'first-120min-free', 'per build-minute', 0.0, 'Free Tier'), ('GCP', 'CI/CD Pipeline', 'Cloud Build', 'standard', 'per build-minute', 0.003, 'Standard'), ('GCP', 'CI/CD Pipeline', 'Cloud Build', 'premium', 'per build-minute', 0.006, 'Premium'), ('AWS', 'Artifact / Package Registry', 'CodeArtifact', 'storage', 'per GB/month', 0.05, 'Standard'), ('AWS', 'Artifact / Package Registry', 'CodeArtifact', 'requests', 'per 10K requests', 0.05, 'Standard'), ('Azure', 'Artifact / Package Registry', 'Azure Artifacts', 'standard', 'per GB/month', 2.0, 'Standard'), ('Azure', 'Artifact / Package Registry', 'Azure Artifacts', 'first-2GB-free', 'per GB/month', 0.0, 'Free Tier'), ('GCP', 'Artifact / Package Registry', 'Artifact Registry', 'standard', 'per GB/month', 0.1, 'Standard'), ('GCP', 'Artifact / Package Registry', 'Artifact Registry', 'premium', 'per GB/month', 0.2, 'Premium'), ('AWS', 'Machine Learning Platform', 'SageMaker', 'ml.t3.medium', 'per hour', 0.046, 'On-Demand'), ('AWS', 'Machine Learning Platform', 'SageMaker', 'ml.m5.xlarge', 'per hour', 0.269, 'On-Demand'), ('AWS', 'Machine Learning Platform', 'SageMaker', 'ml.p3.2xlarge', 'per hour', 3.825, 'On-Demand'), ('Azure', 'Machine Learning Platform', 'Azure ML', 'DS3_v2', 'per hour', 0.251, 'Pay-as-you-go'), ('Azure', 'Machine Learning Platform', 'Azure ML', 'NC6', 'per hour', 0.9, 'Pay-as-you-go'), ('Azure', 'Machine Learning Platform', 'Azure ML', 'NC12', 'per hour', 1.8, 'Pay-as-you-go'), ('Azure', 'Machine Learning Platform', 'Azure ML', 'A100', 'per hour', 3.4, 'Pay-as-you-go'), ('GCP', 'Machine Learning Platform', 'Vertex AI', 'n1-standard-4', 'per hour', 0.19, 'On-Demand'), ('GCP', 'Machine Learning Platform', 'Vertex AI', 'n1-standard-8', 'per hour', 0.38, 'On-Demand'), ('GCP', 'Machine Learning Platform', 'Vertex AI', 'a2-highgpu-1g', 'per hour', 3.673, 'On-Demand'), ('AWS', 'Backup & Disaster Recovery', 'AWS Backup', 'warm', 'per GB/month', 0.05, 'Warm'), ('AWS', 'Backup & Disaster Recovery', 'AWS Backup', 'cold', 'per GB/month', 0.01, 'Cold'), ('AWS', 'Backup & Disaster Recovery', 'AWS Backup', 'restore', 'per GB', 0.02, 'Restore'), ('Azure', 'Backup & Disaster Recovery', 'Azure Backup', 'lrs', 'per GB/month', 0.02, 'LRS'), ('Azure', 'Backup & Disaster Recovery', 'Azure Backup', 'grs', 'per GB/month', 0.04, 'GRS'), ('Azure', 'Backup & Disaster Recovery', 'Azure Backup', 'mabs', 'per GB/month', 0.1, 'MABS'), ('GCP', 'Backup & Disaster Recovery', 'Cloud Backup', 'standard', 'per GB/month', 0.023, 'Standard'), ('GCP', 'Backup & Disaster Recovery', 'Cloud Backup', 'archive', 'per GB/month', 0.012, 'Archive'), ('GCP', 'Backup & Disaster Recovery', 'Cloud Backup', 'snapshot', 'per GB/month', 0.026, 'Snapshot'), ('AWS', 'File Storage (NFS/SMB)', 'EFS', 'standard', 'per GB/month', 0.3, 'Standard'), ('AWS', 'File Storage (NFS/SMB)', 'EFS', 'infrequent-access', 'per GB/month', 0.025, 'Infrequent Access'), ('AWS', 'File Storage (NFS/SMB)', 'EFS', 'one-zone', 'per GB/month', 0.16, 'One Zone'), ('Azure', 'File Storage (NFS/SMB)', 'Azure Files', 'standard-LRS', 'per GB/month', 0.06, 'Standard LRS'), ('Azure', 'File Storage (NFS/SMB)', 'Azure Files', 'premium-LRS', 'per GB/month', 0.26, 'Premium LRS'), ('Azure', 'File Storage (NFS/SMB)', 'Azure Files', 'standard-GRS', 'per GB/month', 0.08, 'Standard GRS'), ('GCP', 'File Storage (NFS/SMB)', 'Filestore', 'basic-HDD', 'per GB/month', 0.2, 'Basic HDD'), ('GCP', 'File Storage (NFS/SMB)', 'Filestore', 'basic-SSD', 'per GB/month', 0.3, 'Basic SSD'), ('GCP', 'File Storage (NFS/SMB)', 'Filestore', 'high-scale-SSD', 'per GB/month', 0.35, 'High Scale SSD')]

def _get_granular_static_fallback() -> list:
    """Return the full static fallback catalog - all 27 service categories across AWS, Azure, GCP."""
    entries = []
    # -- Compute (VMs) --
    for (it, vcpu, mem, price) in AWS_STATIC_INSTANCES:
        entries.append(_make_instance(
            "AWS", "Compute (VMs)", f"EC2 {it}", it,
            vcpu, mem, "per hour", price, "On-Demand", "Linux"
        ))
    for (it, vcpu, mem, price) in AZURE_STATIC_INSTANCES:
        entries.append(_make_instance(
            "Azure", "Compute (VMs)", f"Azure VM {it}", it,
            vcpu, mem, "per hour", price, "Pay-as-you-go", "Linux"
        ))
    for (it, vcpu, mem, price) in GCP_STATIC_INSTANCES:
        entries.append(_make_instance(
            "GCP", "Compute (VMs)", f"Compute Engine {it}", it,
            vcpu, mem, "per hour", price, "On-Demand", "Linux"
        ))
    # -- All other service categories (non-VM) --
    for (prov, cat, svc, it, unit, price, tier) in NON_VM_STATIC_ENTRIES:
        entries.append(_make_instance(
            prov, cat, f"{svc} {it}", it,
            0, 0.0, unit, price, tier
        ))
    return entries

# -- Provider fetch functions --

AZURE_BASE_URL = "https://prices.azure.com/api/retail/prices"
AZURE_VM_SERIES_PATTERN = re.compile(r'^[BDEF]\d+', re.IGNORECASE)

async def fetch_azure_granular(client) -> list:
    """Fetch Azure VM SKUs from the Retail Prices API, then append non-VM static entries."""
    entries = []
    queries = [("Compute (VMs)", "serviceName eq 'Virtual Machines' and armRegionName eq 'eastus' and priceType eq 'Consumption'")]
    for category, filter_query in queries:
        url = AZURE_BASE_URL
        params = {"api-version": "2023-01-01-preview", "$filter": filter_query}
        hops = 0
        while url and hops < 4:
            try:
                resp = await client.get(url, params=params if hops == 0 else None, timeout=15.0)
                resp.raise_for_status()
                data = resp.json()
                items = data.get("Items", [])
                for item in items:
                    sku_name = item.get("skuName", "")
                    price = item.get("retailPrice", 0) or item.get("unitPrice", 0)
                    if not price or price <= 0: continue
                    if not AZURE_VM_SERIES_PATTERN.match(sku_name): continue
                    vcpu, memory_gb = parseAzureSkuSpecs(sku_name)
                    if vcpu == 0: continue
                    entries.append(_make_instance("Azure", category, f"Azure VM {sku_name}", sku_name, vcpu, memory_gb, item.get("unitOfMeasure", "per hour"), price, "Pay-as-you-go", "Linux"))
                url = data.get("NextPageLink")
                params = None
                hops += 1
            except Exception as e:
                logger.warning(f"Azure granular fetch failed (hop {hops}): {e}")
                break
    # Append non-VM static entries for Azure
    non_vm_azure = [e for e in _get_granular_static_fallback() if e["provider"] == "Azure" and e["category"] != "Compute (VMs)"]
    seen = {(e["category"], e["instance_type"]) for e in entries}
    for e in non_vm_azure:
        key = (e["category"], e["instance_type"])
        if key not in seen:
            entries.append(e)
            seen.add(key)
    return entries

async def fetch_aws_granular(client) -> list:
    """Fetch AWS EC2 instance pricing. Falls back to static table on failure. Appends non-VM static entries."""
    TARGET_FAMILIES = {'t3.', 't4g.', 'm5.', 'm6i.', 'c5.', 'c6i.', 'r5.', 'r6i.'}
    vm_entries = []
    try:
        resp = await client.get("https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonEC2/current/us-east-1/index.json", headers={"Range": "bytes=0-2097152"}, timeout=20.0)
        text = resp.text
        import re as _re
        seen = set()
        pattern = _re.compile(r'"instanceType"\s*:\s*"([^"]+)"[^}]*?"vcpu"\s*:\s*"([^"]+)"[^}]*?"memory"\s*:\s*"([^"]+)"', _re.DOTALL)
        for match in pattern.finditer(text):
            instance_type = match.group(1)
            vcpu_str = match.group(2)
            memory_str = match.group(3)
            if not any(instance_type.startswith(f) for f in TARGET_FAMILIES): continue
            if instance_type in seen: continue
            seen.add(instance_type)
            try: vcpu = int(vcpu_str.strip())
            except ValueError: continue
            memory_gb = parseAwsMemoryString(memory_str)
            if memory_gb <= 0: continue
            static_price = next((p for (it, v, m, p) in AWS_STATIC_INSTANCES if it == instance_type), None)
            if static_price is None: continue
            vm_entries.append(_make_instance("AWS", "Compute (VMs)", f"EC2 {instance_type}", instance_type, vcpu, memory_gb, "per hour", static_price, "On-Demand", "Linux"))
        if vm_entries:
            logger.info(f"AWS granular: extracted {len(vm_entries)} instances from pricing JSON")
    except Exception as e:
        logger.warning(f"AWS granular fetch failed: {e}, using static fallback")
    if not vm_entries:
        vm_entries = [e for e in _get_granular_static_fallback() if e["provider"] == "AWS" and e["category"] == "Compute (VMs)"]
    # Append non-VM static entries for AWS
    non_vm_aws = [e for e in _get_granular_static_fallback() if e["provider"] == "AWS" and e["category"] != "Compute (VMs)"]
    seen = {(e["category"], e["instance_type"]) for e in vm_entries}
    for e in non_vm_aws:
        key = (e["category"], e["instance_type"])
        if key not in seen:
            vm_entries.append(e)
            seen.add(key)
    return vm_entries

async def fetch_gcp_granular(client) -> list:
    """Fetch GCP Compute Engine instance pricing. Appends non-VM static entries."""
    vm_entries = []
    try:
        resp = await client.get("https://cloudpricingcalculator.appspot.com/static/data/pricelist.json", timeout=15.0)
        resp.raise_for_status()
        data = resp.json()
        gcp_prices = data.get("gcp_price_list", {})
        prefix = "CP-COMPUTEENGINE-VMIMAGE-"
        for key, value in gcp_prices.items():
            if not key.startswith(prefix): continue
            machine_type = key[len(prefix):].lower()
            vcpu, memory_gb = parseGcpMachineType(machine_type)
            if vcpu == 0: continue
            price = None
            if isinstance(value, dict): price = value.get("us") or value.get("us-east1")
            elif isinstance(value, (int, float)): price = float(value)
            if not price or price <= 0: continue
            vm_entries.append(_make_instance("GCP", "Compute (VMs)", f"Compute Engine {machine_type}", machine_type, vcpu, memory_gb, "per hour", float(price), "On-Demand", "Linux"))
        if vm_entries:
            logger.info(f"GCP granular: extracted {len(vm_entries)} instances")
    except Exception as e:
        logger.warning(f"GCP granular fetch failed: {e}, using static fallback")
    if not vm_entries:
        vm_entries = [e for e in _get_granular_static_fallback() if e["provider"] == "GCP" and e["category"] == "Compute (VMs)"]
    # Append non-VM static entries for GCP
    non_vm_gcp = [e for e in _get_granular_static_fallback() if e["provider"] == "GCP" and e["category"] != "Compute (VMs)"]
    seen = {(e["category"], e["instance_type"]) for e in vm_entries}
    for e in non_vm_gcp:
        key = (e["category"], e["instance_type"])
        if key not in seen:
            vm_entries.append(e)
            seen.add(key)
    return vm_entries

# -- Main public API --

async def get_live_catalog() -> list:
    """Fetch live granular pricing from all three providers concurrently. Falls back to static data per-provider on failure. Updates the in-memory catalog cache."""
    global _catalog_cache
    async with httpx.AsyncClient(follow_redirects=True, headers={"User-Agent": "DevOps-Command-Center/2.0 (granular-pricing)"}) as client:
        results = await asyncio.gather(fetch_aws_granular(client), fetch_azure_granular(client), fetch_gcp_granular(client), return_exceptions=True)
    all_entries = []
    source = "live"
    for i, result in enumerate(results):
        provider = ["AWS", "Azure", "GCP"][i]
        if isinstance(result, Exception):
            logger.error(f"{provider} granular fetch failed: {result}")
            fallback = [e for e in _get_granular_static_fallback() if e["provider"] == provider]
            all_entries.extend(fallback)
            source = "fallback"
        elif isinstance(result, list) and len(result) > 0:
            all_entries.extend(result)
        else:
            fallback = [e for e in _get_granular_static_fallback() if e["provider"] == provider]
            all_entries.extend(fallback)
            source = "fallback"
    _catalog_cache = GranularCatalogCache(entries=all_entries, fetched_at=datetime.now(timezone.utc), source=source)
    logger.info(f"Granular catalog sync complete: {len(all_entries)} entries, source={source}")
    return all_entries

async def get_cached_catalog() -> dict:
    """Return cached catalog if fresh (< 6 hours), otherwise fetch live. Returns: {entries, synced_at, source}"""
    if _catalog_is_fresh():
        return {
            "entries": _catalog_cache.entries,
            "synced_at": _catalog_cache.fetched_at.isoformat() if _catalog_cache.fetched_at else None,
            "source": "cache",
        }
    entries = await get_live_catalog()
    return {
        "entries": entries,
        "synced_at": _catalog_cache.fetched_at.isoformat() if _catalog_cache.fetched_at else None,
        "source": _catalog_cache.source,
    }
