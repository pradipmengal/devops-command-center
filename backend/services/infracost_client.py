"""
Infracost Cloud Pricing API Client
====================================
GraphQL client for https://pricing.api.infracost.io/graphql

Contains 10M+ curated prices across AWS, Azure, and GCP.
Auto-updated weekly. Free API key at https://infracost.io
"""

import asyncio
import logging
import os
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone

import httpx

logger = logging.getLogger(__name__)

INFRACOST_API_URL = "https://pricing.api.infracost.io/graphql"


# ── Service mapping: our category -> (vendor, service, attributeFilters) ──────

# Each entry: category -> (vendorName, service, [attribute filters])
# Attribute filters narrow down to a specific instance type / SKU.

AWS_SERVICE_QUERIES = {
    "Compute (VMs)": ("aws", "AmazonEC2", [
        {"key": "instanceType", "value": "t3.medium"},
        {"key": "operatingSystem", "value": "Linux"},
        {"key": "tenancy", "value": "Shared"},
        {"key": "capacitystatus", "value": "Used"},
        {"key": "preInstalledSw", "value": "NA"},
    ], "Compute Instance"),
    "Object Storage": ("aws", "AmazonS3", [
        {"key": "storageClass", "value": "General Purpose"},
    ]),
    "Managed Databases": ("aws", "AmazonRDS", [
        {"key": "instanceType", "value": "db.t3.medium"},
        {"key": "databaseEngine", "value": "MySQL"},
    ]),
    "Block Storage (Disks)": ("aws", "AmazonEBS", [
        {"key": "volumeType", "value": "General Purpose"},
    ]),
    "Serverless Functions": ("aws", "AWSLambda", [
        {"key": "usagetype", "value": "Lambda-GB-Second"},
    ]),
    "Managed Kubernetes": ("aws", "AmazonEKS", [
        {"key": "usagetype", "value": "EKS-ControlPlane-Hours"},
    ]),
    "Load Balancers": ("aws", "ElasticLoadBalancing", [
        {"key": "usagetype", "value": "LCU-Hours"},
    ]),
    "CDN": ("aws", "AmazonCloudFront", [
        {"key": "usagetype", "value": "DataTransfer-Out-Bytes"},
    ]),
    "DNS": ("aws", "AmazonRoute53", [
        {"key": "usagetype", "value": "HostedZone"},
    ]),
    "Managed Cache": ("aws", "AmazonElastiCache", [
        {"key": "instanceType", "value": "cache.t3.micro"},
    ]),
    "Messaging & Queues": ("aws", "AmazonSQS", [
        {"key": "usagetype", "value": "Requests-Tier1"},
    ]),
    "Data Warehousing": ("aws", "AmazonRedshift", [
        {"key": "instanceType", "value": "dc2.large"},
    ]),
    "Networking Egress": ("aws", "AWSDataTransfer", [
        {"key": "usagetype", "value": "DataTransfer-Out-Bytes"},
    ]),
    "Monitoring & Logging": ("aws", "AmazonCloudWatch", [
        {"key": "usagetype", "value": "CW-LogBytesScanned"},
    ]),
}

AZURE_SERVICE_QUERIES = {
    "Compute (VMs)": ("azure", "Virtual Machines", [
        {"key": "skuName", "value": "Standard_B2s"},
        {"key": "productName", "value": "Virtual Machines B Series"},
    ]),
    "Object Storage": ("azure", "Storage", [
        {"key": "skuName", "value": "Standard LRS"},
        {"key": "productName", "value": "Blob Storage Hot LRS"},
    ]),
    "Managed Databases": ("azure", "Azure SQL Database", [
        {"key": "skuName", "value": "GP_Gen5_2"},
    ]),
    "Block Storage (Disks)": ("azure", "Managed Disks", [
        {"key": "skuName", "value": "S10"},
    ]),
    "Serverless Functions": ("azure", "Functions", [
        {"key": "productName", "value": "Functions"},
    ]),
    "Load Balancers": ("azure", "Load Balancer", [
        {"key": "skuName", "value": "Standard"},
    ]),
    "CDN": ("azure", "CDN", [
        {"key": "productName", "value": "CDN"},
    ]),
    "DNS": ("azure", "Azure DNS", [
        {"key": "productName", "value": "DNS"},
    ]),
    "Managed Cache": ("azure", "Azure Cache for Redis", [
        {"key": "productName", "value": "Azure Cache for Redis"},
    ]),
    "Messaging & Queues": ("azure", "Service Bus", [
        {"key": "productName", "value": "Service Bus"},
    ]),
}

