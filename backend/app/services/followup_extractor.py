import json
import os

from groq import Groq
from dotenv import load_dotenv

load_dotenv()

client = Groq(
    api_key=os.getenv("GROQ_API_KEY")
)


def normalize_year_string(year):
    if year is None:
        return None

    text = str(year).strip().lower()

    if text in {"1", "1st year", "first year"} or "first" in text or "1st" in text:
        return "1st year"
    if text in {"2", "2nd year", "second year"} or "second" in text or "2nd" in text:
        return "2nd year"
    if text in {"3", "3rd year", "third year"} or "third" in text or "3rd" in text:
        return "3rd year"
    if text in {"4", "4th year", "fourth year"} or "fourth" in text or "4th" in text:
        return "4th year"
    if text in {"5", "5th year", "fifth year"} or "fifth" in text or "5th" in text:
        return "5th year"

    return year


def update_profile(profile, answer):

    prompt = f"""
Current FAFSA profile:

{json.dumps(profile, indent=2)}

User provided additional information:

{answer}

Update ONLY missing fields.

If you update year_in_school, normalize year_in_school to one of:
1st year
2nd year
3rd year
4th year
5th year

Return ONLY valid JSON.

Preserve all existing values.
Do not overwrite known values.
"""

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {
                "role": "user",
                "content": prompt
            }
        ],
        temperature=0
    )

    content = response.choices[0].message.content

    content = content.replace("```json", "")
    content = content.replace("```", "")
    content = content.strip()

    data = json.loads(content)
    data["year_in_school"] = normalize_year_string(data.get("year_in_school"))

    missing_count = len(data.get("missing_fields", []))

    if missing_count == 0:
        data["confidence"] = "high"
    elif missing_count <= 2:
        data["confidence"] = "medium"
    else:
        data["confidence"] = "low"

    return data