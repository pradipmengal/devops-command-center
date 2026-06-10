"""
Application settings loaded from environment variables and local configuration.
"""

import os
import json
from pathlib import Path
from typing import Optional, Dict, Any

# Path to the settings files
CONFIG_DIR = Path(__file__).parent.parent / "config"
AWS_SETTINGS_FILE = CONFIG_DIR / "aws_settings.json"
GCP_SETTINGS_FILE = CONFIG_DIR / "gcp_settings.json"


def get_infracost_api_key() -> str:
    """Returns the Infracost API key from env var or empty string."""
    return os.environ.get("INFRACOST_API_KEY", "")


def is_infracost_configured() -> bool:
    """Check if Infracost integration is configured."""
    return bool(get_infracost_api_key())


def _ensure_config_dir() -> None:
    """Ensure the config directory exists."""
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)


# ── AWS Credentials ───────────────────────────────────────────────────────────

def get_aws_credentials() -> Optional[Dict[str, str]]:
    """Returns AWS credentials from local config file, or None if not configured."""
    if not AWS_SETTINGS_FILE.exists():
        return None
    
    try:
        with open(AWS_SETTINGS_FILE, "r") as f:
            data = json.load(f)
            if "access_key_id" in data and "secret_access_key" in data:
                return data
    except (json.JSONDecodeError, IOError):
        return None
    
    return None


def save_aws_credentials(access_key_id: str, secret_access_key: str) -> bool:
    """Saves AWS credentials to local config file securely."""
    try:
        _ensure_config_dir()
        data = {
            "access_key_id": access_key_id.strip(),
            "secret_access_key": secret_access_key.strip()
        }
        with open(AWS_SETTINGS_FILE, "w") as f:
            json.dump(data, f, indent=2)
        return True
    except IOError:
        return False


def is_aws_configured() -> bool:
    """Check if AWS credentials are configured."""
    creds = get_aws_credentials()
    return bool(creds and creds.get("access_key_id") and creds.get("secret_access_key"))


def get_masked_aws_access_key() -> Optional[str]:
    """Returns a masked version of the AWS access key for UI display."""
    creds = get_aws_credentials()
    if not creds or not creds.get("access_key_id"):
        return None
    
    key = creds["access_key_id"]
    if len(key) > 8:
        return f"{key[:4]}****{key[-4:]}"
    return "****"


# ── GCP Credentials ───────────────────────────────────────────────────────────

def get_gcp_credentials() -> Optional[Dict[str, Any]]:
    """Returns GCP Service Account JSON credentials, or None if not configured."""
    if not GCP_SETTINGS_FILE.exists():
        return None
    
    try:
        with open(GCP_SETTINGS_FILE, "r") as f:
            data = json.load(f)
            if "type" in data and data.get("type") == "service_account":
                return data
    except (json.JSONDecodeError, IOError):
        return None
    
    return None


def save_gcp_credentials(json_content: str) -> bool:
    """Saves GCP Service Account JSON to local config file securely."""
    try:
        _ensure_config_dir()
        # Validate it's valid JSON and has required fields
        data = json.loads(json_content.strip())
        if "type" not in data or data.get("type") != "service_account":
            return False
        
        with open(GCP_SETTINGS_FILE, "w") as f:
            json.dump(data, f, indent=2)
        return True
    except (json.JSONDecodeError, IOError):
        return False


def is_gcp_configured() -> bool:
    """Check if GCP credentials are configured."""
    creds = get_gcp_credentials()
    return bool(creds)


def get_masked_gcp_client_email() -> Optional[str]:
    """Returns a masked version of the GCP service account email for UI display."""
    creds = get_gcp_credentials()
    if not creds or not creds.get("client_email"):
        return None
    
    email = creds["client_email"]
    parts = email.split("@")
    if len(parts) == 2:
        name = parts[0]
        domain = parts[1]
        masked_name = name[:4] + "****" + name[-4:] if len(name) > 8 else "****"
        return f"{masked_name}@{domain}"
    return "****"


def delete_aws_credentials() -> bool:
    """Deletes AWS credentials from local config file."""
    try:
        if AWS_SETTINGS_FILE.exists():
            AWS_SETTINGS_FILE.unlink()
        return True
    except IOError:
        return False


def delete_gcp_credentials() -> bool:
    """Deletes GCP credentials from local config file."""
    try:
        if GCP_SETTINGS_FILE.exists():
            GCP_SETTINGS_FILE.unlink()
        return True
    except IOError:
        return False