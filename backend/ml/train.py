"""Train budget regression model — GradientBoosting with CV selection."""
import os
import sys
import pickle
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.linear_model import Ridge
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import r2_score, mean_absolute_error

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from ml.features import build_features

DATA_PATH  = os.path.join(os.path.dirname(__file__), "..", "data", "budget_historical.csv")
MODEL_DIR  = os.path.join(os.path.dirname(__file__), "..", "models")
MODEL_PATH = os.path.join(MODEL_DIR, "budget_regressor.pkl")


def main():
    df = pd.read_csv(DATA_PATH)
    print(f"Training data : {len(df)} rows  |  years {df['year'].min()}-{df['year'].max()}")

    X, y = build_features(df)
    print(f"Features      : {len(X.columns)} cols")
    print(f"Target stats  : mean={y.mean():.2f}  std={y.std():.2f}  min={y.min():.2f}  max={y.max():.2f}\n")

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    candidates = {
        "GradientBoosting": GradientBoostingRegressor(
            n_estimators=500, max_depth=3, learning_rate=0.03,
            subsample=0.8, min_samples_leaf=5, random_state=42,
        ),
        "RandomForest": RandomForestRegressor(
            n_estimators=300, max_depth=6, min_samples_leaf=2,
            random_state=42, n_jobs=-1,
        ),
        "Ridge": Ridge(alpha=1.0),
    }

    print("-- 5-Fold Cross-Validation --")
    best_name, best_cv_r2, best_model = None, -999.0, None
    for name, m in candidates.items():
        cv = cross_val_score(m, X, y, cv=5, scoring="r2")
        print(f"  {name:<22} R2 = {cv.mean():.4f} +/- {cv.std():.4f}")
        if cv.mean() > best_cv_r2:
            best_cv_r2 = cv.mean()
            best_model = m
            best_name  = name

    print(f"\nBest: {best_name}  (CV R2 = {best_cv_r2:.4f})")
    best_model.fit(X_train, y_train)

    y_pred = best_model.predict(X_test)
    r2  = r2_score(y_test, y_pred)
    mae = mean_absolute_error(y_test, y_pred)
    print(f"   Hold-out R2  : {r2:.4f}")
    print(f"   Hold-out MAE : {mae:.4f} pct-pts")

    os.makedirs(MODEL_DIR, exist_ok=True)
    with open(MODEL_PATH, "wb") as f:
        pickle.dump({"model": best_model, "r2": r2, "cv_r2": best_cv_r2}, f)
    print(f"\nModel saved to {MODEL_PATH}")


if __name__ == "__main__":
    main()
