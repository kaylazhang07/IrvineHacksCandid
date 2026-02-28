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
};

const ALL_CATEGORIES = Object.keys(CATEGORY_MEASURE_MAP);

const FILTER_META: Record<string, { icon: string; label: string; color: string }> = {
  housing:       { icon: '🏠', label: 'Housing',       color: '#818cf8' },
  education:     { icon: '📚', label: 'Education',     color: '#a78bfa' },
  transportation:{ icon: '🚌', label: 'Transit',       color: '#38bdf8' },
  public_safety: { icon: '🛡', label: 'Safety',        color: '#fb7185' },
  environment:   { icon: '🌿', label: 'Environment',   color: '#4ade80' },
  healthcare:    { icon: '❤',  label: 'Health',        color: '#f472b6' },
  economy:       { icon: '💼', label: 'Economy',       color: '#fbbf24' },
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
      <div className="absolute top-3 left-3 right-3 z-10 bg-white/92 backdrop-blur-md rounded-2xl shadow-lg px-4 pt-3 pb-2.5">
        <div className="flex items-center justify-between mb-2.5">
          <div>
            <h1 className="text-sm font-black text-zinc-900 leading-tight">Your Neighborhood, Your Ballot</h1>
            {profile?.zip_code && (
              <p className="text-xs text-zinc-400 mt-0.5">Near {profile.zip_code}</p>
            )}
          </div>
          <span className="text-xs font-medium text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded-full">
            {activeCategories.size} / {ALL_CATEGORIES.length} shown
          </span>
        </div>

        {/* Filter pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
          <button
            onClick={selectAll}
            className={`flex-shrink-0 text-xs font-bold px-3 py-1.5 rounded-full border transition-all ${
              allSelected
                ? 'bg-zinc-900 text-white border-zinc-900'
                : 'bg-white text-zinc-500 border-zinc-200 hover:border-zinc-400'
            }`}
          >
            All
          </button>
          {ALL_CATEGORIES.map(cat => {
            const { icon, label, color } = FILTER_META[cat];
            const active = activeCategories.has(cat);
            return (
              <button
                key={cat}
                onClick={() => toggleCategory(cat)}
                className="flex-shrink-0 flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full border transition-all"
                style={active
                  ? { backgroundColor: color, color: 'white', borderColor: color }
                  : { backgroundColor: 'white', color: '#71717a', borderColor: '#e4e4e7' }
                }
              >
                <span>{icon}</span>
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
          activeCategories={activeCategories}
        />
      )}

      {/* Bottom info card — slides up on pin click */}
      <MapInfoCard pin={selectedPin} onClose={() => setSelectedPin(null)} />
    </div>
  );
}
