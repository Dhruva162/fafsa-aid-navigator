"""Core matching logic: classify the request and rank relevant services.

This is a deterministic, keyword-based baseline so the demo works offline.
Swap `classify_category` for an LLM/NLP call when wiring up the real agent.
"""
import json
from pathlib import Path

from app.models import NeedCategory, ServiceMatch, TriageRequest, TriageResponse

_DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "resources.json"

# Keywords that should trigger an immediate human handoff rather than automation.
_CRISIS_KEYWORDS = {
    "suicide", "suicidal", "kill myself", "hurt myself", "abuse",
    "domestic violence", "overdose", "emergency", "bleeding", "can't breathe",
}

_CATEGORY_KEYWORDS: dict[NeedCategory, set[str]] = {
    "food": {"food", "hungry", "meal", "groceries", "pantry", "eat"},
    "housing": {"housing", "homeless", "shelter", "evicted", "rent", "sleep"},
    "mental_health": {"depressed", "anxiety", "mental", "counseling", "therapy", "stress"},
    "medical": {"sick", "doctor", "clinic", "medication", "injury", "pain"},
}


def _load_resources() -> list[dict]:
    with _DATA_PATH.open(encoding="utf-8") as fh:
        return json.load(fh)


def classify_category(text: str) -> NeedCategory:
    """Naive keyword classifier. Replace with an NLP model for production."""
    lowered = text.lower()
    best: NeedCategory = "other"
    best_hits = 0
    for category, keywords in _CATEGORY_KEYWORDS.items():
        hits = sum(1 for kw in keywords if kw in lowered)
        if hits > best_hits:
            best, best_hits = category, hits
    return best


def detect_crisis(text: str) -> bool:
    lowered = text.lower()
    return any(kw in lowered for kw in _CRISIS_KEYWORDS)


def match_services(request: TriageRequest) -> TriageResponse:
    category = request.category or classify_category(request.message)
    urgent = detect_crisis(request.message)

    matches: list[ServiceMatch] = []
    if not urgent:
        for entry in _load_resources():
            if entry["category"] == category:
                matches.append(ServiceMatch(confidence=0.8, **entry))

    return TriageResponse(
        detected_category=category,
        urgent_handoff=urgent,
        matches=matches,
        fallback=(
            "If this is an emergency, call 911. For 24/7 help connecting to local "
            "services, call or text 211, or the 988 Suicide & Crisis Lifeline."
        ),
    )
