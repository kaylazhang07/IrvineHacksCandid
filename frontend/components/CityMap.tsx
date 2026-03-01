// CityMap.tsx
// CRITICAL: Must be dynamically imported with ssr: false in parent page.
// const CityMap = dynamic(() => import('@/components/CityMap'), { ssr: false })
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { MapPin } from '@/lib/types';

// ─── Types ───────────────────────────────────────────────────────────────────────
interface Props {
  initialZip: string;
  measureMap: Record<string, string>; // category → measure_id
  onPinClick: (pin: MapPin) => void;
  activeCategories?: Set<string>;
  /** Impact scores per category: 0–1 scale (0 = negative, 0.5 = neutral, 1 = very positive) */
  impactScores?: Record<string, number>;
  /** Ballot measure descriptions keyed by measure_id */
  measureDescriptions?: Record<string, string>;
}

const isValidPlaceName = (name: string | undefined): boolean => {
  if (!name) return false;
  
  const trimmed = name.trim();
  
  
  if (trimmed.length <= 2) return false;
  
  
  if (/^\d+$/.test(trimmed)) return false;

  if (/^[A-Za-z]\d*$/.test(trimmed)) return false;
  
  // Reject generic system strings
  const lower = trimmed.toLowerCase();
  const blacklisted = ['unknown', 'n/a', 'undefined', 'null', 'point'];
  if (blacklisted.includes(lower)) return false;

  return true;
};
// ─── Visual Config ────────────────────────────────────────────────────────────────
const PILL_COLORS: Record<string, string> = {
  housing: '#818cf8', education: '#a78bfa', transportation: '#38bdf8',
  public_safety: '#fb7185', environment: '#4ade80', healthcare: '#f472b6',
  economy: '#fbbf24', water: '#38bdf8', civil_rights: '#c084fc',
  government: '#94a3b8', family: '#fb923c', immigration: '#a78bfa',
  technology: '#22d3ee', taxes: '#fbbf24', foreign_policy: '#94a3b8',
  other: '#94a3b8',
};

const PILL_ICONS: Record<string, string> = {
  water: '💧', environment: '🌿', transportation: '🚌', housing: '🏠',
  economy: '💼', civil_rights: '⚖️', government: '🏛', public_safety: '🛡',
  education: '📚', healthcare: '🏥', family: '🏡', immigration: '🌐',
  technology: '💻', taxes: '🧾', foreign_policy: '🌍', other: '📋',
};

// ─── Impact narrative templates ───────────────────────────────────────────────────
const IMPACT_NARRATIVES: Record<string, { positive: string; negative: string; neutral: string }> = {
  healthcare: {
    positive: '**{name}** could expand services — potentially opening a new wing, hiring more staff, and reducing ER wait times for your neighborhood.',
    negative: '**{name}** may face funding cuts — potentially reducing available beds, staff, and lengthening wait times for your community.',
    neutral: '**{name}** would see minimal immediate change, but long-term funding structures may shift.',
  },
  education: {
    positive: '**{name}** could receive increased funding — meaning smaller class sizes, updated materials, and new after-school programs.',
    negative: '**{name}** may see budget reductions — risking larger class sizes, program cuts, and deferred maintenance.',
    neutral: '**{name}** would maintain current funding levels with modest adjustments.',
  },
  transportation: {
    positive: '**{name}** could see expanded routes, increased frequency, and accessibility upgrades — shortening your commute.',
    negative: '**{name}** may face service reductions — fewer routes, longer wait times, and deferred maintenance on infrastructure.',
    neutral: '**{name}** would continue current service levels with incremental changes.',
  },
  public_safety: {
    positive: '**{name}** could hire additional personnel, upgrade equipment, and improve response times in your area.',
    negative: '**{name}** may face staffing reductions and slower emergency response times in your neighborhood.',
    neutral: '**{name}** would maintain current operations with minor budgetary adjustments.',
  },
  environment: {
    positive: '**{name}** could receive restoration funding — more green space, cleaner trails, and improved biodiversity in your area.',
    negative: '**{name}** may lose maintenance funding — leading to trail degradation and reduced park services.',
    neutral: '**{name}** would see stable conditions with modest improvements over time.',
  },
  housing: {
    positive: 'Near **{name}**, new affordable units could be built, rent stabilization expanded, and tenant protections strengthened.',
    negative: 'Near **{name}**, affordable housing development may stall and existing protections could weaken.',
    neutral: 'Near **{name}**, housing conditions would remain relatively stable with gradual market-driven changes.',
  },
  economy: {
    positive: '**{name}** and nearby businesses could see growth incentives — more jobs, small business grants, and economic activity in your area.',
    negative: '**{name}** area may face reduced business support — fewer grants, tighter lending, and slower job growth.',
    neutral: '**{name}** area would experience steady economic conditions without major policy shifts.',
  },
  water: {
    positive: '**{name}** infrastructure could be upgraded — cleaner water, better pressure, and modernized treatment for your neighborhood.',
    negative: '**{name}** may face deferred infrastructure repairs — risking water quality and reliability issues.',
    neutral: '**{name}** would continue current service with standard maintenance schedules.',
  },
  government: {
    positive: '**{name}** could expand public services, improve transparency, and increase community engagement programs.',
    negative: '**{name}** may reduce office hours, staff, and accessible services for residents.',
    neutral: '**{name}** would maintain current operations with standard adjustments.',
  },
  civil_rights: {
    positive: '**{name}** could expand legal aid, civil rights enforcement, and community advocacy resources.',
    negative: '**{name}** may see reduced legal aid funding and fewer civil rights enforcement resources.',
    neutral: '**{name}** would maintain current programs with modest changes.',
  },
  family: {
    positive: '**{name}** could expand programming — more youth activities, senior services, and family support resources.',
    negative: '**{name}** may reduce hours, programming, and community resources available to families.',
    neutral: '**{name}** would continue current programming with minor adjustments.',
  },
  immigration: {
    positive: '**{name}** could expand services — more legal aid, language assistance, and pathway-to-citizenship resources.',
    negative: '**{name}** may face funding cuts — reducing available legal aid and support services.',
    neutral: '**{name}** would maintain current service levels.',
  },
  technology: {
    positive: '**{name}** area could see expanded broadband access, digital literacy programs, and tech infrastructure investment.',
    negative: '**{name}** area may face reduced digital equity funding and slower infrastructure upgrades.',
    neutral: '**{name}** area would see gradual tech improvements at current pace.',
  },
  taxes: {
    positive: '**{name}** could help you navigate new tax benefits — potential credits, deductions, and relief programs for your bracket.',
    negative: '**{name}** area residents may face increased tax burden or reduced refund programs.',
    neutral: '**{name}** area would see stable tax rates with minor bracket adjustments.',
  },
  foreign_policy: {
    positive: '**{name}** could expand consular services and international community support programs.',
    negative: '**{name}** may face reduced diplomatic services affecting local international communities.',
    neutral: '**{name}** would maintain current operations.',
  },
};

