"""Pydantic models for triage requests and responses."""
from typing import Literal, Optional

from pydantic import BaseModel, Field

NeedCategory = Literal["food", "housing", "mental_health", "medical", "other"]


class TriageRequest(BaseModel):
    message: str = Field(..., description="Free-text description of the person's situation.")
    category: Optional[NeedCategory] = Field(
        None, description="Optional pre-selected need category."
    )
    zip_code: Optional[str] = Field(None, description="Location for proximity matching.")
    language: str = Field("en", description="Preferred language (ISO 639-1).")


class ServiceMatch(BaseModel):
    name: str
    category: NeedCategory
    description: str
    contact: str
    hours: str
    eligibility: str
    confidence: float = Field(..., ge=0.0, le=1.0)


class TriageResponse(BaseModel):
    detected_category: NeedCategory
    urgent_handoff: bool = Field(
        False, description="True when the situation requires an immediate human responder."
    )
    matches: list[ServiceMatch]
    fallback: str = Field(
        ..., description="Always-present human/211 fallback so no user hits a dead end."
    )
