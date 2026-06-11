"""
Indian On-Premise Provider Plugins for Multi-Cloud Cost Intelligence Platform.

This module implements provider plugins for Indian on-premise data center
providers with static dummy pricing data for demonstration purposes.

Providers:
    - Tata Cloud
    - Jio Cloud
    - Yotta Infrastructure
    - NxtGen Data Centers
"""

import logging
from typing import List, Dict, Optional, Any
from datetime import datetime, timezone

from providers.base import ProviderPlugin
from models.service import ServiceCategory, PricingTier


logger = logging.getLogger(__name__)


_INDIAN_CATEGORIES = {
    1:  ("Compute (VMs)", "per hour", PricingTier.ON_DEMAND),
    2:  ("Managed Kubernetes", "per hour", PricingTier.ON_DEMAND),
    3:  ("Object Storage", "per GB-month", PricingTier.ON_DEMAND),
    4:  ("Managed Databases", "per hour", PricingTier.ON_DEMAND),
    5:  ("Container Registry", "per GB-month", PricingTier.ON_DEMAND),
    6:  ("Load Balancers", "per hour", PricingTier.ON_DEMAND),
    7:  ("Serverless Functions", "per million invocations", PricingTier.ON_DEMAND),
    8:  ("CDN", "per GB egress", PricingTier.ON_DEMAND),
    9:  ("VPC / Networking", "per hour", PricingTier.ON_DEMAND),
    10: ("Networking Egress", "per GB", PricingTier.ON_DEMAND),
    11: ("Managed Cache", "per hour", PricingTier.ON_DEMAND),
    12: ("Messaging & Queues", "per million messages", PricingTier.ON_DEMAND),
    13: ("Managed Kafka / Streaming", "per hour", PricingTier.ON_DEMAND),
    14: ("Block Storage (Disks)", "per GB-month", PricingTier.ON_DEMAND),
    15: ("Monitoring & Logging", "per GB ingested", PricingTier.ON_DEMAND),
    16: ("Secret Management", "per secret-month", PricingTier.ON_DEMAND),
    17: ("Data Warehousing", "per hour", PricingTier.ON_DEMAND),
    18: ("DNS", "per hosted zone-month", PricingTier.ON_DEMAND),
    19: ("Email / Notifications", "per million emails", PricingTier.ON_DEMAND),
    20: ("API Gateway", "per million API calls", PricingTier.ON_DEMAND),
    21: ("Container Orchestration (Serverless)", "per vCPU-hour", PricingTier.ON_DEMAND),
    22: ("Identity & Access (IAM)", "per MAU", PricingTier.ON_DEMAND),
    23: ("CI/CD Pipeline", "per pipeline-month", PricingTier.ON_DEMAND),
    24: ("Artifact / Package Registry", "per GB-month", PricingTier.ON_DEMAND),
    25: ("Machine Learning Platform", "per hour", PricingTier.ON_DEMAND),
    26: ("Backup & Disaster Recovery", "per GB-month", PricingTier.ON_DEMAND),
    27: ("File Storage (NFS/SMB)", "per GB-month", PricingTier.ON_DEMAND),
}


def _build_service_entry(
    provider_id: str,
    category_name: str,
    service_name: str,
    unit: str,
    price_usd: float,
    tier_label: str,
    default_region: str = "ap-south-1",
) -> Dict[str, Any]:
    return {
        "provider": provider_id,
        "category": category_name,
        "service_name": service_name,
        "unit": unit,
        "price_usd": price_usd,
        "tier_label": tier_label,
        "region": default_region,
        "metadata": {"service_family": category_name},
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "is_fallback": True,
        "is_anomaly": False,
    }


TATA_PRICES = [0.028, 0.07, 0.015, 0.045, 0.06, 0.005, 0.12, 0.005,
               0.03, 0.06, 0.012, 0.25, 0.14, 0.05, 0.30, 0.25,
               0.15, 0.30, 0.06, 2.00, 0.025, 0.0035, 0.60, 0.03,
               0.18, 0.03, 0.20]

TATA_NAMES = [
    "Tata Compute t2.small", "Tata Managed K8s", "Tata Object Store",
    "Tata Managed DB", "Tata Container Registry", "Tata Load Balancer",
    "Tata Functions", "Tata Edge CDN", "Tata Virtual Cloud",
    "Tata Data Transfer Out", "Tata Cache Service", "Tata Message Queue",
    "Tata Streams", "Tata Block Storage", "Tata Monitor",
    "Tata Secrets Vault", "Tata Data Warehouse", "Tata DNS",
    "Tata Email Service", "Tata API Gateway", "Tata Serverless Containers",
    "Tata IAM", "Tata CI/CD Pipeline", "Tata Artifact Registry",
    "Tata ML Platform", "Tata Backup Service", "Tata File Storage",
]


