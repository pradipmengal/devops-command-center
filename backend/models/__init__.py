"""
Data models for the Multi-Cloud Cost Intelligence Platform.

This package contains Pydantic models for service entries, providers,
optimization suggestions, and other data structures used throughout the platform.

Also re-exports legacy models from models.py for backward compatibility.
"""

from .service import ServiceEntry

# Re-export legacy models from the flat models.py file so existing routes
# that do `from models import DockerRequest` continue to work.
import sys
import importlib
import os

# Load the flat models.py alongside this package
_flat_models_path = os.path.join(os.path.dirname(__file__), '..', 'models.py')
_flat_models_path = os.path.normpath(_flat_models_path)

if os.path.exists(_flat_models_path):
    import importlib.util as _ilu
    _spec = _ilu.spec_from_file_location("_flat_models", _flat_models_path)
    _flat = _ilu.module_from_spec(_spec)
    _spec.loader.exec_module(_flat)
    
    # Re-export everything from the flat models
    from typing import Any as _Any
    import inspect as _inspect
    for _name, _obj in _inspect.getmembers(_flat):
        if not _name.startswith('_'):
            globals()[_name] = _obj

__all__ = ["ServiceEntry"]
