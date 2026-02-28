'use client';
import useSWR from 'swr';
import { Race } from '@/lib/types';

const fetcher = (url: string) =>
  fetch(url).then(r => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

export function useRaces(zip: string | null) {
  const { data, error, isLoading } = useSWR<Race[]>(
    zip ? `${process.env.NEXT_PUBLIC_API_URL}/api/races?zip=${zip}` : null,
    fetcher,
    { shouldRetryOnError: false }
  );
  const races = Array.isArray(data) ? data : [];
  return { races, isLoading, error };
}
