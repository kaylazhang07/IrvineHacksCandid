"""Races API — real legislator data, no API key needed."""

from typing import Optional, List
from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel
from services.civic import build_races_for_zip

router = APIRouter()


class Source(BaseModel):
    title: str
    url: str
    source_type: str
    accessed_date: str


class Candidate(BaseModel):
    name: str
    party: str
    bio: str
    photo_url: Optional[str] = ""
    website: Optional[str] = ""
    phone: Optional[str] = ""
    email: Optional[str] = ""
    social: Optional[dict] = {}
    top_priorities: list = []
    budget_stance: dict = {}
    platform_summary: Optional[str] = ""
    experience: list = []
    endorsements: list = []
    sources: List[Source] = []


class Race(BaseModel):
    race_id: str
    position: str
    jurisdiction: str
    division_id: Optional[str] = ""
    district: Optional[str] = ""
    candidates: List[Candidate]


@router.get("/races", response_model=List[Race])
async def list_races(zip: str = Query(default="92697")):
    """Return real federal legislators for a zip code."""
    try:
        races = build_races_for_zip(zip)
        return races
    except Exception as e:
        raise HTTPException(502, detail=f"Could not load race data: {str(e)}")


@router.get("/races/{race_id}", response_model=Race)
async def get_race(race_id: str, zip: str = Query(default="92697")):
    """Get a specific race by ID."""
    races = build_races_for_zip(zip)
    for r in races:
        if r["race_id"] == race_id:
            return r
    raise HTTPException(404, detail=f"Race '{race_id}' not found")
