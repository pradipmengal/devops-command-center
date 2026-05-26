"""
Regional Pricing Sync Service
==============================
Fetches real-time per-region pricing from AWS, Azure, and GCP public APIs.

Each price entry carries a `price_status` field:
  - "live"     -> successfully fetched from provider API right now
  - "cached"   -> served from in-memory cache (TTL not expired)
  - "fallback" -> API call failed, estimated via region multiplier

Frontend can use `price_status` to show a blinking status indicator.
"""

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional, List

import httpx

from services.infracost_client import InfracostClient
from services.settings import get_infracost_api_key, is_infracost_configured

logger = logging.getLogger(__name__)

# ── Cache ─────────────────────────────────────────────────────────────────────

CACHE_TTL_SECONDS = 3600  # 1 hour


@dataclass
class RegionalPriceEntry:
    provider: str
    region: str
    service_name: str
    category: str
    price_usd: float
    unit: str
    tier_label: str
    price_status: str  # "live" | "cached" | "fallback"
    fetched_at: str


@dataclass
class RegionalPriceCache:
    entries: dict = field(default_factory=dict)
    fetched_at: Optional[datetime] = None
    source: str = "fallback"


_regional_cache = RegionalPriceCache()


def invalidate_regional_cache():
    global _regional_cache
    _regional_cache = RegionalPriceCache()


def _cache_is_fresh() -> bool:
    if _regional_cache.fetched_at is None:
        return False
    age = (datetime.now(timezone.utc) - _regional_cache.fetched_at).total_seconds()
    return age < CACHE_TTL_SECONDS


# ── Region multipliers ────────────────────────────────────────────────────────
# Base prices are for the default (cheapest) region; other regions are estimated
# by applying the multiplier when live API fetch fails.

AWS_REGION_MULTIPLIERS = {
    "us-east-1": 1.000, "us-east-2": 1.000,
    "us-west-1": 1.056, "us-west-2": 1.000,
    "ca-central-1": 1.000,
    "eu-west-1": 1.069, "eu-west-2": 1.069, "eu-west-3": 1.069,
    "eu-central-1": 1.139, "eu-north-1": 1.069, "eu-south-1": 1.069,
    "ap-southeast-1": 1.139, "ap-southeast-2": 1.139,
    "ap-northeast-1": 1.139, "ap-northeast-2": 1.139,
    "ap-south-1": 1.139,
    "sa-east-1": 1.576,
    "me-south-1": 1.139, "af-south-1": 1.139,
}

AZURE_REGION_MULTIPLIERS = {
    "eastus": 1.000, "eastus2": 1.000, "westus": 1.000,
    "westus2": 1.000, "westus3": 1.000,
    "centralus": 1.000, "northcentralus": 1.000, "southcentralus": 1.000,
    "westeurope": 1.069, "northeurope": 1.069,
    "francecentral": 1.069, "uksouth": 1.069,
    "germanywestcentral": 1.069,
    "southeastasia": 1.139, "japaneast": 1.139,
    "australiaeast": 1.139, "centralindia": 1.139,
    "brazilsouth": 1.576, "canadacentral": 1.000,
}

GCP_REGION_MULTIPLIERS = {
    "us-central1": 1.000, "us-east1": 1.000, "us-east4": 1.000,
    "us-west1": 1.000, "us-west2": 1.121, "us-west3": 1.121, "us-west4": 1.000,
    "europe-west1": 1.069, "europe-west2": 1.069, "europe-west3": 1.139,
    "europe-west4": 1.069, "europe-west6": 1.139,
    "asia-southeast1": 1.139, "asia-northeast1": 1.139,
    "asia-northeast2": 1.139, "asia-south1": 1.139,
    "australia-southeast1": 1.139,
    "southamerica-east1": 1.576,
    "northamerica-northeast1": 1.000,
}

ALL_MULTIPLIERS = {
    "aws": AWS_REGION_MULTIPLIERS,
    "azure": AZURE_REGION_MULTIPLIERS,
    "gcp": GCP_REGION_MULTIPLIERS,
}

# ── Base (default region) prices used as fallback ─────────────────────────────

