"""Fetch state legislation from Open States API (free API key)."""

import os
import time
import requests
from dotenv import load_dotenv

load_dotenv()

BASE_URL = "https://v3.openstates.org"

ALL_STATES = [
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

STATE_ABBR = {
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


def _headers():
    key = os.environ.get("OPENSTATES_API_KEY")
    return {"X-API-KEY": key} if key else {}


def fetch_state_bills(state: str = "California", limit: int = 20, page: int = 1) -> list[dict]:
    url = f"{BASE_URL}/bills"
    params = {
        "jurisdiction": state,
        "sort": "updated_desc",
        "per_page": limit,
        "page": page,
    }
    resp = requests.get(url, headers=_headers(), params=params, timeout=30)
    resp.raise_for_status()
    bills = resp.json().get("results", [])

    state_abbr = STATE_ABBR.get(state, state[:2].upper())

    results = []
    for bill in bills:
        text = _extract_text(bill)
        results.append({
            "measure_id": f"{state_abbr}-{bill.get('identifier', 'UNKNOWN')}",
            "title": bill.get("title", ""),
            "text": text or bill.get("title", ""),
            "source_url": bill.get("openstates_url", ""),
            "jurisdiction": "state",
            "state": state_abbr,
            "category": _classify(bill.get("title", "")),
        })
    return results


def fetch_all_states(per_state: int = 20, max_pages: int = 1) -> list[dict]:
    """Fetch bills from all 50 states."""
    all_bills = []
    for state in ALL_STATES:
        for page in range(1, max_pages + 1):
            try:
                bills = fetch_state_bills(state, limit=per_state, page=page)
                all_bills.extend(bills)
                print(f"    {state}: page {page}, got {len(bills)} bills")
                if len(bills) < per_state:
                    break
            except Exception as e:
                print(f"    {state}: page {page} failed: {e}")
                break
            time.sleep(0.3)
    return all_bills


def _extract_text(bill: dict) -> str | None:
    versions = bill.get("versions", [])
    for version in versions:
        links = version.get("links", [])
        for link in links:
            url = link.get("url", "")
            if link.get("media_type") in ("text/html", "application/pdf") or url.endswith(".html"):
                try:
                    resp = requests.get(url, timeout=30)
                    if resp.ok and len(resp.text) > 200:
                        return resp.text[:50000]
                except Exception:
                    continue
    return None


def _classify(title: str) -> str:
    title_lower = title.lower()
    keywords = {
        "housing": ["housing", "rent", "tenant", "mortgage", "home", "shelter", "affordable"],
        "education": ["education", "school", "student", "university", "college", "teacher"],
        "transportation": ["transport", "transit", "highway", "road", "rail", "bridge", "traffic"],
        "public_safety": ["police", "safety", "crime", "fire", "emergency", "gun", "violence"],
        "environment": ["environment", "climate", "energy", "water", "pollution", "emission", "conservation"],
    }
    for cat, words in keywords.items():
        if any(w in title_lower for w in words):
            return cat
    return "other"