class TataCloudProvider(ProviderPlugin):
    def __init__(self):
        super().__init__(
            provider_id="tata_cloud",
            provider_name="Tata Cloud",
            api_version="1.0",
            rate_limit=5,
        )

    async def get_service_catalog(self, region=None, category=None, force_refresh=False):
        default_region = region or "ap-south-1"
        services = []
        for i, (cat_name, unit, tier) in _INDIAN_CATEGORIES.items():
            idx = i - 1
            entry = _build_service_entry(
                self.provider_id, cat_name, TATA_NAMES[idx],
                unit, TATA_PRICES[idx], tier.value, default_region,
            )
            services.append(entry)
        if category:
            services = [s for s in services if s["category"] == category]
        return services

    async def get_pricing_data(self, service_id: str, region=None) -> Dict[str, Any]:
        return {
            "service_id": service_id,
            "service_name": service_id,
            "base_price": 0.0,
            "pricing_tiers": [],
            "regional_pricing": {},
            "metadata": {"provider": self.provider_id, "fetched_at": datetime.now(timezone.utc).isoformat()},
        }

    async def get_regions(self) -> List[Dict[str, str]]:
        return [
            {"region_id": "ap-south-1", "region_name": "Mumbai", "location": "Asia Pacific"},
        ]

    async def validate_credentials(self, api_key=None, **kwargs) -> bool:
        return True


class JioCloudProvider(ProviderPlugin):
    def __init__(self):
        super().__init__(
            provider_id="jio_cloud",
            provider_name="Jio Cloud",
            api_version="1.0",
            rate_limit=5,
        )

    async def get_service_catalog(self, region=None, category=None, force_refresh=False):
        default_region = region or "ap-south-1"
        services = []
        for i, (cat_name, unit, tier) in _INDIAN_CATEGORIES.items():
            idx = i - 1
            entry = _build_service_entry(
                self.provider_id, cat_name, JIO_NAMES[idx],
                unit, JIO_PRICES[idx], tier.value, default_region,
            )
            services.append(entry)
        if category:
            services = [s for s in services if s["category"] == category]
        return services

    async def get_pricing_data(self, service_id: str, region=None) -> Dict[str, Any]:
        return {
            "service_id": service_id,
            "service_name": service_id,
            "base_price": 0.0,
            "pricing_tiers": [],
            "regional_pricing": {},
            "metadata": {"provider": self.provider_id, "fetched_at": datetime.now(timezone.utc).isoformat()},
        }

    async def get_regions(self) -> List[Dict[str, str]]:
        return [
            {"region_id": "ap-south-1", "region_name": "Mumbai", "location": "Asia Pacific"},
        ]

    async def validate_credentials(self, api_key=None, **kwargs) -> bool:
        return True


class YottaProvider(ProviderPlugin):
    def __init__(self):
        super().__init__(
            provider_id="yotta",
            provider_name="Yotta Infrastructure",
            api_version="1.0",
            rate_limit=5,
        )

    async def get_service_catalog(self, region=None, category=None, force_refresh=False):
        default_region = region or "ap-south-1"
        services = []
        for i, (cat_name, unit, tier) in _INDIAN_CATEGORIES.items():
            idx = i - 1
            entry = _build_service_entry(
                self.provider_id, cat_name, YOTTA_NAMES[idx],
                unit, YOTTA_PRICES[idx], tier.value, default_region,
            )
            services.append(entry)
        if category:
            services = [s for s in services if s["category"] == category]
        return services

    async def get_pricing_data(self, service_id: str, region=None) -> Dict[str, Any]:
        return {
            "service_id": service_id,
            "service_name": service_id,
            "base_price": 0.0,
            "pricing_tiers": [],
            "regional_pricing": {},
            "metadata": {"provider": self.provider_id, "fetched_at": datetime.now(timezone.utc).isoformat()},
        }

    async def get_regions(self) -> List[Dict[str, str]]:
        return [
            {"region_id": "ap-south-1", "region_name": "Mumbai", "location": "Asia Pacific"},
        ]

    async def validate_credentials(self, api_key=None, **kwargs) -> bool:
        return True


class NxtGenProvider(ProviderPlugin):
    def __init__(self):
        super().__init__(
            provider_id="nxtgen",
            provider_name="NxtGen Data Centers",
            api_version="1.0",
            rate_limit=5,
        )

    async def get_service_catalog(self, region=None, category=None, force_refresh=False):
        default_region = region or "ap-south-1"
        services = []
        for i, (cat_name, unit, tier) in _INDIAN_CATEGORIES.items():
            idx = i - 1
            entry = _build_service_entry(
                self.provider_id, cat_name, NXTGEN_NAMES[idx],
                unit, NXTGEN_PRICES[idx], tier.value, default_region,
            )
            services.append(entry)
        if category:
            services = [s for s in services if s["category"] == category]
        return services

    async def get_pricing_data(self, service_id: str, region=None) -> Dict[str, Any]:
        return {
            "service_id": service_id,
            "service_name": service_id,
            "base_price": 0.0,
            "pricing_tiers": [],
            "regional_pricing": {},
            "metadata": {"provider": self.provider_id, "fetched_at": datetime.now(timezone.utc).isoformat()},
        }

    async def get_regions(self) -> List[Dict[str, str]]:
        return [
            {"region_id": "ap-south-1", "region_name": "Mumbai", "location": "Asia Pacific"},
        ]

    async def validate_credentials(self, api_key=None, **kwargs) -> bool:
        return True
