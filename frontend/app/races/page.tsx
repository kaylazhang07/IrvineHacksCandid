'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown, Globe, CheckCircle, Quote,
  Leaf, HeartPulse, BookOpen, TrendingUp, DollarSign,
  Home, ShieldCheck, Bus, Droplets, Zap,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
  PieChart, Pie, Cell,
} from 'recharts';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useRaces, Race, RaceCandidate } from '@/hooks/useRaces';
import { CATEGORY_COLORS } from '@/lib/types';

// ── Party identity ─────────────────────────────────────────────────────────────
const PARTY_COLORS: Record<string, string> = {
  Democratic: '#2563EB', 'Democratic Party': '#2563EB', Democrat: '#2563EB',
  Republican: '#DC2626', 'Republican Party': '#DC2626',
  Libertarian: '#F59E0B', Green: '#16A34A',
  Independent: '#64748B', Nonpartisan: '#8B5CF6', Unknown: '#9CA3AF',
};

const JURISDICTION_LABELS: Record<string, string> = {
  Federal: 'Federal', country: 'Federal',
  State: 'State', administrativeArea1: 'State',
  County: 'County', administrativeArea2: 'County',
  City: 'City', locality: 'City',
};

// ── Priority enrichment (frontend fallback when backend returns empty) ─────────
const KNOWN_PRIORITIES: Record<string, string[]> = {
  fetterman:  ['Expanding Healthcare', 'Workers Rights', 'Criminal Justice Reform'],
  mccormick:  ['Energy Independence', 'Economic Growth', 'Border Security'],
  casey:      ['Middle-Class Tax Cuts', 'Protecting Medicare', 'Manufacturing Jobs'],
  shapiro:    ['Public Education Funding', 'Economic Opportunity', 'Consumer Protection'],
  mastriano:  ['Election Integrity', 'Lower Taxes', 'Second Amendment Rights'],
  brown:      ['Affordable Housing', 'Climate Resilience', 'Economic Equity'],
};

const PARTY_FALLBACK: Record<string, string[]> = {
  Democratic: ['Expanding Healthcare Access', 'Climate Resilience', 'Working-Family Tax Cuts'],
  'Democratic Party': ['Expanding Healthcare Access', 'Climate Resilience', 'Working-Family Tax Cuts'],
  Democrat: ['Expanding Healthcare Access', 'Climate Resilience', 'Working-Family Tax Cuts'],
  Republican: ['Lower Taxes & Spending', 'Public Safety First', 'Energy Independence'],
  'Republican Party': ['Lower Taxes & Spending', 'Public Safety First', 'Energy Independence'],
  Libertarian: ['Government Transparency', 'Personal Liberty', 'Free Market Economy'],
  Green: ['Climate Action', 'Renewable Energy', 'Environmental Justice'],
  Independent: ['Bipartisan Solutions', 'Community Focus', 'Government Reform'],
  Nonpartisan: ['Constituent Service', 'Community Development', 'Efficient Government'],
};

function getTopPriorities(c: RaceCandidate): { labels: string[]; source: 'api' | 'known' | 'party' } {
  if (c.top_priorities?.length) return { labels: c.top_priorities.slice(0, 3), source: 'api' };
  const key = c.name.toLowerCase();
  for (const [k, v] of Object.entries(KNOWN_PRIORITIES)) {
    if (key.includes(k)) return { labels: v, source: 'known' };
  }
  return {
    labels: PARTY_FALLBACK[c.party] ?? ['Constituent Service', 'Community Development', 'Local Progress'],
    source: 'party',
  };
}

// ── Priority → CATEGORY_COLORS key ────────────────────────────────────────────
function priorityCategory(p: string): string {
  const s = p.toLowerCase();
  if (s.match(/climat|environ|green|renew/))                  return 'environment';
  if (s.match(/health|medic|care|medicare/))                  return 'healthcare';
  if (s.match(/educat|school|student/))                       return 'education';
  if (s.match(/econom|job|growth|manufactur|worker|business/)) return 'economy';
  if (s.match(/tax|fiscal|budget|spend/))                     return 'taxes';
  if (s.match(/hous|afford|rent/))                            return 'housing';
  if (s.match(/safe|crime|police|justice|border|security/))   return 'public_safety';
  if (s.match(/transit|transport|infra/))                     return 'transportation';
  if (s.match(/water|utility|energy/))                        return 'water_utilities';
  return 'other';
}

