// CityMap.tsx
// CRITICAL: Must be dynamically imported with ssr: false in parent page.
// const CityMap = dynamic(() => import('@/components/CityMap'), { ssr: false })
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin } from '@/lib/types';

// ─── Types ───────────────────────────────────────────────────────────────────────

interface Props {
  initialZip: string;
  measureMap: Record<string, string>; // category → measure_id
  onPinClick: (pin: MapPin) => void;
  onClearPin?: () => void;
  selectedMeasureId?: string | null;
  /** Impact scores per category: 0–1 scale (0 = negative, 0.5 = neutral, 1 = very positive) */
  impactScores?: Record<string, number>;
  /** Ballot measure descriptions keyed by measure_id */
  measureDescriptions?: Record<string, string>;
}

// Add a radius map at the top of the file
const CATEGORY_RADIUS: Record<string, number> = {
  healthcare: 12000, // 12km — hospitals serve wide areas
  education: 12000,  // 12km — universities are regional
  transit: 5000,
  greenspace: 5000,
  grocery: 4000,
  default: 5000,
};

/** How "official" a place type is — lower = more prominent, picked first */
const TYPE_RANK: Record<string, Record<string, number>> = {
  healthcare:     { hospital: 1, clinic: 2, centre: 2, doctors: 4, pharmacy: 5 },
  education:      { university: 1, college: 1, school: 2, library: 3, kindergarten: 4 },
  transportation: { station: 1, halt: 2, bus_station: 3, bus_stop: 5 },
  public_safety:  { police: 1, fire_station: 1 },
  environment:    { nature_reserve: 1, park: 2, garden: 3 },
  government:     { townhall: 1, government: 1, courthouse: 2 },
  economy:        { financial: 1, company: 2, bank: 3, atm: 5 },
};

/**
 * Keywords in a place's name that signal it's a major institution.
 * Matching any of these adds a prominence bonus so it beats nearby smaller ones.
 */
const PROMINENCE_KEYWORDS: Record<string, string[]> = {
  healthcare: [
    'medical center', 'medical centre', 'hospital', 'health system',
    'health center', 'regional', 'university', 'children', 'memorial',
    'cedars', 'ucla', 'usc', 'kaiser', 'providence', 'adventist',
  ],
  education: [
    'university', 'college', 'institute', 'campus', 'academy',
    'district', 'unified', 'polytechnic', 'state',
  ],
  transportation: [
    'international', 'central', 'union', 'metro', 'transit center',
  ],
  environment: [
    'state park', 'national', 'preserve', 'botanical', 'arboretum',
  ],
  government: [
    'city hall', 'federal', 'county', 'municipal', 'courthouse', 'civic',
  ],
};

/**
 * Score a candidate POI — higher is better.
 *
 * Components:
 *  - type rank  (hospital=1 → 900 pts, doctor=4 → 600 pts)
 *  - name keywords (major institution → +400 pts)
 *  - distance penalty (−1 pt per 100 m — a tie-breaker, not the main factor)
 *
 * This means a hospital 5 km away beats a doctor's office 0.1 km away.
 */