AWS_BASE_PRICES = {
    "Compute (VMs)": ("EC2 t3.medium", "per hour", "On-Demand", 0.0416),
    "Managed Kubernetes": ("EKS (control plane)", "per hour", "Standard", 0.10),
    "Object Storage": ("S3 Standard", "per GB/month", "Standard", 0.023),
    "Managed Databases": ("RDS db.t3.medium", "per hour", "On-Demand", 0.068),
    "Container Registry": ("ECR", "per GB/month", "Standard", 0.10),
    "Load Balancers": ("ALB", "per hour", "On-Demand", 0.008),
    "Serverless Functions": ("AWS Lambda", "per million invocations", "Pay-as-you-go", 0.20),
    "CDN": ("CloudFront", "per GB egress", "On-Demand", 0.0085),
    "VPC / Networking": ("NAT Gateway", "per hour", "On-Demand", 0.045),
    "Networking Egress": ("AWS Data Transfer Out", "per GB", "Standard", 0.09),
    "Managed Cache": ("ElastiCache cache.t3.micro", "per hour", "On-Demand", 0.017),
    "Messaging & Queues": ("SQS Standard", "per million messages", "Pay-as-you-go", 0.40),
    "Block Storage (Disks)": ("EBS gp3", "per GB/month", "General Purpose", 0.08),
    "Monitoring & Logging": ("CloudWatch Logs", "per GB ingested", "Pay-as-you-go", 0.50),
    "Secret Management": ("Secrets Manager", "per secret/month", "Pay-as-you-go", 0.40),
    "Data Warehousing": ("Redshift dc2.large", "per hour", "On-Demand", 0.25),
    "DNS": ("Route 53", "per hosted zone/month", "Standard", 0.50),
    "API Gateway": ("API Gateway", "per million API calls", "Pay-as-you-go", 3.50),
    "Container Orchestration (Serverless)": ("ECS Fargate", "per vCPU/hour", "On-Demand", 0.04048),
    "Identity & Access (IAM)": ("Cognito", "per MAU", "Pay-as-you-go", 0.0055),
    "CI/CD Pipeline": ("CodePipeline", "per pipeline/month", "Standard", 1.00),
    "Artifact / Package Registry": ("CodeArtifact", "per GB/month", "Standard", 0.05),
    "Machine Learning Platform": ("SageMaker ml.m5.xlarge", "per hour", "On-Demand", 0.269),
    "Backup & Disaster Recovery": ("AWS Backup", "per GB/month", "Standard", 0.05),
    "File Storage (NFS/SMB)": ("Amazon EFS", "per GB/month", "Standard", 0.30),
}

AZURE_BASE_PRICES = {
    "Compute (VMs)": ("Azure VM B2s", "per hour", "Pay-as-you-go", 0.0416),
    "Managed Kubernetes": ("AKS (control plane)", "per hour", "Standard", 0.10),
    "Object Storage": ("Azure Blob Storage Hot LRS", "per GB/month", "Hot Tier", 0.0184),
    "Managed Databases": ("Azure SQL Database GP 2 vCore", "per hour", "General Purpose", 0.150),
    "Container Registry": ("ACR", "per GB/month", "Standard", 0.167),
    "Load Balancers": ("Azure Load Balancer", "per hour", "Standard", 0.005),
    "Serverless Functions": ("Azure Functions", "per million invocations", "Consumption", 0.20),
    "CDN": ("Azure CDN", "per GB egress", "Standard", 0.0075),
    "VPC / Networking": ("Azure NAT Gateway", "per hour", "Standard", 0.045),
    "Networking Egress": ("Azure Bandwidth Out", "per GB", "Standard", 0.087),
    "Managed Cache": ("Azure Cache for Redis C1", "per hour", "Standard", 0.055),
    "Messaging & Queues": ("Service Bus", "per million messages", "Standard", 0.10),
    "Block Storage (Disks)": ("Managed Disk SSD", "per GB/month", "Standard SSD", 0.096),
    "Monitoring & Logging": ("Azure Monitor", "per GB ingested", "Pay-as-you-go", 0.25),
    "Secret Management": ("Key Vault", "per secret/month", "Standard", 0.03),
    "Data Warehousing": ("Synapse Analytics", "per TB queried", "Pay-as-you-go", 5.00),
    "DNS": ("Azure DNS", "per hosted zone/month", "Standard", 0.50),
    "API Gateway": ("API Management", "per million API calls", "Consumption", 0.35),
    "Container Orchestration (Serverless)": ("Container Instances", "per vCPU/second", "Pay-as-you-go", 0.0000135),
    "Identity & Access (IAM)": ("Azure AD B2C", "per MAU", "Pay-as-you-go", 0.0016),
    "CI/CD Pipeline": ("DevOps Pipelines", "per build-minute", "Pay-as-you-go", 0.008),
    "Artifact / Package Registry": ("Artifacts", "per GB/month", "Standard", 2.00),
    "Machine Learning Platform": ("Azure ML DS3_v2", "per hour", "Pay-as-you-go", 0.251),
    "Backup & Disaster Recovery": ("Azure Backup", "per GB/month", "Standard", 0.02),
    "File Storage (NFS/SMB)": ("Azure Files", "per GB/month", "Standard", 0.06),
}

