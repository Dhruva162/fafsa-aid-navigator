"""
eligibility.py

Core reasoning engine for the Aid Navigator.

Pipeline: user profile (collected via guided chat) -> SAI approximation
-> match against Pell Grant / Federal Work-Study / Subsidized & Unsubsidized
Loan rules -> structured "may qualify" result with next steps.

IMPORTANT: The SAI calculation here is a documented SIMPLIFICATION of the
real federal Student Aid Index formula (see data/aid_programs.json for
sources and disclaimer). It exists to demonstrate AI REASONING over public
eligibility rules for a hackathon MVP, not to produce official aid figures.
Every output explicitly says "may qualify" / "estimate" and points the user
to the real FAFSA + their school's financial aid office.
"""

import json
import os
from dataclasses import dataclass, field
from typing import Optional

DATA_PATH = os.path.abspath(
    os.path.join(
        os.path.dirname(__file__),
        "..",
        "data",
        "aid_programs.json"
    )
)

def load_aid_programs(path: str = DATA_PATH) -> dict:
    with open(path, "r") as f:
        return json.load(f)


# ---------------------------------------------------------------------------
# User profile
# ---------------------------------------------------------------------------

@dataclass
class StudentProfile:
    dependency_status: str  # "dependent" | "independent"
    household_agi: float    # annual adjusted gross income of the relevant household
    family_size: int        # number of people in that household
    number_in_college: int = 1
    student_income: float = 0.0     # dependent student's own income
    student_assets: float = 0.0     # dependent student's own reportable assets
    independent_assets: float = 0.0 # independent filer's reportable assets
    enrollment_intensity: str = "full_time"  # full_time | three_quarter_time | half_time | less_than_half_time
    year_in_school: int = 1          # 1, 2, 3, 4, 5+
    citizenship_eligible: bool = True
    receives_means_tested_benefit: bool = False
    school_type: str = "public_4yr_in_state"  # key into cost_of_attendance_estimates
    custom_coa: Optional[float] = None


# ---------------------------------------------------------------------------
# Step 1: SAI approximation
# ---------------------------------------------------------------------------

def _parent_ipa(family_size: int, aid_data: dict) -> float:
    table = aid_data["sai_formula_simplified"]["parent_income_protection_allowance_by_family_size"]
    increment = aid_data["sai_formula_simplified"]["additional_family_member_ipa_increment"]
    capped_size = min(family_size, 8)
    base = table[str(capped_size)]
    extra_members = max(0, family_size - 8)
    return base + extra_members * increment


def _bracketed_contribution(available_income: float, brackets: list) -> float:
    """
    Marginal-bracket calculation, similar in spirit to a progressive tax
    table. `brackets` is a list of {"upper_bound": X or null, "rate": r}
    sorted ascending. Available income below the first bracket's bound is
    assessed at that bracket's rate (can produce a negative contribution).
    """
    if available_income <= brackets[0]["upper_bound"]:
        return available_income * brackets[0]["rate"]

    contribution = 0.0
    lower = brackets[0]["upper_bound"]
    contribution += lower * brackets[0]["rate"]

    for b in brackets[1:]:
        upper = b["upper_bound"]
        if upper is None or available_income <= upper:
            contribution += (available_income - lower) * b["rate"]
            return contribution
        else:
            contribution += (upper - lower) * b["rate"]
            lower = upper

    return contribution


