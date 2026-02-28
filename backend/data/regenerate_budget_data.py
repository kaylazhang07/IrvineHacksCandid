"""Regenerate budget_historical.csv with realistic 2014–2025 data across 4 states."""
import pandas as pd
import numpy as np
import os

np.random.seed(42)

CATEGORIES    = ["housing", "education", "transportation", "public_safety", "environment"]
JURISDICTIONS = ["city", "county", "state"]
STATES        = ["CA", "NY", "TX", "PA"]

# Base growth rates differ by state — reflects real regional variation
BASE_PCT = {
    "CA": {
        ("housing", "city"): 2.1, ("housing", "county"): 2.0, ("housing", "state"): 1.9,
        ("education", "city"): 1.8, ("education", "county"): 1.9, ("education", "state"): 2.3,
        ("transportation", "city"): 3.2, ("transportation", "county"): 3.0, ("transportation", "state"): 2.8,
        ("public_safety", "city"): 1.5, ("public_safety", "county"): 1.4, ("public_safety", "state"): 1.2,
        ("environment", "city"): 4.1, ("environment", "county"): 3.8, ("environment", "state"): 3.5,
    },
    "NY": {
        ("housing", "city"): 2.5, ("housing", "county"): 2.3, ("housing", "state"): 2.1,
        ("education", "city"): 2.0, ("education", "county"): 2.2, ("education", "state"): 2.6,
        ("transportation", "city"): 3.5, ("transportation", "county"): 3.2, ("transportation", "state"): 3.0,
        ("public_safety", "city"): 1.8, ("public_safety", "county"): 1.6, ("public_safety", "state"): 1.4,
        ("environment", "city"): 3.8, ("environment", "county"): 3.5, ("environment", "state"): 3.2,
    },
    "TX": {
        ("housing", "city"): 1.8, ("housing", "county"): 1.6, ("housing", "state"): 1.5,
        ("education", "city"): 2.2, ("education", "county"): 2.4, ("education", "state"): 2.8,
        ("transportation", "city"): 3.8, ("transportation", "county"): 3.5, ("transportation", "state"): 3.3,
        ("public_safety", "city"): 1.9, ("public_safety", "county"): 1.7, ("public_safety", "state"): 1.5,
        ("environment", "city"): 3.0, ("environment", "county"): 2.7, ("environment", "state"): 2.5,
    },
    "PA": {
        ("housing", "city"): 1.6, ("housing", "county"): 1.5, ("housing", "state"): 1.4,
        ("education", "city"): 2.1, ("education", "county"): 2.3, ("education", "state"): 2.7,
        ("transportation", "city"): 2.9, ("transportation", "county"): 2.7, ("transportation", "state"): 2.5,
        ("public_safety", "city"): 1.6, ("public_safety", "county"): 1.5, ("public_safety", "state"): 1.3,
        ("environment", "city"): 3.5, ("environment", "county"): 3.2, ("environment", "state"): 2.9,
    },
}

BASE_BUDGET = {
    "CA": {
        ("housing", "city"): 850e6, ("housing", "county"): 1.6e9, ("housing", "state"): 5.2e9,
        ("education", "city"): 1.2e9, ("education", "county"): 2.4e9, ("education", "state"): 8.5e9,
        ("transportation", "city"): 600e6, ("transportation", "county"): 1.1e9, ("transportation", "state"): 3.8e9,
        ("public_safety", "city"): 950e6, ("public_safety", "county"): 1.8e9, ("public_safety", "state"): 6.1e9,
        ("environment", "city"): 300e6, ("environment", "county"): 550e6, ("environment", "state"): 2.1e9,
    },
    "NY": {
        ("housing", "city"): 1.1e9, ("housing", "county"): 2.0e9, ("housing", "state"): 6.5e9,
        ("education", "city"): 1.5e9, ("education", "county"): 3.0e9, ("education", "state"): 10.5e9,
        ("transportation", "city"): 900e6, ("transportation", "county"): 1.6e9, ("transportation", "state"): 5.5e9,
        ("public_safety", "city"): 1.2e9, ("public_safety", "county"): 2.3e9, ("public_safety", "state"): 7.8e9,
        ("environment", "city"): 400e6, ("environment", "county"): 750e6, ("environment", "state"): 2.8e9,
    },
    "TX": {
        ("housing", "city"): 500e6, ("housing", "county"): 900e6, ("housing", "state"): 3.0e9,
        ("education", "city"): 800e6, ("education", "county"): 1.5e9, ("education", "state"): 5.5e9,
        ("transportation", "city"): 700e6, ("transportation", "county"): 1.3e9, ("transportation", "state"): 4.5e9,
        ("public_safety", "city"): 750e6, ("public_safety", "county"): 1.4e9, ("public_safety", "state"): 4.8e9,
        ("environment", "city"): 200e6, ("environment", "county"): 350e6, ("environment", "state"): 1.3e9,
    },
    "PA": {
        ("housing", "city"): 400e6, ("housing", "county"): 750e6, ("housing", "state"): 2.5e9,
        ("education", "city"): 700e6, ("education", "county"): 1.3e9, ("education", "state"): 4.8e9,
        ("transportation", "city"): 450e6, ("transportation", "county"): 850e6, ("transportation", "state"): 3.0e9,
        ("public_safety", "city"): 600e6, ("public_safety", "county"): 1.1e9, ("public_safety", "state"): 3.8e9,
        ("environment", "city"): 180e6, ("environment", "county"): 320e6, ("environment", "state"): 1.1e9,
    },
}

