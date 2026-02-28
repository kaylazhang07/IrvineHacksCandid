// CRITICAL: Must be dynamically imported with ssr: false in parent page.
// const CityMap = dynamic(() => import('@/components/CityMap'), { ssr: false })
'use client';
import { useEffect, useRef } from 'react';
import { MapPin } from '@/lib/types';
import { getCategoryColor } from '@/lib/utils';

interface Props {
  pins: MapPin[];
  initialZip: string;
  onPinClick: (pin: MapPin) => void;
}

const ZIP_CENTROIDS: Record<string, [number, number]> = {
  '94601': [-122.2302, 37.7652],
  '94102': [-122.4194, 37.7749],
};

export default function CityMap({ pins, initialZip, onPinClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    // Dynamic require keeps mapbox-gl out of TS compilation (SSR safety + avoids type resolution issues)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mapboxgl = require('mapbox-gl');
    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';

    const center = ZIP_CENTROIDS[initialZip] ?? [-122.4194, 37.7749];
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center,
      zoom: 13,
    });

    map.on('load', () => {
      pins.forEach((pin: MapPin) => {
        const el = document.createElement('div');
        el.style.cssText = `width:12px;height:12px;border-radius:50%;background:${getCategoryColor(pin.category)};border:2px solid white;cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,.3)`;
        new mapboxgl.Marker(el).setLngLat([pin.lon, pin.lat]).addTo(map);
        el.addEventListener('click', () => onPinClick(pin));
      });
    });

    return () => map.remove();
  }, [pins, initialZip, onPinClick]);

  return <div ref={containerRef} className="w-full h-full" />;
}
