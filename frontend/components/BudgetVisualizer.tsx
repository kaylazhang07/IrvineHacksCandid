'use client';
import { useState } from 'react';
import { PieChart, Pie, Cell } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw, Zap } from 'lucide-react';
import { CATEGORY_COLORS } from '@/lib/types';
import { getBudgetForState } from '@/lib/budget-data';
import { useUserProfile } from '@/hooks/useUserProfile';
import { zipToStateAbbr } from '@/lib/utils';

const WARM_BORDER = '1px solid rgba(180,155,120,0.22)';
const CREAM = '#FDFCF8';
const CARD_SHADOW = '0 4px 24px rgba(60,40,20,0.08), 0 1px 4px rgba(60,40,20,0.04)';

interface Slice { id: string; label: string; baseAmount: number; color: string; pct_change: number }


const RIPPLE: Record<string, { up: string; down: string; flat: string }> = {
  public_safety: {
    up:   'More officers on patrol. 911 response times drop ~18 min. Property crime falls ~8%.',
    down: 'Fewer officers per district. Response times rise. Incidents climb ~6%.',
    flat: 'Public safety staffing holds at current levels.',
  },
  education: {
    up:   'Smaller classes. Teacher raises. After-school programs expand to 5 days/week.',
    down: 'Classes grow to 34+ students. Programs for 12,000 kids face cuts.',
    flat: 'Schools funded at current levels, no major changes.',
  },
  infrastructure: {
    up:   'Potholes patched faster. Bus delays drop ~15%. Broadband expands to more blocks.',
    down: 'Road repairs slow. Bus delays worsen ~8 min avg. Broadband expansion paused.',
    flat: 'Road and transit funding stays unchanged.',
  },
  healthcare: {
    up:   'Free clinic hours expand. Mental health slots triple. ER wait times drop.',
    down: 'Clinics cut evening hours. Uninsured wait 6+ weeks. Sliding-scale programs suspended.',
    flat: 'Clinic hours and services stay the same.',
  },
  housing: {
    up:   '500 new affordable units added. Rent stabilization. Eviction prevention funds expand.',
    down: 'Rental prices climb ~$47/mo. Affordable unit waitlist grows 800+ people.',
    flat: 'Housing programs funded at current levels.',
  },
};

type Party = 'Baseline' | 'Democrat' | 'Republican';
interface Candidate {
  id: string; name: string; party: Party;
  tagline: string; narrative: string;
  deltas: Record<string, number>;
}
const CANDIDATES: Candidate[] = [
  {
    id: 'baseline', name: 'This Year', party: 'Baseline',
    tagline: "what's actually being spent",
    narrative: "This is the current city budget, no spin. Pick a candidate to see how their plan moves the numbers around and what those shifts actually mean for people.",
    deltas: {},
  },
  {
    id: 'gallagher', name: 'Pat Gallagher', party: 'Democrat',
    tagline: 'neighborhoods over everything',
    narrative: "Gallagher wants to put more money into schools and housing, betting that long-term investment in people pays off more than adding cops to the street. Education goes up 8%, affordable housing up 12%. He trims a bit from infrastructure to make the math work.",
    deltas: { public_safety: +2, education: +8, infrastructure: -3, healthcare: +5, housing: +12 },
  },
  {
    id: 'nutter', name: 'Ed Nutter', party: 'Republican',
    tagline: 'safety first, cut the rest',
    narrative: "Nutter thinks the city needs to get its act together on safety and roads before anything else. Public safety goes up 7%, infrastructure up 8%. Healthcare and education take cuts to keep it balanced. His argument is you fix the foundation before you redecorate.",
    deltas: { public_safety: +7, education: -3, infrastructure: +8, healthcare: -5, housing: -4 },
  },
];
const PARTY_COLORS: Record<Party, string> = {
  Baseline: '#78716C', Democrat: '#2563EB', Republican: '#DC2626',
};

const getAmount = (s: Slice, c: Candidate) => s.baseAmount * (1 + (c.deltas[s.id] ?? 0) / 100);
const fmtM = (m: number) => `$${m.toFixed(1)}M`;

