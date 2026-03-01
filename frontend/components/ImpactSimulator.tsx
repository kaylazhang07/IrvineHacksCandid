'use client';
import { useState, useCallback, useEffect } from 'react';

const TOTAL = 1050; // $M
const MIN   = 10;   // floor per category

// ── Types ────────────────────────────────────────────────────────────────────

type Persona = 'renter' | 'owner' | 'student';

interface Cat {
  id: string;
  label: string;
  icon: string;
  color: string;
  glow: string;
  critical: number; // $M below which to pulse-warn
  baseConf: number; // 0–1 base confidence score
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CATS: Cat[] = [
  { id: 'public_safety',  label: 'Public Safety',  icon: '🛡',  color: '#ef4444', glow: 'rgba(239,68,68,0.28)',   critical: 150, baseConf: 0.87 },
  { id: 'healthcare',     label: 'Healthcare',     icon: '❤️',  color: '#ec4899', glow: 'rgba(236,72,153,0.28)',  critical: 120, baseConf: 0.82 },
  { id: 'education',      label: 'Education',      icon: '📚',  color: '#6366f1', glow: 'rgba(99,102,241,0.28)',  critical: 150, baseConf: 0.91 },
  { id: 'infrastructure', label: 'Infrastructure', icon: '🏗️',  color: '#f59e0b', glow: 'rgba(245,158,11,0.28)',  critical: 100, baseConf: 0.85 },
  { id: 'housing',        label: 'Housing',        icon: '🏠',  color: '#8b5cf6', glow: 'rgba(139,92,246,0.28)',  critical: 70,  baseConf: 0.88 },
];

const BASE: Record<string, number> = {
  public_safety: 250, healthcare: 210, education: 280, infrastructure: 190, housing: 120,
};

const PERSONA_META: Record<Persona, { label: string; icon: string; location: string }> = {
  renter:  { label: 'Renter',  icon: '🏢', location: 'Oakland, CA' },
  owner:   { label: 'Owner',   icon: '🔑', location: 'San Francisco, CA' },
  student: { label: 'Student', icon: '🎓', location: 'Berkeley, CA' },
};

// Plain-English messages keyed by [category][direction][persona]
// Each array has two tiers: small delta (< 40M) and large delta (≥ 40M)
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
  if (typeof document === 'undefined' || document.getElementById('sim-styles')) return;
  const s = document.createElement('style');
  s.id = 'sim-styles';
  s.textContent = `
    .sim-slider {
      -webkit-appearance: none;
      appearance: none;
      height: 6px;
      border-radius: 9999px;
      outline: none;
      cursor: pointer;
      width: 100%;
    }
    .sim-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: white;
      cursor: pointer;
      border: 2.5px solid currentColor;
      box-shadow: 0 1px 6px rgba(0,0,0,0.18);
      transition: transform 0.12s ease, box-shadow 0.12s ease;
    }
    .sim-slider:hover::-webkit-slider-thumb,
    .sim-slider:active::-webkit-slider-thumb {
      transform: scale(1.2);
      box-shadow: 0 2px 12px rgba(0,0,0,0.22);
    }
    .sim-slider::-moz-range-thumb {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: white;
      cursor: pointer;
      border: 2.5px solid currentColor;
      box-shadow: 0 1px 6px rgba(0,0,0,0.18);
    }
    .sim-slider.critical::-webkit-slider-thumb {
      border-color: #ef4444 !important;
      animation: critPulse 1.1s ease-in-out infinite;
    }
    @keyframes critPulse {
      0%, 100% { box-shadow: 0 0 0 0px rgba(239,68,68,0.35), 0 1px 6px rgba(0,0,0,0.18); }
      50%       { box-shadow: 0 0 0 8px rgba(239,68,68,0.0),  0 1px 6px rgba(0,0,0,0.18); }
    }
    @keyframes feedSlideIn {
      from { opacity: 0; transform: translateY(10px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .feed-item { animation: feedSlideIn 0.22s ease-out both; }
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
  // Fix floating-point drift
  const drift = TOTAL - res.reduce((s, v) => s + v, 0);
  if (Math.abs(drift) > 0.01) {
    const big = others.reduce((mx, i) => res[i] > res[mx] ? i : mx, others[0]);
    res[big] = Math.max(MIN, res[big] + drift);
  }
  return res;
}

// ── Feed item type ─────────────────────────────────────────────────────────────

interface FeedItem {
  id: number;
  cat: Cat;
  msg: string;
  dir: 'up' | 'down';
  delta: number;
  confidence: number;
  persona: Persona;
}
let nextId = 0;

// ── Component ─────────────────────────────────────────────────────────────────

export default function ImpactSimulator() {
  const [allocs, setAllocs]     = useState<number[]>(CATS.map(c => BASE[c.id]));
  const [persona, setPersona]   = useState<Persona>('renter');
  const [feed, setFeed]         = useState<FeedItem[]>([]);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

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
      { id: nextId++, cat, msg, dir, delta, confidence, persona },
      ...prev.slice(0, 8),
    ]);
  }, [allocs, persona]);

  const reset = useCallback(() => {
    setAllocs(CATS.map(c => BASE[c.id]));
    setFeed([]);
  }, []);

  const totalUsed = allocs.reduce((s, v) => s + v, 0);
  const balanced  = Math.abs(totalUsed - TOTAL) < 2;
  const activeCat = activeIdx !== null ? CATS[activeIdx] : null;

  return (
    <div className="relative" style={{ background: '#f9f9f8', minHeight: '100vh' }}>

      {/* ── Ambient background glow ──────────────────────────────────────────── */}
      <div
        className="fixed inset-0 pointer-events-none overflow-hidden"
        style={{ zIndex: 0 }}
        aria-hidden
      >
        <div style={{
          position: 'absolute',
          width: '900px', height: '900px',
          borderRadius: '50%',
          backgroundColor: activeCat?.color ?? '#6366f1',
          opacity: activeCat ? 0.055 : 0,
          filter: 'blur(160px)',
          top: '50%', left: '42%',
          transform: 'translate(-50%, -50%)',
          transition: 'background-color 0.5s ease, opacity 0.5s ease',
        }} />
      </div>

      <div className="relative max-w-5xl mx-auto px-4 py-8" style={{ zIndex: 1 }}>

        {/* ── Header ───────────────────────────────────────────────────────────── */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <p className="text-xs font-bold tracking-[0.18em] text-zinc-400 uppercase mb-2">
                Candid · Budget Simulator
              </p>
              <h1
                className="text-4xl sm:text-5xl font-black leading-none tracking-tight text-zinc-900"
                style={{ letterSpacing: '-0.025em' }}
              >
                YOUR BUDGET,{' '}
                <span
                  className="inline-block"
                  style={{
                    WebkitTextStroke: '2px #18181b',
                    color: 'transparent',
                  } as React.CSSProperties}
                >
                  RECODED.
                </span>
              </h1>
              <p className="text-sm text-zinc-500 mt-3 max-w-md leading-relaxed">
                Shift the $1.05B city budget and watch real-world consequences cascade —
                personalized to how you actually live.
              </p>
            </div>

            {/* Balance pill */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="text-right">
                <p className="text-xs text-zinc-400 font-medium tabular-nums">
                  ${(totalUsed / 1000).toFixed(3)}B / $1.050B
                </p>
                <p className={`text-sm font-black tabular-nums ${balanced ? 'text-emerald-600' : 'text-red-600'}`}>
                  {balanced
                    ? '✓ Balanced'
                    : `⚠ ${totalUsed > TOTAL ? '+' : ''}${Math.round(totalUsed - TOTAL)}M deficit`}
                </p>
              </div>
              <button
                onClick={reset}
                className="px-3.5 py-1.5 text-xs font-bold text-zinc-600 border border-zinc-200 rounded-full hover:bg-zinc-100 transition-colors"
              >
                Reset
              </button>
            </div>
          </div>

          {/* ── Persona switcher ─────────────────────────────────────────────── */}
          <div className="mt-5 flex flex-col sm:flex-row sm:items-center gap-3">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex-shrink-0">
              How this affects YOU →
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              {(Object.entries(PERSONA_META) as [Persona, typeof PERSONA_META[Persona]][]).map(([key, p]) => {
                const active = persona === key;
                return (
                  <button
                    key={key}
                    onClick={() => setPersona(key)}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all duration-150"
                    style={active
                      ? { background: '#18181b', color: 'white', borderColor: '#18181b' }
                      : { background: 'white', color: '#71717a', borderColor: '#e4e4e7' }}
                  >
                    <span>{p.icon}</span>
                    <span>{p.label}</span>
                    {active && (
                      <span className="text-zinc-400 font-normal ml-0.5">· {p.location}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Main grid: sliders + transcript ──────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

          {/* ── Sliders ────────────────────────────────────────────────────────── */}
          <div className="lg:col-span-3 flex flex-col gap-3">
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">
              Budget Controls
            </p>

            {CATS.map((cat, i) => {
              const val    = allocs[i];
              const base   = BASE[cat.id];
              const pct    = (val / TOTAL) * 100;
              const delta  = val - base;
              const isCrit = val < cat.critical;
              const isOn   = activeIdx === i;

              return (
                <div
                  key={cat.id}
                  className="rounded-2xl border p-5 transition-all duration-200"
                  style={{
                    background: 'rgba(255,255,255,0.92)',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    borderColor: isOn
                      ? `${cat.color}55`
                      : isCrit
                      ? 'rgba(239,68,68,0.35)'
                      : 'rgba(0,0,0,0.06)',
                    boxShadow: isOn
                      ? `0 6px 36px ${cat.glow}`
                      : isCrit
                      ? '0 4px 20px rgba(239,68,68,0.14)'
                      : '0 1px 8px rgba(0,0,0,0.05)',
                  }}
                >
                  {/* Row: icon + label + value */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                        style={{ backgroundColor: `${cat.color}18` }}
                      >
                        {cat.icon}
                      </div>
                      <div>
                        <p className="text-xs font-black text-zinc-800 uppercase tracking-wide leading-none">
                          {cat.label}
                        </p>
                        {isCrit && (
                          <p className="text-xs text-red-500 font-semibold mt-0.5 leading-none">
                            ⚠ Below critical threshold
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {Math.abs(delta) >= 1 && (
                        <span
                          className="text-xs font-black px-2 py-0.5 rounded-full tabular-nums"
                          style={{
                            background: delta > 0 ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.1)',
                            color: delta > 0 ? '#059669' : '#dc2626',
                          }}
                        >
                          {delta > 0 ? '+' : ''}${Math.round(delta)}M
                        </span>
                      )}
                      <div className="text-right">
                        <p
                          className="text-xl font-black tabular-nums leading-none"
                          style={{ color: isOn ? cat.color : '#18181b' }}
                        >
                          ${Math.round(val)}M
                        </p>
                        <p className="text-xs text-zinc-400 tabular-nums">{pct.toFixed(1)}%</p>
                      </div>
                    </div>
                  </div>

                  {/* Slider */}
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
                        ? `linear-gradient(to right, #ef4444 ${pct}%, rgba(239,68,68,0.15) ${pct}%)`
                        : `linear-gradient(to right, ${cat.color} ${pct}%, rgba(0,0,0,0.08) ${pct}%)`,
                      color: isCrit ? '#ef4444' : cat.color,
                      accentColor: isCrit ? '#ef4444' : cat.color,
                    }}
                  />

                  {/* Baseline change bar */}
                  {Math.abs(delta) >= 1 && (
                    <div className="mt-3 flex items-center gap-2.5">
                      <div className="flex-1 h-1 bg-zinc-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${Math.min(100, (Math.abs(delta) / base) * 100)}%`,
                            backgroundColor: delta > 0 ? '#10b981' : '#ef4444',
                          }}
                        />
                      </div>
                      <span
                        className="text-xs font-bold tabular-nums flex-shrink-0"
                        style={{ color: delta > 0 ? '#059669' : '#dc2626' }}
                      >
                        {delta > 0 ? '▲' : '▼'} {Math.abs(Math.round((delta / base) * 100))}% vs baseline
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── Live Impact Transcript ──────────────────────────────────────────── */}
          <div className="lg:col-span-2">
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2 lg:mt-0 mt-0">
              Live Impact Transcript
            </p>

            <div
              className="rounded-2xl border overflow-hidden"
              style={{
                background: 'rgba(255,255,255,0.92)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                borderColor: 'rgba(0,0,0,0.06)',
                boxShadow: '0 1px 8px rgba(0,0,0,0.05)',
              }}
            >
              {/* Panel header */}
              <div
                className="px-4 py-3 border-b flex items-center justify-between"
                style={{ borderColor: 'rgba(0,0,0,0.06)' }}
              >
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  <span className="text-xs font-bold text-zinc-700">Live</span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="text-xs font-bold px-2.5 py-0.5 rounded-full"
                    style={{ background: '#18181b', color: 'white' }}
                  >
                    {PERSONA_META[persona].icon} {PERSONA_META[persona].label}
                  </span>
                  {feed.length > 0 && (
                    <span className="text-xs text-zinc-400 tabular-nums">{feed.length}</span>
                  )}
                </div>
              </div>

              {/* Feed body */}
              <div
                className="overflow-y-auto"
                style={{ minHeight: '380px', maxHeight: '560px' }}
              >
                {feed.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 gap-3 px-6">
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
                      style={{ background: '#f4f4f5' }}
                    >
                      💡
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-bold text-zinc-600">No changes yet</p>
                      <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                        Drag a slider to see personalized,<br />plain-English consequences
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col">
                    {feed.map((entry, idx) => (
                      <div
                        key={entry.id}
                        className="feed-item px-4 py-4 border-b last:border-b-0"
                        style={{
                          borderColor: 'rgba(0,0,0,0.04)',
                          background: idx === 0 ? `${entry.cat.color}08` : 'transparent',
                          opacity: idx > 3 ? 0.6 : 1,
                        }}
                      >
                        {/* Entry header row */}
                        <div className="flex items-center gap-2 mb-2">
                          <div
                            className="w-6 h-6 rounded-lg flex items-center justify-center text-xs flex-shrink-0"
                            style={{ backgroundColor: `${entry.cat.color}22` }}
                          >
                            {entry.cat.icon}
                          </div>
                          <span className="text-xs font-black text-zinc-700 uppercase tracking-wide">
                            {entry.cat.label}
                          </span>
                          <span
                            className="text-xs font-black tabular-nums"
                            style={{ color: entry.dir === 'up' ? '#059669' : '#dc2626' }}
                          >
                            {entry.dir === 'up' ? '↑' : '↓'} ${Math.abs(Math.round(entry.delta))}M
                          </span>
                        </div>

                        {/* Persona context */}
                        <p className="text-xs font-semibold text-zinc-400 mb-1.5">
                          As a {PERSONA_META[entry.persona].label} in {PERSONA_META[entry.persona].location}:
                        </p>

                        {/* Plain-English message */}
                        <p className="text-sm text-zinc-800 leading-relaxed font-medium">
                          {entry.msg}
                        </p>

                        {/* Confidence score */}
                        <div className="mt-3 flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${Math.round(entry.confidence * 100)}%`,
                                background: `linear-gradient(90deg, ${entry.cat.color}99, ${entry.cat.color})`,
                              }}
                            />
                          </div>
                          <span className="text-xs text-zinc-400 font-bold tabular-nums flex-shrink-0">
                            {Math.round(entry.confidence * 100)}% confidence
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Allocation breakdown bar ──────────────────────────────────────────── */}
        <div
          className="mt-5 rounded-2xl border p-5"
          style={{
            background: 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderColor: 'rgba(0,0,0,0.06)',
            boxShadow: '0 1px 8px rgba(0,0,0,0.05)',
          }}
        >
          <p className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-4">
            Allocation Breakdown
          </p>

          {/* Segmented bar */}
          <div className="flex h-4 rounded-full overflow-hidden" style={{ gap: '2px' }}>
            {CATS.map((cat, i) => (
              <div
                key={cat.id}
                className="rounded-full transition-all duration-300"
                title={`${cat.label}: $${Math.round(allocs[i])}M`}
                style={{
                  width: `${(allocs[i] / TOTAL) * 100}%`,
                  backgroundColor: cat.color,
                  opacity: activeIdx !== null && activeIdx !== i ? 0.45 : 1,
                  transition: 'width 0.3s ease, opacity 0.2s ease',
                  minWidth: allocs[i] > 0 ? '4px' : '0',
                }}
              />
            ))}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-4">
            {CATS.map((cat, i) => {
              const delta = allocs[i] - BASE[cat.id];
              return (
                <div key={cat.id} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                  <span className="text-xs text-zinc-500">{cat.label}</span>
                  <span className="text-xs font-black text-zinc-900 tabular-nums">
                    {((allocs[i] / TOTAL) * 100).toFixed(1)}%
                  </span>
                  {Math.abs(delta) >= 1 && (
                    <span
                      className="text-xs font-bold tabular-nums"
                      style={{ color: delta > 0 ? '#059669' : '#dc2626' }}
                    >
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
