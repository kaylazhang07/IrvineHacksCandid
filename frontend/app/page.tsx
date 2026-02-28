'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import { Syne } from 'next/font/google';
import { Newsreader } from 'next/font/google';
import Link from 'next/link';
import { BookOpen, DollarSign, MapPin, Shield, FileText, CheckCircle } from 'lucide-react';

const syne = Syne({ subsets: ['latin'], weight: ['800'], variable: '--font-syne' });
const newsreader = Newsreader({ subsets: ['latin'], weight: ['400'], style: ['italic'], variable: '--font-newsreader' });

/* ── constants ──────────────────────────────────────────── */

const MEASURES = [
  'Measure A — Affordable Housing Bond',
  'Prop 14 — School Funding Initiative',
  'Measure J — Transit Expansion',
  'Prop 33 — Rent Control Reform',
  'Measure K — Parks & Open Space',
  'Prop 1 — Mental Health Services',
  'Measure B — Police Oversight Commission',
  'Prop 47 — Criminal Justice Reform',
  'Measure C — Library Modernization',
  'Prop 22 — Gig Worker Benefits',
  'Measure D — Homeless Services Tax',
  'Prop 36 — Drug Treatment Programs',
];

const FEATURES = [
  {
    icon: Shield,
    title: 'Personalized to You',
    desc: 'Answer 5 questions about your life — housing, income, family — and every explanation adapts to your exact situation.',
    color: '#2563EB',
    bg: '#EFF6FF',
    dot: 'bg-blue-500',
  },
  {
    icon: DollarSign,
    title: 'Budget in Plain English',
    desc: 'Not "12% citywide" — "$340/year for renters in your ZIP code." Real dollar estimates for your actual household.',
    color: '#16A34A',
    bg: '#F0FDF4',
    dot: 'bg-green-500',
  },
  {
    icon: MapPin,
    title: 'Your Neighborhood, Live',
    desc: 'A 3D city map pins every policy to the real streets it affects. See exactly which blocks change and how.',
    color: '#D97706',
    bg: '#FFFBEB',
    dot: 'bg-yellow-500',
  },
  {
    icon: BookOpen,
    title: 'Source-Grounded, Always',
    desc: 'Every claim links to the exact legislative clause it came from. Confidence scores show how well the law supports each statement.',
    color: '#DC2626',
    bg: '#FEF2F2',
    dot: 'bg-red-500',
  },
  {
    icon: FileText,
    title: 'Records, Not Rhetoric',
    desc: 'Candidate vote histories from public records — not campaign sites. What they voted for, not what they promised.',
    color: '#7C3AED',
    bg: '#F5F3FF',
    dot: 'bg-violet-500',
  },
];

const STEPS = [
  { n: '01', title: 'Tell us about your life', desc: 'Five quick questions about your housing, income, family, and what you care about. Takes 60 seconds.' },
  { n: '02', title: 'We pull real legislation', desc: 'Candid searches 30,000+ chunked legislative documents in our vector database, filtered to your jurisdiction.' },
  { n: '03', title: 'Claude reads it for you', desc: 'Our AI reads the raw legalese and writes a plain-English summary — personalized to your exact profile.' },
  { n: '04', title: 'You get the full picture', desc: 'Dollar impact for your household, citations to real clauses, confidence scores, and a live map of affected streets.' },
];

const PERSONAS = [
  {
    label: 'Renter · Oakland · $65k',
    impact: '−$340/yr',
    positive: false,
    statement: 'This measure increases your property tax base, which Oakland landlords can legally pass through as rent increases of up to $28/month.',
    confidence: 87,
  },
  {
    label: 'Owner · San Francisco · $145k',
    impact: '+$120/yr',
    positive: true,
    statement: 'As a homeowner, you benefit from infrastructure improvements funded by this measure — estimated to raise property values 2–4% in your district.',
    confidence: 91,
  },
  {
    label: 'Renter · Los Angeles · $38k',
    impact: '−$680/yr',
    positive: false,
    statement: 'Lower-income renters bear a disproportionate share of this measure\'s costs. Your bracket is most affected by indirect cost pass-throughs.',
    confidence: 83,
  },
];

/* ── sub-components ─────────────────────────────────────── */

