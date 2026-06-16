import json
import os

from dotenv import load_dotenv
from groq import Groq

load_dotenv()

client = Groq(api_key=os.getenv("GROQ_API_KEY"))


def extract_profile(text: str):
    prompt = f"""
Extract FAFSA information from this student description.

Return ONLY valid JSON.

{{
  "household_agi": number|null,
  "family_size": number|null,
  "number_in_college": number|null,
  "year_in_school": number|null,
  "dependency_status": "dependent"|"independent"|null,
  "missing_fields": [],
  "confidence": "high"|"medium"|"low"
}}

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

    missing_count = len(data.get("missing_fields", []))

    if missing_count == 0:
        data["confidence"] = "high"
    elif missing_count <= 2:
        data["confidence"] = "medium"
    else:
        data["confidence"] = "low"

    return data