function scoreCandidate(
  candidate: { name: string; type?: string; distance: number },
  category: string,
): number {
  // Type rank score (1–5, lower rank = better)
  const rank = TYPE_RANK[category]?.[candidate.type ?? ''] ?? 3;
  let score = (6 - rank) * 150; // rank 1 → 750 pts, rank 5 → 150 pts

  // Prominence keyword bonus
  const nameLower = candidate.name.toLowerCase();
  const keywords = PROMINENCE_KEYWORDS[category] ?? [];
  if (keywords.some((kw) => nameLower.includes(kw))) {
    score += 400;
  }

  // Small distance penalty so truly equal results pick the closer one
  score -= candidate.distance / 100;

  return score;
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

// Muted, sophisticated accent colors — Pale Rose, Muted Lavender, Sage, etc.
const PILL_COLORS: Record<string, string> = {
  housing:        '#8B7EC8', // Muted Lavender
  education:      '#C47B76', // Pale Rose
  transportation: '#6A9EB8', // Muted Steel Blue
  public_safety:  '#B87560', // Muted Terracotta
  environment:    '#6B9E82', // Sage
  healthcare:     '#B5789C', // Muted Mauve
  economy:        '#A88E44', // Muted Amber
  water:          '#6A9EB8', // Muted Steel Blue
  civil_rights:   '#9B82C2', // Soft Violet
  government:     '#8A9AA8', // Warm Slate
  family:         '#C08070', // Muted Coral
  immigration:    '#9B82C2', // Soft Violet
  technology:     '#5EA8B8', // Muted Cyan
  taxes:          '#A88E44', // Muted Amber
  foreign_policy: '#8A9AA8', // Warm Slate
  other:          '#8A9AA8', // Warm Slate
};

const PILL_ICONS: Record<string, string> = {
  water: '💧', environment: '🌿', transportation: '🚌', housing: '🏠',
  economy: '💼', civil_rights: '⚖️', government: '🏛', public_safety: '🛡',
  education: '📚', healthcare: '🏥', family: '🏡', immigration: '🌐',
  technology: '💻', taxes: '🧾', foreign_policy: '🌍', other: '📋',
};

// ─── Loading phrases per category ────────────────────────────────────────────────

const CAT_LOADING_PHRASE: Record<string, string> = {
  education:      'Mapping education infrastructure...',
  housing:        'Analyzing housing legislation...',
  transportation: 'Tracing transit corridors...',
  public_safety:  'Locating safety infrastructure...',
  environment:    'Finding green spaces nearby...',
  healthcare:     'Identifying healthcare facilities...',
  economy:        'Decoding economic centers...',
  water:          'Finding water infrastructure...',
  civil_rights:   'Mapping civic institutions...',
  government:     'Locating government buildings...',
  family:         'Mapping community centers...',
  immigration:    'Locating community services...',
  technology:     'Mapping tech corridors...',
  taxes:          'Locating financial centers...',
  foreign_policy: 'Finding diplomatic sites...',
  other:          'Scanning additional landmarks...',
};

// ─── Impact narrative templates ───────────────────────────────────────────────────

const IMPACT_NARRATIVES: Record<string, { positive: string; negative: string; neutral: string }> = {
  healthcare: {
    positive: '**{name}** could expand services — potentially opening a new wing, hiring more staff, and reducing ER wait times for your neighborhood.',
    negative: '**{name}** may face funding cuts — potentially reducing available beds, staff, and lengthening wait times for your community.',
    neutral:  '**{name}** would see minimal immediate change, but long-term funding structures may shift.',
  },
  education: {
    positive: '**{name}** could receive increased funding — meaning smaller class sizes, updated materials, and new after-school programs.',
    negative: '**{name}** may see budget reductions — risking larger class sizes, program cuts, and deferred maintenance.',
    neutral:  '**{name}** would maintain current funding levels with modest adjustments.',
  },
  transportation: {
    positive: '**{name}** could see expanded routes, increased frequency, and accessibility upgrades — shortening your commute.',
    negative: '**{name}** may face service reductions — fewer routes, longer wait times, and deferred maintenance on infrastructure.',
    neutral:  '**{name}** would continue current service levels with incremental changes.',
  },
  public_safety: {
    positive: '**{name}** could hire additional personnel, upgrade equipment, and improve response times in your area.',
    negative: '**{name}** may face staffing reductions and slower emergency response times in your neighborhood.',
    neutral:  '**{name}** would maintain current operations with minor budgetary adjustments.',
  },
  environment: {
    positive: '**{name}** could receive restoration funding — more green space, cleaner trails, and improved biodiversity in your area.',
    negative: '**{name}** may lose maintenance funding — leading to trail degradation and reduced park services.',
    neutral:  '**{name}** would see stable conditions with modest improvements over time.',
  },
  housing: {
    positive: 'Near **{name}**, new affordable units could be built, rent stabilization expanded, and tenant protections strengthened.',
    negative: 'Near **{name}**, affordable housing development may stall and existing protections could weaken.',
    neutral:  'Near **{name}**, housing conditions would remain relatively stable with gradual market-driven changes.',
  },
  economy: {
    positive: '**{name}** and nearby businesses could see growth incentives — more jobs, small business grants, and economic activity in your area.',
    negative: '**{name}** area may face reduced business support — fewer grants, tighter lending, and slower job growth.',
    neutral:  '**{name}** area would experience steady economic conditions without major policy shifts.',
  },
  water: {
    positive: '**{name}** infrastructure could be upgraded — cleaner water, better pressure, and modernized treatment for your neighborhood.',
    negative: '**{name}** may face deferred infrastructure repairs — risking water quality and reliability issues.',
    neutral:  '**{name}** would continue current service with standard maintenance schedules.',
  },
  government: {
    positive: '**{name}** could expand public services, improve transparency, and increase community engagement programs.',
    negative: '**{name}** may reduce office hours, staff, and accessible services for residents.',
    neutral:  '**{name}** would maintain current operations with standard adjustments.',
  },
  civil_rights: {
    positive: '**{name}** could expand legal aid, civil rights enforcement, and community advocacy resources.',
    negative: '**{name}** may see reduced legal aid funding and fewer civil rights enforcement resources.',
    neutral:  '**{name}** would maintain current programs with modest changes.',
  },
  family: {
    positive: '**{name}** could expand programming — more youth activities, senior services, and family support resources.',
    negative: '**{name}** may reduce hours, programming, and community resources available to families.',
    neutral:  '**{name}** would continue current programming with minor adjustments.',
  },
  immigration: {
    positive: '**{name}** could expand services — more legal aid, language assistance, and pathway-to-citizenship resources.',
    negative: '**{name}** may face funding cuts — reducing available legal aid and support services.',
    neutral:  '**{name}** would maintain current service levels.',
  },
  technology: {
    positive: '**{name}** area could see expanded broadband access, digital literacy programs, and tech infrastructure investment.',
    negative: '**{name}** area may face reduced digital equity funding and slower infrastructure upgrades.',
    neutral:  '**{name}** area would see gradual tech improvements at current pace.',
  },
  taxes: {
    positive: '**{name}** could help you navigate new tax benefits — potential credits, deductions, and relief programs for your bracket.',
    negative: '**{name}** area residents may face increased tax burden or reduced refund programs.',
    neutral:  '**{name}** area would see stable tax rates with minor bracket adjustments.',
  },
  foreign_policy: {
    positive: '**{name}** could expand consular services and international community support programs.',
    negative: '**{name}** may face reduced diplomatic services affecting local international communities.',
    neutral:  '**{name}** would maintain current operations.',
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
    amenity:     ['hospital', 'clinic', 'doctors', 'dentist', 'pharmacy', 'nursing_home', 'veterinary'],
    healthcare:  ['hospital', 'clinic', 'doctor', 'centre', 'pharmacy', 'dentist'],
  },
  education: {
    amenity: ['school', 'university', 'college', 'library', 'kindergarten', 'language_school', 'music_school'],
  },
  transportation: {
    public_transport: ['station', 'stop_position', 'platform', 'stop_area'],
    railway:          ['station', 'halt', 'tram_stop', 'subway_entrance'],
    amenity:          ['bus_station', 'ferry_terminal', 'taxi'],
    highway:          ['bus_stop'],
    aeroway:          ['aerodrome', 'terminal'],
  },
  public_safety: {
    amenity:   ['police', 'fire_station', 'ranger_station'],
    emergency: ['ambulance_station', 'fire_hydrant'],
  },
  environment: {
    leisure:  ['park', 'nature_reserve', 'garden', 'dog_park'],
    boundary: ['national_park', 'protected_area'],
    natural:  ['wood', 'wetland', 'beach'],
    landuse:  ['forest', 'recreation_ground'],
  },
  housing: {
    office:          ['estate_agent', 'housing'],
    building:        ['apartments', 'residential'],
    social_facility: ['shelter', 'housing'],
    amenity:         ['shelter', 'social_facility'],
  },
  economy: {
    amenity: ['bank', 'bureau_de_change', 'atm'],
    office:  ['financial', 'company', 'insurance', 'coworking'],
    shop:    ['mall', 'department_store'],
  },
  water: {
    amenity:  ['drinking_water', 'water_point', 'watering_place'],
    man_made: ['water_tower', 'water_works', 'water_well', 'reservoir_covered'],
    office:   ['water_utility'],
    landuse:  ['reservoir'],
    natural:  ['spring'],
  },
  government: {
    amenity: ['townhall', 'public_building', 'courthouse'],
    office:  ['government', 'administrative'],
  },
  civil_rights: {
    amenity: ['courthouse'],
    office:  ['lawyer', 'ngo', 'association', 'political_party'],
  },
  family: {
    amenity:         ['community_centre', 'childcare', 'social_facility'],
    leisure:         ['playground', 'sports_centre', 'swimming_pool'],
    social_facility: ['group_home', 'nursing_home', 'food_bank'],
  },
  immigration: {
    office:  ['immigration', 'diplomatic', 'ngo', 'association'],
    amenity: ['embassy', 'social_facility'],
  },
  technology: {
    office:   ['it', 'telecommunication', 'research'],
    shop:     ['computer', 'electronics', 'mobile_phone'],
    man_made: ['communications_tower'],
  },
  taxes: {
    office: ['tax', 'tax_advisor', 'accountant', 'financial_advisor'],
  },
  foreign_policy: {
    amenity: ['embassy'],
    office:  ['diplomatic', 'consulate'],
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

type PinLocation = { name: string; lat: number; lon: number; type?: string; address?: string | null };
type PinMap = Record<string, PinLocation | null>;

const pinCache: Record<string, PinMap> = {};

function cacheKey(lat: number, lng: number): string {
  return `osm_pins_${lat.toFixed(3)}_${lng.toFixed(3)}`;
}

// ─── Cache version — bump this when you change query logic ───────────────────────
const PIN_CACHE_VERSION = 6;

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
    { q: 'node["railway"="station"](around:{R},{LAT},{LNG});way["railway"="station"](around:{R},{LAT},{LNG});', r: 10000 },
    { q: 'node["public_transport"="station"](around:{R},{LAT},{LNG});way["public_transport"="station"](around:{R},{LAT},{LNG});', r: 8000 },
    { q: 'node["amenity"="bus_station"](around:{R},{LAT},{LNG});', r: 6000 },
    { q: 'node["highway"="bus_stop"](around:{R},{LAT},{LNG});', r: 3000 },
  ],
  environment: [
    { q: 'way["leisure"="nature_reserve"](around:{R},{LAT},{LNG});relation["leisure"="nature_reserve"](around:{R},{LAT},{LNG});', r: 15000 },
    { q: 'relation["boundary"="protected_area"](around:{R},{LAT},{LNG});way["boundary"="protected_area"](around:{R},{LAT},{LNG});', r: 15000 },
    { q: 'way["natural"="wood"](around:{R},{LAT},{LNG});relation["natural"="wood"](around:{R},{LAT},{LNG});', r: 10000 },
    { q: 'way["leisure"="park"](around:{R},{LAT},{LNG});relation["leisure"="park"](around:{R},{LAT},{LNG});', r: 8000 },
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
  const categoryRadius = CATEGORY_RADIUS[category] ?? CATEGORY_RADIUS.default;
  const priorities = PRIORITY_QUERIES[category];
  if (!priorities) return null;

  for (const { q: tmpl, r: queryRadius } of priorities) {
    const radius = queryRadius ?? categoryRadius;
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

          const rawName =
            el.tags?.name ??
            el.tags?.['name:en'] ??
            el.tags?.operator ??
            el.tags?.brand;
          if (!isValidPlaceName(rawName)) return null;

          return {
            name: rawName!.trim(),
            lat: elLat,
            lon: elLon,
            type: el.tags?.amenity ?? el.tags?.office ?? el.tags?.leisure ?? category,
            distance: haversineMeters(lat, lng, elLat, elLon),
          };
        })
        .filter(Boolean) as (PinLocation & { distance: number; type: string })[];

      // ── FIX 1: skip this tier entirely if it produced zero VALID candidates ──
      if (candidates.length === 0) continue;

      // ── FIX 2: pick the most PROMINENT result, not just the nearest ──────────
      candidates.sort((a, b) => scoreCandidate(b, category) - scoreCandidate(a, category));

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
  healthcare:     ['hospital', 'medical center', 'urgent care', 'clinic'],
  education:      ['school', 'university', 'public library'],
  transportation: ['train station', 'transit center', 'bus station'],
  public_safety:  ['fire station', 'police station'],
  environment:    ['park', 'nature reserve', 'botanical garden'],
  housing:        ['housing authority', 'apartment complex', 'real estate'],
  economy:        ['bank', 'credit union', 'financial services'],
  water:          ['water district', 'water treatment plant', 'reservoir'],
  government:     ['city hall', 'municipal building', 'government center'],
  civil_rights:   ['courthouse', 'legal aid office', 'law office'],
  family:         ['community center', 'recreation center', 'ymca'],
  immigration:    ['immigration office', 'consulate', 'citizenship services'],
  technology:     ['tech company', 'data center', 'computer store'],
  taxes:          ['tax preparation', 'accounting office', 'cpa'],
  foreign_policy: ['consulate', 'embassy', 'diplomatic mission'],
};

const MAPBOX_VALID_CATEGORIES: Record<string, string[]> = {
  healthcare:     ['hospital', 'medical', 'clinic', 'doctor', 'health', 'pharmacy', 'urgent'],
  education:      ['school', 'education', 'university', 'college', 'library'],
  transportation: ['transit', 'train', 'bus', 'rail', 'transport', 'station', 'airport'],
  public_safety:  ['fire', 'police', 'emergency', 'safety'],
  environment:    ['park', 'garden', 'nature', 'recreation'],
  housing:        ['real estate', 'apartment', 'housing', 'residential'],
  economy:        ['bank', 'financial', 'atm', 'insurance', 'credit union'],
  water:          ['water', 'utility'],
  government:     ['government', 'city hall', 'municipal', 'civic'],
  civil_rights:   ['court', 'legal', 'law', 'attorney'],
  family:         ['community', 'recreation', 'playground', 'childcare', 'ymca'],
  immigration:    ['embassy', 'consulate', 'immigration', 'diplomatic'],
  technology:     ['tech', 'computer', 'electronics', 'telecom'],
  taxes:          ['tax', 'accounting', 'financial', 'cpa'],
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
    } catch (err) {
      console.warn(`Overpass query failed for ${category}:`, err);
      continue;
    }
  }

  return null;
}