GCP_BASE_PRICES = {
    "Compute (VMs)": ("Compute Engine e2-medium", "per hour", "On-Demand", 0.0336),
    "Managed Kubernetes": ("GKE (control plane)", "per hour", "Standard", 0.10),
    "Object Storage": ("Cloud Storage Standard", "per GB/month", "Standard", 0.020),
    "Managed Databases": ("Cloud SQL n1-standard-1", "per hour", "On-Demand", 0.115),
    "Container Registry": ("Artifact Registry", "per GB/month", "Standard", 0.10),
    "Load Balancers": ("Cloud Load Balancing", "per hour", "On-Demand", 0.008),
    "Serverless Functions": ("Cloud Functions", "per million invocations", "Pay-as-you-go", 0.40),
    "CDN": ("Cloud CDN", "per GB egress", "On-Demand", 0.008),
    "VPC / Networking": ("Cloud NAT", "per hour", "On-Demand", 0.044),
    "Networking Egress": ("GCP Network Egress", "per GB", "Standard", 0.08),
    "Managed Cache": ("Memorystore M1", "per hour", "Standard", 0.049),
    "Messaging & Queues": ("Cloud Pub/Sub", "per million messages", "Pay-as-you-go", 0.04),
    "Block Storage (Disks)": ("Persistent Disk SSD", "per GB/month", "SSD", 0.17),
    "Monitoring & Logging": ("Cloud Logging", "per GB ingested", "Pay-as-you-go", 0.01),
    "Secret Management": ("Secret Manager", "per secret/month", "Pay-as-you-go", 0.06),
    "Data Warehousing": ("BigQuery", "per TB queried", "On-Demand", 5.00),
    "DNS": ("Cloud DNS", "per hosted zone/month", "Standard", 0.20),
    "API Gateway": ("Cloud Endpoints", "per million API calls", "Pay-as-you-go", 3.00),
    "Container Orchestration (Serverless)": ("Cloud Run", "per 100ms", "Pay-as-you-go", 0.0000024),
    "Identity & Access (IAM)": ("Cloud Identity", "per MAU", "Pay-as-you-go", 0.0030),
    "CI/CD Pipeline": ("Cloud Build", "per build-minute", "Pay-as-you-go", 0.003),
    "Artifact / Package Registry": ("Artifact Registry (packages)", "per GB/month", "Standard", 0.10),
    "Machine Learning Platform": ("Vertex AI n1-standard-4", "per hour", "On-Demand", 0.190),
    "Backup & Disaster Recovery": ("Cloud Backup", "per GB/month", "Standard", 0.023),
    "File Storage (NFS/SMB)": ("Filestore", "per GB/month", "Standard", 0.20),
}

BASE_PRICES = {
    "aws": AWS_BASE_PRICES,
    "azure": AZURE_BASE_PRICES,
    "gcp": GCP_BASE_PRICES,
}

# ── Live pricing via Infracost API (primary) ──────────────────────────────────

_infracost_client: Optional[InfracostClient] = None


def _get_infracost_client() -> Optional[InfracostClient]:
    """Get or create the Infracost client singleton."""
    global _infracost_client
    if _infracost_client is None:
        api_key = get_infracost_api_key()
        if api_key:
            _infracost_client = InfracostClient(api_key=api_key)
        else:
            logger.warning("INFRACOST_API_KEY not set — live pricing unavailable")
    return _infracost_client


