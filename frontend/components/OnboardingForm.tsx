'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, BookOpen, Home, Car, Leaf, Shield, Briefcase, LucideIcon } from 'lucide-react';
import { UserProfile, Topic } from '@/lib/types';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useTopics } from '@/hooks/useTopics';

const INCOME_OPTIONS: { label: string; value: UserProfile['household_income_bracket'] }[] = [
  { label: 'Under $50k', value: 'under_50k' },
  { label: '$50k–$100k', value: '50_100k' },
  { label: '$100k–$200k', value: '100_200k' },
  { label: 'Over $200k', value: 'over_200k' },
];

const AGE_OPTIONS: { label: string; value: NonNullable<UserProfile['age_bracket']> }[] = [
  { label: '🧑 Under 25', value: 'under_25' },
  { label: '🙋 25–34', value: '25_34' },
  { label: '👔 35–49', value: '35_49' },
  { label: '🧑‍🦳 50–64', value: '50_64' },
  { label: '🧓 65+', value: '65_plus' },
];

const COMMUTE_OPTIONS: { label: string; value: NonNullable<UserProfile['commute_method']>; emoji: string }[] = [
  { label: 'Drive / carpool', value: 'drive', emoji: '🚗' },
  { label: 'Public transit', value: 'transit', emoji: '🚌' },
  { label: 'Bike or walk', value: 'bike_walk', emoji: '🚲' },
  { label: 'Work from home', value: 'wfh', emoji: '🏠' },
];

const ICON_MAP: Record<string, LucideIcon> = {
  heart: Heart,
  book: BookOpen,
  home: Home,
  car: Car,
  leaf: Leaf,
  shield: Shield,
  briefcase: Briefcase,
};

const FALLBACK_TOPICS: Topic[] = [
  { id: 'housing', label: 'Housing', icon: 'home' },
  { id: 'education', label: 'Education', icon: 'book' },
  { id: 'environment', label: 'Environment', icon: 'leaf' },
  { id: 'public_safety', label: 'Public Safety', icon: 'shield' },
  { id: 'transportation', label: 'Transportation', icon: 'car' },
  { id: 'healthcare', label: 'Healthcare', icon: 'heart' },
  { id: 'jobs', label: 'Jobs & Economy', icon: 'briefcase' },
];

const TOTAL_STEPS = 10;

