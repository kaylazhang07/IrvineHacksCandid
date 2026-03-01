'use client';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { BudgetShift } from '@/lib/types';
import { getCategoryColor, formatDollar } from '@/lib/utils';

interface Props { shifts: BudgetShift[] }

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { payload: { name: string; personal_annual_usd: number; delta_pct: number } }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const isPos = d.personal_annual_usd >= 0;
  return (
    <div style={{
      background: '#FDFCF8', border: '1px solid rgba(180,155,120,0.22)',
      borderRadius: 12, padding: '10px 14px', fontSize: 12,
      boxShadow: '0 4px 16px rgba(60,40,20,0.08)',
    }}>
      <p style={{ fontWeight: 700, color: '#1C1917', marginBottom: 4, textTransform: 'capitalize' }}>
        {d.name.replace(/_/g, ' ')}
      </p>
      <p style={{ color: isPos ? '#B91C1C' : '#15803D', fontWeight: 600 }}>
        {formatDollar(d.personal_annual_usd)} / yr
      </p>
      <p style={{ color: '#78716C', marginTop: 2 }}>
        {d.delta_pct >= 0 ? '+' : ''}{d.delta_pct.toFixed(1)}% citywide
      </p>
    </div>
  );
}

export function BudgetChart({ shifts }: Props) {
  const safeNum = (v: number) => isFinite(+v) ? +v : 0;
  const data = shifts.map(s => ({
    name: s.category,
    personal_annual_usd: safeNum(s.personal_annual_usd),
    delta_pct: safeNum(s.delta_pct),
    value: Math.max(Math.abs(safeNum(s.personal_annual_usd)), 1),
    color: getCategoryColor(s.category),
  }));

  return (
    <div className="flex items-center gap-6">
      {/* Donut */}
      <div style={{ width: 160, height: 160, flexShrink: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius="58%"
              outerRadius="82%"
              paddingAngle={2}
              dataKey="value"
              strokeWidth={0}
            >
              {data.map((d, i) => (
                <Cell key={i} fill={d.color} opacity={0.88} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex flex-col gap-2 flex-1 min-w-0">
        {data.map(d => {
          const isPos = d.personal_annual_usd >= 0;
          return (
            <div key={d.name} className="flex items-center gap-2">
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: '#78716C', flex: 1, textTransform: 'capitalize', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {d.name.replace(/_/g, ' ')}
              </span>
              <span style={{
                fontSize: 11, fontWeight: 700, flexShrink: 0,
                color: isPos ? '#B91C1C' : '#15803D',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {isPos ? '▲' : '▼'}{Math.abs(Math.round(d.personal_annual_usd))}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
