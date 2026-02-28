import pandas as pd
import numpy as np

INCOME_COEFFICIENTS = {
    "under_50k": 0.85,
    "50_100k":   1.00,
    "100_200k":  1.20,
    "over_200k": 1.45,
}

RENTER_OWNER_COEFFICIENTS = {
    "housing":        {"renter": 1.6, "owner": 0.4, "other": 1.0},
    "education":      {"renter": 0.9, "owner": 1.1, "other": 1.0},
    "transportation": {"renter": 1.2, "owner": 0.8, "other": 1.0},
    "public_safety":  {"renter": 1.0, "owner": 1.0, "other": 1.0},
    "environment":    {"renter": 1.1, "owner": 0.9, "other": 1.0},
}

CATEGORIES    = ["housing", "education", "transportation", "public_safety", "environment"]
JURISDICTIONS = ["city", "county", "state"]

# Census regions — fewer features, more signal than 50 one-hot columns
REGION_MAP = {
    "CT": "northeast", "ME": "northeast", "MA": "northeast", "NH": "northeast",
    "RI": "northeast", "VT": "northeast", "NJ": "northeast", "NY": "northeast", "PA": "northeast",
    "IL": "midwest", "IN": "midwest", "MI": "midwest", "OH": "midwest", "WI": "midwest",
    "IA": "midwest", "KS": "midwest", "MN": "midwest", "MO": "midwest", "NE": "midwest",
    "ND": "midwest", "SD": "midwest",
    "DE": "south", "FL": "south", "GA": "south", "MD": "south", "NC": "south",
    "SC": "south", "VA": "south", "WV": "south", "AL": "south", "KY": "south",
    "MS": "south", "TN": "south", "AR": "south", "LA": "south", "OK": "south", "TX": "south",
    "AZ": "west", "CO": "west", "ID": "west", "MT": "west", "NV": "west", "NM": "west",
    "UT": "west", "WY": "west", "AK": "west", "CA": "west", "HI": "west", "OR": "west", "WA": "west",
    "DC": "south",
}
REGIONS = ["northeast", "midwest", "south", "west"]

ALL_STATES = sorted(set(REGION_MAP.keys()))


def build_features(df: pd.DataFrame):
    df = df.copy()

    # One-hot: category, jurisdiction
    for cat in CATEGORIES:
        df[f"cat_{cat}"] = (df["category"] == cat).astype(int)
    for jur in JURISDICTIONS:
        df[f"jur_{jur}"] = (df["jurisdiction"] == jur).astype(int)

    # Region instead of 50 state dummies
    if "state" in df.columns:
        df["region"] = df["state"].map(REGION_MAP).fillna("south")
        for r in REGIONS:
            df[f"reg_{r}"] = (df["region"] == r).astype(int)
    else:
        for r in REGIONS:
            df[f"reg_{r}"] = 0

    # Normalized year
    year_range = df["year"].max() - df["year"].min()
    df["year_norm"] = (df["year"] - df["year"].min()) / year_range if year_range > 0 else 0

    # Lag and rolling features
    if "lag_1" not in df.columns:
        df = df.sort_values(["state", "category", "jurisdiction", "year"])
        df["lag_1"] = df.groupby(["state", "category", "jurisdiction"])["pct_change_yoy"].shift(1)
        df["lag_1"] = df["lag_1"].fillna(df["pct_change_yoy"])
    if "rolling_3yr" not in df.columns:
        df["rolling_3yr"] = (
            df.groupby(["state", "category", "jurisdiction"])["pct_change_yoy"]
            .transform(lambda x: x.rolling(3, min_periods=1).mean())
        )
    if "budget_log" not in df.columns:
        df["budget_log"] = np.log10(df["budget_usd"].clip(lower=1))

    feature_cols = (
        [f"cat_{c}" for c in CATEGORIES]
        + [f"jur_{j}" for j in JURISDICTIONS]
        + [f"reg_{r}" for r in REGIONS]
        + ["year_norm", "lag_1", "rolling_3yr", "budget_log"]
    )
    return df[feature_cols], df["pct_change_yoy"]


_LATEST_LAGS = None


def load_latest_lags():
    """Load lag values from the training data for use at prediction time."""
    global _LATEST_LAGS
    if _LATEST_LAGS is not None:
        return _LATEST_LAGS

    import os
    data_path = os.path.join(os.path.dirname(__file__), "..", "data", "budget_historical.csv")
    try:
        df = pd.read_csv(data_path)
        latest_year = df["year"].max()
        latest = df[df["year"] == latest_year]
        _LATEST_LAGS = {}
        for _, row in latest.iterrows():
            key = (row.get("state", "CA"), row["category"], row["jurisdiction"])
            _LATEST_LAGS[key] = {
                "lag_1": row["pct_change_yoy"],
                "rolling_3yr": row.get("rolling_3yr", row["pct_change_yoy"]),
                "budget_log": row.get("budget_log", np.log10(max(row["budget_usd"], 1))),
            }
    except FileNotFoundError:
        _LATEST_LAGS = {}
    return _LATEST_LAGS


def make_prediction_features(category: str, jurisdiction: str, state: str = "CA") -> pd.DataFrame:
    row = {}
    for cat in CATEGORIES:
        row[f"cat_{cat}"] = 1 if cat == category else 0
    for jur in JURISDICTIONS:
        row[f"jur_{jur}"] = 1 if jur == jurisdiction else 0

    region = REGION_MAP.get(state, "south")
    for r in REGIONS:
        row[f"reg_{r}"] = 1 if r == region else 0

    row["year_norm"] = 1.0

    lags = load_latest_lags()
    lag_data = lags.get((state, category, jurisdiction), {})
    row["lag_1"] = lag_data.get("lag_1", 5.0)
    row["rolling_3yr"] = lag_data.get("rolling_3yr", 5.0)
    row["budget_log"] = lag_data.get("budget_log", 9.0)

    return pd.DataFrame([row])


def personalize_shift(base_shift_pct, base_amount_usd, category, user):
    income_mult  = INCOME_COEFFICIENTS.get(user.household_income_bracket, 1.0)
    housing_mult = RENTER_OWNER_COEFFICIENTS.get(category, {}).get(user.housing_status, 1.0)
    annual_share = base_amount_usd * (base_shift_pct / 100) * income_mult * housing_mult / 300_000
    return round(annual_share, 2)
