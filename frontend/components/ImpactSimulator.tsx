'use client';
import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Syne } from 'next/font/google';
import { Newsreader } from 'next/font/google';
import { useUserProfile } from '@/hooks/useUserProfile';

const syne      = Syne({ subsets: ['latin'], weight: ['800'], variable: '--font-syne' });
const newsreader = Newsreader({ subsets: ['latin'], weight: ['400'], style: ['italic'], variable: '--font-newsreader' });

const TOTAL = 1050; // $M
const MIN   = 10;   // floor per category

// ── Types ────────────────────────────────────────────────────────────────────

type Persona = 'renter' | 'owner' | 'student';

interface Cat {
  id: string;
  label: string;
  color: string;
  tint: string;
  glow: string;
  critical: number;
  baseConf: number;
}

// ── SVG Icons — SF Symbols-style, stroke-based ────────────────────────────────

function IconShield({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 1.5L2.5 4v4c0 2.8 2.3 5.1 5.5 6 3.2-.9 5.5-3.2 5.5-6V4L8 1.5z" />
    </svg>
  );
}

function IconCross({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round">
      <path d="M8 3.5v9M3.5 8h9" />
    </svg>
  );
}

function IconCap({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1.5 6.5L8 3.5l6.5 3-6.5 3-6.5-3z" />
      <path d="M4.5 8.2v3c0 1.2 1.6 2.3 3.5 2.3s3.5-1.1 3.5-2.3v-3" />
      <line x1="14.5" y1="6.5" x2="14.5" y2="10" />
    </svg>
  );
}

function IconBus({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3.5" width="12" height="8" rx="1.5" />
      <line x1="2" y1="7.5" x2="14" y2="7.5" />
      <line x1="8" y1="3.5" x2="8" y2="7.5" />
      <circle cx="4.5" cy="12.5" r="1" fill={color} stroke="none" />
      <circle cx="11.5" cy="12.5" r="1" fill={color} stroke="none" />
    </svg>
  );
}

function IconHouse({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1.5 7.5L8 2l6.5 5.5" />
      <path d="M3 6.5V13.5h3.5v-3.5h3v3.5H13V6.5" />
    </svg>
  );
}

const CAT_ICON: Record<string, (color: string) => React.ReactNode> = {
  public_safety:  color => <IconShield color={color} />,
  healthcare:     color => <IconCross  color={color} />,
  education:      color => <IconCap    color={color} />,
  infrastructure: color => <IconBus    color={color} />,
  housing:        color => <IconHouse  color={color} />,
};

// ── ZIP → State lookup ────────────────────────────────────────────────────────

const ZIP_TO_STATE: Record<string, string> = {
  '94601': 'California', '94102': 'California', '94105': 'California',
  '90001': 'California', '90210': 'California', '92617': 'California',
  '92697': 'California', '10001': 'New York',    '60601': 'Illinois',
  '77001': 'Texas',      '85001': 'Arizona',     '19101': 'Pennsylvania',
  '98101': 'Washington', '30301': 'Georgia',     '78201': 'Texas',
};

// ── Constants ─────────────────────────────────────────────────────────────────

const CATS: Cat[] = [
  { id: 'public_safety',  label: 'Public Safety',  color: '#B87560', tint: 'rgba(184,117,96,0.10)',  glow: 'rgba(184,117,96,0.28)',  critical: 150, baseConf: 0.87 },
  { id: 'healthcare',     label: 'Healthcare',     color: '#B5789C', tint: 'rgba(181,120,156,0.10)', glow: 'rgba(181,120,156,0.28)', critical: 120, baseConf: 0.82 },
  { id: 'education',      label: 'Education',      color: '#C47B76', tint: 'rgba(196,123,118,0.10)', glow: 'rgba(196,123,118,0.28)', critical: 150, baseConf: 0.91 },
  { id: 'infrastructure', label: 'Infrastructure', color: '#6A9EB8', tint: 'rgba(106,158,184,0.10)', glow: 'rgba(106,158,184,0.28)', critical: 100, baseConf: 0.85 },
  { id: 'housing',        label: 'Housing',        color: '#8B7EC8', tint: 'rgba(139,126,200,0.10)', glow: 'rgba(139,126,200,0.28)', critical: 70,  baseConf: 0.88 },
];

