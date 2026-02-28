'use client';
import useSWR from 'swr';
import { UserProfile } from '@/lib/types';

export interface Measure {
  measure_id: string;
  title: string;
  summary: string;
  category: string;
  personal_annual_usd: number;
}

const fetcher = (url: string) =>
  fetch(url).then(r => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

export function useMeasures(profile: UserProfile | null, topic?: string) {
  let url = profile
    ? `${process.env.NEXT_PUBLIC_API_URL}/api/measures?zip=${profile.zip_code}`
    : null;
  if (url && topic) url += `&topic=${encodeURIComponent(topic)}`;

  const { data, error, isLoading } = useSWR<Measure[]>(url, fetcher, {
    shouldRetryOnError: false,
  });
  const measures = Array.isArray(data) ? data : [];
  return { measures, isLoading, error };
}
