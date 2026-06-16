from fastapi import APIRouter
from pydantic import BaseModel
from app.services.intake_extractor import extract_profile

router = APIRouter(prefix="/api", tags=["intake"])

class IntakeRequest(BaseModel):
    situation: str

@router.post("/extract-profile")
def extract_intake(data: IntakeRequest):
    if len(data.situation) > 500:
        return {
            "error": "Input too long. Please keep responses under 500 characters."
        }

    profile = extract_profile(data.situation)

    if (
        profile.get("household_agi") is None and
        profile.get("family_size") is None and
        profile.get("number_in_college") is None
    ):
        return {
            "error": "Could not identify FAFSA-related information."
        }

    return profile