const BASE: Record<string, number> = {
  public_safety: 250, healthcare: 210, education: 280, infrastructure: 190, housing: 120,
};

const PERSONA_META: Record<Persona, { label: string }> = {
  renter:  { label: 'Renter'  },
  owner:   { label: 'Owner'   },
  student: { label: 'Student' },
};

// Plain-English messages keyed by [category][direction][persona]
const MSGS: Record<string, Record<'up' | 'down', Record<Persona, [string, string]>>> = {
  public_safety: {
    up: {
      renter:  ['Night patrols expand to your block — emergency response time drops by 18 min.', 'Beat cops return to your street; crisis teams handle 40% more calls without escalation.'],
      owner:   ['Property crime in your ZIP drops 8% — home insurance premiums may fall ~$15/yr.', 'Patrol density doubles near your address; burglary risk drops by 12%.'],
      student: ['Crisis counselors deploy to 12 schools — mental health referrals climb 30%.', 'Campus emergency response upgraded; average incident resolution time falls under 4 min.'],
    },
    down: {
      renter:  ['Night patrols cut in half — response times in your neighborhood rise by 14 min.', 'Fewer officers on your block; property incidents climb 6% in comparable areas.'],
      owner:   ['Burglary risk in your ZIP climbs 6% — home insurance carriers may raise rates.', 'Reduced patrol frequency near your address; alarm system adoption now strongly recommended.'],
      student: ['School resource officers cut 40% — campus safety incidents may rise.', 'After-hours security thinned; escort service suspended between 10 pm and 2 am.'],
    },
  },
  healthcare: {
    up: {
      renter:  ['The free clinic near you expands to evening hours — no-cost visits up to 3×/yr.', 'Mobile health units add 6 stops in your ZIP, covering dental and mental health.'],
      owner:   ['Community wellness programs reduce ER use 22% — your average wait time shortens.', 'Preventive care expansion keeps acute care available for true emergencies near you.'],
      student: ['On-campus mental health slots triple — counselor-to-student ratio hits 1:150.', 'Student health center adds psychiatry and nutrition services; no referral needed.'],
    },
    down: {
      renter:  ['Your nearest clinic cuts evening hours — uninsured residents wait 6+ weeks.', 'Sliding-scale prescription program suspended; avg out-of-pocket rises $34/mo.'],
      owner:   ['ER overcrowding rises 18% — your average wait time increases by 40 min.', 'Specialist referral backlogs grow to 11 weeks in your county.'],
      student: ['Campus mental health waitlists stretch to 3 months — crisis resources shrink.', 'Health center cuts to core hours only; after-hours care now requires an ER visit.'],
    },
  },
  education: {
    up: {
      renter:  ['Teachers in your district get a 12% raise — turnover drops; familiar faces stay.', 'After-school programs expand to 5 days per week in your neighborhood schools.'],
      owner:   ['Local school test scores projected to climb 8 pts over 3 years.', 'Tech upgrades in 42 schools may lift your property\'s school-quality rating from 7 → 8.'],
      student: ['Class sizes drop by 4 students — your teacher has 20% more time per student.', 'New lab equipment, updated textbooks, and tutoring stipends arrive this semester.'],
    },
    down: {
      renter:  ['District layoffs begin — class sizes swell to 34 in your neighborhood schools.', 'After-school programs serving 12k students in your district face elimination.'],
      owner:   ['Property values near under-resourced schools historically dip 3–5%.', 'School rating in your zone may drop — buyer demand for the area softens.'],
      student: ['Your class grows by 4 students — electives and AP courses face cuts first.', 'Tutoring programs and counseling staff reduced 35% at your institution.'],
    },
  },
  infrastructure: {
    up: {
      renter:  ['The 3 potholes on your commute get patched — bus reliability improves 15%.', 'Broadband expansion reaches your block; gigabit internet at lower cost is incoming.'],
      owner:   ['Road maintenance near your home extends pavement life 12 yrs, saving ~$800/yr in vehicle wear.', 'Stormwater upgrades near your address may reduce flood-risk insurance costs.'],
      student: ['Bike lanes on campus routes expand — your 20-min walk becomes a safe 10-min ride.', 'Campus Wi-Fi dead zones eliminated; library hours extended with new HVAC.'],
    },
    down: {
      renter:  ['Bus delays worsen by avg 8 min — potholes on your route may damage tires.', 'Broadband expansion paused; your neighborhood stays on legacy copper lines.'],
      owner:   ['Deferred maintenance near you costs ~$4,200 more in vehicle wear over 5 years.', 'Stormwater backlog grows — your street\'s flood-risk classification may rise.'],
      student: ['Crosswalk upgrades near campus pushed back 18 months; bike lanes shelved.', 'Library HVAC repairs delayed — study hours cut during temperature extremes.'],
    },
  },
  housing: {
    up: {
      renter:  ['500 affordable units unlock near you — rent stabilization caps your increase at ~$28/mo.', 'Eviction prevention funds cover 90-day grace periods; your safety net expands.'],
      owner:   ['New construction eases price pressure — bidding wars in your ZIP cool by 15%.', 'Mixed-income development nearby increases walkability score by 12 pts.'],
      student: ['Student housing waitlist shrinks by 800 — off-campus rent may drop $120/mo.', 'New campus-adjacent units open; commute from affordable housing cut by 8 min.'],
    },
    down: {
      renter:  ['Affordable supply tightens — your rent is projected to rise $47/mo by next lease renewal.', 'Shelter capacity drops 200 beds; rent competition in your area intensifies.'],
      owner:   ['Housing supply tightens — bidding wars in your ZIP become more competitive.', 'Luxury-only construction fills the void; neighborhood character shifts upmarket.'],
      student: ['Campus housing waitlist grows by 1,200 — off-campus rents spike ~$85/mo.', 'Student housing lottery odds worsen; avg commute from affordable areas +22 min.'],
    },
  },
};

