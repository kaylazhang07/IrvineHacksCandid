from pydantic import BaseModel
from typing import Literal, Optional


class UserProfile(BaseModel):
    zip_code: str
    housing_status: Literal["renter", "owner", "other"]
    has_children: bool
    household_income_bracket: Literal["under_50k", "50_100k", "100_200k", "over_200k"]
    primary_concerns: list[str]
    job: str = ""
    goals: list[str] = []


class ExplainRequest(BaseModel):
    measure_id: str
    measure_text: str = ""
    measure_title: str = ""
    user: UserProfile


class Citation(BaseModel):
    chunk_id: str
    chunk_text: str
    source_url: str
    plain_translation: str
    relevance_score: float


class BudgetShift(BaseModel):
    category: str
    delta_pct: float
    delta_usd: float
    personal_annual_usd: float


class MapPin(BaseModel):
    lat: float
    lon: float
    label: str
    category: str
    measure_id: str
    address: Optional[str] = None


class ExplainResponse(BaseModel):
    measure_id: str
    measure_title: str
    plain_english_summary: str
    personal_impact_statement: str
    citations: list[Citation]
    budget_shifts: list[BudgetShift]
    map_pins: list[MapPin]
    confidence_score: float


class BudgetRequest(BaseModel):
    measure_id: str
    user: UserProfile


class BudgetResponse(BaseModel):
    shifts: list[BudgetShift]
    model_r2: float