// ─── Haversine distance (meters) ─────────────────────────────────────────────────
function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Universal OSM tag validation ────────────────────────────────────────────────
const VALID_TAGS: Record<string, Record<string, string[]>> = {
  healthcare: {
    amenity: ['hospital', 'clinic', 'doctors', 'dentist', 'pharmacy', 'nursing_home', 'veterinary'],
    healthcare: ['hospital', 'clinic', 'doctor', 'centre', 'pharmacy', 'dentist'],
  },
  education: {
    amenity: ['school', 'university', 'college', 'library', 'kindergarten', 'language_school', 'music_school'],
  },
  transportation: {
    public_transport: ['station', 'stop_position', 'platform', 'stop_area'],
    railway: ['station', 'halt', 'tram_stop', 'subway_entrance'],
    amenity: ['bus_station', 'ferry_terminal', 'taxi'],
    highway: ['bus_stop'],
    aeroway: ['aerodrome', 'terminal'],
  },
  public_safety: {
    amenity: ['police', 'fire_station', 'ranger_station'],
    emergency: ['ambulance_station', 'fire_hydrant'],
  },
  environment: {
    leisure: ['park', 'nature_reserve', 'garden', 'dog_park'],
    boundary: ['national_park', 'protected_area'],
    natural: ['wood', 'wetland', 'beach'],
    landuse: ['forest', 'recreation_ground'],
  },
  housing: {
    office: ['estate_agent', 'housing'],
    building: ['apartments', 'residential'],
    social_facility: ['shelter', 'housing'],
    amenity: ['shelter', 'social_facility'],
  },
  economy: {
    amenity: ['bank', 'bureau_de_change', 'atm'],
    office: ['financial', 'company', 'insurance', 'coworking'],
    shop: ['mall', 'department_store'],
  },
  water: {
    amenity: ['drinking_water', 'water_point', 'watering_place'],
    man_made: ['water_tower', 'water_works', 'water_well', 'reservoir_covered'],
    office: ['water_utility'],
    landuse: ['reservoir'],
    natural: ['spring'],
  },
  government: {
    amenity: ['townhall', 'public_building', 'courthouse'],
    office: ['government', 'administrative'],
  },
  civil_rights: {
    amenity: ['courthouse'],
    office: ['lawyer', 'ngo', 'association', 'political_party'],
  },
  family: {
    amenity: ['community_centre', 'childcare', 'social_facility'],
    leisure: ['playground', 'sports_centre', 'swimming_pool'],
    social_facility: ['group_home', 'nursing_home', 'food_bank'],
  },
  immigration: {
    office: ['immigration', 'diplomatic', 'ngo', 'association'],
    amenity: ['embassy', 'social_facility'],
  },
  technology: {
    office: ['it', 'telecommunication', 'research'],
    shop: ['computer', 'electronics', 'mobile_phone'],
    man_made: ['communications_tower'],
  },
  taxes: {
    office: ['tax', 'tax_advisor', 'accountant', 'financial_advisor'],
  },
  foreign_policy: {
    amenity: ['embassy'],
    office: ['diplomatic', 'consulate'],
  },
};

function isValidForCategory(category: string, tags: Record<string, string> | undefined): boolean {
  if (!tags) return false;
  const allowed = VALID_TAGS[category];
  if (!allowed) return true;
  for (const [tagKey, validValues] of Object.entries(allowed)) {
    const actual = tags[tagKey];
    if (actual && validValues.includes(actual)) return true;
  }
  return false;
}

type PinLocation = { name: string; lat: number; lon: number; type?: string };
type PinMap = Record<string, PinLocation| null>;

const pinCache: Record<string, PinMap> = {};

function cacheKey(lat: number, lng: number): string {
  return `osm_pins_${lat.toFixed(3)}_${lng.toFixed(3)}`;
}

