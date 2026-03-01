import json
import os
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

RERANK_PROMPT = """You are evaluating how relevant a legislative text chunk is to a specific voter's profile.

Voter profile:
- Housing status: {housing_status}
- Has children: {has_children}
- Income bracket: {income_bracket}
- Primary concerns: {primary_concerns}

Ballot measure context: {measure_title}

Score each chunk 0.0-1.0:
- 1.0 = directly describes financial or lifestyle impact for this exact voter profile
- 0.5 = relevant to the measure but not specific to this voter type
- 0.0 = procedural/legal boilerplate with no voter-facing impact

Output ONLY a JSON array: [{{"chunk_id": "...", "score": 0.0}}]
No preamble, no markdown fences.

Chunks:
{chunks_json}"""


def rerank_chunks(chunks: list[dict], user, measure_title: str) -> list[dict]:
    if not chunks:
        return []

    client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

    prompt = RERANK_PROMPT.format(
        housing_status=user.housing_status,
        has_children=user.has_children,
        income_bracket=user.household_income_bracket,
        primary_concerns=", ".join(user.primary_concerns),
        measure_title=measure_title,
        chunks_json=json.dumps([
            {"chunk_id": c["chunk_id"], "chunk_text": c["chunk_text"][:300]}
            for c in chunks
        ]),
    )

    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            max_tokens=512,
            temperature=0,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = response.choices[0].message.content.strip()
        raw = raw.removeprefix("```json").removesuffix("```").strip()
        scores = json.loads(raw)
        score_map = {s["chunk_id"]: s["score"] for s in scores}
    except Exception as e:
        import traceback; traceback.print_exc()
        score_map = {}

    for chunk in chunks:
        fallback = chunk.get("relevance_score") or chunk.get("score", 0.5)
        chunk["relevance_score"] = score_map.get(chunk["chunk_id"], fallback)

    return sorted(chunks, key=lambda x: x["relevance_score"], reverse=True)[:4]