// ── CSS injection ─────────────────────────────────────────────────────────────

function injectStyles() {
  if (typeof document === 'undefined') return;
  document.getElementById('sim-styles')?.remove(); // Remove stale version
  if (document.getElementById('sim-styles-v2')) return;
  const s = document.createElement('style');
  s.id = 'sim-styles-v2';
  s.textContent = `
    .sim-slider {
      -webkit-appearance: none;
      appearance: none;
      height: 8px;
      border-radius: 9999px;
      outline: none;
      cursor: pointer;
      width: 100%;
    }
    .sim-slider::-webkit-slider-runnable-track {
      height: 8px;
      border-radius: 9999px;
      box-shadow: inset 0 1.5px 3px rgba(0,0,0,0.10);
    }
    .sim-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 22px;
      height: 22px;
      margin-top: -7px;
      border-radius: 50%;
      background: #FDFCF8;
      cursor: pointer;
      border: 2px solid currentColor;
      box-shadow: 0 1px 6px rgba(0,0,0,0.14), 0 0 0 3px rgba(253,252,248,0.85);
      transition: transform 0.12s ease, box-shadow 0.12s ease;
    }
    .sim-slider:hover::-webkit-slider-thumb,
    .sim-slider:active::-webkit-slider-thumb {
      transform: scale(1.2);
      box-shadow: 0 2px 14px rgba(0,0,0,0.22), 0 0 0 5px rgba(253,252,248,0.9);
    }
    .sim-slider::-moz-range-thumb {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: #FDFCF8;
      cursor: pointer;
      border: 2px solid currentColor;
      box-shadow: 0 1px 6px rgba(0,0,0,0.14);
    }
    .sim-slider.critical::-webkit-slider-thumb {
      border-color: #ef4444 !important;
      animation: critPulse 1.1s ease-in-out infinite;
    }
    @keyframes critPulse {
      0%, 100% { box-shadow: 0 0 0 0px rgba(239,68,68,0.35), 0 1px 6px rgba(0,0,0,0.14); }
      50%       { box-shadow: 0 0 0 8px rgba(239,68,68,0.0),  0 1px 6px rgba(0,0,0,0.14); }
    }
  `;
  document.head.appendChild(s);
}

// ── Zero-sum redistribution ───────────────────────────────────────────────────

