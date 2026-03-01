'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useUserProfile } from '@/hooks/useUserProfile';
import { MapInfoCard } from '@/components/MapInfoCard';
import { MapPin } from '@/lib/types';

const CityMap = dynamic(() => import('@/components/CityMap'), { ssr: false });

// One measure per category — CityMap will find a real nearby POI for each
const CATEGORY_MEASURE_MAP: Record<string, string> = {
  education:     'hr-edu-2025',
  housing:       'hr-housing-2025',
  transportation:'hr-transit-2025',
  public_safety: 'hr-safety-2025',
  environment:   'hr-env-2025',
  healthcare:    'hr-health-2025',
  economy:       'hr-jobs-2025',
  other:         'hr-other-2025',
};

const ALL_CATEGORIES = Object.keys(CATEGORY_MEASURE_MAP);

const FILTER_META: Record<string, { label: string; color: string }> = {
  housing:       { label: 'Housing',       color: '#8B7EC8' },
  education:     { label: 'Education',     color: '#C47B76' },
  transportation:{ label: 'Transit',       color: '#6A9EB8' },
  public_safety: { label: 'Safety',        color: '#B87560' },
  environment:   { label: 'Environment',   color: '#6B9E82' },
  healthcare:    { label: 'Health',        color: '#B5789C' },
  economy:       { label: 'Economy',       color: '#A88E44' },
  other:         { label: 'Other',         color: '#8A9AA8' },
};

export default function MapPage() {
  const router = useRouter();
  const { profile } = useUserProfile();
  const [selectedPin, setSelectedPin] = useState<MapPin | null>(null);
  const [activeCategories, setActiveCategories] = useState<Set<string>>(
    new Set(ALL_CATEGORIES)
  );

  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem('candid_user_profile')) {
      router.replace('/');
    }
  }, [router]);

  function toggleCategory(cat: string) {
    setActiveCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) {
        if (next.size === 1) return prev; // keep at least one active
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  }

  function selectAll() {
    setActiveCategories(new Set(ALL_CATEGORIES));
  }

  const allSelected = activeCategories.size === ALL_CATEGORIES.length;

  return (
    <div className="relative w-full" style={{ height: 'calc(100vh - 44px - 56px)' }}>

      {/* Floating header: title + filter bar */}
      <div
        className="absolute top-3 left-3 right-3 z-10 backdrop-blur-md rounded-2xl px-4 pt-3 pb-2.5"
        style={{
          background: 'rgba(253, 252, 248, 0.94)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 8px 24px rgba(0,0,0,0.08)',
          border: '1px solid rgba(0,0,0,0.06)',
        }}
      >
        <div className="flex items-center justify-between mb-2.5">
          <div>
            <h1 className="text-sm font-black text-zinc-900 leading-tight">Your Neighborhood, Your Ballot</h1>
            {profile?.zip_code && (
              <p className="text-xs text-zinc-400 mt-0.5">Near {profile.zip_code}</p>
            )}
          </div>
          <span
            className="text-xs font-medium px-2 py-0.5"
            style={{
              color: '#6B7280',
              background: 'rgba(0,0,0,0.05)',
              borderRadius: 8,
            }}
          >
            {activeCategories.size} / {ALL_CATEGORIES.length}
          </span>
        </div>

        {/* Filter pills — squircle cream, colored dot when active */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
          {/* All button — dark solid squircle when selected */}
          <button
            onClick={selectAll}
            className="flex-shrink-0 text-xs font-semibold px-3 py-1.5 transition-all"
            style={{
              borderRadius: 9,
              border: '1px solid',
              ...(allSelected
                ? { background: '#1C1917', color: '#FDFCF8', borderColor: '#1C1917' }
                : { background: 'rgba(253,252,248,0.0)', color: '#6B7280', borderColor: 'rgba(0,0,0,0.12)' }
              ),
            }}
          >
            All
          </button>

          {ALL_CATEGORIES.map(cat => {
            const { label, color } = FILTER_META[cat];
            const active = activeCategories.has(cat);
            return (
              <button
                key={cat}
                onClick={() => toggleCategory(cat)}
                className="flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 transition-all"
                style={{
                  borderRadius: 9,
                  border: '1px solid',
                  ...(active
                    ? {
                        background: 'rgba(253,252,248,0.96)',
                        color: '#1C1917',
                        borderColor: 'rgba(0,0,0,0.08)',
                        borderTop: `2.5px solid ${color}`,
                      }
                    : {
                        background: 'transparent',
                        color: '#9CA3AF',
                        borderColor: 'rgba(0,0,0,0.08)',
                      }
                  ),
                }}
              >
                {active && (
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: color, flexShrink: 0, display: 'inline-block',
                  }} />
                )}
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Map — CityMap handles its own geocoding + POI lookup */}
      {profile?.zip_code && (
        <CityMap
          initialZip={profile.zip_code}
          measureMap={CATEGORY_MEASURE_MAP}
          onPinClick={setSelectedPin}
          selectedMeasureId={selectedPin?.measure_id ?? null}
          activeCategories={activeCategories}
        />
      )}

      {/* Bottom info card — slides up on pin click */}
      <MapInfoCard pin={selectedPin} onClose={() => setSelectedPin(null)} />
    </div>
  );
}
