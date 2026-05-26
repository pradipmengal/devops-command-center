from pydantic import BaseModel
from typing import Any, Literal, List, Optional


# Shared response envelope
class APIResponse(BaseModel):
    status: Literal["success", "error"]
    data: Any


# Dockerfile Generator models
class DockerRequest(BaseModel):
    app_type: str


class DockerSuccessData(BaseModel):
    dockerfile: str


class DockerErrorData(BaseModel):
    message: str


# Kubernetes Validator models
class K8sRequest(BaseModel):
    yaml_content: str


class K8sSuccessData(BaseModel):
    valid: bool
    suggestions: List[str]


class K8sErrorData(BaseModel):
    valid: bool
    error: str


# Base64 Tool models
class Base64Request(BaseModel):
    text: str
    mode: str


class Base64SuccessData(BaseModel):
    result: str


class Base64ErrorData(BaseModel):
    message: str


# Cron Builder models
class CronRequest(BaseModel):
    minute: str
    hour: str
    day: str
    month: str
    weekday: str


class CronSuccessData(BaseModel):
    expression: str
    description: str


class CronErrorData(BaseModel):
    message: str


# Granular Cloud Pricing models
class InstanceEntry(BaseModel):
    """Extended pricing record with hardware specs. Backward-compatible with ServiceEntry."""
    provider: str
    category: str
    service_name: str
    instance_type: str
    vcpu: int
    memory_gb: float
    unit: str
    price_usd: float
    tier_label: str
    os: Optional[str] = None
    storage: Optional[str] = None
