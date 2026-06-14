from dataclasses import asdict

from fastapi import APIRouter
from pydantic import BaseModel

from app.services.eligibility import StudentProfile, get_aid_estimate

router = APIRouter(prefix="/api", tags=["aid"])


class StudentProfileRequest(BaseModel):
    dependency_status: str
    household_agi: float
    family_size: int

    number_in_college: int = 1
    student_income: float = 0.0
    student_assets: float = 0.0
    independent_assets: float = 0.0

    enrollment_intensity: str = "full_time"
    year_in_school: int = 1

    citizenship_eligible: bool = True
    receives_means_tested_benefit: bool = False

    school_type: str = "public_4yr_in_state"
    custom_coa: float | None = None


@router.post("/aid-estimate")
def estimate(profile: StudentProfileRequest):
    student = StudentProfile(**profile.model_dump())
    return get_aid_estimate(student)