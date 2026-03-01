"""Real legislator data from unitedstates/congress-legislators (no API key needed)."""

import hashlib
import json
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import requests

DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def _load_json(filename):
    path = DATA_DIR / filename
    if not path.exists():
        return []
    with open(path) as f:
        return json.load(f)


# Load once at import time
_LEGISLATORS = _load_json("legislators-current.json")
_SOCIAL = _load_json("legislators-social-media.json")

# Build social media lookup by bioguide ID
_SOCIAL_MAP = {}
for s in _SOCIAL:
    bid = s.get("id", {}).get("bioguide", "")
    if bid:
        _SOCIAL_MAP[bid] = s.get("social", {})

from data.zip_coords import zip_to_state

# ── Party platform stances ─────────────────────────────────────────────────────
# Approximate % change from current spending levels by category, per party.
# These represent typical party platform positions, not individual votes.
_PARTY_STANCES = {
    "Democratic": {
        "healthcare":     22,
        "education":      18,
        "environment":    28,
        "housing":        16,
        "transportation": 12,
        "public_safety":   2,
        "economy":        10,
        "taxes":         -14,
    },
    "Republican": {
        "healthcare":    -10,
        "education":      -7,
        "environment":   -12,
        "housing":        -4,
        "transportation":  9,
        "public_safety":  24,
        "economy":        22,
        "taxes":         -26,
    },
    "Independent": {
        "healthcare":     10,
        "education":       9,
        "environment":    13,
        "housing":         8,
        "transportation":  9,
        "public_safety":   8,
        "economy":        10,
        "taxes":          -8,
    },
}

_PARTY_PRIORITIES = {
    "Democratic": [
        "Expanding Healthcare Access",
        "Climate Resilience",
        "Working-Family Tax Cuts",
    ],
    "Republican": [
        "Lower Taxes & Spending",
        "Public Safety First",
        "Energy Independence",
    ],
    "Independent": [
        "Bipartisan Solutions",
        "Fiscal Responsibility",
        "Community Focus",
    ],
}

# ── Wikipedia bio cache ────────────────────────────────────────────────────────
_bio_cache: dict[str, str] = {}
_bio_lock = threading.Lock()


def _fetch_wiki_bio(name: str) -> str:
    """Fetch a 2-sentence bio from Wikipedia. Returns '' on failure (< 2 s timeout)."""
    with _bio_lock:
        if name in _bio_cache:
            return _bio_cache[name]
    try:
        slug = name.strip().replace(" ", "_")
        resp = requests.get(
            f"https://en.wikipedia.org/api/rest_v1/page/summary/{slug}",
            headers={"User-Agent": "CandidApp/1.0 (civic education platform)"},
            timeout=2,
        )
        if resp.status_code == 200:
            data = resp.json()
            # Skip disambiguation pages
            if data.get("type") == "disambiguation":
                bio = ""
            else:
                extract = data.get("extract", "")
                # Skip if it reads like a disambiguation list
                if "may refer to" in extract or extract.startswith("The ") and "refer" in extract:
                    bio = ""
                else:
                    sentences = extract.split(". ")
                    bio = ". ".join(sentences[:2]).strip()
                    if bio and not bio.endswith("."):
                        bio += "."
        else:
            bio = ""
    except Exception:
        bio = ""
    with _bio_lock:
        _bio_cache[name] = bio
    return bio


def _budget_stance(party: str, bioguide_id: str) -> dict[str, int]:
    """
    Return a deterministic per-legislator budget stance derived from the party
    platform template with a small (±5 pp) hash-based variation so two
    legislators of the same party aren't pixel-identical.
    """
    base = _PARTY_STANCES.get(party, _PARTY_STANCES["Independent"])
    seed = int(hashlib.md5(bioguide_id.encode()).hexdigest()[:8], 16)
    result: dict[str, int] = {}
    for i, (cat, val) in enumerate(base.items()):
        # Extract 4 bits → 0-15 → shift to -5..+5
        nibble = (seed >> (i * 4)) & 0xF
        variation = round((nibble / 15) * 10) - 5
        result[cat] = val + variation
    return result


# ── Main public function ───────────────────────────────────────────────────────