function Ticker() {
  const repeated = [...MEASURES, ...MEASURES];
  return (
    <div className="overflow-hidden border-y border-zinc-200 py-2.5 bg-white">
      <div className="flex animate-ticker whitespace-nowrap will-change-transform">
        {repeated.map((m, i) => (
          <span key={i} className="mx-8 text-[11px] font-mono text-zinc-400 tracking-[0.12em] uppercase flex items-center gap-3 flex-shrink-0">
            <span className={`w-1.5 h-1.5 rounded-full inline-block flex-shrink-0 ${['bg-blue-400','bg-green-400','bg-red-400','bg-yellow-400','bg-violet-400'][i % 5]}`} />
            {m}
          </span>
        ))}
      </div>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, desc, color, bg, index }: typeof FEATURES[0] & { index: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 32 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: index * 0.09, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col gap-4 p-6 rounded-2xl border border-zinc-200 bg-white hover:shadow-md hover:-translate-y-1 transition-all duration-300 cursor-default"
    >
      <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: bg }}>
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <div>
        <h3 className="font-bold text-zinc-900 text-base mb-1.5">{title}</h3>
        <p className="text-zinc-500 text-sm leading-relaxed">{desc}</p>
      </div>
    </motion.div>
  );
}

function StepItem({ n, title, desc, index }: { n: string; title: string; desc: string; index: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  const colors = ['#2563EB', '#16A34A', '#DC2626', '#D97706'];
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, x: -20 }}
      animate={inView ? { opacity: 1, x: 0 } : {}}
      transition={{ duration: 0.5, delay: index * 0.08 }}
      className="flex gap-5 items-start md:pl-14 relative"
    >
      <div
        className="absolute left-0 w-10 h-10 rounded-full border-2 border-zinc-100 flex items-center justify-center hidden md:flex flex-shrink-0"
        style={{ backgroundColor: colors[index] + '15', borderColor: colors[index] + '30' }}
      >
        <span className="text-[11px] font-black" style={{ fontFamily: 'var(--font-syne)', color: colors[index] }}>{n}</span>
      </div>
      <div>
        <h3 className="font-bold text-zinc-900 text-base mb-1">{title}</h3>
        <p className="text-zinc-500 text-sm leading-relaxed">{desc}</p>
      </div>
    </motion.div>
  );
}

