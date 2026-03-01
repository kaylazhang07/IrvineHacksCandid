"""Load trained model and predict budget shifts."""

import os
import re
import pickle
from .features import personalize_shift, make_prediction_features, CATEGORIES

MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "models", "budget_regressor.pkl")

_model_data = None

CATEGORY_BUDGETS_BY_STATE = {
    "CA": {"housing": 1_065_000_000, "education": 1_430_000_000, "transportation": 780_000_000, "public_safety": 1_108_000_000, "environment": 435_000_000},
    "NY": {"housing": 1_332_000_000, "education": 2_304_000_000, "transportation": 1_440_000_000, "public_safety": 1_548_000_000, "environment": 576_000_000},
    "TX": {"housing": 372_000_000,   "education": 868_000_000,   "transportation": 775_000_000,   "public_safety": 868_000_000,   "environment": 217_000_000},
    "PA": {"housing": 330_000_000,   "education": 682_000_000,   "transportation": 418_000_000,   "public_safety": 572_000_000,   "environment": 198_000_000},
}
DEFAULT_BUDGETS = CATEGORY_BUDGETS_BY_STATE["CA"]

# Keywords that signal a category is actually relevant to the measure text
CATEGORY_KEYWORDS = {
    "housing":        ["housing", "rent", "tenant", "affordable", "eviction", "mortgage", "homelessness", "shelter", "dwelling", "residential"],
    "education":      ["education", "school", "student", "teacher", "classroom", "curriculum", "college", "university", "learning", "literacy"],
    "transportation": ["transportation", "transit", "highway", "road", "bus", "rail", "commute", "infrastructure", "bridge", "traffic"],
    "public_safety":  ["safety", "police", "fire", "emergency", "crime", "law enforcement", "911", "officer", "patrol", "security"],
    "environment":    ["environment", "climate", "pollution", "clean energy", "carbon", "water", "air quality", "conservation", "renewable", "emission"],
}

# Hard floor/ceiling so model never predicts crazy numbers
DELTA_PCT_MIN = -8.0
DELTA_PCT_MAX = 8.0


def _load_model():
    global _model_data
    if _model_data is None:
        with open(MODEL_PATH, "rb") as f:
            _model_data = pickle.load(f)
    return _model_data


def _relevance_scores(measure_text: str) -> dict[str, float]:
    """
    Score each budget category by how many of its keywords appear
    in the measure text. Returns a dict of category -> 0.0..1.0.
    A score of 0.0 means the measure has nothing to do with that category.
    """
    if not measure_text:
        return {cat: 1.0 for cat in CATEGORIES}  # no text — don't filter anything

    text = measure_text.lower()
    scores = {}
    for cat, keywords in CATEGORY_KEYWORDS.items():
        hits = sum(1 for kw in keywords if re.search(r'\b' + re.escape(kw) + r'\b', text))
        scores[cat] = min(hits / 3.0, 1.0)  # 3+ keyword hits = full relevance

    # If nothing matched at all, don't zero everything out — use small baseline
    if max(scores.values()) == 0.0:
        return {cat: 0.1 for cat in CATEGORIES}

    return scores


def predict_budget_shifts(measure_id: str, user, state: str = "CA", measure_text: str = "") -> list:
    from models import BudgetShift

    category_budgets = CATEGORY_BUDGETS_BY_STATE.get(state, DEFAULT_BUDGETS)
    relevance = _relevance_scores(measure_text)

    try:
        data = _load_model()
        model = data["model"]
        use_model = True
    except FileNotFoundError:
        use_model = False

    shifts = []
    for cat in CATEGORIES:
        if use_model:
            jur = "state" if state in ["CA", "NY", "TX", "PA"] else "city"
            X = make_prediction_features(cat, jur, state=state)
            raw_delta = float(model.predict(X)[0])
        else:
            raw_delta = 0.0

        # Scale by relevance: if the measure doesn't mention this category, shrink toward 0
        rel = relevance.get(cat, 0.0)
        delta_pct = raw_delta * rel

        # Clamp to reasonable range
        delta_pct = max(DELTA_PCT_MIN, min(DELTA_PCT_MAX, delta_pct))
        delta_pct = round(delta_pct, 2)

        base_usd = category_budgets.get(cat, 500_000_000)
        delta_usd = round(base_usd * delta_pct / 100)
        personal = personalize_shift(delta_pct, base_usd, cat, user)

        shifts.append(BudgetShift(
            category=cat,
            delta_pct=delta_pct,
            delta_usd=delta_usd,
            personal_annual_usd=personal,
        ))

    return shifts


def get_model_r2() -> float:
    try:
        data = _load_model()
        return data.get("r2", 0.0)
    except FileNotFoundError:
        return 0.0