// ─── Cache version — bump this when you change query logic ───────────────────────
const PIN_CACHE_VERSION = 3;

// ─── Prioritized Overpass queries per category ────────────────────────────────────
const PRIORITY_QUERIES: Record<string, Array<{ q: string; r: number }>> = {
  healthcare: [
    { q: 'way["amenity"="hospital"](around:{R},{LAT},{LNG});node["amenity"="hospital"](around:{R},{LAT},{LNG});', r: 10000 },
    { q: 'way["amenity"="clinic"](around:{R},{LAT},{LNG});node["amenity"="clinic"](around:{R},{LAT},{LNG});', r: 6000 },
    { q: 'node["amenity"="doctors"](around:{R},{LAT},{LNG});', r: 4000 },
    { q: 'node["amenity"="pharmacy"](around:{R},{LAT},{LNG});', r: 3000 },
  ],
  education: [
    { q: 'way["amenity"="university"](around:{R},{LAT},{LNG});node["amenity"="university"](around:{R},{LAT},{LNG});', r: 10000 },
    { q: 'way["amenity"="school"](around:{R},{LAT},{LNG});node["amenity"="school"](around:{R},{LAT},{LNG});', r: 5000 },
    { q: 'way["amenity"="library"](around:{R},{LAT},{LNG});node["amenity"="library"](around:{R},{LAT},{LNG});', r: 4000 },
  ],
  public_safety: [
    { q: 'way["amenity"="police"](around:{R},{LAT},{LNG});node["amenity"="police"](around:{R},{LAT},{LNG});', r: 10000 },
    { q: 'way["amenity"="fire_station"](around:{R},{LAT},{LNG});node["amenity"="fire_station"](around:{R},{LAT},{LNG});', r: 10000 },
  ],
  transportation: [
    { q: 'node["railway"="station"](around:{R},{LAT},{LNG});way["railway"="station"](around:{R},{LAT},{LNG});', r: 5000 },
    { q: 'node["public_transport"="station"](around:{R},{LAT},{LNG});way["public_transport"="station"](around:{R},{LAT},{LNG});', r: 4000 },
    { q: 'node["amenity"="bus_station"](around:{R},{LAT},{LNG});', r: 3000 },
    { q: 'node["highway"="bus_stop"](around:{R},{LAT},{LNG});', r: 2000 },
  ],
  environment: [
    { q: 'way["leisure"="nature_reserve"](around:{R},{LAT},{LNG});relation["leisure"="nature_reserve"](around:{R},{LAT},{LNG});', r: 8000 },
    { q: 'way["leisure"="park"](around:{R},{LAT},{LNG});relation["leisure"="park"](around:{R},{LAT},{LNG});', r: 5000 },
    { q: 'node["leisure"="garden"](around:{R},{LAT},{LNG});', r: 3000 },
  ],
  government: [
    { q: 'way["amenity"="townhall"](around:{R},{LAT},{LNG});node["amenity"="townhall"](around:{R},{LAT},{LNG});', r: 10000 },
    { q: 'way["office"="government"](around:{R},{LAT},{LNG});node["office"="government"](around:{R},{LAT},{LNG});', r: 6000 },
  ],
  water: [
    { q: 'way["man_made"="water_works"](around:{R},{LAT},{LNG});node["man_made"="water_works"](around:{R},{LAT},{LNG});', r: 10000 },
    { q: 'node["man_made"="water_tower"](around:{R},{LAT},{LNG});', r: 8000 },
    { q: 'node["amenity"="drinking_water"](around:{R},{LAT},{LNG});', r: 3000 },
  ],
  economy: [
    { q: 'node["amenity"="bank"](around:{R},{LAT},{LNG});way["amenity"="bank"](around:{R},{LAT},{LNG});', r: 3000 },
    { q: 'node["office"="financial"](around:{R},{LAT},{LNG});way["office"="financial"](around:{R},{LAT},{LNG});', r: 5000 },
    { q: 'node["office"="company"](around:{R},{LAT},{LNG});', r: 5000 },
  ],
  civil_rights: [
    { q: 'way["amenity"="courthouse"](around:{R},{LAT},{LNG});node["amenity"="courthouse"](around:{R},{LAT},{LNG});', r: 10000 },
    { q: 'node["office"="lawyer"](around:{R},{LAT},{LNG});', r: 5000 },
    { q: 'node["office"="ngo"](around:{R},{LAT},{LNG});', r: 5000 },
  ],
  housing: [
    { q: 'way["building"="apartments"]["name"]["name"~".{3,}"](around:{R},{LAT},{LNG});', r: 3000 },
    { q: 'node["office"="estate_agent"](around:{R},{LAT},{LNG});', r: 4000 },
    { q: 'node["social_facility"="housing"](around:{R},{LAT},{LNG});way["amenity"="social_facility"]["social_facility"="shelter"](around:{R},{LAT},{LNG});', r: 8000 },
  ],
  family: [
    { q: 'way["amenity"="community_centre"](around:{R},{LAT},{LNG});node["amenity"="community_centre"](around:{R},{LAT},{LNG});', r: 5000 },
    { q: 'node["leisure"="playground"](around:{R},{LAT},{LNG});', r: 3000 },
    { q: 'node["amenity"="childcare"](around:{R},{LAT},{LNG});', r: 4000 },
  ],
  immigration: [
    { q: 'node["office"="immigration"](around:{R},{LAT},{LNG});', r: 15000 },
    { q: 'node["office"="diplomatic"](around:{R},{LAT},{LNG});', r: 15000 },
    { q: 'node["office"="ngo"](around:{R},{LAT},{LNG});', r: 8000 },
  ],
  technology: [
    { q: 'way["office"="it"](around:{R},{LAT},{LNG});node["office"="it"](around:{R},{LAT},{LNG});', r: 5000 },
    { q: 'node["office"="telecommunication"](around:{R},{LAT},{LNG});way["office"="telecommunication"](around:{R},{LAT},{LNG});', r: 6000 },
    { q: 'node["shop"="computer"](around:{R},{LAT},{LNG});', r: 3000 },
  ],
  taxes: [
    { q: 'node["office"="tax"](around:{R},{LAT},{LNG});node["office"="tax_advisor"](around:{R},{LAT},{LNG});', r: 8000 },
    { q: 'node["office"="accountant"](around:{R},{LAT},{LNG});', r: 5000 },
  ],
  foreign_policy: [
    { q: 'node["amenity"="embassy"](around:{R},{LAT},{LNG});way["amenity"="embassy"](around:{R},{LAT},{LNG});', r: 20000 },
    { q: 'node["office"="diplomatic"](around:{R},{LAT},{LNG});way["office"="diplomatic"](around:{R},{LAT},{LNG});', r: 20000 },
  ],
};