GCP_SERVICE_QUERIES = {
    "Compute (VMs)": ("gcp", "Compute Engine", [
        {"key": "machineType", "value": "e2-medium"},
    ]),
    "Object Storage": ("gcp", "Cloud Storage", [
        {"key": "storageClass", "value": "Standard"},
    ]),
    "Managed Databases": ("gcp", "Cloud SQL", [
        {"key": "machineType", "value": "db-n1-standard-1"},
    ]),
    "Managed Kubernetes": ("gcp", "GKE", [
        {"key": "description", "value": "Cluster management fee"},
    ]),
    "Serverless Functions": ("gcp", "Cloud Functions", [
        {"key": "description", "value": "Invocation"},
    ]),
    "Load Balancers": ("gcp", "Cloud Load Balancing", [
        {"key": "description", "value": "Forwarding rule"},
    ]),
    "CDN": ("gcp", "Cloud CDN", [
        {"key": "description", "value": "Cache egress"},
    ]),
    "DNS": ("gcp", "Cloud DNS", [
        {"key": "description", "value": "Managed zone"},
    ]),
    "Block Storage (Disks)": ("gcp", "Compute Engine", [
        {"key": "description", "value": "SSD backed PD Capacity"},
    ]),
    "Networking Egress": ("gcp", "Cloud CDN", [
        {"key": "description", "value": "Data transfer"},
    ]),
}

SERVICE_QUERIES = {
    "aws": AWS_SERVICE_QUERIES,
    "azure": AZURE_SERVICE_QUERIES,
    "gcp": GCP_SERVICE_QUERIES,
}


def _build_graphql_query(category: str, vendor: str, service: str,
                         region: str, attributes: List[dict],
                         product_family: Optional[str] = None) -> str:
    """Build a single GraphQL query for one product.

    Matches the official Infracost Cloud Pricing API query format:
    https://www.infracost.io/docs/supported_resources/cloud_pricing_api/
    """
    attr_filters = "".join(
        f'{{key: "{a["key"]}", value: "{a["value"]}"}},' for a in attributes
    )
    family_filter = f'\n    productFamily: "{product_family}"' if product_family else ""
    alias = category.replace(" ", "_").replace("(", "").replace(")", "").replace("/", "_")
    return f"""
  {alias}: products(filter: {{
    vendorName: "{vendor}"
    service: "{service}"{family_filter}
    region: "{region}"
    attributeFilters: [{attr_filters}]
  }}) {{
    prices(filter: {{purchaseOption: "on_demand"}}) {{
      USD
      unit
    }}
  }}
"""


def _build_batch_query(vendor: str, region: str,
                        categories: List[str]) -> str:
    """Build a batched GraphQL query for multiple products."""
    queries = []
    for cat in categories:
        entry = SERVICE_QUERIES.get(vendor, {}).get(cat)
        if entry:
            v, s, attrs, *rest = entry
            pf = rest[0] if rest else None
            queries.append(_build_graphql_query(cat, v, s, region, attrs, product_family=pf))
    if not queries:
        return ""
    return "{" + "\n".join(queries) + "\n}"


def _extract_price(result: dict) -> Optional[float]:
    """Extract USD price from a GraphQL product result."""
    try:
        if result and len(result) > 0:
            prices = result[0].get("prices", [])
            if prices:
                return float(prices[0].get("USD", 0))
    except (IndexError, TypeError, ValueError):
        pass
    return None


def _extract_unit(result: dict) -> Optional[str]:
    """Extract unit from a GraphQL product result."""
    try:
        if result and len(result) > 0:
            prices = result[0].get("prices", [])
            if prices:
                return prices[0].get("unit")
    except (IndexError, TypeError, ValueError):
        pass
    return None