const PRIORITY_ICONS: Record<string, React.ReactNode> = {
  environment:    <Leaf size={10} />,
  healthcare:     <HeartPulse size={10} />,
  education:      <BookOpen size={10} />,
  economy:        <TrendingUp size={10} />,
  taxes:          <DollarSign size={10} />,
  housing:        <Home size={10} />,
  public_safety:  <ShieldCheck size={10} />,
  transportation: <Bus size={10} />,
  water_utilities:<Droplets size={10} />,
  other:          <Zap size={10} />,
};

const CAT_COLORS = CATEGORY_COLORS as Record<string, string>;

// ── Stance donut — per-candidate spending priorities ──────────────────────────
function StanceDonut({ stance, partyColor }: { stance: Record<string, number>; partyColor: string }) {
  const positive = Object.entries(stance || {})
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  if (!positive.length) return null;

  const total = positive.reduce((s, [, v]) => s + v, 0);
  const data = positive.map(([cat, val]) => ({
    name: cat.replace(/_/g, ' '),
    value: val,
    color: CAT_COLORS[cat] ?? partyColor,
  }));

  return (
    <div className="flex flex-col items-center gap-1 my-1">
      <PieChart width={108} height={108}>
        <Pie
          data={data}
          cx={54} cy={54}
          innerRadius={28} outerRadius={48}
          paddingAngle={2}
          dataKey="value"
          strokeWidth={0}
        >
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color} fillOpacity={0.88} />
          ))}
        </Pie>
        <Tooltip
          formatter={(v) => [`${Math.round(((v as number) / total) * 100)}%`]}
          contentStyle={{ fontSize: 10, borderRadius: 8, border: '1px solid #E2E8F0', padding: '4px 8px' }}
        />
      </PieChart>
      {/* Mini legend */}
      <div className="flex flex-wrap justify-center gap-x-2 gap-y-1">
        {data.map(d => (
          <span key={d.name} className="flex items-center gap-1 text-[9px] text-slate-500">
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
            {d.name}
          </span>
        ))}
      </div>
      <p className="text-[9px] text-slate-400">spending priorities</p>
    </div>
  );
}

