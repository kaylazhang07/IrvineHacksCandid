'use client';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useMeasures } from '@/hooks/useMeasures';
import BallotExportHub from '@/components/BallotExportHub';

export default function GlobalExportHub() {
  const { profile } = useUserProfile();
  const { measures } = useMeasures(profile);
  const sorted = (Array.isArray(measures) ? [...measures] : [])
    .sort((a, b) => Math.abs(b.personal_annual_usd) - Math.abs(a.personal_annual_usd));
  return <BallotExportHub measures={sorted} />;
}
