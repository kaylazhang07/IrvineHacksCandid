from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel
from data.zip_coords import zip_to_state

router = APIRouter()

# Sample race/candidate data
RACES_DB = [
    {
        "race_id": "mayor-2025",
        "position": "Mayor",
        "jurisdiction": "City",
        "state": "CA",
        "candidates": [
            {
                "name": "Maria Gonzalez",
                "party": "Democrat",
                "bio": "City council member for 8 years, focused on affordable housing and public transit.",
                "top_priorities": ["housing", "transportation", "education"],
                "budget_stance": {"housing": +5.0, "education": +3.0, "transportation": +4.0, "public_safety": -1.0, "environment": +2.0},
            },
            {
                "name": "James Chen",
                "party": "Republican",
                "bio": "Small business owner and former school board member advocating for fiscal responsibility.",
                "top_priorities": ["economy", "public_safety", "education"],
                "budget_stance": {"housing": -1.0, "education": +2.0, "transportation": +1.0, "public_safety": +5.0, "environment": -2.0},
            },
            {
                "name": "Priya Patel",
                "party": "Independent",
                "bio": "Environmental engineer pushing for green infrastructure and community-driven budgeting.",
                "top_priorities": ["environment", "healthcare", "housing"],
                "budget_stance": {"housing": +3.0, "education": +1.0, "transportation": +2.0, "public_safety": 0.0, "environment": +6.0},
            },
        ],
    },
    {
        "race_id": "council-dist5-2025",
        "position": "City Council - District 5",
        "jurisdiction": "City",
        "state": "CA",
        "candidates": [
            {
                "name": "David Washington",
                "party": "Democrat",
                "bio": "Community organizer focused on public safety reform and youth programs.",
                "top_priorities": ["public_safety", "education", "economy"],
                "budget_stance": {"housing": +2.0, "education": +4.0, "transportation": +1.0, "public_safety": +3.0, "environment": +1.0},
            },
            {
                "name": "Lisa Tran",
                "party": "Democrat",
                "bio": "Healthcare worker advocating for expanded community health services.",
                "top_priorities": ["healthcare", "housing", "environment"],
                "budget_stance": {"housing": +3.0, "education": +2.0, "transportation": +1.0, "public_safety": +1.0, "environment": +3.0},
            },
        ],
    },
    {
        "race_id": "school-board-2025",
        "position": "School Board",
        "jurisdiction": "County",
        "state": "CA",
        "candidates": [
            {
                "name": "Robert Kim",
                "party": "Nonpartisan",
                "bio": "Retired teacher with 30 years in public education, focused on curriculum modernization.",
                "top_priorities": ["education"],
                "budget_stance": {"education": +8.0},
            },
            {
                "name": "Sarah Johnson",
                "party": "Nonpartisan",
                "bio": "Parent and tech executive advocating for STEM programs and school safety.",
                "top_priorities": ["education", "public_safety"],
                "budget_stance": {"education": +6.0, "public_safety": +2.0},
            },
        ],
    },
]


class Candidate(BaseModel):
    name: str
    party: str
    bio: str
    top_priorities: list[str]
    budget_stance: dict[str, float]


class Race(BaseModel):
    race_id: str
    position: str
    jurisdiction: str
    candidates: list[Candidate]


@router.get("/races", response_model=list[Race])
async def list_races(zip: str = Query(default="94601")):
    state = zip_to_state(zip)
    return [
        Race(
            race_id=r["race_id"],
            position=r["position"],
            jurisdiction=r["jurisdiction"],
            candidates=[Candidate(**c) for c in r["candidates"]],
        )
        for r in RACES_DB
    ]


@router.get("/races/{race_id}", response_model=Race)
async def get_race(race_id: str):
    for r in RACES_DB:
        if r["race_id"] == race_id:
            return Race(
                race_id=r["race_id"],
                position=r["position"],
                jurisdiction=r["jurisdiction"],
                candidates=[Candidate(**c) for c in r["candidates"]],
            )
    raise HTTPException(status_code=404, detail=f"Race '{race_id}' not found")