async function reverseGeocode(
  lat: number, lon: number, token: string
): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${lon},${lat}.json?types=address&limit=1&access_token=${token}`
    );
    const data = await res.json();
    return data.features?.[0]?.place_name ?? null;
  } catch {
    return null;
  }
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
          pin = null;
        }

        const isFallback = !pin;
        if (isFallback) pin = fallbackPin(cat, lat, lng, i + batchIdx);

        if (pin && !isFallback) {
          pin.address = await reverseGeocode(pin.lat, pin.lon, token);
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

function injectPillStyles() {
  const STYLE_ID = 'candid-pill-styles-v2';
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    /* ═══ CRITICAL MAPBOX MARKER POSITIONING ═══ */
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
      bottom: -9px;
      left: 50%;
      width: 1.5px;
      height: 9px;
      background: rgba(0, 0, 0, 0.18);
      border-radius: 0 0 2px 2px;
      transform: translateX(-50%);
    }

    /* ═══ PILL ELEMENT — Solid Parchment Squircle ═══ */
    .candid-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 11px 6px 8px;
      border-radius: 11px;
      font-size: 11.5px;
      font-weight: 500;
      font-family: system-ui, -apple-system, sans-serif;
      letter-spacing: 0.5px;
      line-height: 1.2;
      white-space: nowrap;
      color: #1C1917;
      background: rgba(253, 252, 248, 0.96);
      border: 1px solid rgba(0, 0, 0, 0.07);
      box-shadow:
        0 1px 3px rgba(0, 0, 0, 0.06),
        0 8px 20px rgba(0, 0, 0, 0.09),
        0 20px 50px rgba(0, 0, 0, 0.08);
      transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1),
                  box-shadow 0.2s ease;
      pointer-events: auto;
      user-select: none;
    }
    .candid-pill:hover {
      transform: scale(1.05);
      box-shadow:
        0 2px 6px rgba(0, 0, 0, 0.08),
        0 12px 32px rgba(0, 0, 0, 0.12),
        0 28px 60px rgba(0, 0, 0, 0.10);
      z-index: 10;
    }
    .candid-pill-dot {
      flex-shrink: 0;
      border-radius: 50%;
      width: 6px;
      height: 6px;
    }
    .candid-pill-label {
      max-width: 130px;
      overflow: hidden;
      text-overflow: ellipsis;
      color: #1C1917;
    }

    /* ═══ IMPACT STATE — subtle, static ═══ */
    .candid-pill[data-impact="positive"] {
      border-color: rgba(107, 158, 130, 0.45);
    }
    .candid-pill[data-impact="negative"] {
      opacity: 0.68;
    }
    .candid-pill[data-impact="neutral"] {
      opacity: 0.88;
    }

    /* ═══ SELECTED STATE ═══ */
    .candid-pill.selected {
      box-shadow:
        0 2px 8px rgba(0, 0, 0, 0.12),
        0 16px 40px rgba(0, 0, 0, 0.18),
        0 0 0 2px rgba(28, 25, 23, 0.14);
      transform: scale(1.08);
      z-index: 20;
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

    /* ═══ LOADING STATE — Immersive Geocoding ═══ */
    .candid-map-loading {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(253, 252, 248, 0.80);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      z-index: 20;
      overflow: hidden;
    }

    /* Grid overlay */
    .candid-loading-grid {
      position: absolute;
      inset: 0;
      background-image:
        linear-gradient(rgba(0,0,0,0.025) 1px, transparent 1px),
        linear-gradient(90deg, rgba(0,0,0,0.025) 1px, transparent 1px);
      background-size: 48px 48px;
      pointer-events: none;
    }

    /* Light leaks */
    .candid-loading-leak-blue {
      position: absolute;
      top: -15%;
      right: -10%;
      width: 55%;
      height: 55%;
      border-radius: 50%;
      background: radial-gradient(circle, #BFDBFE 0%, transparent 65%);
      opacity: 0.55;
      pointer-events: none;
    }
    .candid-loading-leak-pink {
      position: absolute;
      bottom: -15%;
      left: -10%;
      width: 50%;
      height: 50%;
      border-radius: 50%;
      background: radial-gradient(circle, #FCA5A5 0%, transparent 65%);
      opacity: 0.38;
      pointer-events: none;
    }
    .candid-loading-leak-lime {
      position: absolute;
      top: 40%;
      left: 5%;
      width: 35%;
      height: 35%;
      border-radius: 50%;
      background: radial-gradient(circle, #BBF7D0 0%, transparent 65%);
      opacity: 0.30;
      pointer-events: none;
    }

    /* Center squircle with radar */
    .candid-loading-squircle {
      position: relative;
      width: 96px;
      height: 96px;
      border-radius: 26px;
      background: #FDFCF8;
      border: 1px solid rgba(0,0,0,0.07);
      box-shadow:
        0 4px 24px rgba(0,0,0,0.06),
        0 1px 4px rgba(0,0,0,0.04),
        inset 0 1px 0 rgba(255,255,255,0.9);
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }

    /* Rotating radar sweep */
    .candid-loading-radar {
      position: absolute;
      inset: 0;
      border-radius: inherit;
      background: conic-gradient(
        from 0deg,
        transparent 0deg,
        rgba(107,158,130,0.55) 22deg,
        rgba(107,158,130,0.18) 42deg,
        transparent 65deg
      );
      animation: candid-radar-spin 2.4s linear infinite;
    }
    @keyframes candid-radar-spin {
      from { transform: rotate(0deg); }
      to   { transform: rotate(360deg); }
    }

    /* Crosshair lines */
    .candid-loading-ch-h,
    .candid-loading-ch-v {
      position: absolute;
      background: rgba(107,158,130,0.16);
    }
    .candid-loading-ch-h { top: 50%; left: 10px; right: 10px; height: 1px; transform: translateY(-50%); }
    .candid-loading-ch-v { left: 50%; top: 10px; bottom: 10px; width: 1px; transform: translateX(-50%); }

    /* Center dot */
    .candid-loading-dot {
      position: relative;
      z-index: 2;
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #6B9E82;
      box-shadow: 0 0 0 3px rgba(107,158,130,0.22);
    }

    /* Ping ripple ring — re-animates via Framer Motion key change */
    .candid-loading-ping {
      position: absolute;
      inset: 0;
      border-radius: 26px;
      border: 2px solid rgba(107,158,130,0.55);
      pointer-events: none;
    }

    /* Progress track */
    .candid-loading-track {
      width: 180px;
      height: 2px;
      background: rgba(0,0,0,0.07);
      border-radius: 99px;
      overflow: hidden;
      position: relative;
    }

    /* ═══ CATEGORY SWITCHER BAR ═══ */
    .candid-switcher {
      position: absolute;
      top: 14px;
      left: 14px;
      right: 64px;
      z-index: 10;
      display: flex;
      gap: 7px;
      overflow-x: auto;
      padding: 3px;
      scrollbar-width: none;
      -ms-overflow-style: none;
    }
    .candid-switcher::-webkit-scrollbar { display: none; }

    .candid-switcher-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 7px 13px 7px 10px;
      border-radius: 20px;
      border: 1.5px solid rgba(0,0,0,0.08);
      background: #FDFCF8;
      font-size: 11.5px;
      font-weight: 600;
      font-family: system-ui, -apple-system, sans-serif;
      letter-spacing: 0.3px;
      color: #78716C;
      cursor: pointer;
      white-space: nowrap;
      flex-shrink: 0;
      transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
      box-shadow: 0 1px 4px rgba(0,0,0,0.06);
      user-select: none;
    }
    .candid-switcher-btn:hover:not([data-active="true"]) {
      color: #1C1917;
      border-color: rgba(0,0,0,0.14);
      box-shadow: 0 2px 10px rgba(0,0,0,0.09);
      transform: scale(1.02);
    }
    .candid-switcher-btn[data-active="true"] {
      color: #fff;
      border-color: transparent;
      box-shadow:
        0 4px 18px rgba(0,0,0,0.18),
        inset 0 0 0 1px rgba(255,255,255,0.2),
        inset 0 1px 12px rgba(255,255,255,0.12);
      transform: scale(1.06);
    }
    .candid-switcher-btn[data-disabled="true"] {
      opacity: 0.38;
      pointer-events: none;
    }
  `;

  document.head.appendChild(style);
}

