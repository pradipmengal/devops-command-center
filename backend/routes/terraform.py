from fastapi import APIRouter

router = APIRouter(prefix="/terraform", tags=["terraform"])


@router.post("/generate")
async def generate_terraform():
    return {
        "status": "success",
        "data": {"message": "Generation happens client-side in the visual builder"},
    }


@router.post("/validate")
async def validate_terraform():
    return {"status": "success", "data": {"valid": True}}
