'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useMeasures } from '@/hooks/useMeasures';
import { MeasureCard } from '@/components/MeasureCard';

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl p-4 border border-zinc-100 animate-pulse">
      <div className="h-3 w-20 bg-zinc-200 rounded mb-2" />
      <div className="h-4 w-3/4 bg-zinc-200 rounded mb-2" />
      <div className="h-3 w-full bg-zinc-200 rounded" />
    </div>
  );
}

export default function BallotPage() {
  const router = useRouter();
  const { profile } = useUserProfile();
  const { measures, isLoading } = useMeasures(profile);

  useEffect(() => {
    if (profile === null && typeof window !== 'undefined') {
      const stored = localStorage.getItem('candid_user_profile');
      if (!stored) router.replace('/');
    }
  }, [profile, router]);

  const sorted = (Array.isArray(measures) ? [...measures] : []).sort((a, b) => Math.abs(b.personal_annual_usd) - Math.abs(a.personal_annual_usd));

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-bold text-zinc-900">
          Your ballot{profile ? ` for ${profile.zip_code}` : ''}
        </h1>
      </div>
      <div className="flex items-center gap-2 mb-6">
        <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">Personalized for you</span>
      </div>

      <div className="flex flex-col gap-3">
        {isLoading
          ? Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)
          : sorted.length === 0
          ? <p className="text-zinc-400 text-sm text-center py-10">No measures found — backend may not be running.</p>
          : sorted.map(m => (
              <MeasureCard
                key={m.measure_id}
                measureId={m.measure_id}
                title={m.title}
                summary={m.summary}
                category={m.category}
                estimatedImpact={m.personal_annual_usd}
              />
            ))
        }
      </div>
    </div>
  );
}
