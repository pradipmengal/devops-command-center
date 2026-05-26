"""
Application settings loaded from environment variables.
"""

import os


def get_infracost_api_key() -> str:
    """Returns the Infracost API key from env var or empty string."""
    return os.environ.get("INFRACOST_API_KEY", "")


def is_infracost_configured() -> bool:
    """Check if Infracost integration is configured."""
    return bool(get_infracost_api_key())
