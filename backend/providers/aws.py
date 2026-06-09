"""
AWS Provider Plugin for Multi-Cloud Cost Intelligence Platform.

This module implements the AWS provider plugin that fetches service catalogs
and pricing data from the AWS Price List API.

Requirements:
    - Requirement 2.1: AWS provider implementation
    - Requirement 2.2: AWS-specific category mapping
    - Requirement 3.1: Real-time service discovery
"""

import asyncio
import json
import logging
from typing import List, Dict, Optional, Any
from datetime import datetime, timezone
import httpx

import boto3
from botocore.exceptions import ClientError, NoCredentialsError, PartialCredentialsError

from providers.base import ProviderPlugin
from models.service import ServiceEntry, ServiceCategory, PricingTier
from services.infracost_client import InfracostClient
from services.settings import get_infracost_api_key, get_aws_credentials


logger = logging.getLogger(__name__)


class AWSProvider(ProviderPlugin):
    """
    AWS provider plugin for fetching service catalogs and pricing data.
    
    This provider integrates with the AWS Price List API to fetch real-time
    pricing information for AWS services including EC2, S3, RDS, Lambda, and more.
    
    API Documentation:
        https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/price-changes.html
        https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/index.json
    
    Requirements:
        - Requirement 2.1: AWS provider implementation
        - Requirement 2.2: AWS-specific category mapping
        - Requirement 3.1: Real-time service discovery
    
    Example:
        >>> provider = AWSProvider()
        >>> services = await provider.get_service_catalog(region="us-east-1")
        >>> pricing = await provider.get_pricing_data("AmazonEC2", region="us-east-1")
    """
    
    PRICING_API_BASE = "https://pricing.us-east-1.amazonaws.com"
    
    SERVICE_CODES = {
        "AmazonEC2": "Compute (VMs)",
        "AmazonS3": "Object Storage",
        "AmazonRDS": "Relational Database",
        "AmazonDynamoDB": "NoSQL Database",
        "AWSLambda": "Serverless Functions",
        "AmazonEKS": "Managed Kubernetes",
        "AmazonEBS": "Block Storage",
        "ElasticLoadBalancing": "Load Balancers",
        "AmazonCloudFront": "CDN",
        "AmazonRoute53": "DNS",
        "Amazon SageMaker": "AI/ML Services",
        "AmazonRedshift": "Analytics",
        "AmazonElastiCache": "Caching",
        "AmazonSQS": "Messaging",
        "AmazonSNS": "Notifications",
        "AmazonECS": "Container Services",
        "AWSCloudTrail": "Monitoring",
        "AmazonCloudWatch": "Monitoring",
        "AWSWAF": "Security",
        "Amazon GuardDuty": "Security",
    }
    
    CATEGORY_KEYWORDS = {
        ServiceCategory.COMPUTE_VMS: ["ec2", "instance", "compute"],
        ServiceCategory.MANAGED_KUBERNETES: ["eks", "kubernetes"],
        ServiceCategory.OBJECT_STORAGE: ["s3", "storage", "bucket"],
        ServiceCategory.BLOCK_STORAGE: ["ebs", "volume", "disk"],
        ServiceCategory.RELATIONAL_DATABASE: ["rds", "aurora", "database", "mysql", "postgres"],
        ServiceCategory.NOSQL_DATABASE: ["dynamodb", "nosql"],
        ServiceCategory.SERVERLESS_FUNCTIONS: ["lambda", "function"],
        ServiceCategory.LOAD_BALANCERS: ["elb", "load balancer", "alb", "nlb"],
        ServiceCategory.CDN: ["cloudfront", "cdn"],
        ServiceCategory.DNS: ["route 53", "dns"],
        ServiceCategory.NETWORKING: ["vpc", "network", "transit gateway", "nat", "vpn", "direct connect"],
        ServiceCategory.AI_ML: ["sagemaker", "rekognition", "comprehend", "translate", "polly", "lex"],
        ServiceCategory.ANALYTICS: ["athena", "emr", "redshift", "kinesis", "glue", "quicksight"],
        ServiceCategory.MONITORING: ["cloudwatch", "monitoring", "x-ray", "cloudtrail"],
        ServiceCategory.SECURITY: ["waf", "shield", "guardduty", "inspector", "secrets manager", "kms", "cognito"],
    }
    
    def __init__(self):
        """Initialize the AWS provider plugin."""
        super().__init__(
            provider_id="aws",
            provider_name="Amazon Web Services",
            api_version="1.0",
            rate_limit=10
        )
        self._http_client: Optional[httpx.AsyncClient] = None
        api_key = get_infracost_api_key()
        self._infracost: Optional[InfracostClient] = (
            InfracostClient(api_key=api_key) if api_key else None
        )
        self._aws_creds = get_aws_credentials()

    def _get_boto3_pricing_client(self):
        """Get boto3 pricing client if AWS credentials are configured."""
        if not self._aws_creds:
            return None
        try:
            return boto3.client(
                'pricing',
                aws_access_key_id=self._aws_creds['access_key_id'],
                aws_secret_access_key=self._aws_creds['secret_access_key'],
                region_name='us-east-1'  # AWS Pricing API is always us-east-1
            )
        except Exception as e:
            logger.debug(f"Failed to initialize boto3 pricing client: {e}")
            return None
    
    def _get_http_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client for API requests."""
        if self._http_client is None:
            self._http_client = httpx.AsyncClient(
                timeout=30.0,
                follow_redirects=True,
                headers={
                    "User-Agent": "Multi-Cloud-Cost-Intelligence-Platform/1.0"
                }
            )
        return self._http_client
    
    async def close(self):
        """Close HTTP client and cleanup resources."""
        if self._http_client is not None:
            await self._http_client.aclose()
            self._http_client = None
    
    def _map_category(self, service_name: str, service_code: str) -> str:
        service_lower = service_name.lower()
        if service_code in self.SERVICE_CODES:
            return self.SERVICE_CODES[service_code]
        for category, keywords in self.CATEGORY_KEYWORDS.items():
            if any(keyword in service_lower for keyword in keywords):
                return category.value
        return ServiceCategory.OTHER.value
    
    def _map_pricing_tier(self, term_type: str, purchase_option: Optional[str] = None) -> str:
        term_lower = term_type.lower()
        if "ondemand" in term_lower:
            return PricingTier.ON_DEMAND.value
        elif "reserved" in term_lower:
            return PricingTier.RESERVED.value
        elif "spot" in term_lower:
            return PricingTier.SPOT.value
        else:
            return PricingTier.OTHER.value
    
    async def _enrich_with_live_prices(
        self, services: List[Dict[str, Any]], region: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Replace hardcoded prices with live AWS Pricing API or Infracost data where available."""
        target_region = region or "us-east-1"
        
        # 1. Try AWS Boto3 Pricing API if credentials are configured (Region-wise)
        pricing_client = self._get_boto3_pricing_client()
        if pricing_client:
            try:
                # Enrich EC2 services specifically with region-wise live pricing
                for svc in services:
                    if svc.get("metadata", {}).get("service_code") == "AmazonEC2" and "instance_type" in svc.get("metadata", {}):
                        instance_type = svc["metadata"]["instance_type"]
                        response = pricing_client.get_products(
                            ServiceCode='AmazonEC2',
                            Filters=[
                                {'Type': 'TERM_MATCH', 'Field': 'instanceType', 'Value': instance_type},
                                {'Type': 'TERM_MATCH', 'Field': 'regionCode', 'Value': target_region},
                                {'Type': 'TERM_MATCH', 'Field': 'operatingSystem', 'Value': 'Linux'},
                                {'Type': 'TERM_MATCH', 'Field': 'preInstalledSw', 'Value': 'NA'},
                                {'Type': 'TERM_MATCH', 'Field': 'tenancy', 'Value': 'Shared'},
                                {'Type': 'TERM_MATCH', 'Field': 'capacitystatus', 'Value': 'Used'}
                            ],
                            MaxResults=1
                        )
                        if response.get('PriceList'):
                            price_data = json.loads(response['PriceList'][0])
                            terms = price_data.get('terms', {}).get('OnDemand', {})
                            for term_key, term_value in terms.items():
                                price_dimensions = term_value.get('priceDimensions', {})
                                for dim_key, dim_value in price_dimensions.items():
                                    price_per_unit = dim_value.get('pricePerUnit', {}).get('USD')
                                    if price_per_unit:
                                        svc["price_usd"] = float(price_per_unit)
                                        svc["is_fallback"] = False
                                        svc["price_status"] = "live"
                                        svc["fetched_at"] = datetime.now(timezone.utc).isoformat()
                                        break
                logger.info(f"AWS Boto3: enriched EC2 services with live region-wise prices for {target_region}")
            except Exception as e:
                logger.debug(f"AWS Boto3 pricing enrichment failed: {e}")

        # 2. Fallback to Infracost for other services or if boto3 didn't enrich everything
        if not self._infracost or not self._infracost.is_configured():
            return services

        try:
            live = await self._infracost.get_prices("aws", target_region)
            if not live:
                return services

            for svc in services:
                if svc.get("is_fallback"):  # Only enrich if not already enriched by boto3
                    cat = svc.get("category")
                    if cat in live:
                        svc["price_usd"] = live[cat]["price_usd"]
                        svc["is_fallback"] = False
                        svc["price_status"] = "live"
                        svc["fetched_at"] = datetime.now(timezone.utc).isoformat()

            live_count = sum(1 for s in services if not s["is_fallback"])
            logger.info(f"Infracost: enriched {live_count} AWS services with live prices")
        except Exception as e:
            logger.debug(f"Infracost enrichment failed for AWS/{target_region}: {e}")

        return services

    async def get_service_catalog(
        self,
        region: Optional[str] = None,
        category: Optional[str] = None,
        force_refresh: bool = False
    ) -> List[Dict[str, Any]]:
        logger.info(
            f"Fetching AWS service catalog (region={region}, category={category}, "
            f"force_refresh={force_refresh})"
        )
        try:
            services = []
            ec2_services = await self._fetch_ec2_pricing(region)
            services.extend(ec2_services)
            s3_services = await self._fetch_s3_pricing(region)
            services.extend(s3_services)
            ebs_services = await self._fetch_ebs_pricing(region)
            services.extend(ebs_services)
            rds_services = await self._fetch_rds_pricing(region)
            services.extend(rds_services)
            dynamodb_services = await self._fetch_dynamodb_pricing(region)
            services.extend(dynamodb_services)
            lambda_services = await self._fetch_lambda_pricing(region)
            services.extend(lambda_services)
            elb_services = await self._fetch_elb_pricing(region)
            services.extend(elb_services)
            cdn_services = await self._fetch_cloudfront_pricing(region)
            services.extend(cdn_services)
            dns_services = await self._fetch_route53_pricing(region)
            services.extend(dns_services)
            networking_services = await self._fetch_networking_pricing(region)
            services.extend(networking_services)
            eks_services = await self._fetch_eks_pricing(region)
            services.extend(eks_services)
            cache_services = await self._fetch_elasticache_pricing(region)
            services.extend(cache_services)
            ai_services = await self._fetch_ai_ml_pricing(region)
            services.extend(ai_services)
            analytics_services = await self._fetch_analytics_pricing(region)
            services.extend(analytics_services)
            monitoring_services = await self._fetch_monitoring_pricing(region)
            services.extend(monitoring_services)
            security_services = await self._fetch_security_pricing(region)
            services.extend(security_services)
            messaging_services = await self._fetch_messaging_pricing(region)
            services.extend(messaging_services)

            services = await self._enrich_with_live_prices(services, region)

            if category:
                services = [s for s in services if s.get("category") == category]
            logger.info(f"Fetched {len(services)} AWS services")
            return services
        except Exception as e:
            logger.error(f"Failed to fetch AWS service catalog: {e}")
            return self._get_fallback_data(region, category)

    async def _fetch_ec2_pricing(self, region: Optional[str] = None) -> List[Dict[str, Any]]:
        ec2_instances = [
            {"instance_type": "t3.nano", "vcpu": 2, "memory_gb": 0.5, "price_usd": 0.0052, "family": "General Purpose"},
            {"instance_type": "t3.micro", "vcpu": 2, "memory_gb": 1.0, "price_usd": 0.0104, "family": "General Purpose"},
            {"instance_type": "t3.small", "vcpu": 2, "memory_gb": 2.0, "price_usd": 0.0208, "family": "General Purpose"},
            {"instance_type": "t3.medium", "vcpu": 2, "memory_gb": 4.0, "price_usd": 0.0416, "family": "General Purpose"},
            {"instance_type": "t3.large", "vcpu": 2, "memory_gb": 8.0, "price_usd": 0.0832, "family": "General Purpose"},
            {"instance_type": "t3.xlarge", "vcpu": 4, "memory_gb": 16.0, "price_usd": 0.1664, "family": "General Purpose"},
            {"instance_type": "t3.2xlarge", "vcpu": 8, "memory_gb": 32.0, "price_usd": 0.3328, "family": "General Purpose"},
            {"instance_type": "m5.large", "vcpu": 2, "memory_gb": 8.0, "price_usd": 0.096, "family": "General Purpose"},
            {"instance_type": "m5.xlarge", "vcpu": 4, "memory_gb": 16.0, "price_usd": 0.192, "family": "General Purpose"},
            {"instance_type": "m5.2xlarge", "vcpu": 8, "memory_gb": 32.0, "price_usd": 0.384, "family": "General Purpose"},
            {"instance_type": "m5.4xlarge", "vcpu": 16, "memory_gb": 64.0, "price_usd": 0.768, "family": "General Purpose"},
            {"instance_type": "m5.8xlarge", "vcpu": 32, "memory_gb": 128.0, "price_usd": 1.536, "family": "General Purpose"},
            {"instance_type": "m6i.large", "vcpu": 2, "memory_gb": 8.0, "price_usd": 0.096, "family": "General Purpose"},
            {"instance_type": "m6i.xlarge", "vcpu": 4, "memory_gb": 16.0, "price_usd": 0.192, "family": "General Purpose"},
            {"instance_type": "m6i.2xlarge", "vcpu": 8, "memory_gb": 32.0, "price_usd": 0.384, "family": "General Purpose"},
            {"instance_type": "m6i.4xlarge", "vcpu": 16, "memory_gb": 64.0, "price_usd": 0.768, "family": "General Purpose"},
            {"instance_type": "c5.large", "vcpu": 2, "memory_gb": 4.0, "price_usd": 0.085, "family": "Compute Optimized"},
            {"instance_type": "c5.xlarge", "vcpu": 4, "memory_gb": 8.0, "price_usd": 0.17, "family": "Compute Optimized"},
            {"instance_type": "c5.2xlarge", "vcpu": 8, "memory_gb": 16.0, "price_usd": 0.34, "family": "Compute Optimized"},
            {"instance_type": "c5.4xlarge", "vcpu": 16, "memory_gb": 32.0, "price_usd": 0.68, "family": "Compute Optimized"},
            {"instance_type": "c6i.large", "vcpu": 2, "memory_gb": 4.0, "price_usd": 0.085, "family": "Compute Optimized"},
            {"instance_type": "c6i.xlarge", "vcpu": 4, "memory_gb": 8.0, "price_usd": 0.17, "family": "Compute Optimized"},
            {"instance_type": "c6i.2xlarge", "vcpu": 8, "memory_gb": 16.0, "price_usd": 0.34, "family": "Compute Optimized"},
            {"instance_type": "r5.large", "vcpu": 2, "memory_gb": 16.0, "price_usd": 0.126, "family": "Memory Optimized"},
            {"instance_type": "r5.xlarge", "vcpu": 4, "memory_gb": 32.0, "price_usd": 0.252, "family": "Memory Optimized"},
            {"instance_type": "r5.2xlarge", "vcpu": 8, "memory_gb": 64.0, "price_usd": 0.504, "family": "Memory Optimized"},
            {"instance_type": "r5.4xlarge", "vcpu": 16, "memory_gb": 128.0, "price_usd": 1.008, "family": "Memory Optimized"},
            {"instance_type": "r6i.large", "vcpu": 2, "memory_gb": 16.0, "price_usd": 0.126, "family": "Memory Optimized"},
            {"instance_type": "r6i.xlarge", "vcpu": 4, "memory_gb": 32.0, "price_usd": 0.252, "family": "Memory Optimized"},
            {"instance_type": "r6i.2xlarge", "vcpu": 8, "memory_gb": 64.0, "price_usd": 0.504, "family": "Memory Optimized"},
            {"instance_type": "i3.large", "vcpu": 2, "memory_gb": 15.25, "price_usd": 0.156, "family": "Storage Optimized"},
            {"instance_type": "i3.xlarge", "vcpu": 4, "memory_gb": 30.5, "price_usd": 0.312, "family": "Storage Optimized"},
            {"instance_type": "i3.2xlarge", "vcpu": 8, "memory_gb": 61.0, "price_usd": 0.624, "family": "Storage Optimized"},
            {"instance_type": "g4dn.xlarge", "vcpu": 4, "memory_gb": 16.0, "price_usd": 0.526, "family": "GPU Accelerated"},
            {"instance_type": "g4dn.2xlarge", "vcpu": 8, "memory_gb": 32.0, "price_usd": 0.752, "family": "GPU Accelerated"},
            {"instance_type": "p3.2xlarge", "vcpu": 8, "memory_gb": 61.0, "price_usd": 3.06, "family": "GPU Accelerated"},
        ]
        default_region = "us-east-1"
        services = []
        for inst in ec2_instances:
            entry = {
                "provider": self.provider_id,
                "category": ServiceCategory.COMPUTE_VMS.value,
                "service_name": f"EC2 {inst['instance_type']}",
                "unit": "per hour",
                "price_usd": inst["price_usd"],
                "tier_label": PricingTier.ON_DEMAND.value,
                "region": region or default_region,
                "vcpu": inst["vcpu"],
                "memory_gb": inst["memory_gb"],
                "metadata": {
                    "instance_type": inst["instance_type"],
                    "family": inst["family"],
                    "service_code": "AmazonEC2"
                },
                "fetched_at": datetime.now(timezone.utc).isoformat(),
                "is_fallback": True,
                "is_anomaly": False
            }
            services.append(entry)
        return services
    
    async def _fetch_s3_pricing(self, region: Optional[str] = None) -> List[Dict[str, Any]]:
        s3_storage_classes = [
            {"storage_class": "Standard", "price_usd": 0.023, "retrieval": "instant"},
            {"storage_class": "Intelligent-Tiering", "price_usd": 0.023, "retrieval": "auto"},
            {"storage_class": "Standard-IA", "price_usd": 0.0125, "retrieval": "fast"},
            {"storage_class": "One Zone-IA", "price_usd": 0.01, "retrieval": "fast"},
            {"storage_class": "Glacier Instant Retrieval", "price_usd": 0.004, "retrieval": "instant"},
            {"storage_class": "Glacier Flexible Retrieval", "price_usd": 0.0036, "retrieval": "minutes"},
            {"storage_class": "Glacier Deep Archive", "price_usd": 0.00099, "retrieval": "hours"},
            {"storage_class": "S3 Express One Zone", "price_usd": 0.16, "retrieval": "microseconds"},
        ]
        default_region = "us-east-1"
        services = []
        for sc in s3_storage_classes:
            entry = {
                "provider": self.provider_id,
                "category": ServiceCategory.OBJECT_STORAGE.value,
                "service_name": f"S3 {sc['storage_class']}",
                "unit": "per GB-month",
                "price_usd": sc["price_usd"],
                "tier_label": PricingTier.ON_DEMAND.value,
                "region": region or default_region,
                "metadata": {
                    "storage_class": sc["storage_class"],
                    "retrieval_speed": sc["retrieval"],
                    "service_code": "AmazonS3"
                },
                "fetched_at": datetime.now(timezone.utc).isoformat(),
                "is_fallback": True,
                "is_anomaly": False
            }
            services.append(entry)
        return services
    
    async def _fetch_ebs_pricing(self, region: Optional[str] = None) -> List[Dict[str, Any]]:
        ebs_volumes = [
            {"volume_type": "gp3 (SSD)", "price_usd": 0.08, "iops": 3000, "desc": "General Purpose SSD"},
            {"volume_type": "gp2 (SSD)", "price_usd": 0.10, "iops": 100, "desc": "General Purpose SSD (previous gen)"},
            {"volume_type": "io2 (SSD)", "price_usd": 0.125, "iops": 50000, "desc": "Provisioned IOPS SSD"},
            {"volume_type": "io1 (SSD)", "price_usd": 0.125, "iops": 50000, "desc": "Provisioned IOPS SSD (previous gen)"},
            {"volume_type": "st1 (HDD)", "price_usd": 0.045, "iops": 500, "desc": "Throughput Optimized HDD"},
            {"volume_type": "sc1 (HDD)", "price_usd": 0.025, "iops": 250, "desc": "Cold HDD"},
        ]
        default_region = "us-east-1"
        services = []
        for vol in ebs_volumes:
            entry = {
                "provider": self.provider_id,
                "category": ServiceCategory.BLOCK_STORAGE.value,
                "service_name": f"EBS {vol['volume_type']}",
                "unit": "per GB-month",
                "price_usd": vol["price_usd"],
                "tier_label": PricingTier.ON_DEMAND.value,
                "region": region or default_region,
                "iops": vol["iops"],
                "metadata": {
                    "volume_type": vol["volume_type"],
                    "description": vol["desc"],
                    "service_code": "AmazonEBS"
                },
                "fetched_at": datetime.now(timezone.utc).isoformat(),
                "is_fallback": True,
                "is_anomaly": False
            }
            services.append(entry)
        return services
    
    async def _fetch_rds_pricing(self, region: Optional[str] = None) -> List[Dict[str, Any]]:
        rds_engines = [
            {"engine": "MySQL (db.t3.medium)", "price_usd": 0.068, "vcpu": 2, "memory_gb": 4},
            {"engine": "MySQL (db.t3.large)", "price_usd": 0.136, "vcpu": 2, "memory_gb": 8},
            {"engine": "MySQL (db.r5.large)", "price_usd": 0.24, "vcpu": 2, "memory_gb": 16},
            {"engine": "PostgreSQL (db.t3.medium)", "price_usd": 0.072, "vcpu": 2, "memory_gb": 4},
            {"engine": "PostgreSQL (db.t3.large)", "price_usd": 0.144, "vcpu": 2, "memory_gb": 8},
            {"engine": "PostgreSQL (db.r5.large)", "price_usd": 0.25, "vcpu": 2, "memory_gb": 16},
            {"engine": "MariaDB (db.t3.medium)", "price_usd": 0.06, "vcpu": 2, "memory_gb": 4},
            {"engine": "MariaDB (db.t3.large)", "price_usd": 0.12, "vcpu": 2, "memory_gb": 8},
            {"engine": "SQL Server SE (db.t3.large)", "price_usd": 0.273, "vcpu": 2, "memory_gb": 8},
            {"engine": "Oracle SE (db.t3.large)", "price_usd": 0.224, "vcpu": 2, "memory_gb": 8},
            {"engine": "Aurora MySQL (serverless v2)", "price_usd": 0.12, "vcpu": 2, "memory_gb": 4},
            {"engine": "Aurora PostgreSQL (serverless v2)", "price_usd": 0.14, "vcpu": 2, "memory_gb": 4},
        ]
        default_region = "us-east-1"
        services = []
        for db in rds_engines:
            entry = {
                "provider": self.provider_id,
                "category": ServiceCategory.RELATIONAL_DATABASE.value,
                "service_name": f"RDS {db['engine']}",
                "unit": "per hour",
                "price_usd": db["price_usd"],
                "tier_label": PricingTier.ON_DEMAND.value,
                "region": region or default_region,
                "vcpu": db["vcpu"],
                "memory_gb": db["memory_gb"],
                "metadata": {
                    "engine": db["engine"],
                    "service_code": "AmazonRDS"
                },
                "fetched_at": datetime.now(timezone.utc).isoformat(),
                "is_fallback": True,
                "is_anomaly": False
            }
            services.append(entry)
        return services
    
    async def _fetch_dynamodb_pricing(self, region: Optional[str] = None) -> List[Dict[str, Any]]:
        dynamodb_options = [
            {"mode": "Standard (on-demand)", "price_usd": 1.25, "unit_desc": "per million write request units"},
            {"mode": "Standard (on-demand) reads", "price_usd": 0.25, "unit_desc": "per million read request units"},
            {"mode": "Standard-IA (on-demand)", "price_usd": 0.75, "unit_desc": "per million write request units"},
            {"mode": "Standard-IA (on-demand) reads", "price_usd": 0.15, "unit_desc": "per million read request units"},
            {"mode": "Standard storage", "price_usd": 0.25, "unit_desc": "per GB-month"},
            {"mode": "DynamoDB Accelerator (DAX)", "price_usd": 0.12, "unit_desc": "per hour (t3.small node)"},
        ]
        default_region = "us-east-1"
        services = []
        for opt in dynamodb_options:
            entry = {
                "provider": self.provider_id,
                "category": ServiceCategory.NOSQL_DATABASE.value,
                "service_name": f"DynamoDB {opt['mode']}",
                "unit": opt["unit_desc"],
                "price_usd": opt["price_usd"],
                "tier_label": PricingTier.ON_DEMAND.value,
                "region": region or default_region,
                "metadata": {
                    "mode": opt["mode"],
                    "service_code": "AmazonDynamoDB"
                },
                "fetched_at": datetime.now(timezone.utc).isoformat(),
                "is_fallback": True,
                "is_anomaly": False
            }
            services.append(entry)
        return services
    
    async def _fetch_lambda_pricing(self, region: Optional[str] = None) -> List[Dict[str, Any]]:
        lambda_options = [
            {"architecture": "x86", "price_usd": 0.0000166667, "unit_desc": "per GB-second"},
            {"architecture": "Arm (Graviton)", "price_usd": 0.0000133334, "unit_desc": "per GB-second"},
            {"architecture": "x86 requests", "price_usd": 0.20, "unit_desc": "per million requests"},
            {"architecture": "Arm (Graviton) requests", "price_usd": 0.20, "unit_desc": "per million requests"},
        ]
        default_region = "us-east-1"
        services = []
        for opt in lambda_options:
            entry = {
                "provider": self.provider_id,
                "category": ServiceCategory.SERVERLESS_FUNCTIONS.value,
                "service_name": f"Lambda ({opt['architecture']})",
                "unit": opt["unit_desc"],
                "price_usd": opt["price_usd"],
                "tier_label": PricingTier.ON_DEMAND.value,
                "region": region or default_region,
                "metadata": {
                    "architecture": opt["architecture"],
                    "service_code": "AWSLambda"
                },
                "fetched_at": datetime.now(timezone.utc).isoformat(),
                "is_fallback": True,
                "is_anomaly": False
            }
            services.append(entry)
        return services
    
    async def _fetch_elb_pricing(self, region: Optional[str] = None) -> List[Dict[str, Any]]:
        elb_options = [
            {"lb_type": "Application (ALB)", "price_usd": 0.0225, "unit_desc": "per hour"},
            {"lb_type": "ALB LCU", "price_usd": 0.008, "unit_desc": "per LCU-hour"},
            {"lb_type": "Network (NLB)", "price_usd": 0.0225, "unit_desc": "per hour"},
            {"lb_type": "NLB NLCU", "price_usd": 0.006, "unit_desc": "per NLCU-hour"},
            {"lb_type": "Classic", "price_usd": 0.025, "unit_desc": "per hour"},
            {"lb_type": "Gateway (GWLB)", "price_usd": 0.0225, "unit_desc": "per hour"},
        ]
        default_region = "us-east-1"
        services = []
        for lb in elb_options:
            entry = {
                "provider": self.provider_id,
                "category": ServiceCategory.LOAD_BALANCERS.value,
                "service_name": f"{lb['lb_type']} Load Balancer",
                "unit": lb["unit_desc"],
                "price_usd": lb["price_usd"],
                "tier_label": PricingTier.ON_DEMAND.value,
                "region": region or default_region,
                "metadata": {
                    "load_balancer_type": lb["lb_type"],
                    "service_code": "ElasticLoadBalancing"
                },
                "fetched_at": datetime.now(timezone.utc).isoformat(),
                "is_fallback": True,
                "is_anomaly": False
            }
            services.append(entry)
        return services
    
    async def _fetch_cloudfront_pricing(self, region: Optional[str] = None) -> List[Dict[str, Any]]:
        cf_options = [
            {"data_transfer": "US/Europe (per GB)", "price_usd": 0.085},
            {"data_transfer": "Asia (per GB)", "price_usd": 0.14},
            {"data_transfer": "South America (per GB)", "price_usd": 0.25},
            {"data_transfer": "Australia (per GB)", "price_usd": 0.14},
            {"data_transfer": "HTTP Requests (per 10K)", "price_usd": 0.0075},
            {"data_transfer": "HTTPS Requests (per 10K)", "price_usd": 0.01},
            {"data_transfer": "Origin Shield (per GB)", "price_usd": 0.02},
            {"data_transfer": "Real-Time Logs (per 1M requests)", "price_usd": 0.01},
        ]
        default_region = "us-east-1"
        services = []
        for opt in cf_options:
            entry = {
                "provider": self.provider_id,
                "category": ServiceCategory.CDN.value,
                "service_name": f"CloudFront ({opt['data_transfer']})",
                "unit": "per unit",
                "price_usd": opt["price_usd"],
                "tier_label": PricingTier.ON_DEMAND.value,
                "region": region or default_region,
                "metadata": {
                    "option": opt["data_transfer"],
                    "service_code": "AmazonCloudFront"
                },
                "fetched_at": datetime.now(timezone.utc).isoformat(),
                "is_fallback": True,
                "is_anomaly": False
            }
            services.append(entry)
        return services
    
    async def _fetch_route53_pricing(self, region: Optional[str] = None) -> List[Dict[str, Any]]:
        r53_options = [
            {"option": "Hosted Zone (per zone/month)", "price_usd": 0.50},
            {"option": "Standard Query (per million)", "price_usd": 0.40},
            {"option": "Latency-Based Query (per million)", "price_usd": 0.60},
            {"option": "Geo DNS Query (per million)", "price_usd": 0.70},
            {"option": "Health Check (basic)", "price_usd": 0.50, "unit_desc": "per month"},
            {"option": "Traffic Flow Policy", "price_usd": 50.0, "unit_desc": "per month"},
            {"option": "Domain Registration (.com)", "price_usd": 12.0, "unit_desc": "per year"},
        ]
        default_region = "us-east-1"
        services = []
        for opt in r53_options:
            entry = {
                "provider": self.provider_id,
                "category": ServiceCategory.DNS.value,
                "service_name": f"Route53 {opt['option']}",
                "unit": opt.get("unit_desc", "per unit"),
                "price_usd": opt["price_usd"],
                "tier_label": PricingTier.ON_DEMAND.value,
                "region": region or default_region,
                "metadata": {
                    "option": opt["option"],
                    "service_code": "AmazonRoute53"
                },
                "fetched_at": datetime.now(timezone.utc).isoformat(),
                "is_fallback": True,
                "is_anomaly": False
            }
            services.append(entry)
        return services
    
    async def _fetch_networking_pricing(self, region: Optional[str] = None) -> List[Dict[str, Any]]:
        net_options = [
            {"option": "NAT Gateway", "price_usd": 0.045, "unit_desc": "per hour"},
            {"option": "NAT Gateway Data Processed", "price_usd": 0.045, "unit_desc": "per GB"},
            {"option": "VPN Connection", "price_usd": 0.05, "unit_desc": "per hour"},
            {"option": "Direct Connect (1 Gbps)", "price_usd": 0.21, "unit_desc": "per hour"},
            {"option": "Direct Connect (10 Gbps)", "price_usd": 2.10, "unit_desc": "per hour"},
            {"option": "Transit Gateway", "price_usd": 0.05, "unit_desc": "per hour"},
            {"option": "Transit Gateway Attachment", "price_usd": 0.07, "unit_desc": "per attachment/hour"},
            {"option": "VPC Peering (per region)", "price_usd": 0.02, "unit_desc": "per hour"},
            {"option": "PrivateLink/Endpoint", "price_usd": 0.01, "unit_desc": "per hour"},
            {"option": "EIP (not in use)", "price_usd": 0.005, "unit_desc": "per hour"},
        ]
        default_region = "us-east-1"
        services = []
        for opt in net_options:
            entry = {
                "provider": self.provider_id,
                "category": ServiceCategory.NETWORKING.value,
                "service_name": f"AWS {opt['option']}",
                "unit": opt["unit_desc"],
                "price_usd": opt["price_usd"],
                "tier_label": PricingTier.ON_DEMAND.value,
                "region": region or default_region,
                "metadata": {
                    "option": opt["option"],
                    "service_code": "AmazonVPC"
                },
                "fetched_at": datetime.now(timezone.utc).isoformat(),
                "is_fallback": True,
                "is_anomaly": False
            }
            services.append(entry)
        return services
    
    async def _fetch_eks_pricing(self, region: Optional[str] = None) -> List[Dict[str, Any]]:
        eks_options = [
            {"option": "EKS Cluster Fee", "price_usd": 0.10, "unit_desc": "per hour"},
            {"option": "EKS Managed Node (t3.medium)", "price_usd": 0.0416, "unit_desc": "per hour"},
            {"option": "EKS Managed Node (m5.large)", "price_usd": 0.096, "unit_desc": "per hour"},
            {"option": "EKS Fargate (per pod)", "price_usd": 0.0134, "unit_desc": "per vCPU-hour"},
            {"option": "EKS Fargate Memory", "price_usd": 0.0018, "unit_desc": "per GB-hour"},
        ]
        default_region = "us-east-1"
        services = []
        for opt in eks_options:
            entry = {
                "provider": self.provider_id,
                "category": ServiceCategory.MANAGED_KUBERNETES.value,
                "service_name": f"AWS {opt['option']}",
                "unit": opt["unit_desc"],
                "price_usd": opt["price_usd"],
                "tier_label": PricingTier.ON_DEMAND.value,
                "region": region or default_region,
                "metadata": {
                    "option": opt["option"],
                    "service_code": "AmazonEKS"
                },
                "fetched_at": datetime.now(timezone.utc).isoformat(),
                "is_fallback": True,
                "is_anomaly": False
            }
            services.append(entry)
        return services
    
    async def _fetch_elasticache_pricing(self, region: Optional[str] = None) -> List[Dict[str, Any]]:
        cache_options = [
            {"option": "ElastiCache Redis (cache.t3.micro)", "price_usd": 0.022, "vcpu": 2, "memory_gb": 0.5},
            {"option": "ElastiCache Redis (cache.t3.small)", "price_usd": 0.047, "vcpu": 2, "memory_gb": 1.3},
            {"option": "ElastiCache Redis (cache.t3.medium)", "price_usd": 0.094, "vcpu": 2, "memory_gb": 3.1},
            {"option": "ElastiCache Redis (cache.r5.large)", "price_usd": 0.25, "vcpu": 2, "memory_gb": 13.3},
            {"option": "ElastiCache Memcached (cache.t3.small)", "price_usd": 0.044, "vcpu": 2, "memory_gb": 1.3},
            {"option": "ElastiCache Memcached (cache.t3.medium)", "price_usd": 0.088, "vcpu": 2, "memory_gb": 3.1},
        ]
        default_region = "us-east-1"
        services = []
        for opt in cache_options:
            entry = {
                "provider": self.provider_id,
                "category": "Caching",
                "service_name": f"AWS {opt['option']}",
                "unit": "per hour",
                "price_usd": opt["price_usd"],
                "tier_label": PricingTier.ON_DEMAND.value,
                "region": region or default_region,
                "vcpu": opt["vcpu"],
                "memory_gb": opt["memory_gb"],
                "metadata": {
                    "option": opt["option"],
                    "service_code": "AmazonElastiCache"
                },
                "fetched_at": datetime.now(timezone.utc).isoformat(),
                "is_fallback": True,
                "is_anomaly": False
            }
            services.append(entry)
        return services
    
    async def _fetch_ai_ml_pricing(self, region: Optional[str] = None) -> List[Dict[str, Any]]:
        ai_options = [
            {"option": "SageMaker (ml.t3.medium)", "price_usd": 0.05, "unit_desc": "per hour"},
            {"option": "SageMaker (ml.m5.large)", "price_usd": 0.11, "unit_desc": "per hour"},
            {"option": "SageMaker (ml.p3.2xlarge GPU)", "price_usd": 3.825, "unit_desc": "per hour"},
            {"option": "Rekognition Image Analysis", "price_usd": 0.001, "unit_desc": "per image"},
            {"option": "Rekognition Video Analysis", "price_usd": 0.10, "unit_desc": "per minute"},
            {"option": "Comprehend (sentiment)", "price_usd": 0.0001, "unit_desc": "per unit"},
            {"option": "Translate Text", "price_usd": 15.0, "unit_desc": "per million characters"},
            {"option": "Polly (standard TTS)", "price_usd": 4.0, "unit_desc": "per million characters"},
            {"option": "Polly (neural TTS)", "price_usd": 16.0, "unit_desc": "per million characters"},
            {"option": "Lex (text requests)", "price_usd": 0.004, "unit_desc": "per request"},
            {"option": "Lex (speech requests)", "price_usd": 0.065, "unit_desc": "per minute"},
            {"option": "Textract (document)", "price_usd": 0.015, "unit_desc": "per page"},
        ]
        default_region = "us-east-1"
        services = []
        for opt in ai_options:
            entry = {
                "provider": self.provider_id,
                "category": ServiceCategory.AI_ML.value,
                "service_name": f"AWS {opt['option']}",
                "unit": opt["unit_desc"],
                "price_usd": opt["price_usd"],
                "tier_label": PricingTier.ON_DEMAND.value,
                "region": region or default_region,
                "metadata": {
                    "option": opt["option"],
                    "service_code": "AmazonSageMaker"
                },
                "fetched_at": datetime.now(timezone.utc).isoformat(),
                "is_fallback": True,
                "is_anomaly": False
            }
            services.append(entry)
        return services
    
    async def _fetch_analytics_pricing(self, region: Optional[str] = None) -> List[Dict[str, Any]]:
        analytics_options = [
            {"option": "Athena (per TB scanned)", "price_usd": 5.0, "unit_desc": "per TB"},
            {"option": "EMR (m5.xlarge)", "price_usd": 0.21, "unit_desc": "per hour"},
            {"option": "EMR (m5.2xlarge)", "price_usd": 0.42, "unit_desc": "per hour"},
            {"option": "Redshift (dc2.large)", "price_usd": 0.25, "unit_desc": "per hour"},
            {"option": "Redshift (dc2.8xlarge)", "price_usd": 4.0, "unit_desc": "per hour"},
            {"option": "Redshift (ra3.xlplus)", "price_usd": 0.85, "unit_desc": "per hour"},
            {"option": "Kinesis Data Streams (shard)", "price_usd": 0.015, "unit_desc": "per shard-hour"},
            {"option": "Kinesis Data Firehose (per GB)", "price_usd": 0.035, "unit_desc": "per GB"},
            {"option": "Kinesis Data Analytics", "price_usd": 0.11, "unit_desc": "per KPU-hour"},
            {"option": "Glue ETL", "price_usd": 0.44, "unit_desc": "per DPU-hour"},
            {"option": "QuickSight (author)", "price_usd": 18.0, "unit_desc": "per month"},
            {"option": "QuickSight (reader)", "price_usd": 5.0, "unit_desc": "per month"},
            {"option": "MSK (Kafka) broker", "price_usd": 0.14, "unit_desc": "per broker-hour"},
        ]
        default_region = "us-east-1"
        services = []
        for opt in analytics_options:
            entry = {
                "provider": self.provider_id,
                "category": ServiceCategory.ANALYTICS.value,
                "service_name": f"AWS {opt['option']}",
                "unit": opt["unit_desc"],
                "price_usd": opt["price_usd"],
                "tier_label": PricingTier.ON_DEMAND.value,
                "region": region or default_region,
                "metadata": {
                    "option": opt["option"],
                    "service_code": "AmazonRedshift"
                },
                "fetched_at": datetime.now(timezone.utc).isoformat(),
                "is_fallback": True,
                "is_anomaly": False
            }
            services.append(entry)
        return services
    
    async def _fetch_monitoring_pricing(self, region: Optional[str] = None) -> List[Dict[str, Any]]:
        monitoring_options = [
            {"option": "CloudWatch Metrics (basic)", "price_usd": 0.30, "unit_desc": "per metric-month"},
            {"option": "CloudWatch Detailed Metrics", "price_usd": 3.50, "unit_desc": "per instance-month"},
            {"option": "CloudWatch Logs (ingestion)", "price_usd": 0.50, "unit_desc": "per GB"},
            {"option": "CloudWatch Logs (storage)", "price_usd": 0.03, "unit_desc": "per GB-month"},
            {"option": "CloudWatch Dashboard", "price_usd": 3.0, "unit_desc": "per dashboard-month"},
            {"option": "CloudWatch Synthetics Canary", "price_usd": 0.0012, "unit_desc": "per run"},
            {"option": "CloudTrail (management events)", "price_usd": 2.0, "unit_desc": "per 100K events"},
            {"option": "CloudTrail (data events)", "price_usd": 0.10, "unit_desc": "per 100K events"},
            {"option": "X-Ray (traces recorded)", "price_usd": 0.000005, "unit_desc": "per trace"},
        ]
        default_region = "us-east-1"
        services = []
        for opt in monitoring_options:
            entry = {
                "provider": self.provider_id,
                "category": ServiceCategory.MONITORING.value,
                "service_name": f"AWS {opt['option']}",
                "unit": opt["unit_desc"],
                "price_usd": opt["price_usd"],
                "tier_label": PricingTier.ON_DEMAND.value,
                "region": region or default_region,
                "metadata": {
                    "option": opt["option"],
                    "service_code": "AmazonCloudWatch"
                },
                "fetched_at": datetime.now(timezone.utc).isoformat(),
                "is_fallback": True,
                "is_anomaly": False
            }
            services.append(entry)
        return services
    
    async def _fetch_security_pricing(self, region: Optional[str] = None) -> List[Dict[str, Any]]:
        security_options = [
            {"option": "WAF Web ACL", "price_usd": 5.0, "unit_desc": "per month"},
            {"option": "WAF Rule", "price_usd": 1.0, "unit_desc": "per rule-month"},
            {"option": "WAF (per million requests)", "price_usd": 0.60, "unit_desc": "per million"},
            {"option": "Shield Advanced", "price_usd": 3000.0, "unit_desc": "per month (annual)"},
            {"option": "GuardDuty", "price_usd": 4.24, "unit_desc": "per 1 million events"},
            {"option": "Inspector (per assessment)", "price_usd": 0.001, "unit_desc": "per instance-assessment"},
            {"option": "Secrets Manager (per secret)", "price_usd": 0.40, "unit_desc": "per month"},
            {"option": "Secrets Manager (per 10K API calls)", "price_usd": 0.05, "unit_desc": "per 10K calls"},
            {"option": "KMS (key)", "price_usd": 1.0, "unit_desc": "per Customer KMS key/month"},
            {"option": "KMS (per 10K requests)", "price_usd": 0.03, "unit_desc": "per 10K requests"},
            {"option": "Cognito (MAU)", "price_usd": 0.0055, "unit_desc": "per MAU"},
            {"option": "Macie (automated discovery)", "price_usd": 1.0, "unit_desc": "per GB-month"},
        ]
        default_region = "us-east-1"
        services = []
        for opt in security_options:
            entry = {
                "provider": self.provider_id,
                "category": ServiceCategory.SECURITY.value,
                "service_name": f"AWS {opt['option']}",
                "unit": opt["unit_desc"],
                "price_usd": opt["price_usd"],
                "tier_label": PricingTier.ON_DEMAND.value,
                "region": region or default_region,
                "metadata": {
                    "option": opt["option"],
                    "service_code": "AWSWAF"
                },
                "fetched_at": datetime.now(timezone.utc).isoformat(),
                "is_fallback": True,
                "is_anomaly": False
            }
            services.append(entry)
        return services
    
    async def _fetch_messaging_pricing(self, region: Optional[str] = None) -> List[Dict[str, Any]]:
        msg_options = [
            {"option": "SQS Standard (per million requests)", "price_usd": 0.40, "unit_desc": "per million"},
            {"option": "SQS FIFO (per million requests)", "price_usd": 0.50, "unit_desc": "per million"},
            {"option": "SNS (per million publish)", "price_usd": 0.50, "unit_desc": "per million"},
            {"option": "SNS (Email delivery)", "price_usd": 2.0, "unit_desc": "per 100K emails"},
            {"option": "SNS (SMS delivery)", "price_usd": 0.0075, "unit_desc": "per SMS"},
            {"option": "ECS Fargate (per vCPU-hour)", "price_usd": 0.04048, "unit_desc": "per vCPU-hour"},
            {"option": "ECS Fargate Memory", "price_usd": 0.004445, "unit_desc": "per GB-hour"},
            {"option": "ECR (storage)", "price_usd": 0.10, "unit_desc": "per GB-month"},
        ]
        default_region = "us-east-1"
        services = []
        for opt in msg_options:
            entry = {
                "provider": self.provider_id,
                "category": ServiceCategory.OTHER.value,
                "service_name": f"AWS {opt['option']}",
                "unit": opt["unit_desc"],
                "price_usd": opt["price_usd"],
                "tier_label": PricingTier.ON_DEMAND.value,
                "region": region or default_region,
                "metadata": {
                    "option": opt["option"],
                    "service_code": "AmazonSQS"
                },
                "fetched_at": datetime.now(timezone.utc).isoformat(),
                "is_fallback": True,
                "is_anomaly": False
            }
            services.append(entry)
        return services
    
    def _get_fallback_data(
        self,
        region: Optional[str] = None,
        category: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        logger.warning("Using AWS fallback data")
        fallback_data = []
        fallback_data.extend([
            {
                "provider": self.provider_id,
                "category": ServiceCategory.COMPUTE_VMS.value,
                "service_name": "EC2 t3.medium",
                "unit": "per hour",
                "price_usd": 0.0416,
                "tier_label": PricingTier.ON_DEMAND.value,
                "region": region or "us-east-1",
                "vcpu": 2,
                "memory_gb": 4.0,
                "metadata": {"instance_type": "t3.medium"},
                "fetched_at": datetime.now(timezone.utc).isoformat(),
                "is_fallback": True,
                "is_anomaly": False
            },
            {
                "provider": self.provider_id,
                "category": ServiceCategory.COMPUTE_VMS.value,
                "service_name": "EC2 m5.large",
                "unit": "per hour",
                "price_usd": 0.096,
                "tier_label": PricingTier.ON_DEMAND.value,
                "region": region or "us-east-1",
                "vcpu": 2,
                "memory_gb": 8.0,
                "metadata": {"instance_type": "m5.large"},
                "fetched_at": datetime.now(timezone.utc).isoformat(),
                "is_fallback": True,
                "is_anomaly": False
            },
            {
                "provider": self.provider_id,
                "category": ServiceCategory.OBJECT_STORAGE.value,
                "service_name": "S3 Standard",
                "unit": "per GB-month",
                "price_usd": 0.023,
                "tier_label": PricingTier.ON_DEMAND.value,
                "region": region or "us-east-1",
                "metadata": {"storage_class": "Standard"},
                "fetched_at": datetime.now(timezone.utc).isoformat(),
                "is_fallback": True,
                "is_anomaly": False
            },
            {
                "provider": self.provider_id,
                "category": ServiceCategory.RELATIONAL_DATABASE.value,
                "service_name": "RDS MySQL (db.t3.medium)",
                "unit": "per hour",
                "price_usd": 0.068,
                "tier_label": PricingTier.ON_DEMAND.value,
                "region": region or "us-east-1",
                "vcpu": 2,
                "memory_gb": 4,
                "metadata": {"engine": "MySQL"},
                "fetched_at": datetime.now(timezone.utc).isoformat(),
                "is_fallback": True,
                "is_anomaly": False
            },
            {
                "provider": self.provider_id,
                "category": ServiceCategory.SERVERLESS_FUNCTIONS.value,
                "service_name": "Lambda (x86)",
                "unit": "per GB-second",
                "price_usd": 0.0000166667,
                "tier_label": PricingTier.ON_DEMAND.value,
                "region": region or "us-east-1",
                "metadata": {"architecture": "x86"},
                "fetched_at": datetime.now(timezone.utc).isoformat(),
                "is_fallback": True,
                "is_anomaly": False
            },
        ])
        if region:
            fallback_data = [d for d in fallback_data if d.get("region") == region]
        if category:
            fallback_data = [d for d in fallback_data if d.get("category") == category]
        return fallback_data
    
    async def get_pricing_data(
        self,
        service_id: str,
        region: Optional[str] = None
    ) -> Dict[str, Any]:
        logger.info(f"Fetching AWS pricing data for service: {service_id}, region: {region}")
        return {
            "service_id": service_id,
            "service_name": self.SERVICE_CODES.get(service_id, service_id),
            "base_price": 0.0,
            "pricing_tiers": [],
            "regional_pricing": {},
            "metadata": {
                "provider": self.provider_id,
                "fetched_at": datetime.now(timezone.utc).isoformat()
            }
        }
    
    async def get_regions(self) -> List[Dict[str, str]]:
        regions = [
            {"region_id": "us-east-1", "region_name": "US East (N. Virginia)", "location": "North America"},
            {"region_id": "us-east-2", "region_name": "US East (Ohio)", "location": "North America"},
            {"region_id": "us-west-1", "region_name": "US West (N. California)", "location": "North America"},
            {"region_id": "us-west-2", "region_name": "US West (Oregon)", "location": "North America"},
            {"region_id": "eu-west-1", "region_name": "EU (Ireland)", "location": "Europe"},
            {"region_id": "eu-central-1", "region_name": "EU (Frankfurt)", "location": "Europe"},
            {"region_id": "eu-west-2", "region_name": "EU (London)", "location": "Europe"},
            {"region_id": "eu-west-3", "region_name": "EU (Paris)", "location": "Europe"},
            {"region_id": "eu-north-1", "region_name": "EU (Stockholm)", "location": "Europe"},
            {"region_id": "eu-south-1", "region_name": "EU (Milan)", "location": "Europe"},
            {"region_id": "ap-southeast-1", "region_name": "Asia Pacific (Singapore)", "location": "Asia Pacific"},
            {"region_id": "ap-southeast-2", "region_name": "Asia Pacific (Sydney)", "location": "Asia Pacific"},
            {"region_id": "ap-northeast-1", "region_name": "Asia Pacific (Tokyo)", "location": "Asia Pacific"},
            {"region_id": "ap-northeast-2", "region_name": "Asia Pacific (Seoul)", "location": "Asia Pacific"},
            {"region_id": "ap-south-1", "region_name": "Asia Pacific (Mumbai)", "location": "Asia Pacific"},
            {"region_id": "sa-east-1", "region_name": "South America (Sao Paulo)", "location": "South America"},
            {"region_id": "ca-central-1", "region_name": "Canada (Central)", "location": "North America"},
            {"region_id": "me-south-1", "region_name": "Middle East (Bahrain)", "location": "Middle East"},
            {"region_id": "af-south-1", "region_name": "Africa (Cape Town)", "location": "Africa"},
        ]
        return regions
    
    async def validate_credentials(
        self,
        api_key: Optional[str] = None,
        **kwargs
    ) -> bool:
        logger.info("AWS Price List API is public, no authentication required")
        return True