function redistribute(cur: number[], idx: number, raw: number): number[] {
  const max = TOTAL - (CATS.length - 1) * MIN;
  const nv  = Math.max(MIN, Math.min(max, raw));
  const delta = nv - cur[idx];
  if (Math.abs(delta) < 0.1) return cur;

  const res = [...cur];
  res[idx] = nv;
  const others = cur.map((_, i) => i).filter(i => i !== idx);
  const sum = others.reduce((s, i) => s + cur[i], 0);
  for (const i of others) {
    const share = sum > 0 ? cur[i] / sum : 1 / others.length;
    res[i] = Math.max(MIN, cur[i] - delta * share);
  }
  const drift = TOTAL - res.reduce((s, v) => s + v, 0);
  if (Math.abs(drift) > 0.01) {
    const big = others.reduce((mx, i) => res[i] > res[mx] ? i : mx, others[0]);
    res[big] = Math.max(MIN, res[big] + drift);
  }
  return res;
}

// ── Feed item ─────────────────────────────────────────────────────────────────

interface FeedItem {
  id: number;
  cat: Cat;
  msg: string;
  dir: 'up' | 'down';
  delta: number;
  confidence: number;
}
let nextId = 0;

// ── Style constants ───────────────────────────────────────────────────────────

const WARM_BORDER  = '1px solid rgba(180,155,120,0.24)';
const CARD_SHADOW  = '0 1px 3px rgba(60,40,20,0.04), 0 6px 18px rgba(60,40,20,0.07), 0 24px 48px rgba(60,40,20,0.04)';
const CREAM        = '#FDFCF8';

// ── Component ─────────────────────────────────────────────────────────────────