# State-specific COVID sensitivity (NY hit harder, TX less affected)
YEAR_SHOCKS = {
    "CA": {2014: 0.0, 2015: 0.10, 2016: -0.15, 2017: 0.20, 2018: 0.35, 2019: 0.15, 2020: -1.80, 2021: -0.60, 2022: 1.50, 2023: 0.90, 2024: 0.45, 2025: 0.25},
    "NY": {2014: 0.0, 2015: 0.05, 2016: -0.20, 2017: 0.15, 2018: 0.30, 2019: 0.10, 2020: -2.20, 2021: -0.80, 2022: 1.70, 2023: 1.00, 2024: 0.50, 2025: 0.30},
    "TX": {2014: 0.0, 2015: 0.15, 2016: -0.10, 2017: 0.25, 2018: 0.40, 2019: 0.20, 2020: -1.20, 2021: -0.30, 2022: 1.30, 2023: 0.70, 2024: 0.35, 2025: 0.20},
    "PA": {2014: 0.0, 2015: 0.08, 2016: -0.18, 2017: 0.18, 2018: 0.32, 2019: 0.12, 2020: -1.90, 2021: -0.70, 2022: 1.40, 2023: 0.80, 2024: 0.40, 2025: 0.22},
}

rows = []

for st in STATES:
    budgets = {k: float(v) for k, v in BASE_BUDGET[st].items()}
    prev_pct = {}  # for lag feature

    for year in sorted(YEAR_SHOCKS[st]):
        for cat in CATEGORIES:
            for jur in JURISDICTIONS:
                shock = YEAR_SHOCKS[st][year]
                noise = np.random.normal(0, 0.25)
                pct_change = round(BASE_PCT[st][(cat, jur)] + shock + noise, 2)
                budget = int(budgets[(cat, jur)])

                lag_key = (cat, jur)
                lag_1 = prev_pct.get(lag_key, pct_change)  # first year uses itself

                rows.append({
                    "year":           year,
                    "state":          st,
                    "category":       cat,
                    "jurisdiction":   jur,
                    "budget_usd":     budget,
                    "pct_change_yoy": pct_change,
                    "lag_1":          lag_1,
                })

                prev_pct[lag_key] = pct_change
                budgets[(cat, jur)] *= (1 + pct_change / 100)

df = pd.DataFrame(rows)

# Add rolling 3-year mean (computed after all rows exist)
df = df.sort_values(["state", "category", "jurisdiction", "year"])
df["rolling_3yr"] = (
    df.groupby(["state", "category", "jurisdiction"])["pct_change_yoy"]
    .transform(lambda x: x.rolling(3, min_periods=1).mean())
    .round(3)
)
df["budget_log"] = np.log10(df["budget_usd"]).round(4)

out = os.path.join(os.path.dirname(__file__), "budget_historical.csv")
df.to_csv(out, index=False)
print(f"Saved {len(df)} rows -> {out}")
print(f"States: {df['state'].unique()}")
print(f"Years:  {df['year'].min()}-{df['year'].max()}")
print(f"\nPer-state stats:")
print(df.groupby("state")["pct_change_yoy"].agg(["count", "mean", "std"]).round(2).to_string())
