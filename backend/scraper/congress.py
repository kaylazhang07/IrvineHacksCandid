"""Fetch federal bills from Congress.gov API (free, optional API key)."""

import os
import time
import requests
from dotenv import load_dotenv

load_dotenv()

BASE_URL = "https://api.congress.gov/v3"


def _params_with_key(extra: dict = None) -> dict:
    p = {"format": "json"}
    key = os.environ.get("CONGRESS_API_KEY")
    if key:
        p["api_key"] = key
    if extra:
        p.update(extra)
    return p


def fetch_bills_paginated(congress: int = 118, bill_type: str = "hr", max_pages: int = 10, per_page: int = 250) -> list[dict]:
    """Fetch bills with pagination. Each page = up to 250 bills."""
    results = []
    offset = 0
    for _ in range(max_pages):
        url = f"{BASE_URL}/bill/{congress}/{bill_type}"
        params = _params_with_key({"limit": per_page, "offset": offset})
        try:
            resp = requests.get(url, params=params, timeout=30)
            resp.raise_for_status()
            bills = resp.json().get("bills", [])
        except Exception as e:
            print(f"    Page fetch failed at offset {offset}: {e}")
            break

        if not bills:
            break

        for bill in bills:
            bill_number = bill.get("number", "")
            results.append({
                "measure_id": f"{bill_type.upper()}-{bill_number}",
                "title": bill.get("title", ""),
                "congress": congress,
                "bill_type": bill_type,
                "bill_number": bill_number,
                "source_url": bill.get("url", f"https://congress.gov/bill/{congress}/{bill_type}/{bill_number}"),
                "jurisdiction": "federal",
                "state": "US",
                "category": classify_bill(bill.get("title", "")),
            })

        offset += per_page
        time.sleep(0.5)  # rate limit

    return results


def fetch_bill_text(congress: int, bill_type: str, bill_number: str) -> str | None:
    url = f"{BASE_URL}/bill/{congress}/{bill_type}/{bill_number}/text"
    params = _params_with_key()
    try:
        resp = requests.get(url, params=params, timeout=30)
        resp.raise_for_status()
        versions = resp.json().get("textVersions", [])
        if versions:
            for version in versions:
                for fmt in version.get("formats", []):
                    if fmt.get("url"):
                        text_resp = requests.get(fmt["url"], timeout=30)
                        if text_resp.ok and len(text_resp.text) > 200:
                            return text_resp.text[:50000]
    except Exception:
        pass
    return None


def fetch_recent_bills(congress: int = 118, limit: int = 20) -> list[dict]:
    """Simple fetch for backward compat."""
    raw = fetch_bills_paginated(congress, "hr", max_pages=1, per_page=limit)
    results = []
    for bill in raw:
        text = fetch_bill_text(congress, bill["bill_type"], bill["bill_number"])
        if text:
            bill["text"] = text
            results.append(bill)
        time.sleep(0.3)
    return results


def classify_bill(title: str) -> str:
    title_lower = title.lower()
    keywords = {
        "housing": ["housing", "rent", "tenant", "mortgage", "home", "shelter", "affordable"],
        "education": ["education", "school", "student", "university", "college", "teacher", "literacy"],
        "transportation": ["transport", "transit", "highway", "road", "rail", "bridge", "traffic", "airport"],
        "public_safety": ["police", "safety", "crime", "fire", "emergency", "gun", "violence", "security"],
        "environment": ["environment", "climate", "energy", "water", "pollution", "emission", "wildlife", "conservation"],
    }
    for cat, words in keywords.items():
        if any(w in title_lower for w in words):
            return cat
    return "other"