PROVIDER_VENDOR_MAP = {
    "aws": "aws",
    "azure": "azure",
    "gcp": "gcp",
}


async def fetch_live_prices_for_provider(
    client: httpx.AsyncClient, provider: str, regions: List[str]
) -> dict:
    """
    Fetch live prices for all given regions of a provider.
    Uses Infracost API when available, falls back to direct provider APIs.

    Returns {region: {category: price_usd}}.
    """
    result = {}

    infracost = _get_infracost_client()

    if infracost and infracost.is_configured():
        try:
            vendor = PROVIDER_VENDOR_MAP.get(provider, provider)
            pairs = [(vendor, region) for region in regions]
            batch = await infracost.get_prices_batch(pairs)
            for region in regions:
                region_prices = batch.get(vendor, {}).get(region, {})
                result[region] = {cat: p["price_usd"] for cat, p in region_prices.items()}
            live_count = sum(1 for r in result.values() if r)
            if live_count > 0:
                logger.info(f"Infracost: {live_count}/{len(regions)} regions with live data for {provider}")
                return result
            logger.info(f"Infracost returned no data for {provider}, trying fallback APIs")
        except Exception as e:
            logger.warning(f"Infracost fetch failed for {provider}: {e}, trying fallback APIs")

    # ── Fallback: direct provider API scraping ─────────────────────────────

    if provider == "aws":
        for region in regions:
            try:
                url = f"https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonEC2/current/{region}/index.json"
                resp = await client.get(url, timeout=15.0, headers={"Range": "bytes=0-102400"})
                text = resp.text[:50000]
                import re
                price_match = re.search(r'"t3\.medium".*?"USD"\s*:\s*"([\d.]+)"', text, re.DOTALL)
                if price_match:
                    price = float(price_match.group(1))
                    if 0.01 < price < 1.0:
                        result[region] = {"Compute (VMs)": price}
                    else:
                        result[region] = {}
                else:
                    result[region] = {}
            except Exception:
                result[region] = {}

    elif provider == "azure":
        for region in regions:
            region_prices = {}
            service_map = {
                "Virtual Machines": "Compute (VMs)",
                "Storage": "Object Storage",
                "Azure SQL Database": "Managed Databases",
            }
            for svc, cat in service_map.items():
                try:
                    resp = await client.get(
                        "https://prices.azure.com/api/retail/prices",
                        params={
                            "api-version": "2023-01-01-preview",
                            "$filter": f"serviceName eq '{svc}' and armRegionName eq '{region}' and priceType eq 'Consumption'",
                            "$top": "1",
                        },
                        timeout=10.0,
                    )
                    resp.raise_for_status()
                    items = resp.json().get("Items", [])
                    if items:
                        price = items[0].get("retailPrice", 0) or items[0].get("unitPrice", 0)
                        if price and float(price) > 0:
                            region_prices[cat] = float(price)
                except Exception:
                    pass
            result[region] = region_prices

    elif provider == "gcp":
        try:
            resp = await client.get(
                "https://cloudpricingcalculator.appspot.com/static/data/pricelist.json",
                timeout=15.0,
            )
            resp.raise_for_status()
            data = resp.json()
            gcp_prices = data.get("gcp_price_list", {})
            for region in regions:
                region_prices = {}
                compute = gcp_prices.get("CP-COMPUTEENGINE-VMIMAGE-E2-MEDIUM", {})
                cp = compute.get(region, compute.get("us", None))
                if cp and isinstance(cp, (int, float)) and cp > 0:
                    region_prices["Compute (VMs)"] = float(cp)
                storage = gcp_prices.get("CP-BIGSTORE-STORAGE", {})
                sp = storage.get(region, storage.get("us", None))
                if sp and isinstance(sp, (int, float)) and sp > 0:
                    region_prices["Object Storage"] = float(sp)
                result[region] = region_prices
        except Exception:
            for region in regions:
                result[region] = {}

    return result


# ── Build full regional price dataset ─────────────────────────────────────────

