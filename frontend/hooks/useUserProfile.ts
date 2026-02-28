'use client';
import { useState, useEffect } from 'react';
import { UserProfile } from '@/lib/types';

const KEY = 'candid_user_profile';

export function useUserProfile() {
  const [profile, setProfileState] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(KEY);
      if (stored) setProfileState(JSON.parse(stored));
    } catch {}
  }, []);

  function setProfile(p: UserProfile) {
    localStorage.setItem(KEY, JSON.stringify(p));
    setProfileState(p);
  }

  function clearProfile() {
    localStorage.removeItem(KEY);
    setProfileState(null);
  }

  return { profile, setProfile, clearProfile };
}
