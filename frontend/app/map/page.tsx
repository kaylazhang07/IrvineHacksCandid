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
  education:      'hr-edu-2025',
  housing:        'hr-housing-2025',
  transportation: 'hr-transit-2025',
  public_safety:  'hr-safety-2025',
  environment:    'hr-env-2025',
  healthcare:     'hr-health-2025',
  economy:        'hr-jobs-2025',
  other:          'hr-other-2025',
};

export default function MapPage() {
  const router = useRouter();
  const { profile } = useUserProfile();
  const [selectedPin, setSelectedPin] = useState<MapPin | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem('candid_user_profile')) {
      router.replace('/');
    }
  }, [router]);

  return (
    <div className="relative w-full" style={{ height: 'calc(100vh - 44px - 56px)' }}>

      {/* Map — CityMap renders its own category switcher internally */}
      {profile?.zip_code && (
        <CityMap
          initialZip={profile.zip_code}
          measureMap={CATEGORY_MEASURE_MAP}
          onPinClick={setSelectedPin}
          onClearPin={() => setSelectedPin(null)}
          selectedMeasureId={selectedPin?.measure_id ?? null}
        />
      )}

      {/* Bottom info card — slides up on pin click */}
      <MapInfoCard pin={selectedPin} onClose={() => setSelectedPin(null)} />
    </div>
  );
}
