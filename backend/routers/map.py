from fastapi import APIRouter

router = APIRouter()

# Map pins are now resolved client-side in CityMap.tsx via Mapbox POI search.
# This router is kept for future server-side pin endpoints if needed.