export default function BudgetVisualizer() {
  const { profile } = useUserProfile();
  const stateAbbr = profile?.zip_code ? zipToStateAbbr(profile.zip_code) : 'CA';
  const SLICES = getBudgetForState(stateAbbr).map(d => ({ ...d, baseAmount: d.amount, pct_change: d.pct_change }));
  const [selectedId, setSelectedId]     = useState('baseline');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [clickedSlice, setClickedSlice] = useState<string | null>(null);

  const candidate  = CANDIDATES.find(c => c.id === selectedId)!;
  const partyColor = PARTY_COLORS[candidate.party];
  const chartData  = SLICES.map(s => ({ ...s, amount: s.baseAmount, delta: s.pct_change }));
  const total      = chartData.reduce((s, d) => s + d.amount, 0);
  const hovered    = hoveredIndex !== null ? chartData[hoveredIndex] : null;

  const rippleSlice = clickedSlice ? chartData.find(d => d.id === clickedSlice) : null;
  const rippleBank  = clickedSlice ? RIPPLE[clickedSlice] : null;
  const rippleText  = rippleBank && rippleSlice
    ? (rippleSlice.delta > 0 ? rippleBank.up : rippleSlice.delta < 0 ? rippleBank.down : rippleBank.flat)
    : null;

  const toggleSlice = (id: string) => setClickedSlice(p => p === id ? null : id);

  return (
    <div style={{ background: '#F9F7F2', minHeight: '100vh', padding: '32px 16px 80px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>

        {/* Header */}
        <div className="mb-8">
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#A8A09A', marginBottom: 6 }}>
            Candid · Budget
          </p>
          <h1 style={{ fontSize: 'clamp(24px, 3.5vw, 38px)', fontWeight: 800, color: '#1C1917', lineHeight: 1, letterSpacing: '-0.025em', fontFamily: 'Georgia, serif', marginBottom: 8 }}>
            {stateAbbr} Budget 2023
          </h1>
          <p style={{ fontSize: 13, color: '#78716C', lineHeight: 1.65 }}>
            Real Census Bureau data. Click any category to see what the numbers mean for people.
          </p>
        </div>

        {/* Two-column dashboard */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">

          {/* ── LEFT SIDEBAR: Candidate toggles (4 cols) ── */}
          <div className="lg:col-span-4 flex flex-row lg:flex-col gap-3">
            <p className="hidden lg:block" style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#A8A09A', marginBottom: 4 }}>
              Candidates
            </p>

            {CANDIDATES.map(c => {
              const active = c.id === selectedId;
              const pc = PARTY_COLORS[c.party];
              return (
                <motion.button key={c.id}
                  onClick={() => { setSelectedId(c.id); setClickedSlice(null); }}
                  whileTap={{ scale: 0.98 }}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                    padding: '14px 16px', borderRadius: 16, width: '100%', textAlign: 'left',
                    background: active ? '#fff' : CREAM,
                    border: active ? `1.5px solid ${pc}` : WARM_BORDER,
                    boxShadow: active
                      ? `0 0 0 3px ${pc}18, 0 4px 16px ${pc}22, ${CARD_SHADOW}`
                      : CARD_SHADOW,
                    cursor: 'pointer',
                    transition: 'border-color 0.2s, box-shadow 0.2s, background 0.2s',
                  }}
                >
                  <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: active ? pc : '#A8A09A', marginBottom: 3 }}>
                    {c.party === 'Baseline' ? 'Current' : c.party}
                  </p>
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#1C1917', lineHeight: 1.2, marginBottom: 3 }}>{c.name}</p>
                  <p style={{ fontSize: 11, color: '#78716C' }}>{c.tagline}</p>
                </motion.button>
              );
            })}

            <AnimatePresence>
              {selectedId !== 'baseline' && (
                <motion.button
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  onClick={() => { setSelectedId('baseline'); setClickedSlice(null); }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 16px', borderRadius: 99, background: 'transparent', border: WARM_BORDER, cursor: 'pointer', fontSize: 11.5, fontWeight: 600, color: '#78716C', width: '100%' }}
                >
                  <RotateCcw size={12} /> Start over
                </motion.button>
              )}
            </AnimatePresence>

            {/* Narrative — lives in sidebar on desktop */}
            <AnimatePresence mode="wait">
              <motion.div key={selectedId}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }}
                className="hidden lg:block"
                style={{ background: CREAM, border: WARM_BORDER, borderLeft: `3px solid ${partyColor}`, borderRadius: 16, boxShadow: CARD_SHADOW, padding: '18px 16px', marginTop: 4 }}>
                <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: partyColor, marginBottom: 6 }}>
                  In Their Words
                </p>
                <p style={{ fontSize: 12.5, color: '#44403C', lineHeight: 1.72 }}>{candidate.narrative}</p>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* ── RIGHT CONTENT (8 cols) ── */}
          <div className="lg:col-span-8 flex flex-col gap-4">

            {/* Top row: donut + ripple */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {/* Donut */}
              <div style={{ background: CREAM, border: WARM_BORDER, borderRadius: 20, boxShadow: CARD_SHADOW, padding: '22px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: 360 }}>
                <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#A8A09A', marginBottom: 16, alignSelf: 'flex-start' }}>
                  The Split
                </p>
                <div style={{ position: 'relative', width: 240, height: 240, flexShrink: 0 }}>
                  <PieChart width={240} height={240}>
                    <Pie data={chartData} cx={120} cy={120} innerRadius={70} outerRadius={102} paddingAngle={2} dataKey="amount"
                      isAnimationActive animationDuration={650} animationEasing="ease-out"
                      onMouseEnter={(_, i) => setHoveredIndex(i)} onMouseLeave={() => setHoveredIndex(null)}
                      onClick={(d: { id: string }) => toggleSlice(d.id)}
                    >
                      {chartData.map((d, i) => (
                        <Cell key={d.id} fill={d.color}
                          opacity={hoveredIndex === null || hoveredIndex === i ? 0.88 : 0.28}
                          style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
                        />
                      ))}
                    </Pie>
                  </PieChart>
                  <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center', pointerEvents: 'none', width: 124 }}>
                    <AnimatePresence mode="wait">
                      <motion.div key={`${hoveredIndex}-${selectedId}`} initial={{ opacity: 0, scale: 0.88 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.88 }} transition={{ duration: 0.15 }}>
                        {hovered && <p style={{ fontSize: 8.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: hovered.color, marginBottom: 3 }}>{hovered.label}</p>}
                        <p style={{ fontSize: hovered ? 22 : 18, fontWeight: 800, color: '#1C1917', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                          {hovered ? fmtM(hovered.amount) : fmtM(total)}
                        </p>
                        <p style={{ fontSize: 10.5, color: '#A8A09A', marginTop: 3 }}>
                          {hovered ? `${((hovered.amount / total) * 100).toFixed(1)}%` : 'city budget'}
                        </p>
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </div>
                <AnimatePresence mode="wait">
                  <motion.p key={selectedId} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18 }}
                    style={{ fontSize: 11, color: '#A8A09A', marginTop: 12, textAlign: 'center' }}>
                    {selectedId === 'baseline' ? 'click any slice to see the ripple' : `${candidate.name} vs. current`}
                  </motion.p>
                </AnimatePresence>
              </div>

              {/* Ripple */}
              <div style={{ background: CREAM, border: WARM_BORDER, borderRadius: 20, boxShadow: CARD_SHADOW, padding: '22px 20px', display: 'flex', flexDirection: 'column', minHeight: 360 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
                  <Zap size={11} color="#C9706C" />
                  <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#A8A09A' }}>
                    Ripple Effect
                  </p>
                </div>
                <AnimatePresence mode="wait">
                  {rippleText && rippleSlice ? (
                    <motion.div key={`${clickedSlice}-${selectedId}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.22 }} style={{ flex: 1 }}>
                      {/* Sub-card header */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: `${rippleSlice.color}10`, borderRadius: 12, border: `1px solid ${rippleSlice.color}26`, marginBottom: 14 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: rippleSlice.color, flexShrink: 0 }} />
                        <span style={{ fontSize: 12, fontWeight: 700, color: rippleSlice.color, flex: 1 }}>{rippleSlice.label}</span>
                        {rippleSlice.delta !== 0 && (
                          <span style={{ fontSize: 10.5, fontWeight: 800, padding: '2px 7px', borderRadius: 99, background: rippleSlice.delta > 0 ? 'rgba(21,128,61,0.10)' : 'rgba(185,28,28,0.08)', color: rippleSlice.delta > 0 ? '#15803D' : '#B91C1C', border: `1px solid ${rippleSlice.delta > 0 ? 'rgba(21,128,61,0.22)' : 'rgba(185,28,28,0.18)'}` }}>
                            {rippleSlice.delta > 0 ? '+' : ''}{rippleSlice.delta}%
                          </span>
                        )}
                      </div>
                      {/* Consequence sub-card */}
                      <div style={{ padding: '14px 16px', background: '#fff', borderRadius: 12, border: WARM_BORDER, boxShadow: '0 2px 8px rgba(60,40,20,0.04)' }}>
                        <div style={{ display: 'flex', gap: 10 }}>
                          <div style={{ width: 2, background: `linear-gradient(to bottom, ${rippleSlice.color}cc, transparent)`, borderRadius: 99, flexShrink: 0, minHeight: 52 }} />
                          <p style={{ fontSize: 13, color: '#44403C', lineHeight: 1.72, fontWeight: 500 }}>{rippleText}</p>
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, textAlign: 'center', padding: '20px 0' }}>
                      <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(180,155,120,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Zap size={16} color="#A8A09A" />
                      </div>
                      <p style={{ fontSize: 12, color: '#A8A09A', lineHeight: 1.65, maxWidth: 200 }}>
                        Click any slice or row to see what that shift means for people.
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Breakdown */}
            <div style={{ background: CREAM, border: WARM_BORDER, borderRadius: 20, boxShadow: CARD_SHADOW, padding: '22px 22px' }}>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#A8A09A', marginBottom: 14 }}>
                Breakdown
              </p>
              {chartData.map((d, i) => {
                const pct     = (d.amount / total) * 100;
                const isHov   = hoveredIndex === i;
                const isClick = clickedSlice === d.id;
                return (
                  <motion.div key={d.id}
                    onHoverStart={() => setHoveredIndex(i)} onHoverEnd={() => setHoveredIndex(null)}
                    onClick={() => toggleSlice(d.id)}
                    style={{ padding: '10px 8px', borderBottom: i < chartData.length - 1 ? '1px solid rgba(180,155,120,0.12)' : 'none', cursor: 'pointer', background: isClick ? `${d.color}0d` : 'transparent', borderRadius: 8, transition: 'background 0.2s' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ width: 9, height: 9, borderRadius: '50%', background: d.color, flexShrink: 0, opacity: isHov || isClick ? 1 : 0.65, boxShadow: isHov || isClick ? `0 0 0 3px ${d.color}28` : 'none', transition: 'box-shadow 0.2s' }} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: isHov || isClick ? '#1C1917' : '#57534E', transition: 'color 0.2s' }}>{d.label}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#1C1917', fontVariantNumeric: 'tabular-nums' }}>{fmtM(d.amount)}</span>
                        <AnimatePresence>
                          {d.delta !== 0 && (
                            <motion.span initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.7, opacity: 0 }}
                              style={{ fontSize: 10.5, fontWeight: 800, padding: '3px 8px', borderRadius: 99, background: d.delta > 0 ? 'rgba(21,128,61,0.10)' : 'rgba(185,28,28,0.08)', color: d.delta > 0 ? '#15803D' : '#B91C1C', border: `1px solid ${d.delta > 0 ? 'rgba(21,128,61,0.22)' : 'rgba(185,28,28,0.18)'}` }}>
                              {d.delta > 0 ? '+' : ''}{d.delta.toFixed(1)}%
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                    <div style={{ marginTop: 8, height: 3, background: 'rgba(180,155,120,0.14)', borderRadius: 99, overflow: 'hidden' }}>
                      <motion.div animate={{ width: `${pct}%` }} transition={{ duration: 0.55 }} style={{ height: '100%', background: d.color, borderRadius: 99, opacity: 0.75 }} />
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Narrative — mobile only (desktop version is in sidebar) */}
            <AnimatePresence mode="wait">
              <motion.div key={selectedId}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }}
                className="block lg:hidden"
                style={{ background: CREAM, border: WARM_BORDER, borderLeft: `3px solid ${partyColor}`, borderRadius: 16, boxShadow: CARD_SHADOW, padding: '18px 16px' }}>
                <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: partyColor, marginBottom: 6 }}>
                  In Their Words
                </p>
                <p style={{ fontSize: 12.5, color: '#44403C', lineHeight: 1.72 }}>{candidate.narrative}</p>
              </motion.div>
            </AnimatePresence>

          </div>
        </div>
      </div>
    </div>
  );
}
