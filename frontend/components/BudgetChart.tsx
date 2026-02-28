'use client';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { BudgetShift } from '@/lib/types';
import { getCategoryColor, formatDollar } from '@/lib/utils';

interface Props { shifts: BudgetShift[] }

interface TooltipPayloadItem { dataKey: string; value: number }
interface TooltipProps { active?: boolean; payload?: TooltipPayloadItem[]; label?: string }

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const personal = payload.find(p => p.dataKey === 'personal_annual_usd');
  const citywide = payload.find(p => p.dataKey === 'delta_pct');
  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-3 shadow text-xs">
      <p className="font-semibold mb-1 capitalize">{String(label).replace('_', ' ')}</p>
      {personal && <p>{formatDollar(personal.value)} for you</p>}
      {citywide && <p>{citywide.value > 0 ? '+' : ''}{citywide.value.toFixed(1)}% citywide</p>}
    </div>
  );
}

export function BudgetChart({ shifts }: Props) {
  const data = shifts.map(s => ({
    name: s.category,
    personal_annual_usd: s.personal_annual_usd,
    delta_pct: s.delta_pct,
    fill: getCategoryColor(s.category),
  }));

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
          <XAxis dataKey="name" tick={{ fontSize: 11 }} tickFormatter={v => String(v).replace('_', ' ')} />
          <YAxis yAxisId="left" tick={{ fontSize: 11 }} label={{ value: 'Your impact $', angle: -90, position: 'insideLeft', style: { fontSize: 10 } }} />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} label={{ value: 'City-wide %', angle: 90, position: 'insideRight', style: { fontSize: 10 } }} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar yAxisId="left" dataKey="personal_annual_usd" name="Your impact" fill="#6366f1" radius={[4, 4, 0, 0]} />
          <Bar yAxisId="right" dataKey="delta_pct" name="City-wide %" fill="#94a3b8" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
