"""
Provider Registry - Singleton for managing cloud provider plugins.

This module implements a singleton registry that manages all available provider
plugins. It supports auto-discovery of provider plugins from the providers directory,
registration, retrieval, and listing of providers.

Requirements:
    - Requirement 1.4: Provider Registry configuration
    - Requirement 2.1: Dynamic provider selection
"""

import os
import importlib
import inspect
from typing import Dict, List, Optional, Type
from pathlib import Path
import logging

from providers.base import ProviderPlugin


logger = logging.getLogger(__name__)


class ProviderRegistry:
    """
    Singleton registry for managing cloud provider plugins.
    
    The registry maintains a collection of provider plugins and provides methods
    to register, retrieve, and list providers. It supports auto-discovery of
    provider plugins from the providers directory.
    
    Usage:
        registry = ProviderRegistry.get_instance()
        registry.register_provider(aws_provider)
        provider = registry.get_provider("aws")
        all_providers = registry.list_providers()
    
    Requirements:
        - Requirement 1.4: Provider Registry configuration
        - Requirement 2.1: Dynamic provider selection
    """
    
    _instance: Optional['ProviderRegistry'] = None
    _initialized: bool = False
    
    def __new__(cls) -> 'ProviderRegistry':
        """Ensure only one instance of ProviderRegistry exists (Singleton pattern)."""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        """Initialize the registry (only once due to singleton pattern)."""
        if not self._initialized:
            self._providers: Dict[str, ProviderPlugin] = {}
            self._enabled_providers: Dict[str, bool] = {}
            self._initialized = True
            logger.info("ProviderRegistry initialized")
    
    @classmethod
    def get_instance(cls) -> 'ProviderRegistry':
        """
        Get the singleton instance of ProviderRegistry.
        
        Returns:
            The singleton ProviderRegistry instance
        """
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance
    
    def register_provider(
        self,
        provider: ProviderPlugin,
        enabled: bool = True,
        validate: bool = True
    ) -> bool:
        """
        Register a provider plugin with the registry.
        
        This method validates that the provider implements all required methods
        from the ProviderPlugin interface before registering it.
        
        Args:
            provider: The provider plugin instance to register
            enabled: Whether the provider should be enabled (default: True)
            validate: Whether to validate the provider interface (default: True)
        
        Returns:
            True if registration successful, False otherwise
        
        Raises:
            ValueError: If provider is None or validation fails
            TypeError: If provider doesn't inherit from ProviderPlugin
        
        Requirements:
            - Requirement 1.4: Provider registration
            - Requirement 1.5: Provider interface validation
        
        Example:
            >>> registry = ProviderRegistry.get_instance()
            >>> aws_provider = AWSProvider()
            >>> registry.register_provider(aws_provider)
            True
        """
        if provider is None:
            raise ValueError("Provider cannot be None")
        
        if not isinstance(provider, ProviderPlugin):
            raise TypeError(
                f"Provider must inherit from ProviderPlugin, got {type(provider)}"
            )
        
        provider_id = provider.provider_id
        
        if not provider_id:
            raise ValueError("Provider must have a non-empty provider_id")
        
        # Validate that provider implements all required abstract methods
        if validate:
            if not self._validate_provider_interface(provider):
                raise ValueError(
                    f"Provider '{provider_id}' does not implement all required "
                    f"methods from ProviderPlugin interface"
                )
        
        # Register the provider
        self._providers[provider_id] = provider
        self._enabled_providers[provider_id] = enabled
        
        logger.info(
            f"Registered provider '{provider_id}' "
            f"({provider.provider_name}) - enabled: {enabled}"
        )
        
        return True
    
    def _validate_provider_interface(self, provider: ProviderPlugin) -> bool:
        """
        Validate that a provider implements all required abstract methods.
        
        Args:
            provider: The provider plugin to validate
        
        Returns:
            True if provider implements all required methods, False otherwise
        """
        required_methods = [
            'get_service_catalog',
            'get_pricing_data',
            'get_regions',
            'validate_credentials'
        ]
        
        for method_name in required_methods:
            if not hasattr(provider, method_name):
                logger.error(
                    f"Provider '{provider.provider_id}' missing method: {method_name}"
                )
                return False
            
            method = getattr(provider, method_name)
            if not callable(method):
                logger.error(
                    f"Provider '{provider.provider_id}' attribute '{method_name}' "
                    f"is not callable"
                )
                return False
        
        return True
    
    def get_provider(self, provider_id: str) -> Optional[ProviderPlugin]:
        """
        Get a provider plugin by its ID.
        
        Args:
            provider_id: The unique identifier of the provider (e.g., "aws", "azure", "gcp")
        
        Returns:
            The provider plugin instance if found, None otherwise
        
        Requirements:
            - Requirement 1.4: Provider retrieval
        
        Example:
            >>> registry = ProviderRegistry.get_instance()
            >>> aws_provider = registry.get_provider("aws")
            >>> if aws_provider:
            ...     print(aws_provider.provider_name)
            Amazon Web Services
        """
        provider = self._providers.get(provider_id)
        
        if provider is None:
            logger.warning(f"Provider '{provider_id}' not found in registry")
        
        return provider
    
    def list_providers(self, enabled_only: bool = False) -> List[ProviderPlugin]:
        """
        Get a list of all registered provider plugins.
        
        Args:
            enabled_only: If True, return only enabled providers (default: False)
        
        Returns:
            List of provider plugin instances
        
        Requirements:
            - Requirement 1.4: Provider listing
            - Requirement 2.1: Dynamic provider selection
        
        Example:
            >>> registry = ProviderRegistry.get_instance()
            >>> all_providers = registry.list_providers()
            >>> enabled_providers = registry.list_providers(enabled_only=True)
        """
        if enabled_only:
            return [
                provider for provider_id, provider in self._providers.items()
                if self._enabled_providers.get(provider_id, False)
            ]
        
        return list(self._providers.values())
    
    def get_enabled_providers(self) -> List[ProviderPlugin]:
        """
        Get a list of all enabled provider plugins.
        
        This is a convenience method equivalent to list_providers(enabled_only=True).
        
        Returns:
            List of enabled provider plugin instances
        
        Requirements:
            - Requirement 1.4: Provider listing
            - Requirement 2.1: Dynamic provider selection
        
        Example:
            >>> registry = ProviderRegistry.get_instance()
            >>> enabled_providers = registry.get_enabled_providers()
            >>> for provider in enabled_providers:
            ...     print(f"{provider.provider_id}: {provider.provider_name}")
        """
        return self.list_providers(enabled_only=True)
    
    def is_provider_enabled(self, provider_id: str) -> bool:
        """
        Check if a provider is enabled.
        
        Args:
            provider_id: The unique identifier of the provider
        
        Returns:
            True if provider is registered and enabled, False otherwise
        """
        return self._enabled_providers.get(provider_id, False)
    
    def enable_provider(self, provider_id: str) -> bool:
        """
        Enable a registered provider.
        
        Args:
            provider_id: The unique identifier of the provider
        
        Returns:
            True if provider was enabled, False if provider not found
        """
        if provider_id not in self._providers:
            logger.warning(f"Cannot enable provider '{provider_id}': not registered")
            return False
        
        self._enabled_providers[provider_id] = True
        logger.info(f"Enabled provider '{provider_id}'")
        return True
    
    def disable_provider(self, provider_id: str) -> bool:
        """
        Disable a registered provider.
        
        Args:
            provider_id: The unique identifier of the provider
        
        Returns:
            True if provider was disabled, False if provider not found
        """
        if provider_id not in self._providers:
            logger.warning(f"Cannot disable provider '{provider_id}': not registered")
            return False
        
        self._enabled_providers[provider_id] = False
        logger.info(f"Disabled provider '{provider_id}'")
        return True
    
    def unregister_provider(self, provider_id: str) -> bool:
        """
        Unregister a provider from the registry.
        
        Args:
            provider_id: The unique identifier of the provider
        
        Returns:
            True if provider was unregistered, False if provider not found
        """
        if provider_id not in self._providers:
            logger.warning(f"Cannot unregister provider '{provider_id}': not found")
            return False
        
        del self._providers[provider_id]
        del self._enabled_providers[provider_id]
        logger.info(f"Unregistered provider '{provider_id}'")
        return True
    
    def get_provider_count(self) -> int:
        """
        Get the total number of registered providers.
        
        Returns:
            Number of registered providers
        """
        return len(self._providers)
    
    def get_enabled_provider_count(self) -> int:
        """
        Get the number of enabled providers.
        
        Returns:
            Number of enabled providers
        """
        return sum(1 for enabled in self._enabled_providers.values() if enabled)
    
    def auto_discover_providers(self, providers_dir: Optional[str] = None) -> int:
        """
        Auto-discover and register provider plugins from the providers directory.
        
        This method scans the providers directory for Python modules that contain
        classes inheriting from ProviderPlugin. It automatically imports and
        registers any discovered provider plugins.
        
        Args:
            providers_dir: Path to the providers directory (default: current package directory)
        
        Returns:
            Number of providers discovered and registered
        
        Requirements:
            - Requirement 1.4: Auto-discovery of provider plugins
        
        Example:
            >>> registry = ProviderRegistry.get_instance()
            >>> count = registry.auto_discover_providers()
            >>> print(f"Discovered {count} providers")
        """
        if providers_dir is None:
            # Use the directory of this module (providers package)
            providers_dir = os.path.dirname(os.path.abspath(__file__))
        
        providers_path = Path(providers_dir)
        
        if not providers_path.exists() or not providers_path.is_dir():
            logger.error(f"Providers directory not found: {providers_dir}")
            return 0
        
        discovered_count = 0
        
        # Scan for Python files in the providers directory
        for file_path in providers_path.glob("*.py"):
            # Skip non-provider files
            if file_path.stem in ["__init__", "base", "registry", "test_registry", "example_usage"]:
                continue
            
            try:
                # Import the module
                module_name = f"providers.{file_path.stem}"
                module = importlib.import_module(module_name)
                
                # Find classes that inherit from ProviderPlugin
                for name, obj in inspect.getmembers(module, inspect.isclass):
                    # Check if it's a subclass of ProviderPlugin (but not ProviderPlugin itself)
                    if (issubclass(obj, ProviderPlugin) and 
                        obj is not ProviderPlugin and
                        obj.__module__ == module_name):
                        
                        try:
                            # Instantiate the provider
                            provider_instance = obj()
                            
                            # Register the provider
                            self.register_provider(provider_instance, enabled=True)
                            discovered_count += 1
                            
                            logger.info(
                                f"Auto-discovered provider: {provider_instance.provider_id} "
                                f"from {file_path.name}"
                            )
                        
                        except Exception as e:
                            logger.error(
                                f"Failed to instantiate provider {name} from {file_path.name}: {e}"
                            )
            
            except Exception as e:
                logger.error(f"Failed to import module {file_path.name}: {e}")
        
        logger.info(f"Auto-discovery complete: {discovered_count} providers registered")
        return discovered_count
    
    def clear(self) -> None:
        """
        Clear all registered providers from the registry.
        
        This method is primarily useful for testing purposes.
        """
        self._providers.clear()
        self._enabled_providers.clear()
        logger.info("Registry cleared")
    
    def __repr__(self) -> str:
        """String representation of the registry."""
        enabled_count = self.get_enabled_provider_count()
        total_count = self.get_provider_count()
        return (
            f"ProviderRegistry(providers={total_count}, "
            f"enabled={enabled_count})"
        )
