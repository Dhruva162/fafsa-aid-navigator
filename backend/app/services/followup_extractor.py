import json
import os

from groq import Groq
from dotenv import load_dotenv

load_dotenv()

client = Groq(
    api_key=os.getenv("GROQ_API_KEY")
)


def update_profile(profile, answer):

    prompt = f"""
Current FAFSA profile:

{json.dumps(profile, indent=2)}

User provided additional information:

{answer}

Update ONLY missing fields.

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

    missing_count = len(data.get("missing_fields", []))

    if missing_count == 0:
        data["confidence"] = "high"
    elif missing_count <= 2:
        data["confidence"] = "medium"
    else:
        data["confidence"] = "low"

    return data