def calculate_sai(profile: StudentProfile, aid_data: dict) -> dict:
    """
    Returns {"sai": float, "explanation": [str, ...]} where `explanation`
    is a list of plain-language steps suitable for showing the user
    (and/or feeding to an LLM to phrase more naturally).
    """
    sai_cfg = aid_data["sai_formula_simplified"]
    sai_min, sai_max = aid_data["pell_grant"]["sai_range"]["min"], aid_data["pell_grant"]["sai_range"]["max"]
    explanation = []

    if profile.receives_means_tested_benefit:
        explanation.append(
            "Because your household reported receiving a qualifying benefit "
            "(e.g. SNAP, Medicaid, free/reduced lunch), you qualify through the "
            "'Auto-Zero' pathway: your SAI is automatically set to the minimum "
            f"({sai_min})."
        )
        return {"sai": float(sai_min), "explanation": explanation}

    # --- Household / family contribution -------------------------------
    ipa = _parent_ipa(profile.family_size, aid_data)
    eea_cfg = sai_cfg["parent_employment_expense_allowance"]
    eea = min(profile.household_agi * eea_cfg["rate"], eea_cfg["max"])
    payroll_tax_allowance = profile.household_agi * sai_cfg["payroll_tax_allowance_rate"]

    available_income = profile.household_agi - ipa - eea - payroll_tax_allowance
    family_contribution = _bracketed_contribution(available_income, sai_cfg["available_income_brackets"])

    explanation.append(
        f"Household income protection allowance for a family of {profile.family_size}: ~${ipa:,.0f}. "
        f"After subtracting living-expense, tax, and work-expense allowances, your estimated "
        f"'available income' is ~${available_income:,.0f}."
    )

    divide_by = profile.number_in_college if sai_cfg.get("number_in_college_divides_parent_contribution") else 1
    divide_by = max(1, divide_by)
    family_contribution_per_student = family_contribution / divide_by

    if divide_by > 1:
        explanation.append(
            f"That contribution is split across {divide_by} household members in college, "
            f"giving roughly ${family_contribution_per_student:,.0f} per student."
        )

    # --- Student's own income/assets (dependent students only) ---------
    student_income_contribution = 0.0
    student_asset_contribution = 0.0
    if profile.dependency_status == "dependent":
        student_ipa = sai_cfg["student_income_protection_allowance"]
        student_income_contribution = max(0.0, profile.student_income - student_ipa) * sai_cfg["student_income_assessment_rate"]
        student_asset_contribution = profile.student_assets * sai_cfg["student_asset_assessment_rate"]
        if profile.student_income > student_ipa:
            explanation.append(
                f"Your own income above the student protection allowance "
                f"(${student_ipa:,.0f}) adds ~${student_income_contribution:,.0f}."
            )
        if profile.student_assets > 0:
            explanation.append(
                f"Assets in your name add ~${student_asset_contribution:,.0f}."
            )
    else:
        # Independent filer: assess their own reportable assets at a lower rate
        student_asset_contribution = profile.independent_assets * 0.07
        if profile.independent_assets > 0:
            explanation.append(
                f"Your reportable assets add ~${student_asset_contribution:,.0f}."
            )

    sai = family_contribution_per_student + student_income_contribution + student_asset_contribution
    sai = max(sai_min, min(sai_max, sai))

    explanation.append(f"Putting it together, your estimated Student Aid Index (SAI) is ~{sai:,.0f}.")

    return {"sai": sai, "explanation": explanation}


# ---------------------------------------------------------------------------
# Step 2: Cost of Attendance
# ---------------------------------------------------------------------------

def resolve_coa(profile: StudentProfile, aid_data: dict) -> float:
    if profile.custom_coa is not None:
        return profile.custom_coa
    estimates = aid_data["cost_of_attendance_estimates"]
    return estimates.get(profile.school_type, estimates["public_4yr_in_state"])


# ---------------------------------------------------------------------------
# Step 3: Pell Grant
# ---------------------------------------------------------------------------

