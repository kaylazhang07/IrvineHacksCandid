'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowUpRight } from 'lucide-react';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useMeasures } from '@/hooks/useMeasures';
import { MeasureCard } from '@/components/MeasureCard';
import { getCategoryColor, prettifyTitle } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Measure {
  measure_id: string;
  title: string;
  summary: string;
  category: string;
  personal_annual_usd: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function badgeLabel(impact: number): string {
  const n = Math.round(Math.abs(impact));
  if (n === 0) return 'Free';
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k/yr`;
  return `$${n.toLocaleString()}/yr`;
}

const EASE = [0.22, 1, 0.36, 1] as const;

// ── Official Ballot Header ─────────────────────────────────────────────────────
function BallotHeader({ zip }: { zip?: string }) {
  return (
    <div className="px-8 pt-8 pb-6 text-center border-b border-slate-100">
      {/* Decorative corner marks — like a real ballot */}
      <p className="text-[9px] font-bold tracking-[0.3em] text-slate-300 uppercase mb-1.5">
        OFFICIAL BALLOT — GENERAL ELECTION
      </p>
      <h2
        className="text-xl font-bold text-slate-800 mb-1"
        style={{ fontFamily: 'var(--font-serif, Georgia, serif)' }}
      >
        Commonwealth of Pennsylvania
      </h2>
      {zip && (
        <p className="text-[11px] text-slate-400 mb-4 tracking-wide">
          ZIP Code {zip} · Personalized Results
        </p>
      )}

      {/* "TO VOTE" instruction strip — straight from real ballot design */}
      <div className="inline-flex items-center gap-2.5 border border-slate-200 rounded-full px-4 py-1.5">
        <span className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase">
          To vote, fill in the oval
        </span>
        {/* Sample filled oval */}
        <svg width="22" height="14" viewBox="0 0 22 14">
          <ellipse cx="11" cy="7" rx="10" ry="6" fill="#475569" />
          <ellipse cx="11" cy="7" rx="5.5" ry="3" fill="white" opacity={0.25} />
        </svg>
        <span className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase">
          completely
        </span>
      </div>
    </div>
  );
}

// ── Annotation Panel ───────────────────────────────────────────────────────────
function AnnotationPanel({
  measure,
  onClose,
  onViewFull,
}: {
  measure: Measure;
  onClose: () => void;
  onViewFull: () => void;
}) {
  const color      = getCategoryColor(measure.category);
  const safeImpact = isFinite(+measure.personal_annual_usd) ? +measure.personal_annual_usd : 0;
  const isSavings  = safeImpact < 0;
  const isZero     = Math.round(Math.abs(safeImpact)) === 0;

  return (
    <motion.div
      key={measure.measure_id}
      initial={{ opacity: 0, x: 32, scale: 0.98 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 32, scale: 0.98 }}
      transition={{ duration: 0.35, ease: EASE }}
      className="bg-white rounded-3xl overflow-hidden"
      style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.10), 0 4px 16px rgba(0,0,0,0.05)' }}
    >
      {/* Category color accent bar */}
      <div className="h-1.5" style={{ background: color }} />

      {/* Header: category label + close */}
      <div className="px-6 pt-5 pb-0 flex items-start justify-between gap-3">
        <span
          className="text-[10px] font-bold tracking-[0.15em] uppercase"
          style={{ color }}
        >
          {measure.category.replace(/_/g, ' ')}
        </span>
        <button
          onClick={onClose}
          className="text-slate-300 hover:text-slate-500 transition-colors focus:outline-none -mt-0.5 flex-shrink-0"
          aria-label="Close panel"
        >
          <X size={15} />
        </button>
      </div>

      {/* Measure title */}
      <div className="px-6 pt-3 pb-4">
        <h2
          className="text-[15px] font-bold text-slate-900 leading-snug"
          style={{ fontFamily: 'var(--font-serif, Georgia, serif)' }}
        >
          {prettifyTitle(measure.title, measure.measure_id)}
        </h2>
      </div>

      {/* Impact badge */}
      <div className="px-6 pb-4">
        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold ${
          isZero
            ? 'bg-slate-100 text-slate-500'
            : isSavings ? 'bg-emerald-50 text-emerald-700'
            : 'bg-rose-50 text-rose-700'
        }`}>
          {!isZero && (isSavings ? '▼' : '▲')}
          <span className="font-mono">{badgeLabel(safeImpact)}</span>
          {!isZero && <span className="font-normal text-[10px] opacity-60">estimated</span>}
        </span>
      </div>

      <div className="mx-6 border-t border-slate-100" />

      {/* WHAT THIS MEANS FOR YOU */}
      <div className="px-6 py-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-[3px] h-3.5 rounded-full" style={{ background: color }} />
          <p className="text-[9px] font-bold tracking-[0.15em] uppercase text-slate-400">
            What this means for you
          </p>
        </div>
        <p className="text-sm text-slate-600 leading-relaxed">
          {measure.summary || 'Select "View Full Analysis" for a detailed plain-English breakdown of this measure.'}
        </p>
      </div>

      {/* CTA */}
      <div className="px-6 pb-6">
        <motion.button
          onClick={onViewFull}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          className="w-full py-3 rounded-2xl text-sm font-semibold text-white flex items-center justify-center gap-2"
          style={{ background: color }}
        >
          View Full Analysis
          <ArrowUpRight size={15} />
        </motion.button>
      </div>
    </motion.div>
  );
}

