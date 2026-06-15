from fastapi import APIRouter
from pydantic import BaseModel
from app.services.intake_extractor import extract_profile

router = APIRouter(prefix="/api", tags=["intake"])

class IntakeRequest(BaseModel):
    situation: str

@router.post("/extract-profile")
def extract_intake(data: IntakeRequest):
    return extract_profile(data.situation)