def estimate_pell_grant(sai: float, profile: StudentProfile, aid_data: dict) -> dict:
    cfg = aid_data["pell_grant"]
    proration = cfg["enrollment_proration"].get(profile.enrollment_intensity, 1.0)

    if profile.enrollment_intensity == "less_than_half_time":
        # Pell remains available but most schools require at least
        # half-time for non-trivial awards; flagged as lower confidence.
        confidence = "low"
    else:
        confidence = "medium"

    if sai >= cfg["sai_eligibility_cutoff"]:
        return {
            "program": "Federal Pell Grant",
            "may_qualify": False,
            "estimated_award_range": None,
            "reason": f"Estimated SAI (~{sai:,.0f}) is at or above the 2026-27 eligibility "
                      f"cutoff of {cfg['sai_eligibility_cutoff']:,}.",
            "confidence": "medium",
        }

    if sai <= cfg["sai_auto_max_threshold"]:
        award = cfg["maximum_award"] * proration
        award = round(award / 5) * 5
        return {
            "program": "Federal Pell Grant",
            "may_qualify": True,
            "estimated_award_range": [award, award],
            "reason": "Estimated SAI is at or below 0, which typically corresponds to the "
                      "maximum Pell Grant (adjusted for enrollment intensity).",
            "confidence": confidence,
        }

    # Linear interpolation between max (at SAI=0) and 0 (at SAI=cutoff) --
    # a simplified stand-in for the federal Pell award table.
    fraction_remaining = 1 - (sai / cfg["sai_eligibility_cutoff"])
    raw_award = cfg["maximum_award"] * fraction_remaining * proration

    if raw_award < cfg["minimum_award"]:
        award = cfg["minimum_award"] if raw_award > 0 else 0
    else:
        award = round(raw_award / 5) * 5

    if award <= 0:
        return {
            "program": "Federal Pell Grant",
            "may_qualify": False,
            "estimated_award_range": None,
            "reason": f"Estimated SAI (~{sai:,.0f}) is too high relative to the cutoff "
                      f"({cfg['sai_eligibility_cutoff']:,}) for a non-zero award at this enrollment level.",
            "confidence": confidence,
        }

    # Present a range, not a single number, to avoid false precision.
    low = max(cfg["minimum_award"], round(award * 0.85 / 5) * 5)
    high = min(cfg["maximum_award"], round(award * 1.15 / 5) * 5)

    return {
        "program": "Federal Pell Grant",
        "may_qualify": True,
        "estimated_award_range": [low, high],
        "reason": f"Estimated SAI (~{sai:,.0f}) is below the eligibility cutoff "
                  f"({cfg['sai_eligibility_cutoff']:,}), suggesting a partial award.",
        "confidence": confidence,
    }


# ---------------------------------------------------------------------------
# Step 4: Federal Work-Study
# ---------------------------------------------------------------------------

def estimate_work_study(sai: float, coa: float, profile: StudentProfile, aid_data: dict) -> dict:
    cfg = aid_data["federal_work_study"]
    financial_need = coa - sai

    enrolled_enough = profile.enrollment_intensity in ("full_time", "three_quarter_time", "half_time")

    if not profile.citizenship_eligible:
        return {
            "program": "Federal Work-Study",
            "may_qualify": False,
            "estimated_award_range": None,
            "reason": "Federal Work-Study requires U.S. citizenship or eligible noncitizen status.",
            "confidence": "high",
        }

    if not enrolled_enough:
        return {
            "program": "Federal Work-Study",
            "may_qualify": False,
            "estimated_award_range": None,
            "reason": "Federal Work-Study generally requires at least half-time enrollment.",
            "confidence": "medium",
        }

    if financial_need <= 0:
        return {
            "program": "Federal Work-Study",
            "may_qualify": False,
            "estimated_award_range": None,
            "reason": f"Estimated financial need (Cost of Attendance ${coa:,.0f} minus SAI "
                      f"~{sai:,.0f}) is at or below zero.",
            "confidence": "medium",
        }

    award_range = cfg["typical_award_range"]
    low = min(award_range["min"], financial_need)
    high = min(award_range["max"], financial_need)
    if high < low:
        high = low

    return {
        "program": "Federal Work-Study",
        "may_qualify": True,
        "estimated_award_range": [round(low), round(high)],
        "reason": f"You appear to have unmet financial need (~${financial_need:,.0f}) and "
                  f"meet the basic enrollment/citizenship requirements. Actual award depends "
                  f"on your school's available FWS funding -- you must also indicate interest "
                  f"on the FAFSA.",
        "confidence": "low",  # depends heavily on school-level fund availability
    }


# ---------------------------------------------------------------------------
# Step 5: Subsidized / Unsubsidized Loans
# ---------------------------------------------------------------------------

