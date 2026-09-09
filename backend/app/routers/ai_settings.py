"""AI connection settings for this local app instance."""
from fastapi import APIRouter, HTTPException, Request

from app.internal.ai_configuration import AISettingsError, ai_configuration

router = APIRouter(prefix="/ai_settings", tags=["settings"])


@router.get("")
def get_settings():
    return ai_configuration.describe()


@router.put("")
async def save_settings(request: Request):
    try:
        data = await request.json()
    except ValueError:
        raise HTTPException(400, detail="Enter valid AI settings.")
    if not isinstance(data, dict):
        raise HTTPException(400, detail="Enter valid AI settings.")
    try:
        return ai_configuration.configure(data.get("api_key"), data.get("base_url"), data.get("model"))
    except AISettingsError as error:
        raise HTTPException(400, detail=str(error))
    except Exception:
        # SDK errors may contain credentials or provider response details.
        raise HTTPException(400, detail="Unable to configure AI. Check the key, base URL, and model.")


@router.delete("")
def reset_settings():
    return ai_configuration.reset()
