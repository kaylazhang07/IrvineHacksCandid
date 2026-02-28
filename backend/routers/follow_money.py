from fastapi import APIRouter, Query
from pydantic import BaseModel
from data.zip_coords import zip_to_state

router = APIRouter()

# Budget data keyed by state, with a default fallback
BUDGETS_BY_STATE = {
    "CA": {
        "jurisdiction": "California County",
        "total_budget_usd": 4_818_000_000,
        "categories": {
            "housing": {"label": "Housing & Community Development", "pct": 22.1, "usd": 1_065_000_000},
            "education": {"label": "Education & Libraries", "pct": 29.7, "usd": 1_430_000_000},
            "transportation": {"label": "Transportation & Infrastructure", "pct": 16.2, "usd": 780_000_000},
            "public_safety": {"label": "Public Safety & Justice", "pct": 23.0, "usd": 1_108_000_000},
            "environment": {"label": "Environment & Sustainability", "pct": 9.0, "usd": 435_000_000},
        },
    },
    "NY": {
        "jurisdiction": "New York County",
        "total_budget_usd": 7_200_000_000,
        "categories": {
            "housing": {"label": "Housing & Community Development", "pct": 18.5, "usd": 1_332_000_000},
            "education": {"label": "Education & Libraries", "pct": 32.0, "usd": 2_304_000_000},
            "transportation": {"label": "Transportation & Infrastructure", "pct": 20.0, "usd": 1_440_000_000},
            "public_safety": {"label": "Public Safety & Justice", "pct": 21.5, "usd": 1_548_000_000},
            "environment": {"label": "Environment & Sustainability", "pct": 8.0, "usd": 576_000_000},
        },
    },
    "TX": {
        "jurisdiction": "Texas County",
        "total_budget_usd": 3_100_000_000,
        "categories": {
            "housing": {"label": "Housing & Community Development", "pct": 12.0, "usd": 372_000_000},
            "education": {"label": "Education & Libraries", "pct": 28.0, "usd": 868_000_000},
            "transportation": {"label": "Transportation & Infrastructure", "pct": 25.0, "usd": 775_000_000},
            "public_safety": {"label": "Public Safety & Justice", "pct": 28.0, "usd": 868_000_000},
            "environment": {"label": "Environment & Sustainability", "pct": 7.0, "usd": 217_000_000},
        },
    },
    "PA": {
        "jurisdiction": "Pennsylvania County",
        "total_budget_usd": 2_200_000_000,
        "categories": {
            "housing": {"label": "Housing & Community Development", "pct": 15.0, "usd": 330_000_000},
            "education": {"label": "Education & Libraries", "pct": 31.0, "usd": 682_000_000},
            "transportation": {"label": "Transportation & Infrastructure", "pct": 19.0, "usd": 418_000_000},
            "public_safety": {"label": "Public Safety & Justice", "pct": 26.0, "usd": 572_000_000},
            "environment": {"label": "Environment & Sustainability", "pct": 9.0, "usd": 198_000_000},
        },
    },
}
DEFAULT_BUDGET = BUDGETS_BY_STATE["CA"]

# Candidate budget shift plans keyed by state
CANDIDATE_PLANS_BY_STATE = {
    "CA": {
        "Maria Gonzalez": {"housing": +5.0, "education": +3.0, "transportation": +4.0, "public_safety": -1.0, "environment": +2.0},
        "James Chen":     {"housing": -1.0, "education": +2.0, "transportation": +1.0, "public_safety": +5.0, "environment": -2.0},
        "Priya Patel":    {"housing": +3.0, "education": +1.0, "transportation": +2.0, "public_safety":  0.0, "environment": +6.0},
    },
    "NY": {
        "Angela Reyes":  {"housing": +6.0, "education": +2.0, "transportation": +3.0, "public_safety": -2.0, "environment": +1.0},
        "Marcus Dunlap": {"housing": -1.0, "education": +1.0, "transportation": +2.0, "public_safety": +6.0, "environment": -1.0},
    },
    "TX": {
        "Carlos Vega":    {"housing": +2.0, "education": +5.0, "transportation": +2.0, "public_safety": +1.0, "environment": +3.0},
        "Dana Holloway":  {"housing": -2.0, "education": +1.0, "transportation": +4.0, "public_safety": +5.0, "environment": -3.0},
    },
    "PA": {
        "Diane Kowalski": {"housing": +4.0, "education": +3.0, "transportation": +5.0, "public_safety":  0.0, "environment": +2.0},
        "Frank Russo":    {"housing": -1.0, "education": +2.0, "transportation": +1.0, "public_safety": +5.0, "environment": -1.0},
    },
}
DEFAULT_PLANS = CANDIDATE_PLANS_BY_STATE["CA"]


class BudgetCategory(BaseModel):
    category: str
    label: str
    current_pct: float
    current_usd: int


class CandidateBudgetPlan(BaseModel):
    candidate_name: str
    shifts: dict[str, float]


class FollowMoneyResponse(BaseModel):
    jurisdiction: str
    total_budget_usd: int
    current_breakdown: list[BudgetCategory]
    candidate_plans: list[CandidateBudgetPlan]


@router.get("/follow-the-money", response_model=FollowMoneyResponse)
async def follow_the_money(zip: str = Query(default="94601")):
    state = zip_to_state(zip)
    budget = BUDGETS_BY_STATE.get(state, DEFAULT_BUDGET)
    plans = CANDIDATE_PLANS_BY_STATE.get(state, DEFAULT_PLANS)

    breakdown = [
        BudgetCategory(
            category=cat,
            label=info["label"],
            current_pct=info["pct"],
            current_usd=info["usd"],
        )
        for cat, info in budget["categories"].items()
    ]

    candidate_plans = [
        CandidateBudgetPlan(candidate_name=name, shifts=shifts)
        for name, shifts in plans.items()
    ]

    return FollowMoneyResponse(
        jurisdiction=budget["jurisdiction"],
        total_budget_usd=budget["total_budget_usd"],
        current_breakdown=breakdown,
        candidate_plans=candidate_plans,
    )