def estimate_loans(sai: float, coa: float, profile: StudentProfile, aid_data: dict) -> dict:
    cfg = aid_data["subsidized_loans"]
    dep_key = "dependent" if profile.dependency_status == "dependent" else "independent"
    limits = cfg[dep_key]

    if profile.year_in_school <= 1:
        year_limits = limits["year_1"]
    elif profile.year_in_school == 2:
        year_limits = limits["year_2"]
    else:
        year_limits = limits["year_3_plus"]

    financial_need = max(0.0, coa - sai)
    subsidized_amount = min(year_limits["subsidized_max"], financial_need)
    subsidized_amount = round(subsidized_amount)

    unsubsidized_amount = year_limits["total_limit"] - subsidized_amount
    unsubsidized_amount = max(0, round(unsubsidized_amount))

    return {
        "program": "Direct Subsidized Loan",
        "may_qualify": subsidized_amount > 0,
        "estimated_award_range": [subsidized_amount, subsidized_amount] if subsidized_amount > 0 else None,
        "reason": (
            f"Based on your year in school ({profile.year_in_school}) and {dep_key} status, "
            f"the subsidized cap is ${year_limits['subsidized_max']:,}. Your estimated "
            f"financial need is ~${financial_need:,.0f}, so up to ${subsidized_amount:,} could "
            f"be subsidized (government pays interest while you're in school)."
            if subsidized_amount > 0 else
            "Estimated financial need is too low for a subsidized loan this year, but you "
            "remain eligible for an unsubsidized loan."
        ),
        "confidence": "medium",
        "related": {
            "program": "Direct Unsubsidized Loan",
            "may_qualify": unsubsidized_amount > 0,
            "estimated_award_range": [0, unsubsidized_amount] if unsubsidized_amount > 0 else None,
            "reason": f"Up to ${unsubsidized_amount:,} in unsubsidized loans is available "
                      f"regardless of financial need (interest accrues immediately).",
            "confidence": "medium",
        },
    }


# ---------------------------------------------------------------------------
# Top-level orchestration
# ---------------------------------------------------------------------------

def get_aid_estimate(profile: StudentProfile, aid_data: Optional[dict] = None) -> dict:
    if aid_data is None:
        aid_data = load_aid_programs()

    sai_result = calculate_sai(profile, aid_data)
    sai = sai_result["sai"]
    coa = resolve_coa(profile, aid_data)

    pell = estimate_pell_grant(sai, profile, aid_data)
    fws = estimate_work_study(sai, coa, profile, aid_data)
    loans = estimate_loans(sai, coa, profile, aid_data)

    return {
        "award_year": aid_data["award_year"],
        "sai_estimate": round(sai, 2),
        "sai_explanation": sai_result["explanation"],
        "cost_of_attendance_used": coa,
        "results": {
            "pell_grant": pell,
            "federal_work_study": fws,
            "subsidized_loan": loans,
        },
        "next_steps": [
            "File (or update) your FAFSA at fafsa.gov as early as possible -- many state and "
            "school aid programs are first-come, first-served.",
            "On the FAFSA, mark 'yes' to being considered for Federal Work-Study if you're "
            "interested.",
            "Contact your school's financial aid office for your official aid offer; this "
            "tool's numbers are estimates only.",
        ],
        "disclaimer": aid_data["disclaimer"],
        "human_referral": (
            "This tool does not make a final eligibility or award decision. Your school's "
            "financial aid office reviews your actual FAFSA submission and issues your "
            "official aid offer -- that human review step is the one this AI does not replace."
        ),
    }


if __name__ == "__main__":
    import sys
    import json as _json

    # Quick manual smoke test
    demo_profile = StudentProfile(
        dependency_status="dependent",
        household_agi=42000,
        family_size=4,
        number_in_college=1,
        student_income=3000,
        enrollment_intensity="full_time",
        year_in_school=1,
        school_type="public_4yr_in_state",
    )
    result = get_aid_estimate(demo_profile)
    print(_json.dumps(result, indent=2))