// ─── Component ────────────────────────────────────────────────────────────────────

export default function CityMap({
  initialZip,
  measureMap,
  onPinClick,
  onClearPin,
  selectedMeasureId,
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
      measure_id: string;
      marker: { remove: () => void };
    }>
  >([]);
  const [pinLoad, setPinLoad] = useState({ active: false, done: 0, total: 0 });
  const [mapZoom, setMapZoom] = useState<number>(17.5);
  const selectedElRef = useRef<HTMLElement | null>(null);
  const onPinClickRef = useRef(onPinClick);

  // ─── NEW: Category Switcher State ──────────────────────────────────────────
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [resolvedPins, setResolvedPins] = useState<MapPin[]>([]);
  const popupRef = useRef<any>(null);
  const isFlyingRef = useRef(false); // distinguishes programmatic flyTo from manual zoom

  // Keep callback ref fresh
  useEffect(() => {
    onPinClickRef.current = onPinClick;
  }, [onPinClick]);

  // ── ONE-TIME cache nuke for stale entries (remove after confirming fix) ─────
  useEffect(() => {
    const NUKE_KEY = 'candid_cache_nuked_v3';
    if (!localStorage.getItem(NUKE_KEY)) {
      const keys = Object.keys(localStorage).filter((k) => k.startsWith('osm_pins_'));
      keys.forEach((k) => localStorage.removeItem(k));
      localStorage.setItem(NUKE_KEY, 'true');
      console.log(`[CityMap] Nuked ${keys.length} stale cached pin entries`);
    }
  }, []);

  // ─── NEW: Category Switcher Click Handler ──────────────────────────────────
  const handleCategoryClick = useCallback(
    (category: string) => {
      const map = mapRef.current;
      if (!map) return;

      const mapboxgl = require('mapbox-gl');

      // Toggle off if clicking the same category
      if (activeCategory === category) {
        setActiveCategory(null);
        onClearPin?.();

        // Remove any open popup
        if (popupRef.current) {
          popupRef.current.remove();
          popupRef.current = null;
        }

        // Show ALL markers again
        markersRef.current.forEach(({ el }) => {
          el.style.display = 'flex';
        });

        // Deselect pills
        if (selectedElRef.current) {
          selectedElRef.current.classList.remove('selected');
          selectedElRef.current = null;
        }

        return;
      }

      // ── Activate new category — close any open info card first ──
      onClearPin?.();
      setActiveCategory(category);

      // Find the resolved pin for this category
      const pin = resolvedPins.find((p) => p.category === category);
      if (!pin) return;

      // Filter markers: only show the active category
      markersRef.current.forEach(({ el, pill, category: cat }) => {
        if (cat === category) {
          el.style.display = 'flex';
        } else {
          el.style.display = 'none';
          pill.classList.remove('selected');
        }
      });

      // Close existing popup
      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }

      // FlyTo the category's landmark
      isFlyingRef.current = true;
      map.flyTo({
        center: [pin.lon, pin.lat],
        zoom: 17.5,
        pitch: 60,
        bearing: -15,
        speed: 1.2,
        curve: 1.4,
      });

      // On arrival: open popup + select marker + notify parent
      map.once('moveend', () => {
        isFlyingRef.current = false;
        if (!mapRef.current) return;

        // Select the marker pill
        const markerData = markersRef.current.find((m) => m.category === category);
        if (markerData) {
          if (selectedElRef.current) selectedElRef.current.classList.remove('selected');
          markerData.pill.classList.add('selected');
          selectedElRef.current = markerData.pill;
        }

        // Build & show popup
        const score = impactScores?.[category];
        const icon = PILL_ICONS[category] ?? '📋';
        const color = PILL_COLORS[category] ?? PILL_COLORS.other;
        const narrative = getImpactNarrative(category, pin.label, score);
        const narrativeHTML = narrative.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        const catLabel = category.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

        const popupHTML = `
          <div style="margin-bottom:8px;">
            <span style="font-size:18px;margin-right:6px;">${icon}</span>
            <span style="font-size:13px;font-weight:700;color:${color};">${catLabel}</span>
          </div>
          <div style="font-size:14px;font-weight:600;margin-bottom:4px;">${pin.label}</div>
          ${pin.address ? `<div style="font-size:11px;color:#999;margin-bottom:10px;">${pin.address}</div>` : ''}
          <div style="font-size:12.5px;line-height:1.6;color:#ddd;">${narrativeHTML}</div>
        `;

        const popup = new mapboxgl.Popup({
          offset: [0, -20],
          closeOnClick: false,
          className: 'candid-popup',
          maxWidth: '280px',
        })
          .setLngLat([pin.lon, pin.lat])
          .setHTML(popupHTML)
          .addTo(mapRef.current);

        popupRef.current = popup;

        // Notify parent
        onPinClickRef.current(pin);
      });
    },
    [activeCategory, resolvedPins, impactScores, onClearPin],
  );

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

    map.on('zoom', () => {
      setMapZoom(map.getZoom());
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
      if (popupRef.current) popupRef.current.remove(); // ← NEW: cleanup popup on unmount
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

      // 2. Fly to ZIP with cinematic 3D camera
      mapRef.current?.flyTo({ center, zoom: 17.5, pitch: 60, bearing: -15, speed: 1.2, curve: 1.4 });
      await new Promise<void>((resolve) => {
        if (mapRef.current) mapRef.current.once('moveend', resolve);
        else setTimeout(resolve, 2000);
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
            address: poi.address ?? poi.name,
          } as MapPin;
        })
        .filter(Boolean) as MapPin[];

      // ──── NEW: Save resolved pins for category switcher ────
      if (!cancelled) setResolvedPins(pins);

      // 5. Clear old markers
      markersRef.current.forEach(({ marker }) => marker.remove());
      markersRef.current = [];
      selectedElRef.current = null;

      // 6. Place markers with impact-based animations
      let firstPinCoords: [number, number] | null = null;

      function placeMarkers() {
        if (cancelled || !mapRef.current) return;
        const mapboxgl = require('mapbox-gl');

        pins.forEach((pin, i) => {
          if (!isFinite(pin.lat) || !isFinite(pin.lon)) return;
          if (!firstPinCoords) firstPinCoords = [pin.lon, pin.lat];

          const color = PILL_COLORS[pin.category] ?? PILL_COLORS.other;
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
          pill.style.borderTop = `2.5px solid ${color}`;
          pill.innerHTML = `
            <span class="candid-pill-dot" style="background:${color}"></span>
            <span class="candid-pill-label">${pin.label}</span>
          `;

          wrapper.appendChild(pill);

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
            .addTo(mapRef.current);

          markersRef.current.push({
            el: wrapper,
            pill,
            category: pin.category,
            measure_id: pin.measure_id,
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

      // Glide to first pin after markers land
      setTimeout(() => {
        if (!cancelled && mapRef.current && firstPinCoords) {
          mapRef.current.flyTo({
            center: firstPinCoords,
            zoom: 17.5,
            pitch: 60,
            bearing: -15,
            speed: 1.2,
            curve: 1.4,
          });
        }
      }, 300);
    }

    loadPins();
    return () => {
      cancelled = true;
      setPinLoad({ active: false, done: 0, total: 0 });
    };
  }, [initialZip, measureMap, impactScores]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Effect C: Toggle visibility based on activeCategory ───────────────────
  useEffect(() => {
    markersRef.current.forEach(({ el, category }) => {
      const visible = activeCategory ? category === activeCategory : true;
      el.style.display = visible ? 'flex' : 'none';
    });
  }, [activeCategory]);

  // ── Effect D-extra: Sync selected pill with parent selectedMeasureId ──────────
  useEffect(() => {
    markersRef.current.forEach(({ pill, measure_id }) => {
      if (selectedMeasureId && measure_id === selectedMeasureId) {
        pill.classList.add('selected');
      } else {
        pill.classList.remove('selected');
      }
    });
    // Also clear the local ref if parent deselected
    if (!selectedMeasureId && selectedElRef.current) {
      selectedElRef.current.classList.remove('selected');
      selectedElRef.current = null;
    }
  }, [selectedMeasureId]);

  // ── Effect D: Live-update impact animations when scores change ────────────────
  useEffect(() => {
    markersRef.current.forEach(({ pill, category }) => {
      const score = impactScores?.[category];
      const impact = getImpactLevel(score);
      pill.dataset.impact = impact;
    });
  }, [impactScores]);

  // ── Loading state derived values ─────────────────────────────────────────────
  const catKeys = Object.keys(measureMap);
  const currentCat = catKeys[Math.min(pinLoad.done, catKeys.length - 1)] ?? '';
  const currentColor = PILL_COLORS[currentCat] ?? '#6B9E82';
  const loadingPhrase =
    pinLoad.total === 0
      ? 'Scanning your location...'
      : CAT_LOADING_PHRASE[currentCat] ?? `Analyzing ${currentCat.replace(/_/g, ' ')}...`;
  const progressPct = pinLoad.total > 0 ? (pinLoad.done / pinLoad.total) * 100 : 5;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: '500px' }}>

      {/* ── Loading overlay — Immersive Geocoding ─────────────────────────── */}
      <AnimatePresence>
        {pinLoad.active && (
          <motion.div
            key="loading-overlay"
            className="candid-map-loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
          >
            {/* Background texture */}
            <div className="candid-loading-grid" />
            <div className="candid-loading-leak-blue" />
            <div className="candid-loading-leak-pink" />
            <div className="candid-loading-leak-lime" />

            {/* ── Center content ── */}
            <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22 }}>

              {/* Squircle radar */}
              <div style={{ position: 'relative' }}>
                <div className="candid-loading-squircle">
                  <div className="candid-loading-radar" />
                  <div className="candid-loading-ch-h" />
                  <div className="candid-loading-ch-v" />
                  {/* Concentric rings */}
                  <div style={{ position: 'absolute', borderRadius: '50%', border: '1px solid rgba(107,158,130,0.12)', width: 58, height: 58, pointerEvents: 'none' }} />
                  <div style={{ position: 'absolute', borderRadius: '50%', border: '1px solid rgba(107,158,130,0.07)', width: 78, height: 78, pointerEvents: 'none' }} />
                  <div className="candid-loading-dot" />
                  {/* Ping ripple — fires on every done increment */}
                  <motion.div
                    key={`ping-${pinLoad.done}`}
                    className="candid-loading-ping"
                    initial={{ scale: 1, opacity: 0.7 }}
                    animate={{ scale: 2.1, opacity: 0 }}
                    transition={{ duration: 0.85, ease: 'easeOut' }}
                  />
                </div>

                {/* Outer ambient pulse ring */}
                <motion.div
                  animate={{ scale: [1, 1.08, 1], opacity: [0.18, 0.06, 0.18] }}
                  transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
                  style={{
                    position: 'absolute',
                    inset: -12,
                    borderRadius: 38,
                    border: `1.5px solid ${currentColor}`,
                    pointerEvents: 'none',
                    transition: 'border-color 0.5s ease',
                  }}
                />
              </div>

              {/* Dynamic phrase — cross-fades on category change */}
              <div style={{ textAlign: 'center', width: 240 }}>
                <AnimatePresence mode="wait">
                  <motion.p
                    key={loadingPhrase}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    transition={{ duration: 0.28 }}
                    style={{
                      fontSize: 13.5,
                      fontWeight: 500,
                      color: '#57534E',
                      letterSpacing: '0.01em',
                      margin: 0,
                      lineHeight: 1.5,
                    }}
                  >
                    {loadingPhrase}
                  </motion.p>
                </AnimatePresence>
              </div>

              {/* Progress bar */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <div className="candid-loading-track">
                  <motion.div
                    animate={{ width: `${progressPct}%` }}
                    transition={{ duration: 0.55, ease: [0.34, 1.56, 0.64, 1] }}
                    style={{
                      height: '100%',
                      borderRadius: 99,
                      background: currentColor,
                      transition: 'background 0.5s ease',
                      minWidth: progressPct > 0 ? 6 : 0,
                    }}
                  />
                </div>
                {pinLoad.total > 0 && (
                  <p style={{
                    fontSize: 9.5,
                    fontWeight: 700,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: '#A8A09A',
                    margin: 0,
                  }}>
                    {pinLoad.done} of {pinLoad.total} categories decoded
                  </p>
                )}
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ NEW: Category Switcher Bar ═══ */}
      {Object.keys(measureMap).length > 0 && (
        <div className="candid-switcher">
          {Object.keys(measureMap).map((cat) => {
            const isActive = activeCategory === cat;
            const hasPin = resolvedPins.some((p) => p.category === cat);
            const color = PILL_COLORS[cat] ?? PILL_COLORS.other;
            const label = cat.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

            return (
              <button
                key={cat}
                className="candid-switcher-btn"
                data-active={String(isActive)}
                data-disabled={String(!hasPin)}
                style={{
                  background: isActive ? color : undefined,
                  borderColor: isActive ? 'transparent' : undefined,
                }}
                onClick={() => hasPin && handleCategoryClick(cat)}
                title={hasPin ? `Fly to ${label}` : `No ${label} location found nearby`}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: isActive ? 'rgba(255,255,255,0.85)' : `${color}70`,
                    flexShrink: 0,
                  }}
                />
                <span>{label}</span>
              </button>
            );
          })}
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

      {/* Zoom-out hint — only appears when a category is active and user zooms out */}
      <div
        style={{
          position: 'absolute',
          bottom: 80,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 15,
          pointerEvents: 'none',
          // Show when: category is active AND user has zoomed out below threshold
          // AND we're not in the middle of a flyTo animation
          opacity: activeCategory && mapZoom < 15 && !isFlyingRef.current ? 1 : 0,
          transition: 'opacity 0.5s ease',
          background: 'rgba(253, 252, 248, 0.72)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(0,0,0,0.07)',
          borderRadius: 12,
          padding: '8px 14px',
          whiteSpace: 'nowrap',
          boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
        }}
      >
        <span style={{ fontSize: 12, color: '#6B7280', fontWeight: 500, letterSpacing: '0.01em' }}>
          Zoom out to view impact across other categories
        </span>
      </div>
    </div>
  );
}