export default function ImpactSimulator() {
  const { profile }                         = useUserProfile();
  const [allocs, setAllocs]                 = useState<number[]>(CATS.map(c => BASE[c.id]));
  const [feed, setFeed]                     = useState<FeedItem[]>([]);
  const [activeIdx, setActiveIdx]           = useState<number | null>(null);
  const [expandedCat, setExpandedCat]       = useState<string | null>(null);

  // Derive persona from profile — no UI toggle
  const persona: Persona =
    profile?.housing_status === 'owner' ? 'owner' :
    profile?.housing_status === 'other' ? 'student' : 'renter';

  const userState = profile?.zip_code
    ? (ZIP_TO_STATE[profile.zip_code] ?? 'California')
    : 'your state';

  const personaLabel = PERSONA_META[persona].label;

  useEffect(() => { injectStyles(); }, []);

  const handleSlider = useCallback((i: number, v: number) => {
    const delta = v - allocs[i];
    if (Math.abs(delta) < 1) return;
    const newAllocs = redistribute(allocs, i, v);
    setAllocs(newAllocs);

    const cat = CATS[i];
    const dir: 'up' | 'down' = delta > 0 ? 'up' : 'down';
    const pair = MSGS[cat.id][dir][persona];
    const msg = Math.abs(delta) >= 40 ? pair[1] : pair[0];
    const confidence = Math.max(0.58, cat.baseConf - (Math.abs(delta) / TOTAL) * 0.28);

    setFeed(prev => [
      { id: nextId++, cat, msg, dir, delta, confidence },
      ...prev.slice(0, 8),
    ]);
  }, [allocs, persona]);

  const reset = useCallback(() => {
    setAllocs(CATS.map(c => BASE[c.id]));
    setFeed([]);
    setExpandedCat(null);
  }, []);

  const totalUsed = allocs.reduce((s, v) => s + v, 0);
  const balanced  = Math.abs(totalUsed - TOTAL) < 2;
  const activeCat = activeIdx !== null ? CATS[activeIdx] : null;

  return (
    <div className={`${syne.variable} ${newsreader.variable} relative`} style={{ background: '#F9F7F2', minHeight: '100vh' }}>

      {/* ── Digital Grid ───────────────────────────────────────────────────── */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          zIndex: 0,
          backgroundImage:
            'linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px),' +
            'linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px)',
          backgroundSize: '52px 52px',
        }}
        aria-hidden
      />

      {/* ── Light Leaks ────────────────────────────────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }} aria-hidden>
        {/* Blue — top right */}
        <div style={{
          position: 'absolute', top: 0, right: 0, width: 600, height: 600, borderRadius: '50%',
          background: 'radial-gradient(circle, #BFDBFE 0%, transparent 65%)',
          transform: 'translate(25%, -25%)', opacity: 0.65,
        }} />
        {/* Pink — bottom left */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, width: 500, height: 500, borderRadius: '50%',
          background: 'radial-gradient(circle, #FCA5A5 0%, transparent 65%)',
          transform: 'translate(-25%, 25%)', opacity: 0.50,
        }} />
        {/* Lime — center */}
        <div style={{
          position: 'absolute', top: '35%', left: '12%', width: 380, height: 380, borderRadius: '50%',
          background: 'radial-gradient(circle, #BBF7D0 0%, transparent 65%)',
          opacity: 0.38,
        }} />
        {/* Transcript glow — behind right column, reacts to active slider */}
        <div style={{
          position: 'absolute', top: '18%', right: '5%', width: 440, height: 600, borderRadius: '50%',
          background: `radial-gradient(circle, ${activeCat?.color ?? '#6366f1'}20 0%, transparent 65%)`,
          filter: 'blur(40px)',
          opacity: activeCat ? 1 : 0.45,
          transition: 'background 0.5s ease, opacity 0.4s ease',
        }} />
      </div>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <div className="relative max-w-5xl mx-auto px-4 py-10" style={{ zIndex: 1 }}>

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="mb-10">

          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#A8A09A', marginBottom: 14 }}>
            Candid · Budget Simulator
          </p>

          {/* Hero title — Syne bold + Newsreader outlined italic */}
          <h1 style={{
            fontFamily: 'var(--font-syne)',
            fontSize: 'clamp(32px, 5.5vw, 58px)',
            fontWeight: 800,
            lineHeight: 0.96,
            letterSpacing: '-0.03em',
            color: '#1C1917',
            marginBottom: 20,
          }}>
            YOUR STATE'S BUDGET,{' '}
            <span style={{
              fontFamily: 'var(--font-newsreader)',
              fontStyle: 'italic',
              fontWeight: 400,
              WebkitTextStroke: '1.5px #1C1917',
              color: 'transparent',
              letterSpacing: '-0.01em',
            } as React.CSSProperties}>
              recoded.
            </span>
          </h1>

          {/* Contextual tag */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            background: CREAM,
            border: WARM_BORDER,
            borderRadius: 99,
            padding: '5px 12px 5px 9px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
            marginBottom: 22,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block', flexShrink: 0, boxShadow: '0 0 0 2px rgba(34,197,94,0.25)' }} />
            <span style={{ fontSize: 11.5, fontWeight: 600, color: '#6B6560', letterSpacing: '0.01em' }}>
              Simulating for <strong style={{ color: '#1C1917' }}>{userState}</strong> based on your profile
            </span>
          </div>

          {/* Balance bar */}
          <div className="flex items-start sm:items-center justify-between gap-4 flex-col sm:flex-row">
            <p style={{ fontSize: 13.5, color: '#78716C', lineHeight: 1.65, maxWidth: 380 }}>
              Shift the $1.05B state budget and watch real-world consequences cascade — pre-configured for you as a <strong style={{ color: '#1C1917' }}>{personaLabel}</strong>.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: 11, color: '#A8A09A', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
                  ${(totalUsed / 1000).toFixed(3)}B / $1.050B
                </p>
                <p style={{ fontSize: 13, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: balanced ? '#16a34a' : '#dc2626' }}>
                  {balanced ? '✓ Balanced' : `⚠ ${totalUsed > TOTAL ? '+' : ''}${Math.round(totalUsed - TOTAL)}M`}
                </p>
              </div>
              <button
                onClick={reset}
                style={{
                  padding: '7px 16px', fontSize: 11.5, fontWeight: 600,
                  color: '#6B6560', borderRadius: 99,
                  background: 'rgba(180,155,120,0.09)',
                  border: WARM_BORDER,
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                  whiteSpace: 'nowrap',
                }}
              >
                Reset
              </button>
            </div>
          </div>
        </div>

        {/* ── Main grid: sliders + transcript ──────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

          {/* ── Sliders ────────────────────────────────────────────────────────── */}
          <div className="lg:col-span-3 flex flex-col gap-3">
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.16em', color: '#A8A09A', marginBottom: 4 }}>
              Budget Controls
            </p>

            {CATS.map((cat, i) => {
              const val    = allocs[i];
              const base   = BASE[cat.id];
              const pct    = (val / TOTAL) * 100;
              const delta  = val - base;
              const isCrit = val < cat.critical;
              const isOn   = activeIdx === i;
              const isExp  = expandedCat === cat.id;

              // Message for the expanded detail view
              const dir: 'up' | 'down' = delta >= 0 ? 'up' : 'down';
              const pair = MSGS[cat.id][dir][persona];
              const detailMsg = Math.abs(delta) >= 40 ? pair[1] : pair[0];

              return (
                <div
                  key={cat.id}
                  style={{
                    borderRadius: 16,
                    background: CREAM,
                    border: isCrit
                      ? '1px solid rgba(239,68,68,0.4)'
                      : isOn || isExp
                      ? `1px solid ${cat.color}44`
                      : WARM_BORDER,
                    boxShadow: isOn || isExp
                      ? `0 4px 24px ${cat.glow}, 0 1px 4px rgba(60,40,20,0.06)`
                      : isCrit
                      ? '0 4px 20px rgba(239,68,68,0.14), 0 1px 4px rgba(60,40,20,0.06)'
                      : CARD_SHADOW,
                    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ padding: '18px 20px 14px' }}>
                    {/* Icon + label + value */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: 10,
                          background: `${cat.color}14`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                        }}>
                          {CAT_ICON[cat.id]?.(cat.color)}
                        </div>
                        <div>
                          <p style={{ fontSize: 11, fontWeight: 800, color: '#44403C', textTransform: 'uppercase', letterSpacing: '0.06em', lineHeight: 1 }}>
                            {cat.label}
                          </p>
                          {isCrit && (
                            <p style={{ fontSize: 10, color: '#ef4444', fontWeight: 600, marginTop: 3, lineHeight: 1 }}>
                              ⚠ Below critical threshold
                            </p>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {Math.abs(delta) >= 1 && (
                          <span style={{
                            fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 99,
                            background: delta > 0 ? 'rgba(16,185,129,0.10)' : 'rgba(239,68,68,0.08)',
                            color: delta > 0 ? '#059669' : '#dc2626',
                            fontVariantNumeric: 'tabular-nums',
                          }}>
                            {delta > 0 ? '+' : ''}${Math.round(delta)}M
                          </span>
                        )}
                        <div style={{ textAlign: 'right' }}>
                          <p style={{
                            fontSize: 20, fontWeight: 800, lineHeight: 1,
                            fontVariantNumeric: 'tabular-nums',
                            color: isOn ? cat.color : '#1C1917',
                            transition: 'color 0.2s ease',
                          }}>
                            ${Math.round(val)}M
                          </p>
                          <p style={{ fontSize: 10, color: '#A8A09A', fontVariantNumeric: 'tabular-nums' }}>
                            {pct.toFixed(1)}%
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Slider — dual-tone recessed track */}
                    <input
                      type="range"
                      className={`sim-slider${isCrit ? ' critical' : ''}`}
                      min={MIN}
                      max={TOTAL - (CATS.length - 1) * MIN}
                      step={5}
                      value={Math.round(val)}
                      onChange={e => handleSlider(i, Number(e.target.value))}
                      onMouseDown={() => setActiveIdx(i)}
                      onMouseUp={() => setActiveIdx(null)}
                      onTouchStart={() => setActiveIdx(i)}
                      onTouchEnd={() => setActiveIdx(null)}
                      style={{
                        background: isCrit
                          ? `linear-gradient(to right, #ef4444 ${pct}%, rgba(239,68,68,0.12) ${pct}%)`
                          : `linear-gradient(to right, ${cat.color} ${pct}%, ${cat.tint} ${pct}%)`,
                        color: isCrit ? '#ef4444' : cat.color,
                        accentColor: isCrit ? '#ef4444' : cat.color,
                      }}
                    />

                    {/* Change vs baseline */}
                    {Math.abs(delta) >= 1 && (
                      <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ flex: 1, height: 3, background: 'rgba(180,155,120,0.14)', borderRadius: 99, overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', borderRadius: 99,
                            width: `${Math.min(100, (Math.abs(delta) / base) * 100)}%`,
                            background: delta > 0 ? '#10b981' : '#ef4444',
                            transition: 'width 0.3s ease',
                          }} />
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, flexShrink: 0, fontVariantNumeric: 'tabular-nums', color: delta > 0 ? '#059669' : '#dc2626' }}>
                          {delta > 0 ? '▲' : '▼'} {Math.abs(Math.round((delta / base) * 100))}% vs baseline
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Details toggle — single-active-ID: clicking one closes all others */}
                  <button
                    onClick={() => setExpandedCat(prev => prev === cat.id ? null : cat.id)}
                    style={{
                      width: '100%', padding: '9px 20px',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      background: isExp ? `${cat.color}07` : 'rgba(180,155,120,0.04)',
                      borderTop: '1px solid rgba(180,155,120,0.14)',
                      cursor: 'pointer', border: 'none', outline: 'none',
                      transition: 'background 0.15s',
                    }}
                  >
                    <span style={{ fontSize: 11, fontWeight: 600, color: isExp ? cat.color : '#78716C', transition: 'color 0.15s' }}>
                      {isExp ? 'Hide details' : 'See what this means for you'}
                    </span>
                    <motion.svg
                      animate={{ rotate: isExp ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                      width={12} height={12} fill="none"
                      stroke={isExp ? cat.color : '#A8A09A'}
                      strokeWidth={2.2} viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </motion.svg>
                  </button>

                  {/* Expandable detail panel */}
                  <AnimatePresence>
                    {isExp && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.24, ease: 'easeOut' }}
                        style={{ overflow: 'hidden' }}
                      >
                        <div style={{
                          padding: '14px 20px 18px',
                          background: `${cat.color}05`,
                          borderTop: `2px solid ${cat.color}18`,
                        }}>
                          <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: cat.color, marginBottom: 7 }}>
                            {personaLabel} · {userState}
                          </p>
                          <p style={{ fontSize: 13, color: '#3C3530', lineHeight: 1.72, fontWeight: 500 }}>
                            {detailMsg}
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>

          {/* ── Live Impact Transcript — sticky, glassmorphism ──────────────────── */}
          <div className="lg:col-span-2">
            <div style={{ position: 'sticky', top: 80 }}>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.16em', color: '#A8A09A', marginBottom: 8 }}>
                Live Impact Transcript
              </p>

              <div style={{
                borderRadius: 16,
                background: 'rgba(253,252,248,0.72)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: WARM_BORDER,
                boxShadow: '0 4px 24px rgba(60,40,20,0.08), 0 1px 3px rgba(60,40,20,0.04)',
                overflow: 'hidden',
              }}>
                {/* Panel header */}
                <div style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid rgba(180,155,120,0.14)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#44403C' }}>Live</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      fontSize: 10.5, fontWeight: 700, padding: '3px 10px', borderRadius: 99,
                      background: '#1C1917', color: CREAM,
                    }}>
                      {personaLabel} · {userState}
                    </span>
                    {feed.length > 0 && (
                      <span style={{ fontSize: 11, color: '#A8A09A', fontVariantNumeric: 'tabular-nums' }}>
                        {feed.length}
                      </span>
                    )}
                  </div>
                </div>

                {/* Feed body */}
                <div style={{ minHeight: 380, maxHeight: 560, overflowY: 'auto' }}>
                  {feed.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 280, gap: 12, padding: '0 28px' }}>
                      <div style={{
                        width: 48, height: 48, borderRadius: 14,
                        background: 'rgba(180,155,120,0.10)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#A8A09A" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M9 18h6M10 22h4M12 2a7 7 0 0 1 4.9 11.9c-.6.6-1.4 1.4-1.4 2.6v.5H8.5v-.5c0-1.2-.8-2-1.4-2.6A7 7 0 0 1 12 2z" />
                        </svg>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: '#57534E', marginBottom: 5 }}>No changes yet</p>
                        <p style={{ fontSize: 12, color: '#A8A09A', lineHeight: 1.65 }}>
                          Drag a slider to see personalized,<br />plain-English consequences
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <AnimatePresence initial={false}>
                        {feed.map((entry, idx) => (
                          <motion.div
                            key={entry.id}
                            initial={{ opacity: 0, y: 16, scale: 0.97 }}
                            animate={{ opacity: idx > 3 ? 0.52 : 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -10, scale: 0.95 }}
                            transition={{ type: 'spring', stiffness: 280, damping: 26, delay: idx === 0 ? 0 : idx * 0.025 }}
                            style={{
                              padding: '13px 16px',
                              borderBottom: '1px solid rgba(180,155,120,0.10)',
                              background: idx === 0 ? `${entry.cat.color}07` : 'transparent',
                            }}
                          >
                            {/* Entry header */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                              <div style={{
                                width: 24, height: 24, borderRadius: 7,
                                background: `${entry.cat.color}18`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                flexShrink: 0,
                              }}>
                                {CAT_ICON[entry.cat.id]?.(entry.cat.color)}
                              </div>
                              <span style={{ fontSize: 10, fontWeight: 800, color: '#44403C', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                                {entry.cat.label}
                              </span>
                              <span style={{ fontSize: 11, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: entry.dir === 'up' ? '#059669' : '#dc2626' }}>
                                {entry.dir === 'up' ? '↑' : '↓'} ${Math.abs(Math.round(entry.delta))}M
                              </span>
                            </div>

                            {/* Message */}
                            <p style={{ fontSize: 12.5, color: '#3C3530', lineHeight: 1.7, fontWeight: 500 }}>
                              {entry.msg}
                            </p>

                            {/* Confidence bar */}
                            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ flex: 1, height: 3, background: 'rgba(180,155,120,0.12)', borderRadius: 99, overflow: 'hidden' }}>
                                <div style={{
                                  height: '100%', borderRadius: 99,
                                  width: `${Math.round(entry.confidence * 100)}%`,
                                  background: `linear-gradient(90deg, ${entry.cat.color}88, ${entry.cat.color})`,
                                  transition: 'width 0.5s ease',
                                }} />
                              </div>
                              <span style={{ fontSize: 10, color: '#A8A09A', fontWeight: 700, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                                {Math.round(entry.confidence * 100)}%
                              </span>
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Allocation Breakdown ──────────────────────────────────────────────── */}
        <div style={{
          marginTop: 20, borderRadius: 16,
          background: CREAM,
          border: WARM_BORDER,
          padding: '20px 22px',
          boxShadow: CARD_SHADOW,
        }}>
          <p style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.16em', color: '#A8A09A', marginBottom: 14 }}>
            Allocation Breakdown
          </p>

          {/* Segmented bar */}
          <div style={{ display: 'flex', height: 12, borderRadius: 99, overflow: 'hidden', gap: 2 }}>
            {CATS.map((cat, i) => (
              <div
                key={cat.id}
                title={`${cat.label}: $${Math.round(allocs[i])}M`}
                style={{
                  width: `${(allocs[i] / TOTAL) * 100}%`,
                  background: cat.color,
                  borderRadius: 99,
                  opacity: activeIdx !== null && activeIdx !== i ? 0.32 : 1,
                  transition: 'width 0.3s ease, opacity 0.2s ease',
                  minWidth: allocs[i] > 0 ? '4px' : '0',
                }}
              />
            ))}
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 20px', marginTop: 14 }}>
            {CATS.map((cat, i) => {
              const delta = allocs[i] - BASE[cat.id];
              return (
                <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: cat.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 11.5, color: '#78716C' }}>{cat.label}</span>
                  <span style={{ fontSize: 11.5, fontWeight: 800, color: '#1C1917', fontVariantNumeric: 'tabular-nums' }}>
                    {((allocs[i] / TOTAL) * 100).toFixed(1)}%
                  </span>
                  {Math.abs(delta) >= 1 && (
                    <span style={{ fontSize: 11, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: delta > 0 ? '#059669' : '#dc2626' }}>
                      ({delta > 0 ? '+' : ''}{Math.round(delta)}M)
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
