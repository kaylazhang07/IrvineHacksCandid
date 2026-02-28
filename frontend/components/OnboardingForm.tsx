'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { UserProfile } from '@/lib/types';
import { useUserProfile } from '@/hooks/useUserProfile';

const CONCERNS = ['housing', 'schools', 'transit', 'environment', 'public safety'];
const INCOME_OPTIONS: { label: string; value: UserProfile['household_income_bracket'] }[] = [
  { label: 'Under $50k', value: 'under_50k' },
  { label: '$50k–$100k', value: '50_100k' },
  { label: '$100k–$200k', value: '100_200k' },
  { label: 'Over $200k', value: 'over_200k' },
];

export function OnboardingForm() {
  const router = useRouter();
  const { setProfile } = useUserProfile();
  const [step, setStep] = useState(0);
  const [zip, setZip] = useState('');
  const [housing, setHousing] = useState<UserProfile['housing_status'] | ''>('');
  const [children, setChildren] = useState<boolean | null>(null);
  const [income, setIncome] = useState<UserProfile['household_income_bracket'] | ''>('');
  const [concerns, setConcerns] = useState<string[]>([]);

  function next() { setStep(s => s + 1); }

  function toggleConcern(c: string) {
    setConcerns(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  }

  function submit() {
    const profile: UserProfile = {
      zip_code: zip,
      housing_status: housing as UserProfile['housing_status'],
      has_children: children!,
      household_income_bracket: income as UserProfile['household_income_bracket'],
      primary_concerns: concerns,
    };
    setProfile(profile);
    router.push('/ballot');
  }

  const variants = {
    enter: { x: 60, opacity: 0 },
    center: { x: 0, opacity: 1 },
    exit: { x: -60, opacity: 0 },
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 py-12">
      <div className="w-full max-w-md">
        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-10">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={`w-2 h-2 rounded-full transition-colors ${i <= step ? 'bg-zinc-800' : 'bg-zinc-300'}`} />
          ))}
        </div>

        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div key="step0" variants={variants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.25 }}>
              <h1 className="text-2xl font-bold mb-2 text-zinc-900">Find your ballot</h1>
              <p className="text-zinc-800 mb-6">Enter your ZIP code to see measures on your ballot.</p>
              <input
                type="text" inputMode="numeric" maxLength={5}
                placeholder="94601"
                value={zip} onChange={e => setZip(e.target.value)}
                className="w-full border border-zinc-300 rounded-xl px-4 py-3 text-lg mb-4 focus:outline-none focus:ring-2 focus:ring-zinc-800 text-zinc-900 placeholder:text-zinc-500"
              />
              <button
                onClick={next} disabled={zip.length !== 5}
                className="w-full bg-zinc-900 text-white rounded-xl py-3 font-semibold disabled:opacity-40"
              >
                Find my ballot →
              </button>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div key="step1" variants={variants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.25 }}>
              <h1 className="text-2xl font-bold mb-2">Your housing situation</h1>
              <p className="text-zinc-500 mb-6">This helps personalize financial impacts.</p>
              <div className="grid gap-3">
                {(['renter', 'owner', 'other'] as const).map(h => (
                  <button key={h} onClick={() => { setHousing(h); next(); }}
                    className="w-full border-2 rounded-xl py-4 text-left px-5 font-medium capitalize transition-colors hover:border-zinc-800 hover:bg-zinc-50">
                    {h === 'renter' ? '🏠 Renter' : h === 'owner' ? '🏡 Owner' : '🏢 Other'}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="step2" variants={variants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.25 }}>
              <h1 className="text-2xl font-bold mb-2">Do you have children?</h1>
              <p className="text-zinc-500 mb-6">School-related measures affect families differently.</p>
              <div className="grid gap-3">
                {[{ label: '👶 Yes', val: true }, { label: '🚫 No', val: false }].map(({ label, val }) => (
                  <button key={String(val)} onClick={() => { setChildren(val); next(); }}
                    className="w-full border-2 rounded-xl py-4 text-left px-5 font-medium hover:border-zinc-800 hover:bg-zinc-50">
                    {label}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key="step3" variants={variants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.25 }}>
              <h1 className="text-2xl font-bold mb-2">Household income</h1>
              <p className="text-zinc-500 mb-6">Used only to estimate your personal dollar impact.</p>
              <div className="grid gap-3">
                {INCOME_OPTIONS.map(({ label, value }) => (
                  <button key={value} onClick={() => { setIncome(value); next(); }}
                    className="w-full border-2 rounded-xl py-4 text-left px-5 font-medium hover:border-zinc-800 hover:bg-zinc-50">
                    {label}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div key="step4" variants={variants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.25 }}>
              <h1 className="text-2xl font-bold mb-2">What matters most to you?</h1>
              <p className="text-zinc-500 mb-6">Select all that apply.</p>
              <div className="flex flex-wrap gap-2 mb-6">
                {CONCERNS.map(c => (
                  <button key={c} onClick={() => toggleConcern(c)}
                    className={`px-4 py-2 rounded-full border-2 font-medium text-sm capitalize transition-colors ${concerns.includes(c) ? 'bg-zinc-900 text-white border-zinc-900' : 'border-zinc-300 hover:border-zinc-600'}`}>
                    {c}
                  </button>
                ))}
              </div>
              <button onClick={submit} disabled={concerns.length === 0}
                className="w-full bg-zinc-900 text-white rounded-xl py-3 font-semibold disabled:opacity-40">
                See my ballot →
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