export function OnboardingForm() {
  const router = useRouter();
  const { setProfile } = useUserProfile();
  const { topics: fetchedTopics } = useTopics();
  const topics = fetchedTopics.length > 0 ? fetchedTopics : FALLBACK_TOPICS;

  // Step 0 — Tell us about yourself
  const [goals, setGoals] = useState('');
  // Step 1 — ZIP
  const [zip, setZip] = useState('');
  // Step 2 — Housing
  const [housing, setHousing] = useState<UserProfile['housing_status'] | ''>('');
  // Step 3 — Commute
  const [commute, setCommute] = useState<UserProfile['commute_method'] | ''>('');
  // Step 4 — Children
  const [children, setChildren] = useState<boolean | null>(null);
  // Step 5 — Age
  const [ageBracket, setAgeBracket] = useState<UserProfile['age_bracket'] | ''>('');
  // Step 6 — Income
  const [income, setIncome] = useState<UserProfile['household_income_bracket'] | ''>('');
  // Step 7 — Job
  const [job, setJob] = useState('');
  // Step 8 — Owns business
  const [ownsBusiness, setOwnsBusiness] = useState<boolean | null>(null);
  // Step 9 — Topics + submit
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);

  const [step, setStep] = useState(0);

  function next() { setStep(s => s + 1); }

  function toggleTopic(id: string) {
    setSelectedTopics(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  function submit() {
    const profile: UserProfile = {
      zip_code: zip,
      housing_status: housing as UserProfile['housing_status'],
      has_children: children!,
      household_income_bracket: income as UserProfile['household_income_bracket'],
      primary_concerns: selectedTopics,
      job: job.trim() || undefined,
      goals: goals.trim() ? [goals.trim()] : undefined,
      age_bracket: (ageBracket || undefined) as UserProfile['age_bracket'],
      commute_method: (commute || undefined) as UserProfile['commute_method'],
      owns_business: ownsBusiness ?? undefined,
    };
    setProfile(profile);
    router.push('/ballot');
  }

  const variants = {
    enter: { x: 60, opacity: 0 },
    center: { x: 0, opacity: 1 },
    exit: { x: -60, opacity: 0 },
  };

  const transition = { duration: 0.25 };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 py-12">
      <div className="w-full max-w-md">

        {/* Progress bar */}
        <div className="flex justify-center gap-1.5 mb-10">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i < step
                  ? 'bg-zinc-800 w-6'
                  : i === step
                  ? 'bg-zinc-800 w-4'
                  : 'bg-zinc-200 w-1.5'
              }`}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">

          {/* Step 0: Tell us about yourself */}
          {step === 0 && (
            <motion.div key="step0" variants={variants} initial="enter" animate="center" exit="exit" transition={transition}>
              <h1 className="text-2xl font-bold mb-1 text-zinc-900">Tell us about yourself</h1>
              <p className="text-zinc-500 mb-6 text-sm">
                Share anything that helps us personalize your guide — your job, concerns, or goals.
              </p>
              <textarea
                rows={5}
                autoFocus
                placeholder="e.g. I'm a teacher in Irvine, concerned about school funding and traffic on my commute. I rent an apartment and want to know how local taxes will affect me..."
                value={goals}
                onChange={e => setGoals(e.target.value)}
                className="w-full border border-zinc-300 rounded-xl px-4 py-3 text-base mb-4 focus:outline-none focus:ring-2 focus:ring-zinc-800 text-zinc-900 placeholder:text-zinc-400 resize-none leading-relaxed"
              />
              <button
                onClick={next}
                className="w-full bg-zinc-900 text-white rounded-xl py-3 font-semibold hover:bg-zinc-800 transition-colors"
              >
                {goals.trim() ? 'Continue →' : 'Skip for now →'}
              </button>
            </motion.div>
          )}

          {/* Step 1: ZIP */}
          {step === 1 && (
            <motion.div key="step1" variants={variants} initial="enter" animate="center" exit="exit" transition={transition}>
              <h1 className="text-2xl font-bold mb-1 text-zinc-900">Your ZIP code</h1>
              <p className="text-zinc-500 mb-6 text-sm">We use this to identify the specific ballot in your county.</p>
              <input
                type="text"
                inputMode="numeric"
                maxLength={5}
                autoFocus
                placeholder="92602"
                value={zip}
                onChange={e => setZip(e.target.value)}
                className="w-full border border-zinc-300 rounded-xl px-4 py-3 text-lg mb-4 focus:outline-none focus:ring-2 focus:ring-zinc-800 text-zinc-900 placeholder:text-zinc-400"
              />
              <button
                onClick={next}
                disabled={zip.length !== 5}
                className="w-full bg-zinc-900 text-white rounded-xl py-3 font-semibold disabled:opacity-40 hover:bg-zinc-800 transition-colors"
              >
                Find my ballot →
              </button>
            </motion.div>
          )}

          {/* Step 2: Housing */}
          {step === 2 && (
            <motion.div key="step2" variants={variants} initial="enter" animate="center" exit="exit" transition={transition}>
              <h1 className="text-2xl font-bold mb-1">Your housing situation</h1>
              <p className="text-zinc-500 mb-6 text-sm">This helps personalize financial impacts.</p>
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

          {/* Step 3: Commute */}
          {step === 3 && (
            <motion.div key="step3" variants={variants} initial="enter" animate="center" exit="exit" transition={transition}>
              <h1 className="text-2xl font-bold mb-1">How do you get around?</h1>
              <p className="text-zinc-500 mb-6 text-sm">Helps us weigh transit, road, and infrastructure measures.</p>
              <div className="grid gap-3">
                {COMMUTE_OPTIONS.map(({ label, value, emoji }) => (
                  <button key={value} onClick={() => { setCommute(value); next(); }}
                    className="w-full border-2 rounded-xl py-4 text-left px-5 font-medium transition-colors hover:border-zinc-800 hover:bg-zinc-50">
                    {emoji} {label}
                  </button>
                ))}
              </div>
              <button onClick={next} className="mt-3 text-sm text-zinc-400 hover:text-zinc-600 w-full text-center">
                Skip
              </button>
            </motion.div>
          )}

          {/* Step 4: Children */}
          {step === 4 && (
            <motion.div key="step4" variants={variants} initial="enter" animate="center" exit="exit" transition={transition}>
              <h1 className="text-2xl font-bold mb-1">Do you have children?</h1>
              <p className="text-zinc-500 mb-6 text-sm">School-related measures affect families differently.</p>
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

          {/* Step 5: Age */}
          {step === 5 && (
            <motion.div key="step5" variants={variants} initial="enter" animate="center" exit="exit" transition={transition}>
              <h1 className="text-2xl font-bold mb-1">How old are you?</h1>
              <p className="text-zinc-500 mb-6 text-sm">Different age groups are impacted differently by housing, pension, and healthcare measures.</p>
              <div className="grid gap-3">
                {AGE_OPTIONS.map(({ label, value }) => (
                  <button key={value} onClick={() => { setAgeBracket(value); next(); }}
                    className="w-full border-2 rounded-xl py-4 text-left px-5 font-medium transition-colors hover:border-zinc-800 hover:bg-zinc-50">
                    {label}
                  </button>
                ))}
              </div>
              <button onClick={next} className="mt-3 text-sm text-zinc-400 hover:text-zinc-600 w-full text-center">
                Skip
              </button>
            </motion.div>
          )}

          {/* Step 6: Income */}
          {step === 6 && (
            <motion.div key="step6" variants={variants} initial="enter" animate="center" exit="exit" transition={transition}>
              <h1 className="text-2xl font-bold mb-1">Household income</h1>
              <p className="text-zinc-500 mb-6 text-sm">Used only to estimate your personal dollar impact.</p>
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

          {/* Step 7: Job */}
          {step === 7 && (
            <motion.div key="step7" variants={variants} initial="enter" animate="center" exit="exit" transition={transition}>
              <h1 className="text-2xl font-bold mb-1">What do you do?</h1>
              <p className="text-zinc-500 mb-6 text-sm">Helps us explain how policies affect your livelihood.</p>
              <input
                type="text"
                autoFocus
                placeholder="e.g. Software engineer, Teacher, Retired..."
                value={job}
                onChange={e => setJob(e.target.value)}
                className="w-full border border-zinc-300 rounded-xl px-4 py-3 text-base mb-4 focus:outline-none focus:ring-2 focus:ring-zinc-800 text-zinc-900 placeholder:text-zinc-400"
              />
              <button
                onClick={next}
                className="w-full bg-zinc-900 text-white rounded-xl py-3 font-semibold hover:bg-zinc-800 transition-colors"
              >
                {job.trim() ? 'Continue →' : 'Skip for now →'}
              </button>
            </motion.div>
          )}

          {/* Step 8: Own a business? */}
          {step === 8 && (
            <motion.div key="step8" variants={variants} initial="enter" animate="center" exit="exit" transition={transition}>
              <h1 className="text-2xl font-bold mb-1">Do you own a business?</h1>
              <p className="text-zinc-500 mb-6 text-sm">Tax, zoning, and licensing measures can have big impacts on business owners.</p>
              <div className="grid gap-3">
                {[{ label: '✅ Yes', val: true }, { label: '🚫 No', val: false }].map(({ label, val }) => (
                  <button key={String(val)} onClick={() => { setOwnsBusiness(val); next(); }}
                    className="w-full border-2 rounded-xl py-4 text-left px-5 font-medium hover:border-zinc-800 hover:bg-zinc-50">
                    {label}
                  </button>
                ))}
              </div>
              <button onClick={next} className="mt-3 text-sm text-zinc-400 hover:text-zinc-600 w-full text-center">
                Skip
              </button>
            </motion.div>
          )}

          {/* Step 9: Topics + Submit */}
          {step === 9 && (
            <motion.div key="step9" variants={variants} initial="enter" animate="center" exit="exit" transition={transition}>
              <h1 className="text-2xl font-bold mb-1">What matters to you?</h1>
              <p className="text-zinc-500 mb-6 text-sm">Select topics to highlight on your ballot.</p>
              <div className="flex flex-wrap gap-2 mb-8">
                {topics.map(topic => {
                  const Icon = ICON_MAP[topic.icon] ?? Briefcase;
                  const active = selectedTopics.includes(topic.id);
                  return (
                    <button
                      key={topic.id}
                      onClick={() => toggleTopic(topic.id)}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-full border-2 font-medium text-sm transition-colors ${
                        active
                          ? 'bg-zinc-900 text-white border-zinc-900'
                          : 'border-zinc-300 text-zinc-700 hover:border-zinc-600'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {topic.label}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={submit}
                className="w-full bg-zinc-900 text-white rounded-xl py-3 font-semibold hover:bg-zinc-800 transition-colors"
              >
                See my ballot →
              </button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}