'use client';
import useSWR from 'swr';
import { Topic } from '@/lib/types';

const fetcher = (url: string) =>
  fetch(url).then(r => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

export function useTopics() {
  const { data, error, isLoading } = useSWR<Topic[]>(
    `${process.env.NEXT_PUBLIC_API_URL}/api/topics`,
    fetcher,
    { shouldRetryOnError: false }
  );
  const topics = Array.isArray(data) ? data : [];
  return { topics, isLoading, error };
}
