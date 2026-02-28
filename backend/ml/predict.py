"""Load trained model and predict budget shifts."""

import os
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

MEASURE_BIAS = {
    "hr-edu-2025":     {"education": +1.5},
    "hr-housing-2025": {"housing": +2.0, "transportation": +0.5},
    "hr-transit-2025": {"transportation": +2.0, "environment": +0.8},
    "hr-safety-2025":  {"public_safety": +1.0},
    "hr-env-2025":     {"environment": +2.5, "transportation": +0.5},
    "hr-health-2025":  {"housing": +0.3},
    "hr-jobs-2025":    {"education": +0.5},
    "hr-water-2025":   {"environment": +1.0, "housing": +0.8},
}


def _load_model():
    global _model_data
    if _model_data is None:
        with open(MODEL_PATH, "rb") as f:
            _model_data = pickle.load(f)
    return _model_data


def predict_budget_shifts(measure_id: str, user, state: str = "CA") -> list:
    from models import BudgetShift

    category_budgets = CATEGORY_BUDGETS_BY_STATE.get(state, DEFAULT_BUDGETS)
    bias = MEASURE_BIAS.get(measure_id, {})

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
            delta_pct = float(model.predict(X)[0])
        else:
            delta_pct = 0.0

        delta_pct += bias.get(cat, 0.0)
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
