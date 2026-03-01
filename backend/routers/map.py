from fastapi import APIRouter

router = APIRouter()

# Map pins are now resolved client-side in CityMap.tsx via Mapbox POI search.
# This router is kept for future server-side pin endpoints if needed.

from typing import Optional

def _lookup_measure_category(measure_id: str) -> Optional[str]:
    """Maps measure_id to its category."""
    category_map = {
        'hr-edu-2025':     'education',
        'hr-housing-2025': 'housing',
        'hr-transit-2025': 'transportation',
        'hr-safety-2025':  'public_safety',
        'hr-env-2025':     'environment',
        'hr-health-2025':  'healthcare',
        'hr-jobs-2025':    'economy',
    }
    return category_map.get(measure_id)

def _generate_pins(measure_id: str, category: str = None, lat: float = None, lng: float = None) -> list:
    """Pins are now resolved client-side via Mapbox — returns empty list."""
    return []