def _get_fallback_for_region(provider: str, region: str) -> dict:
    """Build fallback prices for a region by applying multiplier to base prices."""
    base = BASE_PRICES.get(provider, {})
    multipliers = ALL_MULTIPLIERS.get(provider, {})
    mult = multipliers.get(region, 1.0)
    prices = {}
    for cat, (name, unit, tier, price) in base.items():
        prices[cat] = round(price * mult, 8)
    return prices


def _make_region_pricing_dict(
    live_prices: dict,
    provider: str,
    regions: List[str],
) -> dict:
    """Build the full regional pricing dictionary combining live + fallback data.
    Returns {region: {category: {service_name, price_usd, unit, tier_label, price_status}}}.
    Also returns overall status info.
    """
    statuses = set()

    output = {}
    for region in regions:
        region_prices = live_prices.get(region, {})
        has_live = bool(region_prices)
        if has_live:
            statuses.add("live")
        else:
            statuses.add("fallback")

        base = BASE_PRICES.get(provider, {})
        multipliers = ALL_MULTIPLIERS.get(provider, {})
        mult = multipliers.get(region, 1.0)

        region_output = {}
        for cat, (name, unit, tier, base_price) in base.items():
            live_price = region_prices.get(cat)
            if live_price is not None:
                price_status = "live"
                price = live_price
            else:
                price_status = "fallback"
                price = round(base_price * mult, 8)

            region_output[cat] = {
                "service_name": name,
                "price_usd": price,
                "unit": unit,
                "tier_label": tier,
                "price_status": price_status,
            }
        output[region] = region_output

    overall_status = "live" if "live" in statuses else "fallback"
    return {"prices": output, "overall_status": overall_status}


# ── Main public API ───────────────────────────────────────────────────────────

async def get_regional_prices(
    provider: str,
    regions: Optional[List[str]] = None,
) -> dict:
    """Get per-region pricing for a provider.
    Returns {region: {category: {service_name, price_usd, unit, tier_label, price_status}}}.
    """
    from providers.registry import ProviderRegistry
    registry = ProviderRegistry.get_instance()
    prov = registry.get_provider(provider)
    if prov is None:
        return {"error": f"Provider '{provider}' not found", "prices": {}, "overall_status": "fallback"}

    if regions is None:
        region_data = await prov.get_regions()
        regions = [r["region_id"] for r in region_data]

    async with httpx.AsyncClient(
        follow_redirects=True,
        headers={"User-Agent": "DevOps-Command-Center/2.0 (cloud-cost-dashboard)"},
        limits=httpx.Limits(max_connections=20),
    ) as client:
        live_prices = await fetch_live_prices_for_provider(client, provider, regions)

    result = _make_region_pricing_dict(live_prices, provider, regions)

    global _regional_cache
    _regional_cache = RegionalPriceCache(
        entries={provider: result},
        fetched_at=datetime.now(timezone.utc),
        source=result["overall_status"],
    )

    return result


async def get_all_regional_prices(
    providers: Optional[List[str]] = None,
    regions: Optional[List[str]] = None,
) -> dict:
    """Get per-region pricing for all (or specified) providers.
    Returns {provider: {region: {category: {...}}}.
    """
    if providers is None:
        providers = ["aws", "azure", "gcp"]

    results = await asyncio.gather(
        *[get_regional_prices(p, regions) for p in providers],
        return_exceptions=True,
    )

    output = {}
    for provider, result in zip(providers, results):
        if isinstance(result, Exception):
            logger.error(f"Regional pricing fetch failed for {provider}: {result}")
            output[provider] = {"prices": {}, "overall_status": "fallback"}
        else:
            output[provider] = result

    return output


async def get_cached_regional_prices(
    providers: Optional[List[str]] = None,
    regions: Optional[List[str]] = None,
) -> dict:
    """Return cached regional pricing if fresh, otherwise fetch live."""
    if _cache_is_fresh() and _regional_cache.entries:
        if providers:
            result = {}
            for p in providers:
                if p in _regional_cache.entries:
                    result[p] = _regional_cache.entries[p]
                else:
                    result[p] = {"prices": {}, "overall_status": "fallback"}
            return result
        return _regional_cache.entries

    return await get_all_regional_prices(providers, regions)
