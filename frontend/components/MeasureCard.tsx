'use client';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { formatDollar, getCategoryColor } from '@/lib/utils';

interface Props {
  measureId: string;
  title: string;
  summary: string;
  category: string;
  estimatedImpact: number;
}

export function MeasureCard({ measureId, title, summary, category, estimatedImpact }: Props) {
  const router = useRouter();
  const color = getCategoryColor(category);
  const positive = estimatedImpact >= 0;

  return (
    <motion.div
      whileHover={{ y: -2 }}
      onClick={() => {
        sessionStorage.setItem(`measure_${measureId}`, JSON.stringify({ title, text: summary }));
        router.push(`/ballot/${measureId}`);
      }}
      className="bg-white rounded-2xl p-4 shadow-sm border border-zinc-100 cursor-pointer"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
            <span className="text-xs font-medium capitalize" style={{ color }}>{category.replace('_', ' ')}</span>
          </div>
          <h3 className="font-semibold text-zinc-900 leading-snug mb-1">{title}</h3>
          <p className="text-sm text-zinc-500 line-clamp-2">{summary}</p>
        </div>
        <div className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-semibold ${positive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {formatDollar(estimatedImpact)}
        </div>
      </div>
    </motion.div>
  );
}
