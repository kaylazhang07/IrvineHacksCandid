"""Load trained model and predict budget shifts."""

import os
import re
import pickle
from .features import personalize_shift, make_prediction_features, CATEGORIES

MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "models", "budget_regressor.pkl")

_model_data = None

CATEGORY_BUDGETS_BY_STATE = {'AL': {'housing': 89000000, 'education': 420000000, 'transportation': 280000000, 'public_safety': 340000000, 'environment': 95000000}, 'AK': {'housing': 95000000, 'education': 310000000, 'transportation': 240000000, 'public_safety': 190000000, 'environment': 120000000}, 'AZ': {'housing': 240000000, 'education': 540000000, 'transportation': 350000000, 'public_safety': 440000000, 'environment': 148000000}, 'AR': {'housing': 72000000, 'education': 320000000, 'transportation': 220000000, 'public_safety': 260000000, 'environment': 78000000}, 'CA': {'housing': 1065000000, 'education': 1430000000, 'transportation': 780000000, 'public_safety': 1108000000, 'environment': 435000000}, 'CO': {'housing': 195000000, 'education': 480000000, 'transportation': 320000000, 'public_safety': 370000000, 'environment': 162000000}, 'CT': {'housing': 210000000, 'education': 520000000, 'transportation': 340000000, 'public_safety': 390000000, 'environment': 145000000}, 'DE': {'housing': 68000000, 'education': 180000000, 'transportation': 130000000, 'public_safety': 148000000, 'environment': 58000000}, 'FL': {'housing': 520000000, 'education': 1100000000, 'transportation': 680000000, 'public_safety': 820000000, 'environment': 310000000}, 'GA': {'housing': 280000000, 'education': 660000000, 'transportation': 420000000, 'public_safety': 530000000, 'environment': 175000000}, 'HI': {'housing': 118000000, 'education': 290000000, 'transportation': 185000000, 'public_safety': 210000000, 'environment': 88000000}, 'ID': {'housing': 68000000, 'education': 195000000, 'transportation': 148000000, 'public_safety': 162000000, 'environment': 72000000}, 'IL': {'housing': 480000000, 'education': 980000000, 'transportation': 610000000, 'public_safety': 740000000, 'environment': 280000000}, 'IN': {'housing': 168000000, 'education': 480000000, 'transportation': 320000000, 'public_safety': 370000000, 'environment': 128000000}, 'IA': {'housing': 98000000, 'education': 310000000, 'transportation': 215000000, 'public_safety': 240000000, 'environment': 95000000}, 'KS': {'housing': 88000000, 'education': 290000000, 'transportation': 200000000, 'public_safety': 225000000, 'environment': 85000000}, 'KY': {'housing': 118000000, 'education': 380000000, 'transportation': 260000000, 'public_safety': 300000000, 'environment': 98000000}, 'LA': {'housing': 128000000, 'education': 380000000, 'transportation': 268000000, 'public_safety': 320000000, 'environment': 115000000}, 'ME': {'housing': 78000000, 'education': 195000000, 'transportation': 148000000, 'public_safety': 158000000, 'environment': 68000000}, 'MD': {'housing': 310000000, 'education': 680000000, 'transportation': 445000000, 'public_safety': 520000000, 'environment': 192000000}, 'MA': {'housing': 480000000, 'education': 920000000, 'transportation': 580000000, 'public_safety': 680000000, 'environment': 248000000}, 'MI': {'housing': 260000000, 'education': 620000000, 'transportation': 390000000, 'public_safety': 490000000, 'environment': 162000000}, 'MN': {'housing': 248000000, 'education': 580000000, 'transportation': 378000000, 'public_safety': 448000000, 'environment': 178000000}, 'MS': {'housing': 72000000, 'education': 280000000, 'transportation': 195000000, 'public_safety': 235000000, 'environment': 72000000}, 'MO': {'housing': 148000000, 'education': 420000000, 'transportation': 288000000, 'public_safety': 345000000, 'environment': 118000000}, 'MT': {'housing': 58000000, 'education': 168000000, 'transportation': 135000000, 'public_safety': 138000000, 'environment': 72000000}, 'NE': {'housing': 78000000, 'education': 235000000, 'transportation': 168000000, 'public_safety': 188000000, 'environment': 78000000}, 'NV': {'housing': 148000000, 'education': 320000000, 'transportation': 225000000, 'public_safety': 295000000, 'environment': 98000000}, 'NH': {'housing': 88000000, 'education': 195000000, 'transportation': 148000000, 'public_safety': 162000000, 'environment': 65000000}, 'NJ': {'housing': 480000000, 'education': 900000000, 'transportation': 560000000, 'public_safety': 680000000, 'environment': 252000000}, 'NM': {'housing': 88000000, 'education': 248000000, 'transportation': 178000000, 'public_safety': 212000000, 'environment': 88000000}, 'NY': {'housing': 1332000000, 'education': 2304000000, 'transportation': 1440000000, 'public_safety': 1548000000, 'environment': 576000000}, 'NC': {'housing': 270000000, 'education': 640000000, 'transportation': 400000000, 'public_safety': 510000000, 'environment': 168000000}, 'ND': {'housing': 48000000, 'education': 148000000, 'transportation': 118000000, 'public_safety': 118000000, 'environment': 58000000}, 'OH': {'housing': 290000000, 'education': 720000000, 'transportation': 440000000, 'public_safety': 560000000, 'environment': 190000000}, 'OK': {'housing': 98000000, 'education': 320000000, 'transportation': 228000000, 'public_safety': 278000000, 'environment': 88000000}, 'OR': {'housing': 228000000, 'education': 480000000, 'transportation': 318000000, 'public_safety': 368000000, 'environment': 158000000}, 'PA': {'housing': 330000000, 'education': 682000000, 'transportation': 418000000, 'public_safety': 572000000, 'environment': 198000000}, 'RI': {'housing': 88000000, 'education': 195000000, 'transportation': 145000000, 'public_safety': 168000000, 'environment': 65000000}, 'SC': {'housing': 128000000, 'education': 380000000, 'transportation': 258000000, 'public_safety': 318000000, 'environment': 108000000}, 'SD': {'housing': 48000000, 'education': 148000000, 'transportation': 118000000, 'public_safety': 118000000, 'environment': 55000000}, 'TN': {'housing': 158000000, 'education': 428000000, 'transportation': 298000000, 'public_safety': 368000000, 'environment': 118000000}, 'TX': {'housing': 372000000, 'education': 868000000, 'transportation': 775000000, 'public_safety': 868000000, 'environment': 217000000}, 'UT': {'housing': 118000000, 'education': 318000000, 'transportation': 228000000, 'public_safety': 258000000, 'environment': 98000000}, 'VT': {'housing': 58000000, 'education': 148000000, 'transportation': 118000000, 'public_safety': 118000000, 'environment': 55000000}, 'VA': {'housing': 310000000, 'education': 700000000, 'transportation': 450000000, 'public_safety': 560000000, 'environment': 196000000}, 'WA': {'housing': 420000000, 'education': 860000000, 'transportation': 540000000, 'public_safety': 650000000, 'environment': 270000000}, 'WV': {'housing': 68000000, 'education': 228000000, 'transportation': 168000000, 'public_safety': 195000000, 'environment': 72000000}, 'WI': {'housing': 198000000, 'education': 520000000, 'transportation': 348000000, 'public_safety': 398000000, 'environment': 148000000}, 'WY': {'housing': 48000000, 'education': 148000000, 'transportation': 118000000, 'public_safety': 118000000, 'environment': 58000000}, 'DC': {'housing': 348000000, 'education': 448000000, 'transportation': 298000000, 'public_safety': 398000000, 'environment': 128000000}}

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
