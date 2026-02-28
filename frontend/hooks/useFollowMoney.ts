'use client';
import useSWR from 'swr';
import { FollowMoneyResponse } from '@/lib/types';

const fetcher = (url: string) =>
  fetch(url).then(r => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

export function useFollowMoney(zip: string | null) {
  const { data, error, isLoading } = useSWR<FollowMoneyResponse>(
    zip ? `${process.env.NEXT_PUBLIC_API_URL}/api/follow-the-money?zip=${zip}` : null,
    fetcher,
    { shouldRetryOnError: false }
  );
  return { data: data ?? null, isLoading, error };
}
