'use client';
import { useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion, useInView, animate } from 'framer-motion';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useExplanation } from '@/hooks/useExplanation';
import { CitationSection } from '@/components/CitationSection';
import { BudgetShift } from '@/lib/types';

// ── Pop colors + their pastel tints (dual-tone bar tracks) ───────────────────
const POP: Record<string, string> = {
  environment:   '#16A34A',
  education:     '#DC2626',
  transportation:'#2563EB',
  public_safety: '#EA580C',
  housing:       '#7C3AED',
  healthcare:    '#DB2777',
  economy:       '#CA8A04',
  other:         '#475569',
};

// Desaturated pastel for bar tracks — one shade lighter than the pop
const TINT: Record<string, string> = {
  environment:   '#BBF7D0',
  education:     '#FECACA',
  transportation:'#BFDBFE',
  public_safety: '#FED7AA',
  housing:       '#EDE9FE',
  healthcare:    '#FBCFE8',
  economy:       '#FEF08A',
  other:         '#E2E8F0',
};

const CAT_ICONS: Record<string, string> = {
  education: '📚', housing: '🏠', transportation: '🚌',
  public_safety: '🛡', environment: '🌿', healthcare: '❤️',
  economy: '💼', other: '📋',
};

// ── Multi-layer "paper stack" shadow ─────────────────────────────────────────
const CARD_SHADOW =
  '0 1px 2px rgba(60,40,20,0.04), 0 6px 18px rgba(60,40,20,0.07), 0 24px 48px rgba(60,40,20,0.04)';

// Warm sand border — keeps the cream warmth
const WARM_BORDER = '1px solid rgba(180,155,120,0.24)';

// ── NaN-safe helpers ──────────────────────────────────────────────────────────
// Uses unary + to cast any string/null/undefined to number, then checks
// isFinite (which also rejects NaN and ±Infinity). Falls back through the
// delta_pct proxy, then hard-zeros if that is also unusable.
function safeAnnual(s: BudgetShift): number {
  const v = +s.personal_annual_usd;
  if (isFinite(v)) return v;
  const d = +s.delta_pct;
  if (isFinite(d)) return Math.round(d * 50);
  return 0;
}

