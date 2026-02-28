'use client';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useExplanation } from '@/hooks/useExplanation';
import { ExplanationPanel } from '@/components/ExplanationPanel';
import { CitationDrawer } from '@/components/CitationDrawer';
import { BudgetChart } from '@/components/BudgetChart';
import { Citation } from '@/lib/types';

const CityMap = dynamic(() => import('@/components/CityMap'), { ssr: false });

type Tab = 'explanation' | 'budget' | 'map';

export default function MeasurePage() {
  const router = useRouter();
  const params = useParams();
  const measureId = params.measureId as string;
  const { profile } = useUserProfile();
  const { data, isLoading } = useExplanation(measureId, '', profile);
  const [tab, setTab] = useState<Tab>('explanation');
  const [activeCitation, setActiveCitation] = useState<Citation | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem('candid_user_profile')) {
      router.replace('/');
    }
  }, [router]);

  function handleCitationClick(c: Citation) {
    setActiveCitation(c);
    setDrawerOpen(true);
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: 'explanation', label: 'Explanation' },
    { id: 'budget', label: 'Budget' },
    { id: 'map', label: 'Map' },
  ];

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
        <>
          <h1 className="text-xl font-bold text-zinc-900 mb-4">{data.measure_title}</h1>

          {/* Tab bar */}
          <div className="flex border-b border-zinc-200 mb-6">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === t.id ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-400 hover:text-zinc-700'}`}>
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'explanation' && (
            <ExplanationPanel data={data} onCitationClick={handleCitationClick} />
          )}
          {tab === 'budget' && (
            data.budget_shifts.length > 0
              ? <BudgetChart shifts={data.budget_shifts} />
              : <p className="text-zinc-400 text-sm">No budget data available.</p>
          )}
          {tab === 'map' && (
            <div className="h-96 rounded-2xl overflow-hidden">
              <CityMap pins={data.map_pins} initialZip={profile?.zip_code ?? ''} onPinClick={() => {}} />
            </div>
          )}
        </>
      )}

      {!isLoading && !data && (
        <p className="text-zinc-400 text-sm">Loading explanation… (backend may not be running)</p>
      )}

      <CitationDrawer citation={activeCitation} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  );
}
