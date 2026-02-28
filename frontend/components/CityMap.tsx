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

// OpenStreetMap tag pairs per category, tried in order until a nearby result is found.
// Uses Overpass API — real POI categories, not text search.
const OSM_QUERIES: Record<string, Array<[string, string]>> = {
  education:     [['amenity', 'school'], ['amenity', 'college'], ['amenity', 'university']],
  housing:       [['amenity', 'community_centre'], ['amenity', 'social_facility'], ['office', 'government']],
  transportation:[['public_transport', 'station'], ['railway', 'station'], ['amenity', 'bus_station']],
  public_safety: [['amenity', 'fire_station'], ['amenity', 'police']],
  environment:   [['leisure', 'park'], ['leisure', 'nature_reserve'], ['leisure', 'garden']],
  healthcare:    [['amenity', 'hospital'], ['amenity', 'clinic'], ['amenity', 'doctors']],
  economy:       [['amenity', 'library'], ['amenity', 'community_centre']],
};

// Human-readable descriptions connecting each place to its ballot measure
const CATEGORY_CONTEXTS: Record<string, string> = {
  education:     'Schools near you are directly affected by the education funding measure — teacher salaries and classroom resources depend on this vote.',
  housing:       'This area is at the heart of the affordable housing debate — rent stabilization and new affordable units would impact buildings like these.',
  transportation:'This transit stop serves your community. The transit modernization measure would fund electric fleet upgrades and new routes here.',
  public_safety: 'Emergency services near you would receive expanded funding and community crisis response teams under this public safety measure.',
  environment:   'This green space is part of the clean energy and parks restoration program this measure would fund.',
  healthcare:    'This facility would receive expanded capacity for primary care and mental health services under the community health centers measure.',
  economy:       'Community resources here support workforce development — the local jobs act would expand training programs and small business grants nearby.',
};

function injectPillStyles() {
  if (document.getElementById('candid-pill-style')) return;
  const style = document.createElement('style');
  style.id = 'candid-pill-style';
  style.textContent = `
    @keyframes pillBob {
      0%, 100% { transform: translateY(0px); }
      50%       { transform: translateY(-6px); }
    }
    .candid-pill {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 5px 11px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 700;
      color: white;
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(0,0,0,0.18), 0 1px 4px rgba(0,0,0,0.10);
      animation: pillBob 2.4s ease-in-out infinite;
      transition: box-shadow 0.15s;
      user-select: none;
      max-width: 180px;
    }
    .candid-pill .pill-label {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .candid-pill:hover {
      box-shadow: 0 8px 24px rgba(0,0,0,0.25);
    }
    .candid-pill.selected {
      outline: 3px solid white;
      outline-offset: 2px;
      box-shadow: 0 8px 28px rgba(0,0,0,0.30);
    }
  `;
  document.head.appendChild(style);
}

// Query Overpass API (OpenStreetMap) for the nearest POI matching any of the given
// OSM tag pairs. Returns the first result found within 5 km, or null if none.
async function searchNearbyPOI(
  tagPairs: Array<[string, string]>,
  lat: number,
  lng: number,
): Promise<{ name: string; lat: number; lon: number } | null> {
  const radius = 5000; // 5 km
  for (const [key, value] of tagPairs) {
    try {
      const query =
        `[out:json];` +
        `(node[${key}=${value}](around:${radius},${lat},${lng});` +
        ` way[${key}=${value}](around:${radius},${lat},${lng}););` +
        `out center 1;`;
      const res = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: `data=${encodeURIComponent(query)}`,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      const data = await res.json();
      const el = data.elements?.[0];
      if (!el) continue;
      const elLat = el.lat ?? el.center?.lat;
      const elLon = el.lon ?? el.center?.lon;
      // Skip if coordinates didn't resolve — setLngLat([undefined,undefined])
      // silently places the marker at pixel [0,0] (top-left corner).
      if (!isFinite(elLat) || !isFinite(elLon)) continue;
      return {
        name: el.tags?.name ?? value,
        lat: elLat,
        lon: elLon,
      };
    } catch { /* try next tag pair */ }
  }
  return null;
}

export default function CityMap({ initialZip, measureMap, onPinClick, activeCategories }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  const mapLoadedRef = useRef(false);
  const markersRef = useRef<Array<{ el: HTMLElement; category: string; marker: { remove: () => void } }>>([]);
  const selectedElRef = useRef<HTMLElement | null>(null);
  const onPinClickRef = useRef(onPinClick);
  const [pinLoad, setPinLoad] = useState<{ active: boolean; done: number; total: number }>({
    active: false, done: 0, total: 0,
  });

  useEffect(() => { onPinClickRef.current = onPinClick; }, [onPinClick]);

  // ── Effect A: Create map exactly once ────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mapboxgl = require('mapbox-gl');
    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';
    injectPillStyles();

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [-122.4194, 37.7749], // SF default; Effect B will fly to real zip
      zoom: 14,
      pitch: 0,
      bearing: 0,
    });

    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'top-right');

    map.on('load', () => {
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
      await new Promise(resolve => setTimeout(resolve, 300));
      // 3. Fetch one real OSM POI per category in parallel via Overpass API
      const categories = Object.keys(measureMap);
      setPinLoad({ active: true, done: 0, total: categories.length });

      let resolvedCount = 0;
      const poiResults = await Promise.all(
        categories.map(async (cat) => {
          const tagPairs = OSM_QUERIES[cat] ?? [['amenity', cat]];
          const poi = await searchNearbyPOI(tagPairs, lat, lng);
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