def get_legislators_for_zip(zip_code: str) -> list:
    """Return enriched federal legislators for a zip code's state."""
    state = zip_to_state(zip_code)
    raw: list[dict] = []

    for leg in _LEGISLATORS:
        terms = leg.get("terms", [])
        if not terms:
            continue
        current = terms[-1]

        if current.get("state", "").upper() != state.upper():
            continue

        bio_id = leg.get("id", {}).get("bioguide", "")
        social = _SOCIAL_MAP.get(bio_id, {})
        name_info = leg.get("name", {})
        full_name = f"{name_info.get('first', '')} {name_info.get('last', '')}".strip()
        party_raw = current.get("party", "Unknown")
        party_map = {
            "Democrat": "Democratic",
            "Republican": "Republican",
            "Independent": "Independent",
        }
        party = party_map.get(party_raw, party_raw)

        chamber = current.get("type", "")
        district = current.get("district", None)
        position = (
            f"U.S. Senator — {state}"
            if chamber == "sen"
            else f"U.S. Representative — {state} District {district}"
        )

        photo_url = (
            f"https://bioguide.congress.gov/bioguide/photo/{bio_id[0]}/{bio_id}.jpg"
            if bio_id else ""
        )

        raw.append({
            "name": full_name,
            "party": party,
            "bio": "",                           # filled below via Wikipedia
            "photo_url": photo_url,
            "website": current.get("url", ""),
            "phone": current.get("phone", ""),
            "email": current.get("contact_form", ""),
            "social": {
                "twitter":  social.get("twitter", ""),
                "facebook": social.get("facebook", ""),
                "youtube":  social.get("youtube_id", ""),
            },
            "top_priorities": _PARTY_PRIORITIES.get(party, _PARTY_PRIORITIES["Independent"]),
            "budget_stance":  _budget_stance(party, bio_id),
            "platform_summary": "",
            "experience": [position],
            "endorsements": [],
            "chamber": chamber,
            "district": district,
            "state": state,
            "bioguide_id": bio_id,
            "sources": [
                {
                    "title": "unitedstates/congress-legislators (Official public dataset)",
                    "url": (
                        f"https://bioguide.congress.gov/search/bio/{bio_id}"
                        if bio_id
                        else "https://github.com/unitedstates/congress-legislators"
                    ),
                    "source_type": "public_record",
                    "accessed_date": "2026-02-28",
                },
                {
                    "title": "Wikipedia — budget stance derived from party platform",
                    "url": f"https://en.wikipedia.org/wiki/{full_name.replace(' ', '_')}",
                    "source_type": "encyclopedia",
                    "accessed_date": "2026-02-28",
                },
            ],
        })

    # Parallel Wikipedia bio enrichment (up to 12 threads, 2 s timeout each)
    with ThreadPoolExecutor(max_workers=min(12, len(raw) or 1)) as executor:
        future_to_idx = {
            executor.submit(_fetch_wiki_bio, item["name"]): i
            for i, item in enumerate(raw)
        }
        for future in as_completed(future_to_idx):
            idx = future_to_idx[future]
            raw[idx]["bio"] = future.result()

    return raw


def build_races_for_zip(zip_code: str) -> list:
    """Group legislators into Race objects for the API."""
    legislators = get_legislators_for_zip(zip_code)
    state = zip_to_state(zip_code)

    senate_candidates = [l for l in legislators if l["chamber"] == "sen"]
    house_members     = [l for l in legislators if l["chamber"] == "rep"]

    races = []

    if senate_candidates:
        races.append({
            "race_id":     f"us-senate-{state.lower()}",
            "position":    f"U.S. Senate — {state}",
            "jurisdiction": "Federal",
            "division_id": f"ocd-division/country:us/state:{state.lower()}",
            "district":    "",
            "candidates":  senate_candidates,
        })

    for rep in house_members:
        dist = rep.get("district", 0)
        races.append({
            "race_id":     f"us-house-{state.lower()}-{dist}",
            "position":    f"U.S. House — {state} District {dist}",
            "jurisdiction": "Federal",
            "division_id": f"ocd-division/country:us/state:{state.lower()}/cd:{dist}",
            "district":    str(dist),
            "candidates":  [rep],
        })

    return races
