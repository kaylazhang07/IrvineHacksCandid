'use client';
import dynamic from 'next/dynamic';
import { useUserProfile } from '@/hooks/useUserProfile';

const CityMap = dynamic(() => import('@/components/CityMap'), { ssr: false });

export default function MapPage() {
  const { profile } = useUserProfile();
  return (
    <div className="h-[calc(100vh-3.5rem)]">
      <CityMap pins={[]} initialZip={profile?.zip_code ?? ''} onPinClick={() => {}} />
    </div>
  );
}
