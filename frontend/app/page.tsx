'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { OnboardingForm } from '@/components/OnboardingForm';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    try {
      const stored = localStorage.getItem('candid_user_profile');
      if (stored) router.replace('/ballot');
    } catch {}
  }, [router]);

  return <OnboardingForm />;
}
