"""
Settings API routes for cloud provider configurations.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from services.settings import (
    get_aws_credentials,
    save_aws_credentials,
    is_aws_configured,
    get_masked_aws_access_key,
    get_gcp_credentials,
    save_gcp_credentials,
    is_gcp_configured,
    get_masked_gcp_client_email
)

router = APIRouter(prefix="/settings", tags=["settings"])


class AWSCredentialsRequest(BaseModel):
    access_key_id: str
    secret_access_key: str


class AWSCredentialsResponse(BaseModel):
    configured: bool
    masked_access_key_id: Optional[str] = None


class GCPCredentialsRequest(BaseModel):
    json_content: str


class GCPCredentialsResponse(BaseModel):
    configured: bool
    masked_client_email: Optional[str] = None


class TestCredentialsResponse(BaseModel):
    valid: bool
    message: str


# ── AWS Endpoints ─────────────────────────────────────────────────────────────

@router.get("/aws-credentials", response_model=AWSCredentialsResponse)
async def get_aws_credentials_status():
    """Get the status of AWS credentials configuration (returns masked key only)."""
    return AWSCredentialsResponse(
        configured=is_aws_configured(),
        masked_access_key_id=get_masked_aws_access_key()
    )


@router.post("/aws-credentials/test", response_model=TestCredentialsResponse)
async def test_aws_credentials(req: AWSCredentialsRequest):
    """Test AWS credentials validity using STS GetCallerIdentity."""
    try:
        import boto3
        from botocore.exceptions import ClientError, NoCredentialsError, PartialCredentialsError

        sts_client = boto3.client(
            'sts',
            aws_access_key_id=req.access_key_id.strip(),
            aws_secret_access_key=req.secret_access_key.strip(),
            region_name='us-east-1'
        )
        
        response = sts_client.get_caller_identity()
        account_id = response.get('Account', 'Unknown')
        
        return TestCredentialsResponse(
            valid=True,
            message=f"Successfully authenticated. Account: {account_id}"
        )
    except (NoCredentialsError, PartialCredentialsError):
        return TestCredentialsResponse(
            valid=False,
            message="Incomplete credentials provided. Please check Access Key ID and Secret Access Key."
        )
    except ClientError as e:
        error_code = e.response.get('Error', {}).get('Code', 'Unknown')
        return TestCredentialsResponse(
            valid=False,
            message=f"AWS API Error: {error_code}. Please verify your credentials."
        )
    except Exception as e:
        return TestCredentialsResponse(
            valid=False,
            message=f"Connection failed: {str(e)}"
        )


@router.post("/aws-credentials")
async def save_aws_credentials_endpoint(req: AWSCredentialsRequest):
    """Save validated AWS credentials to local configuration."""
    test_result = await test_aws_credentials(req)
    if not test_result.valid:
        raise HTTPException(status_code=400, detail=test_result.message)
    
    success = save_aws_credentials(req.access_key_id, req.secret_access_key)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to save credentials")
    
    return {"status": "success", "message": "AWS credentials saved successfully"}


# ── GCP Endpoints ─────────────────────────────────────────────────────────────

@router.get("/gcp-credentials", response_model=GCPCredentialsResponse)
async def get_gcp_credentials_status():
    """Get the status of GCP credentials configuration (returns masked email only)."""
    return GCPCredentialsResponse(
        configured=is_gcp_configured(),
        masked_client_email=get_masked_gcp_client_email()
    )


@router.post("/gcp-credentials/test", response_model=TestCredentialsResponse)
async def test_gcp_credentials(req: GCPCredentialsRequest):
    """Test GCP Service Account JSON validity."""
    try:
        import json
        from google.oauth2 import service_account
        
        # Attempt to parse and load the credentials
        data = json.loads(req.json_content.strip())
        
        if data.get("type") != "service_account":
            return TestCredentialsResponse(
                valid=False,
                message="Invalid JSON: 'type' must be 'service_account'."
            )
        
        # Try to initialize the credentials object to verify structure
        creds = service_account.Credentials.from_service_account_info(data)
        
        client_email = data.get("client_email", "Unknown")
        return TestCredentialsResponse(
            valid=True,
            message=f"Successfully validated Service Account: {client_email}"
        )
    except json.JSONDecodeError:
        return TestCredentialsResponse(
            valid=False,
            message="Invalid JSON format. Please paste a valid Service Account JSON file."
        )
    except ValueError as e:
        return TestCredentialsResponse(
            valid=False,
            message=f"Invalid Service Account structure: {str(e)}"
        )
    except Exception as e:
        return TestCredentialsResponse(
            valid=False,
            message=f"Validation failed: {str(e)}"
        )


@router.post("/gcp-credentials")
async def save_gcp_credentials_endpoint(req: GCPCredentialsRequest):
    """Save validated GCP Service Account JSON to local configuration."""
    test_result = await test_gcp_credentials(req)
    if not test_result.valid:
        raise HTTPException(status_code=400, detail=test_result.message)
    
    success = save_gcp_credentials(req.json_content)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to save GCP credentials")
    
    return {"status": "success", "message": "GCP credentials saved successfully"}