'use client';
import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useExplanation } from '@/hooks/useExplanation';
import { BudgetChart } from '@/components/BudgetChart';
import { CitationSection } from '@/components/CitationSection';

const CityMap = dynamic(() => import('@/components/CityMap'), { ssr: false });

export default function MeasurePage() {
  const router = useRouter();
  const params = useParams();
  const measureId = params.measureId as string;
  const { profile } = useUserProfile();

  const stored =
    typeof window !== 'undefined'
      ? JSON.parse(sessionStorage.getItem(`measure_${measureId}`) ?? '{}')
      : {};
  const measureTitle: string = stored.title ?? measureId;
  const measureText: string = stored.text ?? '';

  const { data, isLoading, error } = useExplanation(measureId, measureText, profile, measureTitle);

  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem('candid_user_profile')) {
      router.replace('/');
    }
  }, [router]);

  const netImpact = data?.budget_shifts?.reduce((sum, s) => sum + (s.delta_pct ?? 0), 0) ?? 0;
  const impactPositive = netImpact >= 0;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <button onClick={() => router.back()} className="text-sm text-zinc-500 mb-4 flex items-center gap-1 hover:text-zinc-800">
        ← Back
      </button>

      {isLoading && (
        <div className="flex flex-col gap-4 animate-pulse">
          <div className="h-6 bg-zinc-200 rounded w-2/3" />
          <div className="h-32 bg-zinc-200 rounded-2xl" />
          <div className="h-20 bg-zinc-200 rounded-2xl" />
        </div>
      )}

      {data && (
        <div className="flex flex-col gap-5">
          <h1 className="text-xl font-bold text-zinc-900">{data.measure_title}</h1>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl bg-blue-50 border border-blue-100 p-5">
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-2">Official Summary</p>
              <p className="text-sm text-zinc-700 leading-relaxed">{data.plain_english_summary}</p>
            </div>
            <div className={`rounded-2xl border p-5 ${impactPositive ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
              <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${impactPositive ? 'text-green-700' : 'text-red-700'}`}>
                What This Means For You
              </p>
              <p className="text-sm text-zinc-700 leading-relaxed">{data.personal_impact_statement}</p>
            </div>
          </div>

          {data.confidence_score != null && (
            <div className="flex items-center gap-4 bg-white rounded-2xl border border-zinc-100 p-4 shadow-sm">
              <div className="relative w-16 h-16 flex-shrink-0">
                <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e4e4e7" strokeWidth="3" />
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#6366f1" strokeWidth="3"
                    strokeDasharray={`${Math.round(data.confidence_score * 100)} 100`} strokeLinecap="round" />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-zinc-900">
                  {Math.round(data.confidence_score * 100)}%
                </span>
              </div>
              <div>
                <p className="font-semibold text-zinc-900 text-sm">Confidence Score</p>
                <p className="text-xs text-zinc-500">Based on {data.citations?.length ?? 0} source{(data.citations?.length ?? 0) !== 1 ? 's' : ''}</p>
              </div>
            </div>
          )}

          {data.citations && data.citations.length > 0 && (
            <CitationSection citations={data.citations} />
          )}

          {data.budget_shifts && data.budget_shifts.length > 0 && (
            <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-5">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-4">Budget Impact</p>
              <BudgetChart shifts={data.budget_shifts} />
            </div>
          )}

          {data.map_pins && data.map_pins.length > 0 && (
            <div className="h-96 rounded-2xl overflow-hidden">
              <CityMap pins={data.map_pins} initialZip={profile?.zip_code ?? ''} onPinClick={() => {}} />
            </div>
          )}
        </div>
      )}

      {!isLoading && !data && (
        <div className="rounded-xl border border-red-100 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-700 mb-1">Could not load explanation</p>
          <p className="text-xs text-red-500 font-mono break-all">{error?.message ?? 'Backend may not be running on port 8000'}</p>
        </div>
      )}
    </div>
  );
}