"""Measures API - queries ChromaDB for state-specific legislation."""

from fastapi import APIRouter, Query
from pydantic import BaseModel
from typing import Optional
from data.zip_coords import zip_to_state
from rag.retrieve import get_collection

router = APIRouter()

TOPICS = [
    {"id": "healthcare", "label": "Healthcare", "icon": "heart"},
    {"id": "education", "label": "Education", "icon": "book"},
    {"id": "housing", "label": "Housing & Rent", "icon": "home"},
    {"id": "transportation", "label": "Transportation", "icon": "car"},
    {"id": "environment", "label": "Environment & Energy", "icon": "leaf"},
    {"id": "public_safety", "label": "Public Safety", "icon": "shield"},
    {"id": "economy", "label": "Jobs & Economy", "icon": "briefcase"},
]

CATEGORY_IMPACT = {
    "healthcare": -120,
    "education": -85,
    "housing": -200,
    "transportation": -60,
    "environment": -45,
    "public_safety": -70,
    "economy": 150,
    "other": 0,
}


class Topic(BaseModel):
    id: str
    label: str
    icon: str


class Measure(BaseModel):
    measure_id: str
    title: str
    summary: str
    category: str
    personal_annual_usd: float


def _query_measures(collection, where_filter, limit=200):
    """Query ChromaDB and deduplicate by measure_id."""
    try:
        results = collection.get(
            where=where_filter,
            limit=limit,
            include=["metadatas", "documents"],
        )
    except Exception:
        return []

    seen = set()
    measures = []
    nl = chr(10)
    separator = nl + nl

    for i, meta in enumerate(results.get("metadatas", [])):
        mid = meta.get("measure_id", "")
        if not mid or mid in seen:
            continue
        seen.add(mid)

        category = meta.get("category", "other")
        doc = results["documents"][i] if results.get("documents") else ""
        chunk_text = meta.get("chunk_text", doc or "")

        parts = chunk_text.split(separator, 1)
        title = parts[0].strip()[:200]
        summary = parts[1].strip()[:400] if len(parts) > 1 and parts[1].strip() else ""

        if not summary:
            summary = "State legislation related to " + category.replace("_", " ") + "."

        measures.append(Measure(
            measure_id=mid,
            title=title,
            summary=summary,
            category=category,
            personal_annual_usd=float(CATEGORY_IMPACT.get(category, 0)),
        ))

    return measures


@router.get("/topics", response_model=list[Topic])
async def list_topics():
    return TOPICS


@router.get("/measures", response_model=list[Measure])
async def list_measures(
    zip: str = Query(default="94601"),
    topic: Optional[str] = Query(default=None),
):
    state = zip_to_state(zip)
    collection = get_collection()

    # 1) State-specific bills, optionally filtered by topic
    if topic:
        where_filter = {"$and": [{"state": state}, {"category": topic}]}
    else:
        where_filter = {"state": state}

    measures = _query_measures(collection, where_filter)

    # 2) Fallback to federal if no state bills
    if not measures:
        if topic:
            where_filter = {"$and": [{"jurisdiction": "federal"}, {"category": topic}]}
        else:
            where_filter = {"jurisdiction": "federal"}
        measures = _query_measures(collection, where_filter)

    return measures[:50]
