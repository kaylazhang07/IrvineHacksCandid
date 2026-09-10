from typing import Optional
import re
from fastapi import APIRouter
from models import ExplainRequest, ExplainResponse, Citation
from rag.retrieve import retrieve_chunks, filter_federal
from rag.rerank import rerank_chunks
from rag.generate import generate_explanation
from ml.predict import predict_budget_shifts
from cache import get_cache, set_cache
from data.zip_coords import zip_to_state, zip_to_coords
from routers.measures import SAMPLE_MEASURES, CATEGORY_QUERIES
import json

router = APIRouter()

# Map congress numbers to ordinal suffixes for URL conversion
_ORDINALS = {str(n): f"{n}th" for n in range(100, 120)}
_ORDINALS.update({"111": "111th", "112": "112th", "113": "113th"})

_BILL_TYPE_MAP = {
    "hr": "house-bill", "s": "senate-bill",
    "hres": "house-resolution", "sres": "senate-resolution",
    "hjres": "house-joint-resolution", "sjres": "senate-joint-resolution",
    "hconres": "house-concurrent-resolution", "sconres": "senate-concurrent-resolution",
}

# Fast lookup for sample measures by measure_id
_SAMPLE_MAP = {m.measure_id: m for m in SAMPLE_MEASURES}


def _fix_source_url(url: str) -> str:
    """Convert api.congress.gov URLs to readable congress.gov web pages."""
    if not url:
        return url
    m = re.match(r'https?://api\.congress\.gov/v3/bill/(\d+)/(\w+)/(\d+)', url)
    if m:
        congress, bill_type, number = m.group(1), m.group(2), m.group(3)
        ordinal = _ORDINALS.get(congress, f"{congress}th")
        readable_type = _BILL_TYPE_MAP.get(bill_type.lower(), bill_type)
        return f"https://www.congress.gov/bill/{ordinal}-congress/{readable_type}/{number}"
    return url


def _lookup_measure(measure_id: str) -> Optional[dict]:
    m = _SAMPLE_MAP.get(measure_id)
    if m:
        return {"title": m.title, "summary": m.summary, "category": m.category}
    return None


@router.post("/explain", response_model=ExplainResponse)
async def explain_measure(req: ExplainRequest):
    lookup = _lookup_measure(req.measure_id)

    # Determine real measure title and retrieval query.
    # When called from the map card, req.measure_text is empty and
    # req.measure_title holds the POI name (e.g. "Aldrich Park").
    # We keep the POI name as location_name for the LLM and use the
    # real measure title + summary for retrieval.
    if lookup:
        measure_title = lookup["title"]
        # req.measure_title is the POI name when measure_text is absent
        location_name = req.measure_title if not req.measure_text else None
        retrieval_query = (
            req.measure_text
            or lookup["summary"]
            or CATEGORY_QUERIES.get(lookup["category"], lookup["title"])
        )
    else:
        measure_title = req.measure_title or req.measure_id
        location_name = None
        retrieval_query = req.measure_text or req.measure_title or req.measure_id

    cache_key = f"explain:{req.measure_id}:{req.user.zip_code}:{req.user.housing_status}:{req.user.household_income_bracket}"

    cached = get_cache(cache_key)
    if cached:
        return ExplainResponse(**json.loads(cached))

    state = zip_to_state(req.user.zip_code)
    jurisdiction = "state" if state in ["CA", "NY", "TX", "PA"] else "city"

    # Try RAG using the meaningful retrieval query
    chunks = filter_federal(retrieve_chunks(retrieval_query, state, jurisdiction, measure_id=req.measure_id), req.measure_id)
    ranked_chunks = rerank_chunks(chunks, req.user, measure_title)
    ranked_chunks = filter_federal(ranked_chunks, req.measure_id)

    if not ranked_chunks:
        ranked_chunks = [{
            "chunk_id": "measure-text",
            "chunk_text": retrieval_query,
            "source_url": "",
            "relevance_score": 1.0,
        }]

    map_pins = []

    budget_shifts = predict_budget_shifts(req.measure_id, req.user, state=state, measure_text=retrieval_query)

    try:
        generated = generate_explanation(measure_title, ranked_chunks, req.user, budget_shifts, location_name=location_name)
    except Exception:
        generated = {
            "plain_english_summary": "We couldn't generate an AI explanation right now. The information below is sourced directly from official documents.",
            "personal_impact_statement": "Impact estimate temporarily unavailable.",
            "citations": [],
        }

    citations = [
        Citation(
            chunk_id=c["chunk_id"],
            chunk_text=c["chunk_text"][:500],
            source_url=_fix_source_url(c.get("source_url", "")),
            plain_translation=next(
                (g["plain_translation"] for g in generated.get("citations", []) if g["chunk_id"] == c["chunk_id"]),
                "See source for details.",
            ),
            relevance_score=float(c.get("relevance_score") or c.get("score") or 0.5),
        )
        for c in ranked_chunks
    ]

    raw_scores = [c.get("score", 0.5) for c in ranked_chunks]
    confidence = sum(raw_scores) / max(len(raw_scores), 1)

    response = ExplainResponse(
        measure_id=req.measure_id,
        measure_title=measure_title,
        plain_english_summary=generated.get("plain_english_summary", ""),
        personal_impact_statement=generated.get("personal_impact_statement", ""),
        citations=citations,
        budget_shifts=budget_shifts,
        map_pins=map_pins,
        confidence_score=confidence,
    )

    set_cache(cache_key, response.model_dump_json(), ttl=3600)
    return response