function formatImpact(dollars: number): string {
  const safe = isFinite(+dollars) ? +dollars : 0;
  const abs  = Math.abs(safe);
  const sign = safe >= 0 ? '+' : '−';
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}k`;
  return `${sign}$${abs.toFixed(0)}`;
}

function detectCategory(measureId: string, title: string): string {
  const hay = (measureId + ' ' + title).toLowerCase();
  return Object.keys(POP).find(k => hay.includes(k.replace('_', ' '))) ?? 'other';
}

// ── Odometer — count-up animation ────────────────────────────────────────────
function OdometerValue({
  value,
  delay = 0,
  duration = 1.1,
}: {
  value: number;
  delay?: number;
  duration?: number;
}) {
  const ref    = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView || !ref.current) return;
    const node  = ref.current;
    const safe  = isFinite(+value) ? +value : 0; // guard before animate()
    const abs   = Math.abs(safe);
    const sign  = safe >= 0 ? '+' : '−';
    const ctrl = animate(0, abs, {
      duration,
      delay,
      ease: 'easeOut',
      onUpdate(v) {
        node.textContent = abs >= 1000
          ? `${sign}$${(v / 1000).toFixed(1)}k`
          : `${sign}$${Math.round(v)}`;
      },
    });
    return () => ctrl.stop();
  }, [inView, value, delay, duration]);

  const safe = isFinite(+value) ? +value : 0;
  return <span ref={ref}>{formatImpact(safe)}</span>;
}

// ── Budget bar row — spring fill + dual-tone track ────────────────────────────
function BudgetBar({
  shift,
  maxAbs,
  index,
}: {
  shift: BudgetShift & { _annual: number };
  maxAbs: number;
  index: number;
}) {
  const color  = POP[shift.category]  ?? POP.other;
  const tint   = TINT[shift.category] ?? TINT.other;
  const pct    = Math.round((Math.abs(shift._annual) / maxAbs) * 100);
  const isPos  = shift._annual >= 0;
  const rowDelay = 0.08 + index * 0.07;

  return (
    <motion.div
      className="flex items-center gap-3"
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: rowDelay, duration: 0.35, ease: 'easeOut' }}
    >
      {/* Category label */}
      <span style={{
        fontSize: 12, fontWeight: 500, color: '#78716C',
        width: 104, flexShrink: 0, textTransform: 'capitalize',
        letterSpacing: '0.01em',
      }}>
        {shift.category.replace(/_/g, ' ')}
      </span>

      {/* Dual-tone track — fills the remaining space */}
      <div
        className="flex-1 rounded-full overflow-hidden"
        style={{ height: 6, background: isPos ? tint : `${color}18` }}
      >
        <motion.div
          style={{
            height: '100%', borderRadius: 99,
            background: isPos
              ? color
              : `repeating-linear-gradient(45deg,${color},${color} 2px,transparent 2px,transparent 5px)`,
          }}
          initial={{ width: '0%' }}
          animate={{ width: `${pct}%` }}
          transition={{
            type: 'spring',
            stiffness: 52,
            damping: 18,
            delay: rowDelay + 0.05,
          }}
        />
      </div>

      {/* Value — right-aligned, colored to match bar */}
      <span style={{
        fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
        width: 60, textAlign: 'right', flexShrink: 0,
        color: isPos ? '#15803D' : '#B91C1C',
      }}>
        <OdometerValue value={shift._annual} delay={rowDelay + 0.05} duration={0.9} />
        /yr
      </span>
    </motion.div>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────
function Skeleton() {
  const warm = 'rgba(180,155,120,0.1)';
  return (
    <div className="flex flex-col gap-5 animate-pulse">
      {[18, 36, 230, 130, 190].map((h, i) => (
        <div key={i} style={{ height: h, borderRadius: 16, background: warm }} />
      ))}
    </div>
  );
}

// ── Confidence seal ───────────────────────────────────────────────────────────
function ConfidenceSeal({ score, catColor }: { score: number; catColor: string }) {
  const pct  = Math.round(score * 100);
  const circ = 163.4;
  const arc  = (score * circ).toFixed(1);
  return (
    <div
      className="absolute top-5 right-5 flex items-center justify-center"
      style={{ width: 68, height: 68 }}
      title={`${pct}% confidence`}
    >
      <svg viewBox="0 0 72 72" className="absolute inset-0 w-full h-full" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="36" cy="36" r="30" fill="white" />
        <circle cx="36" cy="36" r="34" fill="none"
          stroke={catColor} strokeWidth="1" strokeDasharray="3.5 2.5" opacity="0.4" />
        <circle cx="36" cy="36" r="26" fill="none"
          stroke={catColor} strokeWidth="3" opacity="0.12" strokeDasharray={`${circ} 0`} />
        <circle cx="36" cy="36" r="26" fill="none"
          stroke={catColor} strokeWidth="3" strokeLinecap="round"
          strokeDasharray={`${arc} ${circ}`} />
      </svg>
      <div className="relative flex flex-col items-center justify-center">
        <span style={{ fontFamily: 'Georgia, serif', fontSize: 16, fontWeight: 700, color: '#1C1917', lineHeight: 1 }}>
          {pct}%
        </span>
        <span style={{ fontSize: 7, letterSpacing: '0.13em', textTransform: 'uppercase', color: catColor, fontWeight: 700, lineHeight: 1, marginTop: 3 }}>
          verified
        </span>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function MeasurePage() {
  const router    = useRouter();
  const params    = useParams();
  const measureId = params.measureId as string;
  const { profile } = useUserProfile();

  const stored =
    typeof window !== 'undefined'
      ? JSON.parse(sessionStorage.getItem(`measure_${measureId}`) ?? '{}')
      : {};
  const measureTitle: string = stored.title ?? measureId;
  const measureText: string  = stored.text  ?? '';

  const { data, isLoading, error } = useExplanation(measureId, measureText, profile, measureTitle);

  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem('candid_user_profile')) {
      router.replace('/');
    }
  }, [router]);

  const safeShifts  = (data?.budget_shifts ?? []).map(s => ({ ...s, _annual: safeAnnual(s) }));
  const netAnnual   = safeShifts.reduce((sum, s) => sum + s._annual, 0);
  const netPositive = netAnnual >= 0;
  const category    = data ? detectCategory(measureId, data.measure_title) : 'other';
  const catColor    = POP[category] ?? POP.other;
  const maxAbs      = Math.max(...safeShifts.map(s => Math.abs(s._annual)), 1);

  return (
    // Deeper cream — makes the white cards visually "lift"
    <div style={{ background: '#F4F1EA', minHeight: '100vh' }}>

      {/* Ambient glow — warm amber tones against the deeper cream */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }} aria-hidden>
        <div style={{
          position: 'absolute', width: 700, height: 700, borderRadius: '50%',
          background: `radial-gradient(circle, ${catColor}0D 0%, transparent 65%)`,
          top: -160, right: -160,
        }} />
        <div style={{
          position: 'absolute', width: 520, height: 520, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(202,138,4,0.07) 0%, transparent 68%)',
          bottom: 60, left: -100,
        }} />
      </div>

      <div className="relative max-w-3xl mx-auto px-4 py-8" style={{ zIndex: 1 }}>

        {/* ── Top bar: Back button + ZIP toggle ────────────────────────────── */}
        <div className="flex items-center justify-between mb-8">
          {/* Back — styled as a real button */}
          <motion.button
            onClick={() => router.back()}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            className="flex items-center gap-1.5"
            style={{
              fontSize: 12, fontWeight: 600, color: '#6B6560',
              padding: '7px 14px 7px 10px',
              borderRadius: 99,
              background: 'rgba(180,155,120,0.09)',
              border: WARM_BORDER,
              cursor: 'pointer',
              transition: 'background 0.15s, color 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(180,155,120,0.18)';
              e.currentTarget.style.color = '#1C1917';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(180,155,120,0.09)';
              e.currentTarget.style.color = '#6B6560';
            }}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back to ballot
          </motion.button>

          {/* ZIP toggle — looks like an interactive dropdown chip */}
          {profile?.zip_code && (
            <button
              onClick={() => router.push('/onboarding')}
              className="inline-flex items-center gap-1"
              style={{
                fontSize: 11, fontWeight: 600, color: '#78716C',
                background: 'rgba(180,155,120,0.09)',
                border: WARM_BORDER,
                borderRadius: 99,
                padding: '5px 9px 5px 7px',
                cursor: 'pointer',
                transition: 'background 0.15s, color 0.15s',
                letterSpacing: '0.01em',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(180,155,120,0.18)';
                (e.currentTarget as HTMLButtonElement).style.color = '#1C1917';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(180,155,120,0.09)';
                (e.currentTarget as HTMLButtonElement).style.color = '#78716C';
              }}
            >
              <svg className="w-3 h-3 mr-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {profile.zip_code}
              <svg className="w-2.5 h-2.5 ml-0.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          )}
        </div>

        {isLoading && <Skeleton />}

        {/* Error */}
        {!isLoading && !data && (
          <div style={{
            background: '#FEF2F2', borderRadius: 16,
            border: '1px solid #FECACA', padding: '20px 24px',
          }}>
            <p style={{ fontFamily: 'Georgia, serif', fontSize: 15, fontWeight: 700, color: '#DC2626', marginBottom: 4 }}>
              Could not load explanation
            </p>
            <p style={{ fontSize: 12, color: '#EF4444' }}>
              {error?.message ?? 'Backend may not be running on port 8000'}
            </p>
          </div>
        )}

        {data && (
          <div className="flex flex-col gap-7">

            {/* ── Title — enters first ───────────────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
            >
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full"
                  style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: '0.09em',
                    textTransform: 'uppercase',
                    backgroundColor: `${catColor}16`, color: catColor,
                  }}
                >
                  <span>{CAT_ICONS[category]}</span>
                  {category.replace(/_/g, ' ')}
                </span>
              </div>

              <h1 style={{
                fontFamily: 'Georgia, "Times New Roman", serif',
                fontSize: 27, fontWeight: 700, lineHeight: 1.22,
                letterSpacing: '-0.015em', color: '#1C1917',
              }}>
                {data.measure_title}
              </h1>
            </motion.div>

            {/* ── Hero card — slides up 50ms after title ─────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05, duration: 0.45, ease: 'easeOut' }}
              style={{
                borderRadius: 24, overflow: 'hidden',
                border: WARM_BORDER,
                boxShadow: CARD_SHADOW,
              }}
            >
              <div className="grid grid-cols-1 md:grid-cols-2">

                {/* Official Summary */}
                <div
                  className="p-7 border-b md:border-b-0 md:border-r"
                  style={{ background: '#FFFFFF', borderColor: 'rgba(180,155,120,0.2)' }}
                >
                  <div className="flex items-center gap-2.5 mb-4">
                    <div style={{ width: 3, height: 16, borderRadius: 99, background: '#2563EB', flexShrink: 0 }} />
                    <p style={{
                      fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
                      textTransform: 'uppercase', color: '#2563EB',
                    }}>
                      Official Summary
                    </p>
                  </div>
                  <p style={{ fontSize: 14, color: '#3C3530', lineHeight: 1.78 }}>
                    {data.plain_english_summary}
                  </p>
                </div>

                {/* Personal Impact */}
                <div className="p-7 relative" style={{ background: '#FAFAF9' }}>
                  {data.confidence_score != null && (
                    <ConfidenceSeal score={data.confidence_score} catColor={catColor} />
                  )}
                  <div className="flex items-center gap-2.5 mb-4">
                    <div style={{
                      width: 3, height: 16, borderRadius: 99, flexShrink: 0,
                      background: netPositive ? '#16A34A' : '#DC2626',
                    }} />
                    <p style={{
                      fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      color: netPositive ? '#15803D' : '#B91C1C',
                    }}>
                      What This Means For You
                    </p>
                  </div>
                  <p style={{ fontSize: 14, color: '#3C3530', lineHeight: 1.78, paddingRight: 80 }}>
                    {data.personal_impact_statement}
                  </p>
                  {data.citations?.length ? (
                    <p style={{ fontSize: 11, color: '#A8A09A', marginTop: 16 }}>
                      Based on {data.citations.length} cited source{data.citations.length !== 1 ? 's' : ''}
                    </p>
                  ) : null}
                </div>
              </div>
            </motion.div>

            {/* ── Budget impact — slides up 100ms after hero ─────────────────── */}
            {safeShifts.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.13, duration: 0.45, ease: 'easeOut' }}
                style={{
                  borderRadius: 20,
                  border: WARM_BORDER,
                  background: '#FFFFFF',
                  padding: '26px 28px',
                  boxShadow: CARD_SHADOW,
                }}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-6">
                  <p style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
                    textTransform: 'uppercase', color: '#A8A09A',
                    paddingTop: 4,
                  }}>
                    Estimated Budget Impact
                  </p>

                  {/* Total — serif, larger, count-up */}
                  <div style={{ textAlign: 'right' }}>
                    <div style={{
                      fontFamily: 'Georgia, "Times New Roman", serif',
                      fontSize: 22, fontWeight: 700, lineHeight: 1,
                      fontVariantNumeric: 'tabular-nums',
                      color: netPositive ? '#15803D' : '#B91C1C',
                    }}>
                      <OdometerValue value={netAnnual} delay={0.18} duration={0.65} />/yr
                    </div>
                    <div style={{
                      fontSize: 10, color: '#A8A09A', marginTop: 4,
                      letterSpacing: '0.07em', textTransform: 'uppercase',
                    }}>
                      est. annual impact
                    </div>
                  </div>
                </div>

                {/* Staggered bars with spring physics */}
                <div className="flex flex-col gap-3">
                  {safeShifts.map((shift, i) => (
                    <BudgetBar key={shift.category} shift={shift} maxAbs={maxAbs} index={i} />
                  ))}
                </div>

                <p style={{
                  fontSize: 11, color: '#B8B0A8', marginTop: 20, lineHeight: 1.65,
                  borderTop: '1px solid rgba(180,155,120,0.14)', paddingTop: 16,
                }}>
                  Estimates calculated for income under $50k in ZIP {profile?.zip_code ?? '—'}.
                  Figures are projections, not guarantees.
                </p>
              </motion.div>
            )}

            {/* ── Citations — slides up last ─────────────────────────────────── */}
            {data.citations && data.citations.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.4, ease: 'easeOut' }}
              >
                <CitationSection citations={data.citations} catColor={catColor} />
              </motion.div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}