// ─── Core Overpass fetcher ────────────────────────────────────────────────────────
async function fetchCategoryPinOverpass(
  category: string,
  lat: number,
  lng: number,
): Promise<PinLocation | null> {
  const priorities = PRIORITY_QUERIES[category];
  if (!priorities) return null;

  for (const { q: tmpl, r: radius } of priorities) {
    const inner = tmpl
      .replaceAll('{LAT}', lat.toFixed(6))
      .replaceAll('{LNG}', lng.toFixed(6))
      .replaceAll('{R}', String(radius));
    const query = `[out:json][timeout:10];(${inner});out center 10;`;
    try {
      const res = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: `data=${encodeURIComponent(query)}`,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      if (!res.ok) continue;
      const data = await res.json();
      const elements: any[] = data?.elements ?? [];
      
      const candidates = elements
        .map((el: any) => {
          const elLat = el.lat ?? el.center?.lat;
          const elLon = el.lon ?? el.center?.lon;
          if (elLat == null || elLon == null) return null;
          if (!isValidForCategory(category, el.tags)) return null;

          // 1. Try to get a REAL name from the API tags
          const rawName =
            el.tags?.name ??
            el.tags?.['name:en'] ??
            el.tags?.operator ??
            el.tags?.brand;

         
          if (!isValidPlaceName(rawName)) {
            return null; // Skip this element entirely — coordinates aren't trustworthy
          }

          return {
            name: rawName!.trim(),
            lat: elLat,
            lon: elLon,
            type: el.tags?.amenity ?? el.tags?.office ?? el.tags?.leisure ?? category,
            distance: haversineMeters(lat, lng, elLat, elLon),
          };
        })
        .filter(Boolean) as (PinLocation & { distance: number })[];

      if (candidates.length === 0) continue;
      candidates.sort((a, b) => a.distance - b.distance);
      const best = candidates[0];
      return { name: best.name, lat: best.lat, lon: best.lon, type: best.type };
    } catch {
      continue;
    }
  }
  return null;
}

// ─── Mapbox fallback ──────────────────────────────────────────────────────────────
const MAPBOX_SEARCH_TERMS: Record<string, string[]> = {
  healthcare: ['hospital', 'medical center', 'urgent care', 'clinic'],
  education: ['school', 'university', 'public library'],
  transportation: ['train station', 'transit center', 'bus station'],
  public_safety: ['fire station', 'police station'],
  environment: ['park', 'nature reserve', 'botanical garden'],
  housing: ['housing authority', 'apartment complex', 'real estate'],
  economy: ['bank', 'credit union', 'financial services'],
  water: ['water district', 'water treatment plant', 'reservoir'],
  government: ['city hall', 'municipal building', 'government center'],
  civil_rights: ['courthouse', 'legal aid office', 'law office'],
  family: ['community center', 'recreation center', 'ymca'],
  immigration: ['immigration office', 'consulate', 'citizenship services'],
  technology: ['tech company', 'data center', 'computer store'],
  taxes: ['tax preparation', 'accounting office', 'cpa'],
  foreign_policy: ['consulate', 'embassy', 'diplomatic mission'],
};

const MAPBOX_VALID_CATEGORIES: Record<string, string[]> = {
  healthcare: ['hospital', 'medical', 'clinic', 'doctor', 'health', 'pharmacy', 'urgent'],
  education: ['school', 'education', 'university', 'college', 'library'],
  transportation: ['transit', 'train', 'bus', 'rail', 'transport', 'station', 'airport'],
  public_safety: ['fire', 'police', 'emergency', 'safety'],
  environment: ['park', 'garden', 'nature', 'recreation'],
  housing: ['real estate', 'apartment', 'housing', 'residential'],
  economy: ['bank', 'financial', 'atm', 'insurance', 'credit union'],
  water: ['water', 'utility'],
  government: ['government', 'city hall', 'municipal', 'civic'],
  civil_rights: ['court', 'legal', 'law', 'attorney'],
  family: ['community', 'recreation', 'playground', 'childcare', 'ymca'],
  immigration: ['embassy', 'consulate', 'immigration', 'diplomatic'],
  technology: ['tech', 'computer', 'electronics', 'telecom'],
  taxes: ['tax', 'accounting', 'financial', 'cpa'],
  foreign_policy: ['embassy', 'consulate', 'diplomatic'],
};

