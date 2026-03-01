// CRITICAL: Must be dynamically imported with ssr: false in parent page.
// const CityMap = dynamic(() => import('@/components/CityMap'), { ssr: false })
'use client';
import { useEffect, useRef, useState } from 'react';
import { MapPin } from '@/lib/types';

interface Props {
  initialZip: string;
  measureMap: Record<string, string>; // category → measure_id
  onPinClick: (pin: MapPin) => void;
  activeCategories?: Set<string>; // undefined = show all
}

const PILL_COLORS: Record<string, string> = {
  housing:       '#818cf8',
  education:     '#a78bfa',
  transportation:'#38bdf8',
  public_safety: '#fb7185',
  environment:   '#4ade80',
  healthcare:    '#f472b6',
  economy:       '#fbbf24',
  other:         '#94a3b8',
};

const PILL_ICONS: Record<string, string> = {
  housing: '🏠', education: '📚', transportation: '🚌',
  public_safety: '🛡', environment: '🌿', healthcare: '❤',
  economy: '💼', other: '📋',
};



// Human-readable context for each category pin popup
const CATEGORY_CONTEXTS: Record<string, string> = {
  water:          'Impact on local water infrastructure & access',
  environment:    'Environmental policy changes in your area',
  transportation: 'Transit & public transportation improvements',
  housing:        'Affordable housing & development initiatives',
  economy:        'Jobs, business, and economic development',
  civil_rights:   'Civil rights protections & equity initiatives',
  government:     'Local government operations & accountability',
  public_safety:  'Police, fire, and emergency services funding',
  education:      'Schools, libraries & education funding',
  healthcare:     'Hospital & public health services',
  family:         'Family services, parks & community spaces',
  immigration:    'Immigration services & community support',
  technology:     'Tech infrastructure & digital equity',
  taxes:          'Tax policy & public revenue allocation',
  foreign_policy: 'International relations & trade impact',
};

