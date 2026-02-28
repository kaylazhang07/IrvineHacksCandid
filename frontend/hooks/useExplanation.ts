'use client';
import useSWR from 'swr';
import { ExplainResponse, UserProfile } from '@/lib/types';

export function useExplanation(measureId: string, measureText: string, user: UserProfile | null, measureTitle?: string) {
  return useSWR<ExplainResponse>(
    user ? ['explain', measureId, user.zip_code, user.housing_status] : null,
    async () => {
      const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/explain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ measure_id: measureId, measure_text: measureText, measure_title: measureTitle ?? measureId, user }),
      });
      if (!r.ok) {
        const detail = await r.text();
        throw new Error(`${r.status}: ${detail}`);
      }
      return r.json();
    },
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  );
}
