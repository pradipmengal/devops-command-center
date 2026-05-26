"""
Export Service - CSV and JSON export for service catalog and comparisons. Tasks 17.1, 17.2
"""

import csv
import json
import io
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


class ExportService:
    """Generates CSV and JSON exports for service data."""

    def export_services_csv(self, services: List[Dict[str, Any]]) -> str:
        """Export service list to CSV string."""
        if not services:
            return ""

        output = io.StringIO()
        fieldnames = [
            "provider", "service_name", "category", "price_usd",
            "unit", "tier_label", "region", "vcpu", "memory_gb",
            "storage_gb", "is_fallback", "fetched_at"
        ]

        writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction='ignore')
        writer.writeheader()

        for service in services:
            writer.writerow({k: service.get(k, "") for k in fieldnames})

        return output.getvalue()

    def export_services_json(self, services: List[Dict[str, Any]], metadata: Optional[Dict] = None) -> str:
        """Export service list to JSON string."""
        payload = {
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "service_count": len(services),
            "metadata": metadata or {},
            "services": services
        }
        return json.dumps(payload, indent=2, default=str)

    def export_comparison_csv(self, comparison_data: List[Dict[str, Any]]) -> str:
        """Export comparison results to CSV."""
        if not comparison_data:
            return ""

        output = io.StringIO()
        fieldnames = [
            "provider", "service_name", "category", "price_usd",
            "unit", "tier_label", "is_cheapest", "price_difference",
            "price_difference_pct"
        ]

        writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction='ignore')
        writer.writeheader()

        for item in comparison_data:
            for service in item.get("services", []):
                row = {
                    "provider": service.get("provider", ""),
                    "service_name": service.get("service_name", ""),
                    "category": item.get("category", ""),
                    "price_usd": service.get("price_usd", ""),
                    "unit": service.get("unit", ""),
                    "tier_label": service.get("tier_label", ""),
                    "is_cheapest": service.get("is_cheapest", False),
                    "price_difference": service.get("price_difference", 0),
                    "price_difference_pct": service.get("price_difference_pct", 0)
                }
                writer.writerow(row)

        return output.getvalue()

    def export_cost_estimate_csv(self, estimate_data: Dict[str, Any]) -> str:
        """Export cost estimate to CSV."""
        output = io.StringIO()
        fieldnames = [
            "provider", "service_name", "category",
            "hourly_cost", "daily_cost", "monthly_cost", "annual_cost"
        ]

        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()

        for est in estimate_data.get("estimates", []):
            service = est.get("service", {})
            costs = est.get("costs", {})
            writer.writerow({
                "provider": service.get("provider", ""),
                "service_name": service.get("service_name", ""),
                "category": service.get("category", ""),
                "hourly_cost": costs.get("hourly", 0),
                "daily_cost": costs.get("daily", 0),
                "monthly_cost": costs.get("monthly", 0),
                "annual_cost": costs.get("annual", 0)
            })

        # Add totals row
        totals = estimate_data.get("totals", {})
        writer.writerow({
            "provider": "TOTAL",
            "service_name": "",
            "category": "",
            "hourly_cost": totals.get("hourly", 0),
            "daily_cost": totals.get("daily", 0),
            "monthly_cost": totals.get("monthly", 0),
            "annual_cost": totals.get("annual", 0)
        })

        return output.getvalue()


# Singleton
_export_service = ExportService()


def get_export_service() -> ExportService:
    return _export_service