// ── Skeleton row ───────────────────────────────────────────────────────────────
function SkeletonRow({ index }: { index: number }) {
  return (
    <div
      className="flex items-start gap-4 px-6 py-5 animate-pulse"
      style={{ animationDelay: `${index * 0.07}s` }}
    >
      <div className="w-[26px] h-[16px] rounded-full bg-slate-100 mt-0.5 flex-shrink-0" />
      <div className="flex-1">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="h-4 w-24 bg-slate-100 rounded-full" />
          <div className="h-4 w-14 bg-slate-100 rounded-full" />
        </div>
        <div className="h-3.5 w-4/5 bg-slate-100 rounded mb-1.5" />
        <div className="h-3 w-1/2 bg-slate-50 rounded mb-3" />
        <div className="h-0.5 w-full bg-slate-100 rounded-full" />
      </div>
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      <span className="text-4xl">🗳️</span>
      <p className="text-slate-500 font-medium text-sm">No measures found</p>
      <p className="text-slate-400 text-xs">Make sure the backend is running on port 8000</p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function BallotPage() {
  const router = useRouter();
  const { profile } = useUserProfile();
  const { measures, isLoading } = useMeasures(profile);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (profile === null && typeof window !== 'undefined') {
<<<<<<< HEAD
      if (!localStorage.getItem('candid_user_profile')) router.replace('/');
=======
      const stored = localStorage.getItem('candid_user_profile');
      if (!stored) router.replace('/onboarding');
>>>>>>> bd7431915ce1160a5686391c4409aaf1014831b4
    }
  }, [profile, router]);

  const toAbs      = (v: number) => isFinite(+v) ? Math.abs(+v) : 0;
  const sorted     = (Array.isArray(measures) ? [...measures] : [])
    .sort((a, b) => toAbs(b.personal_annual_usd) - toAbs(a.personal_annual_usd));
  const maxImpact  = sorted.length ? toAbs(sorted[0].personal_annual_usd) : 1;
  const selected   = selectedId ? sorted.find(m => m.measure_id === selectedId) ?? null : null;

  function handleSelect(id: string) {
    setSelectedId(prev => prev === id ? null : id);
  }

  function handleViewFull(m: Measure) {
    sessionStorage.setItem(`measure_${m.measure_id}`, JSON.stringify({ title: m.title, text: m.summary }));
    router.push(`/ballot/${m.measure_id}`);
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Page label */}
        <div className="mb-6">
          <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-slate-400">
            Your personalized ballot
          </span>
        </div>

        {/* Main: ballot paper + annotation panel */}
        <div className="flex flex-col lg:flex-row gap-6 items-start">

          {/* ── Ballot paper ── */}
          <motion.div
            layout
            transition={{ duration: 0.4, ease: EASE }}
            className="w-full lg:flex-1 bg-white rounded-3xl overflow-hidden"
            style={{ boxShadow: '0 12px 40px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.03)' }}
          >
            <BallotHeader zip={profile?.zip_code} />

            {/* Measure rows separated by hairline dividers */}
            <div className="divide-y divide-slate-50">
              {isLoading
                ? Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} index={i} />)
                : sorted.length === 0
                ? <EmptyState />
                : sorted.map((m, i) => (
                    <MeasureCard
                      key={m.measure_id}
                      index={i}
                      maxImpact={maxImpact}
                      selected={selectedId === m.measure_id}
                      onSelect={() => handleSelect(m.measure_id)}
                      measureId={m.measure_id}
                      title={m.title}
                      summary={m.summary}
                      category={m.category}
                      estimatedImpact={m.personal_annual_usd}
                    />
                  ))
              }
            </div>
          </motion.div>

          {/* ── Annotation panel ── */}
          <AnimatePresence mode="wait">
            {selected && (
              <div className="w-full lg:w-80 xl:w-96 lg:flex-shrink-0 lg:sticky lg:top-20">
                <AnnotationPanel
                  measure={selected}
                  onClose={() => setSelectedId(null)}
                  onViewFull={() => handleViewFull(selected)}
                />
              </div>
            )}
          </AnimatePresence>

        </div>
      </div>
    </div>
  );
}
