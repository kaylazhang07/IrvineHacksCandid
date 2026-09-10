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


# ── Fallback measures — returned only when ChromaDB has no data ingested yet.
# Once real data is in ChromaDB, the endpoint returns ChromaDB results first
# and this list is never reached. Safe to leave in place permanently.
SAMPLE_MEASURES = [
    Measure(
        measure_id="hr-housing-2025",
        title="Affordable Housing Expansion Act",
        summary="Requires cities to zone at least 15% of new residential developments as affordable units, with rent stabilization protections for current tenants during construction periods.",
        category="housing",
        personal_annual_usd=float(CATEGORY_IMPACT["housing"]),
    ),
    Measure(
        measure_id="hr-edu-2025",
        title="K-12 Education Funding Reform",
        summary="Redistributes state education funding to reduce per-pupil spending disparities between wealthy and lower-income districts, and adds mandatory mental health counselors at middle and high schools.",
        category="education",
        personal_annual_usd=float(CATEGORY_IMPACT["education"]),
    ),
    Measure(
        measure_id="hr-transit-2025",
        title="Regional Transit Modernization Act",
        summary="Allocates funds for expanded bus rapid transit corridors, electrification of the public bus fleet, and fare-free rides during peak pollution days.",
        category="transportation",
        personal_annual_usd=float(CATEGORY_IMPACT["transportation"]),
    ),
    Measure(
        measure_id="hr-safety-2025",
        title="Community Safety & Crisis Response Act",
        summary="Funds co-responder programs pairing mental health clinicians with police for non-violent calls, expands neighborhood watch infrastructure, and requires body cameras for all patrol officers.",
        category="public_safety",
        personal_annual_usd=float(CATEGORY_IMPACT["public_safety"]),
    ),
    Measure(
        measure_id="hr-env-2025",
        title="Clean Air & Open Spaces Initiative",
        summary="Sets binding emissions reduction targets for medium-sized businesses, expands protected parkland, and creates a grant program for urban tree planting in heat-vulnerable neighborhoods.",
        category="environment",
        personal_annual_usd=float(CATEGORY_IMPACT["environment"]),
    ),
    Measure(
        measure_id="hr-health-2025",
        title="Community Health Access Expansion",
        summary="Funds 24 new community health centers in underserved ZIP codes, expands Medi-Cal dental coverage, and requires hospitals to offer sliding-scale billing for uninsured patients.",
        category="healthcare",
        personal_annual_usd=float(CATEGORY_IMPACT["healthcare"]),
    ),
    Measure(
        measure_id="hr-jobs-2025",
        title="Small Business & Workforce Development Act",
        summary="Creates low-interest loan programs for small businesses, funds apprenticeship programs in construction and healthcare, and raises the minimum wage to $18/hr by 2026.",
        category="economy",
        personal_annual_usd=float(CATEGORY_IMPACT["economy"]),
    ),
    Measure(
        measure_id="hr-water-2025",
        title="Water Infrastructure Modernization Act",
        summary="Replaces aging lead service lines in older neighborhoods, upgrades stormwater management to reduce flooding risk, and funds drought-resilient water recycling facilities.",
        category="other",
        personal_annual_usd=float(CATEGORY_IMPACT["other"]),
    ),
]


def _query_measures(collection, where_filter, limit=200):
    """Query Pinecone and deduplicate by measure_id."""
    try:
        from rag.embed import embed_batch
        query_text = where_filter.get("category", {}).get("$eq", "legislation")
        embedding = embed_batch([query_text])[0]
        filter_dict = {}
        if "$and" in where_filter:
            for f in where_filter["$and"]:
                for k, v in f.items():
                    filter_dict[k] = v
        else:
            filter_dict = where_filter
        res = collection.query(
            vector=embedding,
            top_k=min(limit, 100),
            include_metadata=True,
            filter=filter_dict if filter_dict else None,
        )
        results_list = res.matches
    except Exception as e:
        print(f"measures query error: {e}")
        return []

    seen = set()
    measures = []

    for match in results_list:
        meta = match.metadata or {}
        mid = meta.get("measure_id", "")
        if not mid or mid in seen:
            continue
        seen.add(mid)

        category = meta.get("category", "other")
        chunk_text = meta.get("text", "")

        parts = chunk_text.split("\n\n", 1)
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

    # 3) Fallback to sample data only when ChromaDB is entirely empty.
    #    Once real data is ingested, steps 1 or 2 will return results and
    #    this branch is never reached — no impact on production data.
    if not measures:
        if topic:
            return [m for m in SAMPLE_MEASURES if m.category == topic]
        return SAMPLE_MEASURES

    return measures[:50]
