import { ExplainRequest, ExplainResponse, BudgetRequest, BudgetResponse, MapPin } from '@/lib/types';

const BASE = process.env.NEXT_PUBLIC_API_URL;

export async function explainMeasure(req: ExplainRequest): Promise<ExplainResponse> {
  const res = await fetch(`${BASE}/api/explain`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error('Failed to explain measure');
  return res.json();
}

export async function getBudgetImpact(req: BudgetRequest): Promise<BudgetResponse> {
  const res = await fetch(`${BASE}/api/budget-impact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error('Failed to get budget impact');
  return res.json();
}

export async function getMapPins(measureId: string): Promise<MapPin[]> {
  const res = await fetch(`${BASE}/api/map-pins/${measureId}`);
  if (!res.ok) throw new Error('Failed to get map pins');
  return res.json();
}