function DemoMockup() {
  const [persona, setPersona] = useState(0);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 48 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className="w-full max-w-3xl mx-auto"
    >
      <div className="flex flex-wrap justify-center gap-2 mb-6">
        {PERSONAS.map((p, i) => (
          <button
            key={i}
            onClick={() => setPersona(i)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-all duration-200 ${
              persona === i
                ? 'bg-zinc-900 text-white border-zinc-900'
                : 'bg-white text-zinc-500 border-zinc-200 hover:border-zinc-400'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Browser chrome */}
      <div className="rounded-2xl overflow-hidden border border-zinc-200 shadow-xl">
        <div className="bg-zinc-100 px-4 py-3 flex items-center gap-3 border-b border-zinc-200">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-400" />
            <div className="w-3 h-3 rounded-full bg-yellow-400" />
            <div className="w-3 h-3 rounded-full bg-green-400" />
          </div>
          <div className="flex-1 bg-white rounded-md px-3 py-1 text-xs text-zinc-400 font-mono border border-zinc-200">
            candid.app/ballot/measure-j
          </div>
        </div>

        {/* App UI */}
        <div className="bg-[#F9F7F2] p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[10px] text-zinc-400 uppercase tracking-wider mb-0.5">Ballot Measure</p>
              <h3 className="font-bold text-zinc-900 text-lg">Measure J — Transit Expansion Bond</h3>
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                key={persona}
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.85, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className={`px-4 py-2 rounded-full text-sm font-bold ${
                  PERSONAS[persona].positive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}
              >
                {PERSONAS[persona].impact}
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-3">
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="w-3.5 h-3.5 text-blue-600" />
              <span className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider">Plain English</span>
            </div>
            <p className="text-sm text-zinc-700 leading-relaxed">
              Measure J authorizes $650M in bonds for new BART stations, expanded bus routes, and bike lanes across three districts. Bonds repaid via a small property tax increase over 30 years.
            </p>
          </div>

          <div className="bg-white border border-zinc-200 rounded-xl p-4 mb-3">
            <p className="text-[10px] text-zinc-400 uppercase tracking-wider mb-1.5 font-medium">Your Impact</p>
            <AnimatePresence mode="wait">
              <motion.p
                key={persona}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25 }}
                className="text-sm font-semibold text-zinc-900 leading-snug"
              >
                {PERSONAS[persona].statement}
              </motion.p>
            </AnimatePresence>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex gap-1.5">
              {['§4.2.1', '§11.8', '§22.4', '§31.1'].map(c => (
                <span key={c} className="px-2 py-0.5 bg-zinc-100 rounded-full text-[10px] font-mono text-zinc-500">{c}</span>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <AnimatePresence mode="wait">
                <motion.span key={persona} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[11px] text-zinc-400">
                  {PERSONAS[persona].confidence}% confidence
                </motion.span>
              </AnimatePresence>
              <CheckCircle className="w-3.5 h-3.5 text-green-500" />
            </div>
          </div>
        </div>
      </div>

      <p className="text-center text-zinc-400 text-xs mt-4 font-mono">
        toggle profiles above — watch the explanation adapt in real time
      </p>
    </motion.div>
  );
}

/* ── page ───────────────────────────────────────────────── */

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    try {
      if (localStorage.getItem('candid_user_profile')) router.replace('/ballot');
    } catch {}
  }, [router]);

  return (
    <div className={`${syne.variable} ${newsreader.variable}`}>

      {/* ── HERO ──────────────────────────────────────────── */}
      <section className="noise-bg-light relative min-h-screen flex flex-col overflow-hidden bg-[#F9F7F2]">
        {/* Soft pastel blobs */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full pointer-events-none opacity-60"
          style={{ background: 'radial-gradient(circle, #BFDBFE 0%, transparent 65%)', transform: 'translate(25%, -25%)' }} />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full pointer-events-none opacity-50"
          style={{ background: 'radial-gradient(circle, #FCA5A5 0%, transparent 65%)', transform: 'translate(-25%, 25%)' }} />
        <div className="absolute top-1/2 left-1/4 w-[350px] h-[350px] rounded-full pointer-events-none opacity-35"
          style={{ background: 'radial-gradient(circle, #BBF7D0 0%, transparent 65%)' }} />
        <div className="absolute top-1/3 right-1/4 w-[250px] h-[250px] rounded-full pointer-events-none opacity-30"
          style={{ background: 'radial-gradient(circle, #FDE68A 0%, transparent 65%)' }} />
        {/* Subtle grid */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ backgroundImage: 'linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px)', backgroundSize: '52px 52px' }} />

        {/* Nav */}
        <nav className="relative z-10 flex items-center justify-between px-6 md:px-12 py-5">
          <span className="text-zinc-900 font-black tracking-[-0.03em] text-xl" style={{ fontFamily: 'var(--font-syne)' }}>
            candid<span className="text-blue-500">.</span>
          </span>
          <Link
            href="/ballot"
            className="text-sm font-semibold px-5 py-2 rounded-full border border-zinc-300 text-zinc-600 bg-white hover:bg-zinc-50 transition-colors shadow-sm"
          >
            Enter app →
          </Link>
        </nav>

        <Ticker />

        {/* Hero content */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-6 py-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-zinc-200 bg-white text-zinc-500 text-xs font-medium tracking-wide uppercase mb-8 shadow-sm"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            Built on 30,000+ legislative documents
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="text-5xl md:text-7xl lg:text-[82px] font-black leading-[0.92] tracking-[-0.04em] text-zinc-900 max-w-4xl mb-6"
            style={{ fontFamily: 'var(--font-syne)' }}
          >
            YOUR BALLOT,{' '}
            <span
              style={{
                fontFamily: 'var(--font-newsreader)',
                color: '#2563EB',
                fontStyle: 'italic',
                fontWeight: 400,
                letterSpacing: '-0.01em',
              }}
            >
              decoded
            </span>{' '}
            FOR YOUR LIFE.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="text-zinc-500 text-lg md:text-xl max-w-xl leading-relaxed mb-10"
          >
            Plain-English explanations, personalized to who you are. Grounded in 30,000+ real legislation documents.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.34, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col sm:flex-row gap-3 items-center"
          >
            <Link
              href="/ballot"
              className="px-8 py-3.5 rounded-full font-semibold text-white text-sm bg-zinc-900 hover:bg-zinc-800 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md"
            >
              See My Ballot →
            </Link>
            <a
              href="#features"
              className="px-8 py-3.5 rounded-full font-semibold text-zinc-600 text-sm border border-zinc-300 bg-white hover:bg-zinc-50 transition-all"
            >
              How it works ↓
            </a>
          </motion.div>

          {/* Stat row */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.55 }}
            className="flex flex-wrap justify-center gap-10 mt-16 pt-10 border-t border-zinc-200"
          >
            {[
              { n: '30,000+', label: 'Legislative documents', color: '#2563EB' },
              { n: '< 3s', label: 'Personalized explanation', color: '#16A34A' },
              { n: '94%', label: 'Citation accuracy', color: '#DC2626' },
            ].map(({ n, label, color }) => (
              <div key={label} className="text-center">
                <div className="text-2xl font-black text-zinc-900" style={{ fontFamily: 'var(--font-syne)', color }}>{n}</div>
                <div className="text-xs text-zinc-400 mt-0.5">{label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── FEATURES ──────────────────────────────────────── */}
      <section id="features" className="bg-white px-6 md:px-12 py-24 border-t border-zinc-100">
        <div className="max-w-5xl mx-auto">
          <div className="mb-14 text-center">
            <span className="inline-block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400 mb-3">What Candid does</span>
            <h2 className="text-3xl md:text-5xl font-black text-zinc-900 tracking-tight" style={{ fontFamily: 'var(--font-syne)' }}>
              Five layers.{' '}
              <span className="font-normal italic" style={{ fontFamily: 'var(--font-newsreader)', color: '#2563EB' }}>
                one answer.
              </span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {FEATURES.slice(0, 3).map((f, i) => <FeatureCard key={f.title} {...f} index={i} />)}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {FEATURES.slice(3).map((f, i) => <FeatureCard key={f.title} {...f} index={i + 3} />)}
          </div>
        </div>
      </section>

      {/* ── DEMO ──────────────────────────────────────────── */}
      <section className="noise-bg-light relative overflow-hidden bg-[#EDE9DF] px-6 md:px-12 py-24 border-t border-zinc-200">
        {/* Blobs */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full pointer-events-none opacity-40"
          style={{ background: 'radial-gradient(circle, #BFDBFE 0%, transparent 70%)', transform: 'translate(20%, -30%)' }} />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full pointer-events-none opacity-30"
          style={{ background: 'radial-gradient(circle, #FCA5A5 0%, transparent 70%)', transform: 'translate(-20%, 30%)' }} />
        <div className="relative z-10 max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <span className="inline-block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 mb-3">Live demo</span>
            <h2 className="text-3xl md:text-5xl font-black text-zinc-900 tracking-tight" style={{ fontFamily: 'var(--font-syne)' }}>
              Same measure.{' '}
              <span className="font-normal italic" style={{ fontFamily: 'var(--font-newsreader)', color: '#DC2626' }}>
                different lives.
              </span>
            </h2>
            <p className="text-zinc-500 mt-3 text-base max-w-md mx-auto">
              Switch profiles and watch the explanation adapt — same legislation, entirely different impact.
            </p>
          </div>
          <DemoMockup />
        </div>
      </section>

      {/* ── HOW IT WORKS ──────────────────────────────────── */}
      <section className="noise-bg-light relative overflow-hidden bg-[#F9F7F2] px-6 md:px-12 py-24 border-t border-zinc-200">
        <div className="absolute inset-0 pointer-events-none"
          style={{ backgroundImage: 'linear-gradient(rgba(0,0,0,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.025) 1px, transparent 1px)', backgroundSize: '52px 52px' }} />
        <div className="relative z-10 max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <span className="inline-block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400 mb-3">Under the hood</span>
            <h2 className="text-3xl md:text-5xl font-black text-zinc-900 tracking-tight" style={{ fontFamily: 'var(--font-syne)' }}>
              How it works
            </h2>
          </div>

          <div className="relative">
            <div className="absolute left-5 top-2 bottom-2 w-px bg-zinc-200 hidden md:block" />
            <div className="flex flex-col gap-10">
              {STEPS.map((step, i) => <StepItem key={step.n} {...step} index={i} />)}
            </div>
          </div>

          <div className="text-center mt-16">
            <Link
              href="/ballot"
              className="inline-flex items-center gap-2 px-10 py-4 rounded-full font-semibold text-white text-sm bg-zinc-900 hover:bg-zinc-800 hover:scale-[1.02] transition-all shadow-md"
            >
              Try it on your ballot →
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────── */}
      <footer className="relative overflow-hidden bg-[#F2EFE9] border-t border-zinc-200 px-6 md:px-12 py-14">
        <div className="absolute inset-0 pointer-events-none"
          style={{ backgroundImage: 'linear-gradient(rgba(0,0,0,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.025) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        <div className="relative z-10 max-w-5xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-8 pb-8 border-b border-zinc-300">
            <span className="text-zinc-900 font-black tracking-[-0.03em] text-2xl" style={{ fontFamily: 'var(--font-syne)' }}>
              candid<span className="text-blue-500">.</span>
            </span>
            <div className="flex gap-2">
              {['housing', 'schools', 'transit', 'environment', 'safety'].map((tag, i) => (
                <span key={tag} className={`px-3 py-1 rounded-full text-xs font-medium border ${
                  [
                    'bg-blue-50 text-blue-600 border-blue-200',
                    'bg-green-50 text-green-600 border-green-200',
                    'bg-yellow-50 text-yellow-600 border-yellow-200',
                    'bg-red-50 text-red-600 border-red-200',
                    'bg-violet-50 text-violet-600 border-violet-200',
                  ][i]
                }`}>{tag}</span>
              ))}
            </div>
            <Link href="/ballot" className="px-6 py-2.5 rounded-full text-sm font-semibold bg-zinc-900 text-white hover:bg-zinc-700 transition-colors">
              Open app →
            </Link>
          </div>
          <div className="flex flex-col md:flex-row items-center justify-between gap-2 text-center md:text-left">
            <p className="text-zinc-400 text-xs">Built at IrvineHacks · February 2026</p>
            <p className="text-zinc-400 text-xs max-w-sm">All data sourced from public legislative records. Candid does not endorse any candidate or position.</p>
          </div>
        </div>
      </footer>

    </div>
  );
}
