import json
import yaml
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel

router = APIRouter(prefix="/converter", tags=["converter"])


class ConvertRequest(BaseModel):
    content: str
    from_format: str  # "json" or "yaml"


@router.post("/convert")
async def convert_format(request: ConvertRequest):
    from_fmt = request.from_format.lower().strip()

    if from_fmt not in {"json", "yaml"}:
        return JSONResponse(
            status_code=422,
            content={
                "status": "error",
                "data": {"message": "from_format must be 'json' or 'yaml'"}
            },
        )

    try:
        if from_fmt == "json":
            # JSON → YAML
            data = json.loads(request.content)
            result = yaml.dump(data, default_flow_style=False, sort_keys=False)
            to_format = "yaml"
        else:
            # YAML → JSON
            data = yaml.safe_load(request.content)
            result = json.dumps(data, indent=2, ensure_ascii=False)
            to_format = "json"

        return {
            "status": "success",
            "data": {
                "result": result,
                "from_format": from_fmt,
                "to_format": to_format,
            },
        }
    except json.JSONDecodeError as e:
        return JSONResponse(
            status_code=422,
            content={
                "status": "error",
                "data": {"message": f"Invalid JSON: {str(e)}"}
            },
        )
    except yaml.YAMLError as e:
        return JSONResponse(
            status_code=422,
            content={
                "status": "error",
                "data": {"message": f"Invalid YAML: {str(e)}"}
            },
        )
