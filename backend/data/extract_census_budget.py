"""Extract real budget data from Census ASFIN Excel files for all 50 states."""
import os
import re
import tempfile
import pandas as pd
import numpy as np
import openpyxl
from zipfile import ZipFile

CENSUS_DIR = os.path.join(os.path.dirname(__file__), "census_raw")

# Our 5 budget categories mapped to Census row labels
# Note: Census doesn't have a standalone "housing" category at state level.
# "Public welfare" is the functional area that includes housing assistance,
# community development, TANF, and Medicaid — the closest match.
CATEGORY_MAP = {
    "education":      ["Education"],
    "housing":        ["Public welfare"],
    "transportation": ["Highways"],
    "public_safety":  ["Police protection", "Correction"],  # sum these
    "environment":    ["Natural resources", "Parks and recreation"],  # sum these
}

# State FIPS-like column names vary by file format, so we find them dynamically
US_STATES = [
    "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado",
    "Connecticut", "Delaware", "Florida", "Georgia", "Hawaii", "Idaho",
    "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana",
    "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota",
    "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada",
    "New Hampshire", "New Jersey", "New Mexico", "New York",
    "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon",
    "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota",
    "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington",
    "West Virginia", "Wisconsin", "Wyoming",
]

STATE_ABBREV = {
    "Alabama": "AL", "Alaska": "AK", "Arizona": "AZ", "Arkansas": "AR",
    "California": "CA", "Colorado": "CO", "Connecticut": "CT", "Delaware": "DE",
    "Florida": "FL", "Georgia": "GA", "Hawaii": "HI", "Idaho": "ID",
    "Illinois": "IL", "Indiana": "IN", "Iowa": "IA", "Kansas": "KS",
    "Kentucky": "KY", "Louisiana": "LA", "Maine": "ME", "Maryland": "MD",
    "Massachusetts": "MA", "Michigan": "MI", "Minnesota": "MN",
    "Mississippi": "MS", "Missouri": "MO", "Montana": "MT", "Nebraska": "NE",
    "Nevada": "NV", "New Hampshire": "NH", "New Jersey": "NJ",
    "New Mexico": "NM", "New York": "NY", "North Carolina": "NC",
    "North Dakota": "ND", "Ohio": "OH", "Oklahoma": "OK", "Oregon": "OR",
    "Pennsylvania": "PA", "Rhode Island": "RI", "South Carolina": "SC",
    "South Dakota": "SD", "Tennessee": "TN", "Texas": "TX", "Utah": "UT",
    "Vermont": "VT", "Virginia": "VA", "Washington": "WA",
    "West Virginia": "WV", "Wisconsin": "WI", "Wyoming": "WY",
}


def _clean_label(val):
    """Normalize cell label for matching."""
    if val is None:
        return ""
    return str(val).replace("\xa0", " ").strip().lower()


def _fix_xlsx_xml(filepath):
    """Fix malformed XML datetimes in xlsx files (e.g. asfin_2017.xlsx)."""
    try:
        openpyxl.load_workbook(filepath, data_only=True)
        return filepath  # file is fine
    except ValueError:
        fixed = filepath.replace(".xlsx", "_fixed.xlsx")
        with ZipFile(filepath, "r") as zin, ZipFile(fixed, "w") as zout:
            for item in zin.infolist():
                data = zin.read(item.filename)
                if item.filename == "docProps/core.xml":
                    text = data.decode("utf-8")
                    text = re.sub(
                        r"(\d{4})-\s*(\d{1,2})-(\d{1,2})T(\d{1,2}):\s*(\d{1,2}):(\d{1,2})Z",
                        lambda m: f"{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}T{int(m.group(4)):02d}:{int(m.group(5)):02d}:{int(m.group(6)):02d}Z",
                        text,
                    )
                    data = text.encode("utf-8")
                zout.writestr(item, data)
        return fixed


def _parse_new_format(filepath, year):
    """Parse single-year format: states as columns, label in col A."""
    filepath = _fix_xlsx_xml(filepath)
    wb = openpyxl.load_workbook(filepath, data_only=True)
    ws = wb.active

    # Find header row with state names (row 5 typically)
    state_cols = {}
    for row in ws.iter_rows(min_row=1, max_row=10):
        for cell in row:
            val = str(cell.value or "").strip()
            if val in US_STATES:
                state_cols[val] = cell.column - 1  # 0-indexed

    if not state_cols:
        print(f"  WARNING: No state columns found in {filepath}")
        return []

    # Find expenditure rows by label
    label_rows = {}
    for i, row in enumerate(ws.iter_rows(min_row=1, values_only=True), 1):
        label = _clean_label(row[0])
        for census_label_list in CATEGORY_MAP.values():
            for cl in census_label_list:
                if cl.lower() == label:
                    label_rows[cl] = i

    # Extract data
    rows = []
    all_data = list(ws.iter_rows(min_row=1, values_only=True))
    for state_name, col_idx in state_cols.items():
        abbrev = STATE_ABBREV.get(state_name)
        if not abbrev:
            continue
        for our_cat, census_labels in CATEGORY_MAP.items():
            total = 0
            found = False
            for cl in census_labels:
                if cl in label_rows:
                    row_idx = label_rows[cl] - 1  # 0-indexed
                    val = all_data[row_idx][col_idx]
                    if val and val != "X" and val != "":
                        try:
                            total += int(val) * 1000  # data is in thousands
                            found = True
                        except (ValueError, TypeError):
                            pass
            if found:
                rows.append({
                    "year": year,
                    "state": abbrev,
                    "category": our_cat,
                    "jurisdiction": "state",
                    "budget_usd": total,
                })
    return rows