class InfracostClient:
    """
    Client for the Infracost Cloud Pricing GraphQL API.

    Usage:
        client = InfracostClient(api_key="your_key")
        prices = await client.get_prices("aws", "us-east-1")
        # Returns: {"Compute (VMs)": {"price_usd": 0.0416, "unit": "Hrs", "status": "live"}}
    """

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.environ.get("INFRACOST_API_KEY")
        self._client: Optional[httpx.AsyncClient] = None

    def is_configured(self) -> bool:
        return bool(self.api_key)

    def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(
                timeout=30.0,
                follow_redirects=True,
                headers={
                    "X-Api-Key": self.api_key or "",
                    "Content-Type": "application/json",
                    "User-Agent": "DevOps-Command-Center/2.0",
                },
            )
        return self._client

    async def close(self):
        if self._client is not None:
            await self._client.aclose()
            self._client = None

    async def execute_query(self, query: str) -> dict:
        """Execute a raw GraphQL query and return the data."""
        if not self.api_key:
            raise ValueError(
                "INFRACOST_API_KEY not set. "
                "Get a free key at https://infracost.io or set the env var."
            )
        client = self._get_client()
        resp = await client.post(
            INFRACOST_API_URL,
            json={"query": query},
        )
        resp.raise_for_status()
        data = resp.json()
        if "errors" in data:
            logger.warning(f"Infracost API errors: {data['errors']}")
            raise Exception(f"Infracost API error: {data['errors']}")
        return data.get("data", {})

    async def get_prices(self, vendor: str, region: str,
                         categories: Optional[List[str]] = None) -> dict:
        """
        Get live prices for a provider in a specific region.

        Args:
            vendor: "aws" | "azure" | "gcp"
            region: Region ID (e.g. "us-east-1", "eastus", "us-central1")
            categories: List of categories to query. None = all known categories.

        Returns:
            {category: {"price_usd": float, "unit": str, "price_status": "live"}}
        """
        if categories is None:
            categories = list(SERVICE_QUERIES.get(vendor, {}).keys())

        query = _build_batch_query(vendor, region, categories)
        if not query:
            logger.warning(f"No service queries defined for {vendor}/{region}")
            return {}

        try:
            result = await self.execute_query(query)
        except Exception as e:
            logger.warning(f"Infracost query failed for {vendor}/{region}: {e}")
            return {}

        prices = {}
        for cat in categories:
            alias = cat.replace(" ", "_").replace("(", "").replace(")", "").replace("/", "_")
            product_data = result.get(alias, [])
            price = _extract_price(product_data)
            if price is not None and price > 0:
                unit = _extract_unit(product_data) or "per hour"
                prices[cat] = {
                    "price_usd": price,
                    "unit": unit,
                    "price_status": "live",
                }

        if prices:
            logger.info(f"Infracost: {len(prices)} live prices for {vendor}/{region}")
        else:
            logger.debug(f"Infracost: no live prices found for {vendor}/{region}")

        return prices

    async def get_prices_batch(self, vendor_region_pairs: List[tuple]) -> dict:
        """
        Get prices for multiple (vendor, region) pairs in parallel.

        Args:
            pairs: List of (vendor, region) tuples

        Returns:
            {vendor: {region: {category: {price_usd, unit, price_status}}}}
        """
        tasks = [self.get_prices(v, r) for v, r in vendor_region_pairs]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        output: dict = {}
        for (vendor, region), result in zip(vendor_region_pairs, results):
            if isinstance(result, dict) and result:
                if vendor not in output:
                    output[vendor] = {}
                output[vendor][region] = result
        return output

    async def health_check(self) -> dict:
        """Check if the API key is valid and the API is reachable.

        Uses the official query from the Cloud Pricing API docs first.
        Falls back to a broader query if the exact match returns nothing.
        """
        try:
            query = '{ products(filter: {vendorName: "aws", service: "AmazonEC2", productFamily: "Compute Instance", region: "us-east-1", attributeFilters: [{key: "instanceType", value: "m3.large"}, {key: "operatingSystem", value: "Linux"}, {key: "tenancy", value: "Shared"}, {key: "capacitystatus", value: "Used"}, {key: "preInstalledSw", value: "NA"}]}) { prices(filter: {purchaseOption: "on_demand"}) { USD unit } } }'
            data = await self.execute_query(query)
            products = data.get("products", [])
            if products and products[0].get("prices"):
                return {"status": "healthy", "message": "Infracost API is responding"}
        except Exception:
            pass

        # Fallback: broader query — check API reachability without strict filters
        try:
            fallback = '{ products(filter: {vendorName: "aws", service: "AmazonEC2", region: "us-east-1"}) { prices(filter: {purchaseOption: "on_demand"}) { USD unit } } }'
            data = await self.execute_query(fallback)
            return {"status": "healthy", "message": "Infracost API is reachable (broad query fallback)"}
        except Exception as e:
            return {"status": "unhealthy", "message": str(e)}

    async def get_available_services(self, vendor: str) -> List[str]:
        """List available services from Infracost for a vendor."""
        query = f'{{ __type(name: "VendorName") {{ enumValues {{ name }} }} }}'
        try:
            data = await self.execute_query(query)
            return [v["name"] for v in data.get("__type", {}).get("enumValues", [])]
        except Exception:
            return []
