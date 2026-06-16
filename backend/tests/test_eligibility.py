import json
import os
import sys

import pytest

from app.services.eligibility import (
    StudentProfile,
    get_aid_estimate,
    load_aid_programs,
)  # noqa: E402

DATA_DIR = os.path.join(
    os.path.dirname(__file__),
    "..",
    "app",
    "data"
)


@pytest.fixture(scope="module")
def aid_data():
    return load_aid_programs()


@pytest.fixture(scope="module")
def personas():
    with open(os.path.join(DATA_DIR, "personas.json")) as f:
        return json.load(f)["personas"]


def _profile_for(persona):
    return StudentProfile(**persona["profile"])


def test_low_income_family_gets_max_pell(aid_data, personas):
    maria = next(p for p in personas if p["id"] == "maria")
    result = get_aid_estimate(_profile_for(maria), aid_data)
    pell = result["results"]["pell_grant"]
    assert pell["may_qualify"] is True
    assert pell["estimated_award_range"][0] == aid_data["pell_grant"]["maximum_award"]


def test_middle_income_gets_partial_pell(aid_data, personas):
    devon = next(p for p in personas if p["id"] == "devon")
    result = get_aid_estimate(_profile_for(devon), aid_data)
    pell = result["results"]["pell_grant"]
    assert pell["may_qualify"] is True
    low, high = pell["estimated_award_range"]
    assert 0 < low <= high < aid_data["pell_grant"]["maximum_award"]


def test_high_income_not_pell_eligible_but_still_gets_loan_info(aid_data, personas):
    sofia = next(p for p in personas if p["id"] == "sofia")
    result = get_aid_estimate(_profile_for(sofia), aid_data)
    pell = result["results"]["pell_grant"]
    assert pell["may_qualify"] is False

    loans = result["results"]["subsidized_loan"]
    unsub = loans["related"]
    # Even without need-based aid, unsubsidized loan info should be present.
    assert unsub["estimated_award_range"] is not None
    assert unsub["estimated_award_range"][1] > 0


def test_auto_zero_pathway(aid_data, personas):
    james = next(p for p in personas if p["id"] == "james")
    result = get_aid_estimate(_profile_for(james), aid_data)
    assert result["sai_estimate"] == aid_data["pell_grant"]["sai_range"]["min"]
    assert result["results"]["pell_grant"]["may_qualify"] is True


def test_multiple_students_in_college_splits_contribution(aid_data, personas):
    alvarez = next(p for p in personas if p["id"] == "the_alvarez_family")
    result = get_aid_estimate(_profile_for(alvarez), aid_data)
    # With two students in college, each should see a *lower* SAI than if
    # only one were enrolled -- i.e. more generous aid per student.
    single_profile = StudentProfile(**{**alvarez["profile"], "number_in_college": 1})
    single_result = get_aid_estimate(single_profile, aid_data)
    assert result["sai_estimate"] <= single_result["sai_estimate"]


def test_non_citizen_ineligible_for_work_study(aid_data, personas):
    maria = next(p for p in personas if p["id"] == "maria")
    profile = _profile_for(maria)
    profile.citizenship_eligible = False
    result = get_aid_estimate(profile, aid_data)
    fws = result["results"]["federal_work_study"]
    assert fws["may_qualify"] is False


def test_output_always_includes_responsible_ai_framing(aid_data, personas):
    for persona in personas:
        result = get_aid_estimate(_profile_for(persona), aid_data)
        assert "disclaimer" in result and len(result["disclaimer"]) > 0
        assert "human_referral" in result and len(result["human_referral"]) > 0
        for program_result in result["results"].values():
            assert "confidence" in program_result
            assert "reason" in program_result
