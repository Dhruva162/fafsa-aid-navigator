from fastapi import APIRouter
from pydantic import BaseModel

from app.services.followup_extractor import update_profile

router = APIRouter(prefix="/api", tags=["followup"])


class FollowupRequest(BaseModel):
    current_profile: dict
    answer: str


@router.post("/followup")
def followup(req: FollowupRequest):
    return update_profile(
        req.current_profile,
        req.answer
    )