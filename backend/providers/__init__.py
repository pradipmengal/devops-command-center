"""
Provider plugin system for multi-cloud cost intelligence platform.

This package contains the abstract base class and concrete implementations
for cloud provider plugins that fetch service catalogs and pricing data.
"""

from .base import ProviderPlugin
from .registry import ProviderRegistry

__all__ = ["ProviderPlugin", "ProviderRegistry"]