def _parse_old_format(filepath, year):
    """Parse 2018-2020 format: 'Final' sheet, states have FY columns, wider layout."""
    wb = openpyxl.load_workbook(filepath, data_only=True)
    sheet_name = wb.sheetnames[0]
    ws = wb[sheet_name]

    # Row 1 has state names, row 2 has FY year labels
    # Find state columns — look for the FY{year} column under each state
    header1 = list(ws.iter_rows(min_row=1, max_row=1, values_only=True))[0]
    header2 = list(ws.iter_rows(min_row=2, max_row=2, values_only=True))[0]

    state_cols = {}
    current_state = None
    for i, h in enumerate(header1):
        if h and str(h).strip() in US_STATES:
            current_state = str(h).strip()
        # Under each state, find the FY column matching our year
        if current_state and header2[i]:
            fy_label = str(header2[i]).strip()
            if fy_label == f"FY{year}":
                state_cols[current_state] = i

    if not state_cols:
        print(f"  WARNING: No state FY{year} columns found in {filepath}")
        return []

    # Find expenditure rows
    label_rows = {}
    all_data = list(ws.iter_rows(min_row=1, values_only=True))
    for i, row in enumerate(all_data):
        label = _clean_label(row[0])
        for census_label_list in CATEGORY_MAP.values():
            for cl in census_label_list:
                if cl.lower() == label:
                    label_rows[cl] = i

    # Extract
    rows = []
    for state_name, col_idx in state_cols.items():
        abbrev = STATE_ABBREV.get(state_name)
        if not abbrev:
            continue
        for our_cat, census_labels in CATEGORY_MAP.items():
            total = 0
            found = False
            for cl in census_labels:
                if cl in label_rows:
                    val = all_data[label_rows[cl]][col_idx]
                    if val and val != "X" and val != "":
                        try:
                            total += int(val) * 1000
                            found = True
                        except (ValueError, TypeError):
                            pass
            if found:
                rows.append({
                    "year": year,
                    "state": abbrev,
                    "category": our_cat,
                    "jurisdiction": "state",
                    "budget_usd": total,
                })
    return rows


def main():
    all_rows = []

    # Single-year format files (STC 2014-2016, ASFIN 2017, 2022-2023)
    single_year_files = {
        2014: "2014-STC.xlsx",
        2015: "2015-STC.xlsx",
        2016: "2016-STC.xlsx",
        2017: "asfin_2017.xlsx",
        2022: "asfin_2022.xlsx",
        2023: "asfin_2023.xlsx",
    }
    for year, fname in single_year_files.items():
        path = os.path.join(CENSUS_DIR, fname)
        if os.path.exists(path):
            print(f"Parsing {fname} (single-year format)...")
            rows = _parse_new_format(path, year)
            print(f"  -> {len(rows)} rows")
            all_rows.extend(rows)

    # Multi-year format files (2018-2021) — contain 2 FY years each
    multi_year_files = {
        "asfin_2021.xlsx": [2021, 2020],
        "asfin_2020.xlsx": [2020, 2019],
        "asfin_2019.xlsx": [2019, 2018],
        "asfin_2018.xlsx": [2018, 2017],
    }
    seen_years = {r["year"] for r in all_rows}
    for fname, years in multi_year_files.items():
        path = os.path.join(CENSUS_DIR, fname)
        if os.path.exists(path):
            for year in years:
                if year in seen_years:
                    continue
                print(f"Parsing {fname} for FY{year} (multi-year format)...")
                rows = _parse_old_format(path, year)
                print(f"  -> {len(rows)} rows")
                all_rows.extend(rows)
                seen_years.add(year)

    df = pd.DataFrame(all_rows)
    df = df.sort_values(["state", "category", "year"]).reset_index(drop=True)

    # Compute pct_change_yoy
    df["pct_change_yoy"] = (
        df.groupby(["state", "category", "jurisdiction"])["budget_usd"]
        .pct_change() * 100
    ).round(2)
    df = df.dropna(subset=["pct_change_yoy"])  # drop first year per group (no lag)

    # Clip outliers BEFORE computing lag/rolling so features match target
    df["pct_change_yoy"] = df["pct_change_yoy"].clip(-20, 30)

    # Add lag and rolling features (now computed from clipped values)
    df = df.sort_values(["state", "category", "jurisdiction", "year"])
    df["lag_1"] = df.groupby(["state", "category", "jurisdiction"])["pct_change_yoy"].shift(1)
    df["rolling_3yr"] = (
        df.groupby(["state", "category", "jurisdiction"])["pct_change_yoy"]
        .transform(lambda x: x.rolling(3, min_periods=1).mean())
        .round(3)
    )
    df["budget_log"] = np.log10(df["budget_usd"].clip(lower=1)).round(4)
    # Fill lag NaN for first available year with rolling_3yr
    df["lag_1"] = df["lag_1"].fillna(df["rolling_3yr"])

    out = os.path.join(os.path.dirname(__file__), "budget_historical.csv")
    df.to_csv(out, index=False)

    print(f"\n=== RESULTS ===")
    print(f"Total rows: {len(df)}")
    print(f"States: {sorted(df['state'].unique())} ({df['state'].nunique()} states)")
    print(f"Years: {sorted(df['year'].unique())}")
    print(f"Categories: {sorted(df['category'].unique())}")
    print(f"\nPer-category stats:")
    print(df.groupby("category")["pct_change_yoy"].agg(["count", "mean", "std"]).round(2).to_string())
    print(f"\nSaved to {out}")


if __name__ == "__main__":
    main()
