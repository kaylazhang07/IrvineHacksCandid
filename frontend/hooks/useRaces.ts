'use client';
import useSWR from 'swr';
import { UserProfile } from '@/lib/types';

export interface RaceSource {
  title: string;
  url: string;
  source_type: string;
  accessed_date: string;
}

export interface RaceCandidate {
  name: string;
  party: string;
  bio: string;
  photo_url: string;
  website: string;
  phone: string;
  email: string;
  social: Record<string, string>;
  top_priorities: string[];
  budget_stance: Record<string, number>;
  platform_summary: string;
  experience: string[];
  endorsements: string[];
  sources: RaceSource[];
}

export interface Race {
  race_id: string;
  position: string;
  jurisdiction: string;
  division_id?: string;
  district?: string;
  candidates: RaceCandidate[];
}

const fetcher = (url: string) =>
  fetch(url).then(r => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

export function useRaces(profile: UserProfile | null) {
  const url = profile
    ? `${process.env.NEXT_PUBLIC_API_URL}/api/races?zip=${profile.zip_code}`
    : null;

  const { data, error, isLoading } = useSWR<Race[]>(url, fetcher, {
    shouldRetryOnError: false,
  });

  return { races: Array.isArray(data) ? data : [], isLoading, error };
}
