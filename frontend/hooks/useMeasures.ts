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

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function useMeasures(profile: UserProfile | null) {
  const { data, error, isLoading } = useSWR<Measure[]>(
    profile ? `${process.env.NEXT_PUBLIC_API_URL}/api/measures?zip=${profile.zip_code}` : null,
    fetcher
  );
  return { measures: data ?? [], isLoading, error };
}