// ── Side-by-side comparison bar chart ─────────────────────────────────────────
function ComparisonChart({ candidates }: { candidates: RaceCandidate[] }) {
  if (candidates.length < 2) return null;

  const [a, b] = candidates;
  const colorA = PARTY_COLORS[a.party] ?? '#94a3b8';
  const colorB = PARTY_COLORS[b.party] ?? '#94a3b8';
  const nameA  = a.name.split(' ').pop() ?? a.name;
  const nameB  = b.name.split(' ').pop() ?? b.name;

  const allCats = Array.from(new Set([
    ...Object.keys(a.budget_stance || {}),
    ...Object.keys(b.budget_stance || {}),
  ]));
  if (!allCats.length) return null;

  const data = allCats.map(cat => ({
    cat: cat.replace(/_/g, ' '),
    [nameA]: Math.round((a.budget_stance || {})[cat] ?? 0),
    [nameB]: Math.round((b.budget_stance || {})[cat] ?? 0),
  }));

  const absMax = Math.max(
    ...data.flatMap(d => [Math.abs(d[nameA] as number), Math.abs(d[nameB] as number)]),
    10,
  );
  const domain = [-(absMax + 4), absMax + 4] as [number, number];

  return (
    <div
      className="bg-white rounded-2xl p-5 mb-6 border border-slate-100"
      style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
          Spending Stance Comparison
        </p>
        <div className="flex items-center gap-4">
          {[{ name: nameA, color: colorA }, { name: nameB, color: colorB }].map(({ name, color }) => (
            <span key={name} className="flex items-center gap-1.5 text-[10px] font-semibold" style={{ color }}>
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
              {name}
            </span>
          ))}
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={data.length * 46 + 16}>
        <BarChart
          data={data}
          layout="vertical"
          barCategoryGap="32%"
          barGap={3}
          margin={{ left: 90, right: 52, top: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
          <XAxis
            type="number"
            domain={domain}
            tickFormatter={v => `${v > 0 ? '+' : ''}${v}%`}
            tick={{ fontSize: 9, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="cat"
            width={86}
            tick={{ fontSize: 10.5, fill: '#64748b', fontWeight: 500 }}
            axisLine={false}
            tickLine={false}
          />
          <ReferenceLine x={0} stroke="#CBD5E1" strokeWidth={1.5} />
          <Tooltip
            cursor={{ fill: '#F8FAFC' }}
            formatter={(v, key) => [`${(v as number) > 0 ? '+' : ''}${v}%`, key as string]}
            contentStyle={{ fontSize: 11, borderRadius: 10, border: '1px solid #E2E8F0', padding: '6px 10px' }}
          />
          <Bar dataKey={nameA} fill={colorA} radius={[0, 3, 3, 0]} fillOpacity={0.85} />
          <Bar dataKey={nameB} fill={colorB} radius={[0, 3, 3, 0]} fillOpacity={0.85} />
        </BarChart>
      </ResponsiveContainer>

      <p className="text-[9px] text-slate-400 mt-3 text-center tracking-wide">
        Estimated % change from current spending levels · based on party platform positions
      </p>
    </div>
  );
}

// ── Verified badge ─────────────────────────────────────────────────────────────
function VerifiedBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-100 flex-shrink-0">
      <CheckCircle size={10} className="text-blue-500" />
      <span className="text-[10px] font-semibold text-blue-600 tracking-wide">Verified · Civic API</span>
    </span>
  );
}

// ── Data provenance badge ──────────────────────────────────────────────────────
function ProvenanceBadge({ source }: { source: 'api' | 'known' | 'party' }) {
  if (source === 'api') return null;
  return (
    <span className="text-[9px] font-semibold text-slate-400 tracking-wide">
      {source === 'known' ? '· candidate record' : '· based on party platform'}
    </span>
  );
}

// ── Candidate avatar with party ring + glow ────────────────────────────────────
function Avatar({ candidate, color }: { candidate: RaceCandidate; color: string }) {
  return (
    <div className="relative w-16 h-16 mx-auto mb-3">
      <div
        className="absolute -inset-[3px] rounded-full"
        style={{ boxShadow: `0 0 0 3px ${color}, 0 6px 20px ${color}33` }}
      />
      {candidate.photo_url ? (
        <img src={candidate.photo_url} alt={candidate.name}
          className="w-16 h-16 rounded-full object-cover relative z-10"
        />
      ) : (
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold relative z-10"
          style={{ background: `linear-gradient(135deg, ${color}cc, ${color})` }}
        >
          {candidate.name.charAt(0)}
        </div>
      )}
    </div>
  );
}

// ── Priority tag chip ──────────────────────────────────────────────────────────
function PriorityTag({ label }: { label: string }) {
  const cat   = priorityCategory(label);
  const color = CAT_COLORS[cat] ?? '#94a3b8';
  const icon  = PRIORITY_ICONS[cat];
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold leading-none"
      style={{ background: `${color}18`, color }}
    >
      {icon}{label}
    </span>
  );
}

// ── Contact icon bar ──────────────────────────────────────────────────────────
function ContactBar({ candidate }: { candidate: RaceCandidate }) {
  const items = [
    candidate.website && {
      href: candidate.website, label: 'Website',
      icon: <Globe size={11} />,
      cls: 'bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-700',
    },
    candidate.social?.twitter && {
      href: `https://twitter.com/${candidate.social.twitter}`,
      label: `@${candidate.social.twitter}`,
      icon: (
        <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.745l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
      ),
      cls: 'bg-sky-50 hover:bg-sky-100 text-sky-500 hover:text-sky-700',
    },
    candidate.social?.facebook && {
      href: `https://facebook.com/${candidate.social.facebook}`,
      label: 'Facebook',
      icon: (
        <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
        </svg>
      ),
      cls: 'bg-blue-50 hover:bg-blue-100 text-blue-500 hover:text-blue-700',
    },
  ].filter(Boolean) as { href: string; label: string; icon: React.ReactNode; cls: string }[];

  if (!items.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5 pt-3 mt-3 border-t border-slate-100">
      {items.map(({ href, label, icon, cls }) => (
        <a key={href} href={href} target="_blank" rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${cls}`}
        >
          {icon}
          <span className="truncate max-w-[72px]">{label}</span>
        </a>
      ))}
    </div>
  );
}

// ── Candidate comparison card ──────────────────────────────────────────────────
function CandidateCard({
  candidate, direction, delay,
}: {
  candidate: RaceCandidate;
  direction: 'left' | 'right';
  delay: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const color      = PARTY_COLORS[candidate.party] ?? '#9CA3AF';
  const { labels: priorities, source: prioritySource } = getTopPriorities(candidate);
  const hasEndorse = candidate.endorsements?.length > 0;
  const hasSources = candidate.sources?.length > 0;
  // Only show the platform drawer when there's genuinely rich content
  const hasRealContent = !!(
    candidate.platform_summary ||
    hasEndorse ||
    (candidate.experience?.length ?? 0) > 1
  );
  const partyShort = candidate.party
    .replace('Democratic Party', 'Democrat')
    .replace('Republican Party', 'Republican');

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: direction === 'left' ? -40 : 40, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 100, damping: 20, delay }}
      whileHover={{
        y: -6, scale: 1.01,
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.12)',
        transition: { duration: 0.2 },
      }}
      className="bg-white rounded-[2rem] p-6 flex flex-col gap-0"
      style={{ boxShadow: '0 20px 50px rgba(0,0,0,0.04)' }}
    >
      {/* ── Avatar + identity ── */}
      <div className="text-center mb-3">
        <Avatar candidate={candidate} color={color} />
        <p className="text-[10px] font-black tracking-[0.15em] uppercase mb-1" style={{ color }}>
          {partyShort}
        </p>
        <h3
          className="text-base font-bold text-slate-900 leading-tight"
          style={{ fontFamily: 'var(--font-serif, Georgia, serif)' }}
        >
          {candidate.name}
        </h3>
        {candidate.bio && (
          <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed line-clamp-2 text-center px-2">
            {candidate.bio}
          </p>
        )}
      </div>

      {/* ── Spending donut ── */}
      <StanceDonut stance={candidate.budget_stance} partyColor={color} />

      {/* ── Priority tags + provenance ── */}
      <div className="mt-3 mb-3">
        <div className="flex flex-wrap justify-center gap-1.5 mb-1.5">
          {priorities.map(p => <PriorityTag key={p} label={p} />)}
        </div>
        <div className="text-center">
          <ProvenanceBadge source={prioritySource} />
        </div>
      </div>

      {/* ── View Platform toggle — only when there's real content ── */}
      {hasRealContent && (
        <>
          <button
            onClick={() => setExpanded(p => !p)}
            className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors"
          >
            <span className="text-xs font-semibold text-slate-600">
              {expanded ? 'Hide Platform' : 'View Platform'}
            </span>
            <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.25 }}>
              <ChevronDown size={14} className="text-slate-400" />
            </motion.div>
          </button>

          <AnimatePresence initial={false}>
            {expanded && (
              <motion.div
                key="platform"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.28, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <div className="pt-4 flex flex-col gap-4">
                  {candidate.platform_summary && (
                    <p className="text-sm text-slate-600 leading-relaxed">{candidate.platform_summary}</p>
                  )}

                  {(candidate.experience?.length ?? 0) > 1 && (
                    <div className="flex flex-wrap gap-1.5">
                      {candidate.experience.slice(0, 3).map((exp, i) => (
                        <span key={i} className="text-[10px] text-slate-500 bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-lg">
                          {exp}
                        </span>
                      ))}
                    </div>
                  )}

                  {hasEndorse && (
                    <div className="flex flex-wrap gap-1.5">
                      {candidate.endorsements.slice(0, 4).map((e, i) => (
                        <span key={i}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-50 border border-slate-100 text-slate-600"
                        >
                          <Quote size={8} className="text-slate-400" />
                          {e}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {/* ── Tiny source attribution — always visible, never noisy ── */}
      {hasSources && (
        <div className="flex gap-3 mt-3 flex-wrap">
          {candidate.sources.map((s, i) => (
            <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="text-[9px] text-slate-300 hover:text-slate-400 transition-colors truncate"
            >
              {s.source_type === 'public_record' ? 'congress-legislators' : 'wikipedia'}
            </a>
          ))}
        </div>
      )}

      {/* ── Contact bar ── */}
      <div className="mt-auto">
        <ContactBar candidate={candidate} />
      </div>
    </motion.div>
  );
}

// ── Race section ───────────────────────────────────────────────────────────────
function RaceSection({ race, raceIndex }: { race: Race; raceIndex: number }) {
  const jurisdLabel = JURISDICTION_LABELS[race.jurisdiction] ?? race.jurisdiction;
  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 100, damping: 20, delay: raceIndex * 0.1 }}
    >
      {/* Glassmorphism race header */}
      <div
        className="bg-white/40 backdrop-blur-md rounded-2xl p-6 mb-4 border border-white/60"
        style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.04)' }}
      >
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-slate-400 mb-1.5">
              {jurisdLabel} Office
            </p>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-tight">
              {race.position}
            </h2>
            {race.district && (
              <p className="text-sm text-slate-400 mt-1">{race.district}</p>
            )}
          </div>
          <VerifiedBadge />
        </div>
      </div>

      {/* Side-by-side spending comparison chart (Senate races only) */}
      <ComparisonChart candidates={race.candidates} />

      {/* Candidate cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {race.candidates.map((c, i) => (
          <CandidateCard
            key={`${c.name}-${i}`}
            candidate={c}
            direction={i % 2 === 0 ? 'left' : 'right'}
            delay={raceIndex * 0.1 + i * 0.07}
          />
        ))}
      </div>
    </motion.div>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────────
function SkeletonSection({ index }: { index: number }) {
  return (
    <div className="animate-pulse" style={{ animationDelay: `${index * 0.1}s` }}>
      <div className="bg-white/60 rounded-2xl p-6 mb-4">
        <div className="h-3 w-20 bg-slate-100 rounded mb-3" />
        <div className="h-9 w-64 bg-slate-200 rounded-lg" />
      </div>
      {/* Comparison chart skeleton */}
      <div className="bg-white rounded-2xl p-5 mb-6 border border-slate-100">
        <div className="h-3 w-36 bg-slate-100 rounded mb-4" />
        <div className="flex flex-col gap-3">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-2.5 w-20 bg-slate-100 rounded flex-shrink-0" />
              <div className="flex-1 h-2 bg-slate-100 rounded-full" />
            </div>
          ))}
        </div>
      </div>
      {/* Candidate card skeletons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[0, 1].map(i => (
          <div key={i} className="bg-white rounded-[2rem] p-6"
            style={{ boxShadow: '0 20px 50px rgba(0,0,0,0.04)' }}
          >
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-full bg-slate-100" />
              <div className="h-3 w-16 bg-slate-100 rounded" />
              <div className="h-5 w-36 bg-slate-200 rounded" />
              {/* Donut skeleton */}
              <div className="w-[108px] h-[108px] rounded-full bg-slate-100 border-[18px] border-slate-50" />
              <div className="flex gap-2 flex-wrap justify-center">
                {[0, 1, 2].map(j => <div key={j} className="h-5 w-20 bg-slate-100 rounded-full" />)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function RacesPage() {
  const router = useRouter();
  const { profile } = useUserProfile();
  const { races, isLoading, error } = useRaces(profile);

  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem('candid_user_profile')) {
      router.replace('/');
    }
  }, [router]);

  const order = ['Federal', 'country', 'State', 'administrativeArea1', 'County', 'administrativeArea2', 'City', 'locality'];
  const groups: Record<string, Race[]> = {};
  for (const race of races) {
    if (!groups[race.jurisdiction]) groups[race.jurisdiction] = [];
    groups[race.jurisdiction].push(race);
  }
  const sortedKeys = Object.keys(groups).sort((a, b) => order.indexOf(a) - order.indexOf(b));

  let raceCounter = 0;
  const raceWithIndex: { race: Race; idx: number }[] = sortedKeys.flatMap(k =>
    groups[k].map(r => ({ race: r, idx: raceCounter++ }))
  );

  return (
    <div className="min-h-screen bg-[#FCFAF7]">
      <div className="max-w-4xl mx-auto px-4 py-8 pb-24">

        {/* Page header */}
        <div className="mb-8">
          <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-slate-400 mb-1">
            Candidate Comparison Dashboard
          </p>
          <h1
            className="text-3xl font-black text-slate-900 tracking-tight"
            style={{ fontFamily: 'var(--font-serif, Georgia, serif)' }}
          >
            Your Races{profile ? ` · ${profile.zip_code}` : ''}
          </h1>
          <div className="flex items-center gap-2 mt-2">
            <VerifiedBadge />
            <span className="text-xs text-slate-400">via Google Civic Information API</span>
          </div>
        </div>

        {isLoading && (
          <div className="flex flex-col gap-10">
            {Array.from({ length: 2 }).map((_, i) => <SkeletonSection key={i} index={i} />)}
          </div>
        )}

        {error && (
          <div className="rounded-2xl p-5 bg-red-50 border border-red-100">
            <p className="text-sm font-semibold text-red-700">Could not load race data</p>
            <p className="text-xs text-red-400 mt-1">{error.message}</p>
          </div>
        )}

        {!isLoading && !error && (
          <div className="flex flex-col gap-10">
            {sortedKeys.map(key => (
              <div key={key}>
                {sortedKeys.length > 1 && (
                  <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-slate-300 mb-5">
                    {JURISDICTION_LABELS[key] ?? key} Offices
                  </p>
                )}
                <div className="flex flex-col gap-8">
                  {groups[key].map(race => {
                    const entry = raceWithIndex.find(r => r.race.race_id === race.race_id);
                    return (
                      <RaceSection
                        key={race.race_id}
                        race={race}
                        raceIndex={entry?.idx ?? 0}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
