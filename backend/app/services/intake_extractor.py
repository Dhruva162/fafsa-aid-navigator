import json
import os

from dotenv import load_dotenv
from groq import Groq

load_dotenv()

client = Groq(api_key=os.getenv("GROQ_API_KEY"))


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


def extract_profile(text: str):
    prompt = f"""
Extract FAFSA information from this student description.

Return ONLY valid JSON.

{{
  "household_agi": number|null,
  "family_size": number|null,
  "number_in_college": number|null,
  "year_in_school": "1st year"|"2nd year"|"3rd year"|"4th year"|"5th year"|null,
  "dependency_status": "dependent"|"independent"|null,
  "missing_fields": [],
  "confidence": "high"|"medium"|"low"
}

Normalize year_in_school to one of:
1st year
2nd year
3rd year
4th year
5th year

If information is not provided:
- Set the field to null
- Add the field name to missing_fields
- Do NOT guess missing values

Student description:

{text}
"""

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {
                "role": "user",
                "content": prompt,
            }
        ],
        temperature=0,
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