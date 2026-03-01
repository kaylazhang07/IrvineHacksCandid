"""Real legislator data from unitedstates/congress-legislators (no API key needed)."""

import json
import os
from pathlib import Path

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

# Zip-to-congressional-district is complex, so we filter by state
# and show all reps for that state (Senators + House members)
from data.zip_coords import zip_to_state


def get_legislators_for_zip(zip_code: str) -> list:
    """Return real federal legislators for a zip code's state."""
    state = zip_to_state(zip_code)
    results = []

    for leg in _LEGISLATORS:
        # Get latest term
        terms = leg.get("terms", [])
        if not terms:
            continue
        current = terms[-1]

        # Filter by state
        if current.get("state", "").upper() != state.upper():
            continue

        bio_id = leg.get("id", {}).get("bioguide", "")
        social = _SOCIAL_MAP.get(bio_id, {})
        name_info = leg.get("name", {})
        full_name = f"{name_info.get('first', '')} {name_info.get('last', '')}".strip()
        party_raw = current.get("party", "Unknown")
        party_map = {"Democrat": "Democratic", "Republican": "Republican", "Independent": "Independent"}
        party = party_map.get(party_raw, party_raw)

        chamber = current.get("type", "")  # "sen" or "rep"
        if chamber == "sen":
            position = f"U.S. Senator — {state}"
            race_id = f"us-senate-{state.lower()}-{name_info.get('last', '').lower()}"
        else:
            district = current.get("district", 0)
            position = f"U.S. Representative — {state} District {district}"
            race_id = f"us-house-{state.lower()}-{district}"

        # Photo from bioguide
        photo_url = f"https://bioguide.congress.gov/bioguide/photo/{bio_id[0]}/{bio_id}.jpg" if bio_id else ""

        # Contact info
        website = current.get("url", "")
        phone = current.get("phone", "")
        contact_form = current.get("contact_form", "")

        results.append({
            "name": full_name,
            "party": party,
            "bio": "",
            "photo_url": photo_url,
            "website": website,
            "phone": phone,
            "email": contact_form,  # congress uses contact forms, not emails
            "social": {
                "twitter": social.get("twitter", ""),
                "facebook": social.get("facebook", ""),
                "youtube": social.get("youtube", ""),
            },
            "top_priorities": [],
            "budget_stance": {},
            "platform_summary": "",
            "experience": [position],
            "endorsements": [],
            "chamber": chamber,
            "district": current.get("district", None),
            "state": state,
            "bioguide_id": bio_id,
            "sources": [
                {
                    "title": "unitedstates/congress-legislators (Official public dataset)",
                    "url": f"https://bioguide.congress.gov/search/bio/{bio_id}" if bio_id else "https://github.com/unitedstates/congress-legislators",
                    "source_type": "public_record",
                    "accessed_date": "2026-02-28",
                }
            ],
        })

    return results


def build_races_for_zip(zip_code: str) -> list:
    """Group legislators into Race objects for the API."""
    legislators = get_legislators_for_zip(zip_code)
    state = zip_to_state(zip_code)

    # Group: Senators together, each House member separate
    senate_candidates = [l for l in legislators if l["chamber"] == "sen"]
    house_members = [l for l in legislators if l["chamber"] == "rep"]

    races = []

    # US Senate race
    if senate_candidates:
        races.append({
            "race_id": f"us-senate-{state.lower()}",
            "position": f"U.S. Senate — {state}",
            "jurisdiction": "Federal",
            "division_id": f"ocd-division/country:us/state:{state.lower()}",
            "district": "",
            "candidates": senate_candidates,
        })

    # US House — one "race" per district
    for rep in house_members:
        dist = rep.get("district", 0)
        races.append({
            "race_id": f"us-house-{state.lower()}-{dist}",
            "position": f"U.S. House — {state} District {dist}",
            "jurisdiction": "Federal",
            "division_id": f"ocd-division/country:us/state:{state.lower()}/cd:{dist}",
            "district": str(dist),
            "candidates": [rep],
        })

    return races
