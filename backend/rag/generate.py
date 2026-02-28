import json
import os
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

SYSTEM_PROMPT = """You are Candid — a nonpartisan civic guide helping everyday voters understand ballot measures.

Given legislation excerpts and a voter's personal profile, generate a structured explanation.

STRICT RULES:
1. Plain English only — no legalese, no jargon
2. Every factual claim must be traceable to a provided chunk (cite chunk_id)
3. Personal impact statement must include a dollar estimate when budget data supports it
4. Never recommend how to vote
5. Never editorialize or express political opinions
6. Max 3 sentences for plain_english_summary
7. Output ONLY valid JSON — no markdown fences, no preamble

Output schema:
{
  "plain_english_summary": "string (max 3 sentences)",
  "personal_impact_statement": "string (1 sentence with dollar estimate if possible)",
  "citations": [
    {"chunk_id": "string", "plain_translation": "string (1 sentence)"}
  ]
}"""


def generate_explanation(
    measure_title: str,
    chunks: list[dict],
    user,
    budget_shifts: list,
) -> dict:
    client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

    budget_data = [
        s.model_dump() if hasattr(s, "model_dump") else s
        for s in budget_shifts
    ]

    user_context = f"""Voter profile:
- Zip code: {user.zip_code}
- Housing: {user.housing_status}
- Has children: {user.has_children}
- Income: {user.household_income_bracket}
- Top concerns: {', '.join(user.primary_concerns)}

Predicted budget impact: {json.dumps(budget_data)}"""

    chunks_context = "\n\n".join([
        f"[CHUNK {c['chunk_id']}]\n{c['chunk_text']}"
        for c in chunks
    ])

    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            max_tokens=1024,
            temperature=0.3,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": f"Measure: {measure_title}\n\n{user_context}\n\nLegislation excerpts:\n{chunks_context}",
                },
            ],
        )
    except Exception:
        return {
            "plain_english_summary": "AI explanation temporarily unavailable. Please try again shortly.",
            "personal_impact_statement": "Impact estimate unavailable.",
            "citations": [],
        }

    raw = response.choices[0].message.content.strip()
    # Strip markdown fences if present
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[-1]  # remove first line
    if raw.endswith("```"):
        raw = raw.rsplit("```", 1)[0]
    raw = raw.strip()

    # Try to extract JSON from the response
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        # Try to find JSON object in the text
        start = raw.find("{")
        end = raw.rfind("}") + 1
        if start >= 0 and end > start:
            try:
                return json.loads(raw[start:end])
            except json.JSONDecodeError:
                pass
        return {
            "plain_english_summary": "Unable to generate explanation. Please try again.",
            "personal_impact_statement": "Impact data unavailable.",
            "citations": [],
        }