async function fetchCategoryPinMapboxFallback(
  category: string,
  lat: number,
  lng: number,
  token: string,
): Promise<PinLocation | null> {
  const terms = MAPBOX_SEARCH_TERMS[category] ?? [category.replace(/_/g, ' ')];
  const validCats = MAPBOX_VALID_CATEGORIES[category] ?? [];

  for (const term of terms) {
    try {
      const url = new URL(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(term)}.json`,
      );
      url.searchParams.set('proximity', `${lng},${lat}`);
      url.searchParams.set('limit', '5');
      url.searchParams.set('types', 'poi');
      url.searchParams.set('access_token', token);
      const res = await fetch(url.toString());
      if (!res.ok) continue;
      const data = await res.json();
      const features: any[] = data?.features ?? [];

      for (const feature of features) {
        const featureCats: string = (
          (feature.properties?.category ?? '') + ' ' + (feature.place_name ?? '')
        ).toLowerCase();
        if (validCats.length > 0) {
          const matches = validCats.some((vc) => featureCats.includes(vc));
          if (!matches) continue;
        }
        const fLat = feature.center[1];
        const fLon = feature.center[0];
        if (haversineMeters(lat, lng, fLat, fLon) > 15000) continue;
        return {
          name: feature.text ?? feature.place_name ?? term,
          lat: fLat,
          lon: fLon,
        };
      }
    } catch {
      continue;
    }
  }
  return null;
}

// ─── Geometric fallback (last resort) ────────────────────────────────────────────
function fallbackPin(category: string, lat: number, lng: number, index: number): PinLocation {
  const angle = ((index * 137.5) % 360) * (Math.PI / 180);
  const radius = 0.005 + (index % 3) * 0.002;
  return {
    name: category.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    lat: lat + radius * Math.cos(angle),
    lon: lng + radius * Math.sin(angle),
  };
}

// ─── Orchestrator: fetch all pins for a ZIP's center coords ──────────────────────
async function fetchAllPinsForArea(
  lat: number,
  lng: number,
  categories: string[],
  onProgress: (done: number) => void,
): Promise<PinMap> {
  const key = cacheKey(lat, lng);

  // In-memory cache (current session)
  if (pinCache[key]) return pinCache[key];

  // localStorage cache with version check
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed._version === PIN_CACHE_VERSION && categories.every((c) => parsed[c])) {
        pinCache[key] = parsed;
        return parsed;
      } else {
        // Old version or incomplete — remove it
        localStorage.removeItem(key);
      }
    }
  } catch {
    try { localStorage.removeItem(key); } catch {}
  }

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';
  const result: PinMap = {};
  let done = 0;

  // Batch in groups of 3 to avoid Overpass rate limits
  const BATCH_SIZE = 3;
  for (let i = 0; i < categories.length; i += BATCH_SIZE) {
    const batch = categories.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async (cat, batchIdx) => {
        let pin = await fetchCategoryPinOverpass(cat, lat, lng);
        if (!pin) pin = await fetchCategoryPinMapboxFallback(cat, lat, lng, token);
        if (pin && !isValidPlaceName(pin.name)) {
          console.warn(`[CityMap] Skipping low-quality pin: "${pin.name}" for ${cat}`);
          pin = null; // Forces the orchestrator to treat this as a failed find
        }
        done++;
        onProgress(done);
        return [cat, pin] as const;
      }),
    );
    for (const [cat, pin] of batchResults) {
      result[cat] = pin;
    }
  }

  // Save with version tag
  result._version = PIN_CACHE_VERSION as any;
  pinCache[key] = result;
  try { localStorage.setItem(key, JSON.stringify(result)); } catch {}
  return result;
}

// ─── Impact Helpers ───────────────────────────────────────────────────────────────
function getImpactLevel(score: number | undefined): 'positive' | 'negative' | 'neutral' {
  if (score === undefined) return 'neutral';
  if (score >= 0.6) return 'positive';
  if (score <= 0.4) return 'negative';
  return 'neutral';
}

function getImpactNarrative(category: string, placeName: string, score?: number): string {
  const level = getImpactLevel(score);
  const templates = IMPACT_NARRATIVES[category] ?? IMPACT_NARRATIVES.government;
  const template = templates[level];
  return template.replace(/\{name\}/g, placeName);
}

// ─── Styles Injection ─────────────────────────────────────────────────────────────
// NOTE: Also add this to globals.css BEFORE Tailwind directives for max reliability:
//   @import 'mapbox-gl/dist/mapbox-gl.css';
function injectPillStyles() {
  const STYLE_ID = 'candid-pill-styles-v2';
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    /* ═══ CRITICAL MAPBOX MARKER POSITIONING ═══
       These rules MUST exist for markers to appear on the map.
       They replicate what mapbox-gl.css provides, with !important
       to survive Tailwind preflight and any global resets. */
    .mapboxgl-map {
      position: relative !important;
      overflow: hidden !important;
    }
    .mapboxgl-canvas-container,
    .mapboxgl-canvas {
      position: absolute !important;
      top: 0 !important;
      left: 0 !important;
    }
    .mapboxgl-marker {
      position: absolute !important;
      top: 0 !important;
      left: 0 !important;
      will-change: transform !important;
      z-index: 3 !important;
      cursor: pointer !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
    }
    /* Prevent Tailwind's box-sizing reset from affecting marker measurement */
    .mapboxgl-marker,
    .mapboxgl-marker *,
    .mapboxgl-popup,
    .mapboxgl-popup * {
      box-sizing: content-box;
    }
    /* ═══ PILL WRAPPER (Mapbox measures this for anchoring) ═══ */
    .candid-pill-wrap {
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .candid-pill-wrap::after {
      content: '';
      position: absolute;
      bottom: -40px; /* Adjust height of the "float" */
      left: 50%;
      width: 1px;
      height: 40px;
      background: rgba(255, 255, 255, 0.4);
    }

    /* ═══ PILL ELEMENT (all visual styling & animations) ═══ */
    .candid-pill {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 5px 12px 5px 8px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 600;
      font-family: system-ui, -apple-system, sans-serif;
      line-height: 1.2;
      white-space: nowrap;
      color: #fff;
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      box-shadow: 0 2px 12px rgba(0,0,0,0.15), 0 0 0 1px rgba(255,255,255,0.1) inset;
      transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1),
                  box-shadow 0.3s ease,
                  filter 0.3s ease,
                  opacity 0.3s ease;
      transform: scale(1);
      pointer-events: auto;
      user-select: none;
    }
    .candid-pill:hover {
      transform: scale(1.08);
      box-shadow: 0 4px 20px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.15) inset;
      z-index: 10;
    }
    .candid-pill-icon {
      font-size: 14px;
      line-height: 1;
      flex-shrink: 0;
    }
    .candid-pill-label {
      max-width: 140px;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    /* ═══ IMPACT ANIMATIONS ═══ */
    .candid-pill[data-impact="positive"] {
      animation: candid-glow 2.5s ease-in-out infinite;
    }
    @keyframes candid-glow {
      0%, 100% { box-shadow: 0 2px 12px rgba(0,0,0,0.15), 0 0 0 0px rgba(74,222,128,0); }
      50%       { box-shadow: 0 2px 12px rgba(0,0,0,0.15), 0 0 20px 4px rgba(74,222,128,0.35); }
    }
    .candid-pill[data-impact="negative"] {
      filter: saturate(0.35) brightness(0.85);
      animation: candid-negative 3s ease-in-out infinite;
      outline: 1.5px dashed rgba(251,113,133,0.6);
      outline-offset: 3px;
    }
    @keyframes candid-negative {
      0%, 100% { opacity: 0.75; }
      50%       { opacity: 0.55; }
    }
    .candid-pill[data-impact="neutral"] {
      animation: candid-neutral 4s ease-in-out infinite;
    }
    @keyframes candid-neutral {
      0%, 100% { opacity: 0.85; }
      50%       { opacity: 0.7; }
    }
    /* ═══ CATEGORY VISIBILITY TOGGLE ═══ */
    .candid-pill-wrap[data-hidden="true"] {
      display: none !important;
    }
    /* ═══ POPUP STYLING ═══ */
    .candid-popup .mapboxgl-popup-content {
      background: rgba(30, 30, 36, 0.92);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border-radius: 14px;
      padding: 16px 18px;
      color: #f0f0f0;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 13px;
      line-height: 1.55;
      max-width: 280px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.3);
      border: 1px solid rgba(255,255,255,0.08);
    }
    .candid-popup .mapboxgl-popup-tip {
      border-top-color: rgba(30, 30, 36, 0.92);
    }
    .candid-popup .mapboxgl-popup-close-button {
      color: #aaa;
      font-size: 18px;
      padding: 4px 8px;
    }
    .candid-popup strong {
      color: #fff;
      font-weight: 700;
    }
    /* ═══ LOADING STATE ═══ */
    .candid-map-loading {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(245, 241, 235, 0.85);
      backdrop-filter: blur(4px);
      z-index: 20;
      pointer-events: none;
      transition: opacity 0.4s ease;
    }
    .candid-map-loading[data-done="true"] {
      opacity: 0;
    }
  `;
  document.head.appendChild(style);
}

// ─── Component ────────────────────────────────────────────────────────────────────
export default function CityMap({
  initialZip,
  measureMap,
  onPinClick,
  activeCategories,
  impactScores,
  measureDescriptions,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const mapLoadedRef = useRef(false);
  const markersRef = useRef<
    Array<{
      el: HTMLElement;
      pill: HTMLElement;
      category: string;
      marker: { remove: () => void };
      popup?: any;
    }>
  >([]);
  const [pinLoad, setPinLoad] = useState({ active: false, done: 0, total: 0 });
  const selectedElRef = useRef<HTMLElement | null>(null);
  const onPinClickRef = useRef(onPinClick);

  // Keep callback ref fresh
  useEffect(() => {
    onPinClickRef.current = onPinClick;
  }, [onPinClick]);

  // ── ONE-TIME cache nuke for stale entries (remove after confirming fix) ─────
  useEffect(() => {
    const NUKE_KEY = 'candid_cache_nuked_v2';
    if (!localStorage.getItem(NUKE_KEY)) {
      const keys = Object.keys(localStorage).filter((k) => k.startsWith('osm_pins_'));
      keys.forEach((k) => localStorage.removeItem(k));
      localStorage.setItem(NUKE_KEY, 'true');
      console.log(`[CityMap] Nuked ${keys.length} stale cached pin entries`);
    }
  }, []);

  // ── Effect A: Create Mapbox map once ─────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    // Inject styles FIRST, before map init
    injectPillStyles();

    const mapboxgl = require('mapbox-gl');
    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/standard',
      center: [-122, 37.55], // default; Effect B flies to real zip
      zoom: 13,
      pitch: 60,
      bearing: -10,
      antialias: true,
    });

    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'top-right');

    map.on('style.load', () => {
      map.setConfigProperty('basemap', 'lightPreset', 'dusk'); 
      map.setConfigProperty('basemap', 'showPointOfInterestLabels', false);
      map.setConfigProperty('basemap', 'show3dObjects', true);
      map.setConfigProperty('basemap', 'showTransitLabels', false);
    });

    map.on('load', () => {
      mapLoadedRef.current = true;

      // ── Clay/muted aesthetic ──
      map.getStyle().layers.forEach((layer: any) => {
        try {
          if (layer.type === 'symbol') {
            map.setLayoutProperty(layer.id, 'visibility', 'none');
          }
          if (
            layer.type === 'line' &&
            ((layer['source-layer'] ?? '').includes('road') ||
              layer.id.includes('road') ||
              layer.id.includes('tunnel') ||
              layer.id.includes('bridge'))
          ) {
            map.setPaintProperty(layer.id, 'line-color', '#ede9e2');
          }
          if (
            layer.type === 'fill' &&
            ((layer['source-layer'] ?? '').includes('water') || layer.id.includes('water'))
          ) {
            map.setPaintProperty(layer.id, 'fill-color', '#c8e0f4');
          }
          if (
            layer.type === 'fill' &&
            (layer.id.includes('park') ||
              layer.id.includes('grass') ||
              layer.id.includes('green') ||
              layer.id.includes('wood'))
          ) {
            map.setPaintProperty(layer.id, 'fill-color', '#d8e8c8');
          }
        } catch {}
      });

      // ── 3D buildings — warm cream ──
      

      // ── DIAGNOSTIC: Verify marker CSS is working ──
      console.log('[CityMap] Map loaded. Checking marker CSS...');
      const testEl = document.createElement('div');
      testEl.className = 'candid-pill-wrap';
      testEl.innerHTML = '<div class="candid-pill">test</div>';
      const testMarker = new mapboxgl.Marker({ element: testEl })
        .setLngLat(map.getCenter())
        .addTo(map);
      requestAnimationFrame(() => {
        const markerDiv = testEl.closest('.mapboxgl-marker') as HTMLElement;
        if (markerDiv) {
          const computed = getComputedStyle(markerDiv);
          console.log('[CityMap] .mapboxgl-marker position:', computed.position);
          console.log('[CityMap] .mapboxgl-marker transform:', markerDiv.style.transform);
          if (computed.position !== 'absolute') {
            console.error('[CityMap] ❌ MARKER CSS NOT LOADED — position is:', computed.position);
          } else {
            console.log('[CityMap] ✅ Marker CSS is working correctly');
          }
        }
        testMarker.remove();
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
      mapLoadedRef.current = false;
      markersRef.current = [];
    };
  }, []);

  // ── Effect B: Geocode zip → Overpass POIs → Place animated pills ─────────────
  useEffect(() => {
    if (!initialZip || Object.keys(measureMap).length === 0) return;
    let cancelled = false;
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';

    async function loadPins() {
      // 1. Geocode ZIP
      let center: [number, number] = [-118.2437, 34.0522];
      try {
        const geo = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(initialZip)}.json?country=us&types=postcode&access_token=${token}`,
        ).then((r) => r.json());
        if (geo.features?.[0]?.center) center = geo.features[0].center;
      } catch {}

      if (cancelled) return;
      const [lng, lat] = center;

      // 2. Fly to ZIP
      mapRef.current?.flyTo({ center, zoom: 14, pitch: 0, bearing: 0, duration: 1200 });
      await new Promise<void>((resolve) => {
        if (mapRef.current) mapRef.current.once('moveend', resolve);
        else setTimeout(resolve, 1400);
      });
      if (cancelled) return;

      // 3. Fetch real POIs via Overpass (with Mapbox + geometric fallback)
      const categories = Object.keys(measureMap);
      setPinLoad({ active: true, done: 0, total: categories.length });

      const allPins = await fetchAllPinsForArea(lat, lng, categories, (done) => {
        if (!cancelled) setPinLoad({ active: true, done, total: categories.length });
      });
      if (cancelled) return;

      // 4. Build typed pins
      const pins: MapPin[] = categories
        .map((cat) => {
          const poi = allPins[cat];
          if (!poi) return null;
          return {
            measure_id: measureMap[cat],
            label: poi.name,
            lat: poi.lat,
            lon: poi.lon,
            category: cat,
            address: poi.name,
          } as MapPin;
        })
        .filter(Boolean) as MapPin[];

      // 5. Clear old markers
      markersRef.current.forEach(({ marker }) => marker.remove());
      markersRef.current = [];
      selectedElRef.current = null;

      // 6. Place markers with impact-based animations
      function placeMarkers() {
        if (cancelled || !mapRef.current) return;
        const mapboxgl = require('mapbox-gl');

        pins.forEach((pin, i) => {
          if (!isFinite(pin.lat) || !isFinite(pin.lon)) return;

          const color = PILL_COLORS[pin.category] ?? PILL_COLORS.other;
          const icon = PILL_ICONS[pin.category] ?? '📋';
          const score = impactScores?.[pin.category];
          const impact = getImpactLevel(score);

          // ── Outer wrapper: Mapbox uses this for anchor measurement ──
          // NO transforms or animations on this element
          const wrapper = document.createElement('div');
          wrapper.className = 'candid-pill-wrap';

          // ── Inner pill: all visual styling and animations live here ──
          const pill = document.createElement('div');
          pill.className = 'candid-pill';
          pill.dataset.impact = impact;
          pill.style.background = `linear-gradient(135deg, ${color}ee, ${color}bb)`;
          pill.style.setProperty('--pill-glow', color + '99');
          pill.style.animationDelay = `${i * 0.08}s`;
          pill.innerHTML = `
            <span class="candid-pill-icon">${icon}</span>
            <span class="candid-pill-label">${pin.label}</span>
          `;

          wrapper.appendChild(pill);

          if (activeCategories && !activeCategories.has(pin.category)) {
            wrapper.style.display = 'none';
          }

          // ── Popup ──
          const narrative = getImpactNarrative(pin.category, pin.label, score);
          const impactLabel =
            impact === 'positive' ? '↑ Positive Impact'
            : impact === 'negative' ? '↓ Negative Impact'
            : '→ Neutral Impact';
          const impactIcon =
            impact === 'positive' ? '🟢' : impact === 'negative' ? '🔴' : '🔵';

          const popupHTML = `
            <div style="padding:12px 14px 8px;display:flex;align-items:center;gap:8px;
              border-bottom:1px solid rgba(255,255,255,0.08);">
              <span style="font-size:22px;line-height:1">${icon}</span>
              <div>
                <div style="font-weight:700;font-size:14px;color:#f1f5f9">${pin.label}</div>
                <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;
                  letter-spacing:0.05em">${pin.category.replace(/_/g, ' ')}</div>
              </div>
            </div>
            <div style="padding:10px 14px 14px;font-size:12.5px;line-height:1.55;color:#cbd5e1">
              ${narrative.replace(/\*\*(.*?)\*\*/g, '<strong style="color:#f1f5f9">$1</strong>')}
              <div style="margin-top:8px;padding:6px 10px;border-radius:8px;font-size:11.5px;
                font-weight:600;display:inline-flex;align-items:center;gap:5px;
                background:${impact === 'positive' ? 'rgba(74,222,128,0.15)' : impact === 'negative' ? 'rgba(251,113,133,0.15)' : 'rgba(148,163,184,0.15)'};
                color:${impact === 'positive' ? '#4ade80' : impact === 'negative' ? '#fb7185' : '#94a3b8'}">
                ${impactIcon} ${impactLabel}
              </div>
            </div>
          `;

          const popup = new mapboxgl.Popup({
            offset: 25,
            closeButton: true,
            maxWidth: '280px',
            className: 'candid-popup',
          }).setHTML(popupHTML);

          // ── Click → select + callback ──
          wrapper.addEventListener('click', () => {
            if (selectedElRef.current) selectedElRef.current.classList.remove('selected');
            pill.classList.add('selected');
            selectedElRef.current = pill;
            onPinClickRef.current(pin);
          });

          // ── Create marker: wrapper is the element Mapbox positions ──
          const marker = new mapboxgl.Marker({
            element: wrapper,
            anchor: 'bottom',
          })
            .setLngLat([pin.lon, pin.lat])
            .setPopup(popup)
            .addTo(mapRef.current);

          markersRef.current.push({
            el: wrapper,
            pill,
            category: pin.category,
            marker,
          });
        });
      }

      // Wait for map load if needed
      if (mapLoadedRef.current) {
        placeMarkers();
      } else {
        mapRef.current?.once('load', placeMarkers);
      }

      setPinLoad((prev) => ({ ...prev, active: false }));

      // Tilt into 3D after pins settle
      setTimeout(() => {
        if (!cancelled) {
          mapRef.current?.easeTo({ pitch: 45, bearing: -10, duration: 800 });
        }
      }, 200);
    }

    loadPins();
    return () => {
      cancelled = true;
      setPinLoad({ active: false, done: 0, total: 0 });
    };
  }, [initialZip, measureMap, impactScores]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Effect C: Toggle visibility when filters change ───────────────────────────
  useEffect(() => {
    markersRef.current.forEach(({ el, category }) => {
      const visible = !activeCategories || activeCategories.has(category);
      el.style.display = visible ? 'flex' : 'none';
    });
  }, [activeCategories]);

  // ── Effect D: Live-update impact animations when scores change ────────────────
  useEffect(() => {
    markersRef.current.forEach(({ pill, category }) => {
      const score = impactScores?.[category];
      const impact = getImpactLevel(score);
      pill.dataset.impact = impact;
    });
  }, [impactScores]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: '500px' }}>
      {/* Loading overlay */}
      {pinLoad.active && (
        <div className="candid-map-loading" data-done={String(!pinLoad.active)}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', marginBottom: '8px' }}>🗺️</div>
            <div style={{ fontSize: '13px', color: '#888' }}>
              Finding places near you
              {pinLoad.total > 0 ? ` (${pinLoad.done}/${pinLoad.total})` : '…'}
            </div>
          </div>
        </div>
      )}

      {/* Map container — explicit height is critical */}
      <div
        ref={containerRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
        }}
      />
    </div>
  );
}