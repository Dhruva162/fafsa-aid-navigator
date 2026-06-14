"""Triage endpoint: takes a user's situation and returns ranked support services."""
from fastapi import APIRouter

from app.models import TriageRequest, TriageResponse
from app.services.matcher import match_services

router = APIRouter(prefix="/api", tags=["triage"])


@router.post("/triage", response_model=TriageResponse)
def triage(request: TriageRequest) -> TriageResponse:
    """Match a person's situation to relevant local support services."""
    return match_services(request)