const _pinsCache: Record<string, Record<string, {name: string; lat: number; lon: number}>> = {};
function _loadFromStorage(key: string) {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem('pins_' + key) : null;
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function _saveToStorage(key: string, data: unknown) {
  try { localStorage.setItem('pins_' + key, JSON.stringify(data)); } catch { /**/ }
}

// ─── Category → Geocoding search terms ─────────────────────────────────────────
const CATEGORY_SEARCH_TERMS: Record<string, string[]> = {
  water:          ["water treatment plant", "reservoir", "water district"],
  environment:    ["park", "nature reserve", "botanical garden"],
  transportation: ["transit station", "bus station", "train station"],
  housing:        ["apartment complex", "affordable housing", "real estate office"],
  economy:        ["bank", "business center", "chamber of commerce"],
  civil_rights:   ["courthouse", "legal aid", "civil rights office"],
  government:     ["city hall", "government office", "municipal building"],
  public_safety:  ["police station", "fire station", "emergency services"],
  education:      ["school", "university", "library"],
  healthcare:     ["hospital", "medical center", "clinic"],
  family:         ["community center", "playground", "daycare"],
  immigration:    ["immigration office", "consulate", "citizenship services"],
  technology:     ["tech company", "innovation center", "computer store"],
  taxes:          ["tax office", "accounting firm", "IRS office"],
  foreign_policy: ["embassy", "consulate general", "international center"],
};

const ALL_CATEGORIES = Object.keys(CATEGORY_SEARCH_TERMS);

type PinLocation = { name: string; lat: number; lon: number };
type PinMap = Record<string, PinLocation>;

const pinCache: Record<string, PinMap> = {};

function cacheKey(lat: number, lng: number): string {
  return `pins_${lat.toFixed(3)}_${lng.toFixed(3)}`;
}

async function fetchCategoryPin(
  category: string,
  lat: number,
  lng: number,
  token: string
): Promise<PinLocation | null> {
  const terms = CATEGORY_SEARCH_TERMS[category] ?? [category];
  for (const term of terms) {
    try {
      const url = new URL(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(term)}.json`
      );
      url.searchParams.set("proximity", `${lng},${lat}`);
      url.searchParams.set("limit", "1");
      url.searchParams.set("types", "poi");
      url.searchParams.set("access_token", token);
      const res = await fetch(url.toString());
      if (!res.ok) continue;
      const data = await res.json();
      const feature = data?.features?.[0];
      if (feature) {
        return {
          name: feature.text ?? feature.place_name ?? term,
          lat: feature.center[1],
          lon: feature.center[0],
        };
      }
    } catch {
      continue;
    }
  }
  return null;
}

function fallbackPin(category: string, lat: number, lng: number): PinLocation {
  const index = ALL_CATEGORIES.indexOf(category);
  const angle = ((index * 137.5) % 360) * (Math.PI / 180);
  const radius = 0.006 + (index % 3) * 0.003;
  return {
    name: category.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    lat: lat + radius * Math.cos(angle),
    lon: lng + radius * Math.sin(angle),
  };
}

async function fetchAllPinsForArea(lat: number, lng: number): Promise<PinMap> {
  const key = cacheKey(lat, lng);
  if (pinCache[key]) return pinCache[key];
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      const parsed: PinMap = JSON.parse(stored);
      if (Object.keys(parsed).length === ALL_CATEGORIES.length) {
        pinCache[key] = parsed;
        return parsed;
      }
    }
  } catch {}
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";
  const result: PinMap = {};
  const entries = await Promise.all(
    ALL_CATEGORIES.map(async (category) => {
      const pin = await fetchCategoryPin(category, lat, lng, token);
      return [category, pin] as const;
    })
  );
  for (const [category, pin] of entries) {
    result[category] = pin ?? fallbackPin(category, lat, lng);
  }
  pinCache[key] = result;
  try { localStorage.setItem(key, JSON.stringify(result)); } catch {}
  return result;
}


export default function CityMap({ initialZip, measureMap, onPinClick, activeCategories }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  const mapLoadedRef = useRef(false);
  const markersRef = useRef<Array<{ el: HTMLElement; category: string; marker: { remove: () => void } }>>([])
  const [pinLoad, setPinLoad] = useState({ active: false, done: 0, total: 0 });
  const selectedElRef = useRef<HTMLElement | null>(null);
  const popupRef = useRef<any>(null);
  const onPinClickRef = useRef(onPinClick);
function injectPillStyles() {
  if (document.getElementById('map-pill-styles')) return;
  const style = document.createElement('style');
  style.id = 'map-pill-styles';
  style.innerHTML = `
    .map-pill {
      background: rgba(15, 25, 50, 0.92);
      color: #fff;
      border: 1.5px solid rgba(99,179,255,0.5);
      border-radius: 999px;
      padding: 5px 13px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
      backdrop-filter: blur(6px);
      box-shadow: 0 2px 12px rgba(0,0,0,0.4);
      transition: transform 0.15s, box-shadow 0.15s;
      letter-spacing: 0.02em;
    }
    .map-pill:hover {
      transform: scale(1.08);
      box-shadow: 0 4px 18px rgba(99,179,255,0.35);
      border-color: rgba(99,179,255,0.9);
    }
    .mapboxgl-popup-content {
      background: rgba(10,20,45,0.97) !important;
      color: #e2e8f0 !important;
      border: 1px solid rgba(99,179,255,0.3) !important;
      border-radius: 12px !important;
      padding: 14px 16px !important;
      font-size: 13px !important;
      max-width: 220px !important;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5) !important;
    }
    .mapboxgl-popup-tip { border-top-color: rgba(10,20,45,0.97) !important; }
  `;
  document.head.appendChild(style);
}

  // ── Effect A: create Mapbox map once ──────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;
    const mapboxgl = require('mapbox-gl');
    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';
    injectPillStyles();

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [-122.4194, 37.7749], // SF default; Effect B will fly to real zip
      zoom: 14,
        pitch: 45,
        bearing: -10,
      pitch: 0,
      bearing: 0,
    });

    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'top-right');

    map.on('load', () => {
      // ── 3D buildings ──────────────────────────────────────────────────
      if (map.getSource('composite')) {
        if (!map.getLayer('3d-buildings')) map.addLayer({
          id: '3d-buildings',
          source: 'composite',
          'source-layer': 'building',
          filter: ['==', 'extrude', 'true'],
          type: 'fill-extrusion',
          minzoom: 14,
          paint: {
            'fill-extrusion-color': '#1a2a4a',
            'fill-extrusion-height': ['get', 'height'],
            'fill-extrusion-base': ['get', 'min_height'],
            'fill-extrusion-opacity': 0.7,
          },
        });
      }

      mapLoadedRef.current = true;

      // Clay aesthetic — suppress labels, recolor roads/water/parks
      map.getStyle().layers.forEach((layer: { id: string; type: string; 'source-layer'?: string }) => {
        try {
          if (layer.type === 'symbol') {
            map.setLayoutProperty(layer.id, 'visibility', 'none');
          }
          if (layer.type === 'line' && (
            (layer['source-layer'] ?? '').includes('road') ||
            layer.id.includes('road') || layer.id.includes('tunnel') || layer.id.includes('bridge')
          )) {
            map.setPaintProperty(layer.id, 'line-color', '#ede9e2');
          }
          if (layer.type === 'fill' && (
            (layer['source-layer'] ?? '').includes('water') || layer.id.includes('water')
          )) {
            map.setPaintProperty(layer.id, 'fill-color', '#c8e0f4');
          }
          if (layer.type === 'fill' && (
            layer.id.includes('park') || layer.id.includes('grass') ||
            layer.id.includes('green') || layer.id.includes('wood') ||
            layer.id.includes('pitch') || layer.id.includes('scrub')
          )) {
            map.setPaintProperty(layer.id, 'fill-color', '#d8e8c8');
          }
        } catch { /* layer may not support the property */ }
      });

      // 3D buildings — warm cream clay
      map.addLayer({
        id: '3d-buildings',
        source: 'composite',
        'source-layer': 'building',
        filter: ['==', 'extrude', 'true'],
        type: 'fill-extrusion',
        minzoom: 13,
        paint: {
          'fill-extrusion-color': '#f5f2ed',
          'fill-extrusion-height': [
            'interpolate', ['linear'], ['zoom'], 13, 0, 14, ['get', 'height'],
          ],
          'fill-extrusion-base': [
            'interpolate', ['linear'], ['zoom'], 13, 0, 14, ['get', 'min_height'],
          ],
          'fill-extrusion-opacity': 0.9,
        },
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
      mapLoadedRef.current = false;
      markersRef.current = [];
    };
  }, []); // runs exactly once — no map recreation

  // ── Effect B: Geocode zip + fetch real POIs via Overpass + place pills ────────
  useEffect(() => {
    if (!initialZip || Object.keys(measureMap).length === 0) return;

    let cancelled = false;
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';

    async function loadPins() {
      
      
      // 1. Geocode ZIP → center coordinates (Mapbox is reliable for this)
      let center: [number, number] = [-122.4194, 37.7749];
      try {
        const geo = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(initialZip)}.json?country=us&types=postcode&access_token=${token}`
        ).then(r => r.json());
        if (geo.features?.[0]?.center) center = geo.features[0].center;
      } catch { /* use SF default */ }

      if (cancelled) return;
      const [lng, lat] = center;

      // 2. Fly map to this ZIP
      mapRef.current?.flyTo({ center, zoom: 14, pitch: 0, bearing: 0, duration: 1200 });
      await new Promise(resolve => { if (mapRef.current) { mapRef.current.once("moveend", resolve); } else { setTimeout(resolve, 1400); } });
      // 3. Fetch one real OSM POI per category in parallel via Overpass API
      const categories = Object.keys(measureMap);
      setPinLoad({ active: true, done: 0, total: categories.length });

      let resolvedCount = 0;
      const poiResults = await Promise.all(
        categories.map(async (cat) => {
                    const allPins = await fetchAllPinsForArea(lat, lng);
          const poi = allPins[cat] ?? null;
          if (!cancelled) {
            resolvedCount++;
            setPinLoad({ active: true, done: resolvedCount, total: categories.length });
          }
          if (!poi) return null;
          return {
            measure_id: measureMap[cat],
            label: poi.name,
            lat: poi.lat,
            lon: poi.lon,
            category: cat,
            address: CATEGORY_CONTEXTS[cat],
          } as MapPin;
        })
      );

      if (cancelled) return;

      const pins = poiResults.filter((p) => p !== null) as MapPin[];

      // 4. Clear old markers
      markersRef.current.forEach(({ marker }) => marker.remove());
      markersRef.current = [];
      selectedElRef.current = null;

      // 5. Place new pill markers — wait for map 'load' if not yet fired
      function placeMarkers() {
        if (cancelled) return;
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const mapboxgl = require('mapbox-gl');
        pins.forEach((pin, i) => {
          if (!isFinite(pin.lat) || !isFinite(pin.lon)) {
            console.warn('Skipping pin with invalid coords:', pin);
            return;
          }
      
          const color = PILL_COLORS[pin.category] ?? PILL_COLORS.other;
          const icon  = PILL_ICONS[pin.category] ?? '📋';
      
          const el = document.createElement('div');
          el.className = 'candid-pill';
          el.style.background = color;
          el.style.animationDelay = `${(i * 0.31) % 2.4}s`;
          el.innerHTML = `<span style="font-size:13px;line-height:1">${icon}</span><span class="pill-label">${pin.label}</span>`;
      
          if (activeCategories && !activeCategories.has(pin.category)) {
            el.style.display = 'none';
          }
      
          el.addEventListener('click', () => {
            if (selectedElRef.current) selectedElRef.current.classList.remove('selected');
            el.classList.add('selected');
            selectedElRef.current = el;
            onPinClickRef.current(pin);
          });
      
          const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
            .setLngLat([pin.lon, pin.lat])
            .addTo(mapRef.current);
      
          markersRef.current.push({ el, category: pin.category, marker });
        });
      }

      function safePlace() {
        if (!mapRef.current) return;
        
        const place = () => {
          placeMarkers();
        setPinLoad(prev => ({ ...prev, active: false }));
          // Add tilt back after markers are anchored
          setTimeout(() => {
            mapRef.current?.easeTo({ pitch: 45, bearing: -10, duration: 800 });
          }, 100);
        };
      
        if (mapLoadedRef.current) {
          place();
        } else {
          mapRef.current.once('load', place);
        }
      }
      safePlace();
    }

    loadPins();
    return () => {
      cancelled = true;
      setPinLoad({ active: false, done: 0, total: 0 });
    };
  }, [initialZip, measureMap]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Effect C: Toggle pill visibility when filters change ─────────────────────
  useEffect(() => {
    markersRef.current.forEach(({ el, category }) => {
      const visible = !activeCategories || activeCategories.has(category);
      el.style.display = visible ? 'inline-flex' : 'none';
    });
  }, [activeCategories]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />

      {/* Loading indicator — shows while Overpass POI queries are in flight */}
      {pinLoad.active && (
        <div className="absolute bottom-4 left-4 z-10 flex items-center gap-2 bg-white/90 backdrop-blur-md rounded-full px-3.5 py-2 shadow-lg pointer-events-none">
          {/* Spinning gear */}
          <svg
            className="w-3.5 h-3.5 text-zinc-400 animate-spin flex-shrink-0"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          {/* Progress bar track */}
          <div className="w-20 h-1.5 rounded-full bg-zinc-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-zinc-400 transition-all duration-300"
              style={{ width: `${pinLoad.total ? (pinLoad.done / pinLoad.total) * 100 : 0}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-zinc-500 tabular-nums">
            {pinLoad.done}/{pinLoad.total}
          </span>
        </div>
      )}
    </div>
  );
}