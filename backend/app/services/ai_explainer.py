import os
from dotenv import load_dotenv
from groq import Groq

load_dotenv()

API_KEY = os.getenv("GROQ_API_KEY")

client = Groq(api_key=API_KEY) if API_KEY else None


def generate_explanation(aid_result: dict) -> str:
    if not client:
        return "AI explanation unavailable. GROQ_API_KEY not configured."

    prompt = f"""
You are a FAFSA financial aid advisor helping a first-generation college student.

Student Information:
{aid_result}

Instructions:

Explain:

1. What the Student Aid Index (SAI) means.
2. Why the student may or may not qualify.
3. Explain Pell Grant eligibility.
4. Explain Work Study eligibility.
5. Explain Loan eligibility.
6. Give exactly 3 personalized next steps.

Use plain English.

Be encouraging.

Mention that this is only an estimate and not an official FAFSA determination.

Maximum 180 words.
"""

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {
                "role": "system",
                "content": "You are a helpful financial aid advisor."
            },
            {
                "role": "user",
                "content": prompt
            }
        ],
        temperature=0.3,
        max_tokens=300,
    )

    return response.choices[0].message.content