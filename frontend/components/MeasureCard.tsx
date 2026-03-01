'use client';
import { motion } from 'framer-motion';
import {
  HeartPulse, BookOpen, Bus, TrendingUp,
  ShieldCheck, Home, Leaf, DollarSign, Droplets, Layers,
} from 'lucide-react';
import { getCategoryColor, prettifyTitle } from '@/lib/utils';

export interface MeasureCardProps {
  measureId: string;
  title: string;
  summary: string;
  category: string;
  estimatedImpact: number;
  index?: number;
  maxImpact?: number;
  selected?: boolean;
  onSelect: () => void;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  healthcare:      <HeartPulse size={12} />,
  education:       <BookOpen size={12} />,
  transportation:  <Bus size={12} />,
  public_safety:   <ShieldCheck size={12} />,
  housing:         <Home size={12} />,
  environment:     <Leaf size={12} />,
  economy:         <TrendingUp size={12} />,
  taxes:           <DollarSign size={12} />,
  water_utilities: <Droplets size={12} />,
};

/** Fillable ballot oval — animates fill on selection */
function BallotOval({ filled, color }: { filled: boolean; color: string }) {
  return (
    <svg width="26" height="16" viewBox="0 0 26 16" style={{ flexShrink: 0 }}>
      <ellipse cx="13" cy="8" rx="12" ry="7"
        fill={filled ? color : 'none'}
        stroke={filled ? color : '#CBD5E1'}
        strokeWidth="1.5"
        style={{ transition: 'fill 0.2s ease, stroke 0.2s ease' }}
      />
      {/* Inner white sheen when filled — gives a "stamped" look */}
      {filled && (
        <ellipse cx="13" cy="8" rx="6" ry="3.5"
          fill="white" opacity={0.25}
          style={{ transition: 'opacity 0.2s ease' }}
        />
      )}
    </svg>
  );
}

function formatBadge(abs: number): string {
  const n = Math.round(abs);
  if (n === 0) return 'Free';
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${n.toLocaleString()}`;
}

const EASE = [0.22, 1, 0.36, 1] as const;

export function MeasureCard({
  measureId, title, summary, category,
  estimatedImpact, index = 0, maxImpact = 1,
  selected = false, onSelect,
}: MeasureCardProps) {
  const color      = getCategoryColor(category);
  const safeImpact = isFinite(+estimatedImpact) ? +estimatedImpact : 0;
  const isSavings  = safeImpact < 0;
  const isZero     = Math.round(Math.abs(safeImpact)) === 0;
  const icon       = CATEGORY_ICONS[category] ?? <Layers size={12} />;
  const barPct     = Math.min((Math.abs(safeImpact) / Math.max(maxImpact, 1)) * 100, 100);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06, ease: EASE }}
      onClick={onSelect}
      className="relative flex items-start gap-4 px-6 py-5 cursor-pointer transition-colors duration-150"
      style={{ background: selected ? `${color}08` : undefined }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.background = '#F8FAFC'; }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.background = ''; }}
    >
      {/* Left accent bar — slides in when selected */}
      <motion.div
        className="absolute left-0 top-4 bottom-4 w-[3px] rounded-full"
        style={{ background: color }}
        animate={{ scaleY: selected ? 1 : 0, opacity: selected ? 1 : 0 }}
        initial={false}
        transition={{ duration: 0.25, ease: EASE }}
      />

      {/* Ballot oval */}
      <div className="pt-0.5">
        <BallotOval filled={selected} color={color} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Row: ghost category pill ←→ impact badge */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="inline-flex items-center gap-1 bg-slate-50 border border-slate-100 rounded-full px-2 py-0.5 flex-shrink-0">
            <span style={{ color, display: 'flex' }}>{icon}</span>
            <span className="text-[10px] font-medium text-slate-500 capitalize leading-none">
              {category.replace(/_/g, ' ')}
            </span>
          </div>

          <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
            isZero
              ? 'bg-slate-100 text-slate-500'
              : isSavings ? 'bg-emerald-50 text-emerald-700'
              : 'bg-rose-50 text-rose-700'
          }`}>
            {!isZero && (isSavings ? '▼' : '▲')}
            <span className="font-mono">{formatBadge(Math.abs(safeImpact))}</span>
          </span>
        </div>

        {/* Bill title — always 2 lines max for uniform row heights */}
        <h3
          className="text-[14px] font-bold text-slate-900 leading-snug line-clamp-2"
          style={{ fontFamily: 'var(--font-serif, Georgia, "Times New Roman", serif)' }}
        >
          {prettifyTitle(title, measureId)}
        </h3>

        {/* Impact magnitude bar — data viz, not decoration */}
        <div className="mt-3 h-0.5 rounded-full relative overflow-hidden"
          style={{ background: isZero ? '#E2E8F0' : '#F1F5F9' }}
        >
          {!isZero && (
            <motion.div
              className={`absolute top-0 h-full rounded-full ${
                isSavings ? 'right-0 bg-emerald-400' : 'left-0 bg-rose-400'
              }`}
              initial={{ width: 0 }}
              animate={{ width: `${barPct}%` }}
              transition={{ duration: 0.9, delay: index * 0.06 + 0.3, ease: [0.25, 1, 0.5, 1] }}
            />
          )}
        </div>
      </div>
    </motion.div>
  );
}
