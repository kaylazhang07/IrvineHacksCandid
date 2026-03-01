'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useRaces, Race, RaceCandidate } from '@/hooks/useRaces';

const PARTY_COLORS: Record<string, string> = {
  Democratic: '#2563EB',
  'Democratic Party': '#2563EB',
  Democrat: '#2563EB',
  Republican: '#DC2626',
  'Republican Party': '#DC2626',
  Libertarian: '#F59E0B',
  Green: '#16A34A',
  Independent: '#6B7280',
  Nonpartisan: '#8B5CF6',
  Unknown: '#9CA3AF',
};

const JURISDICTION_ICONS: Record<string, string> = {
  Federal: '🏛',
  State: '🏢',
  County: '🏫',
  City: '🏘',
  country: '🏛',
  administrativeArea1: '🏢',
  administrativeArea2: '🏫',
  locality: '🏘',
};

function CandidateCard({ candidate }: { candidate: RaceCandidate }) {
  const [expanded, setExpanded] = useState(false);
  const partyColor = PARTY_COLORS[candidate.party] || '#9CA3AF';

  return (
    <motion.div
      layout
      className="bg-white rounded-xl border border-zinc-100 overflow-hidden"
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center gap-4 text-left hover:bg-zinc-50 transition-colors"
      >
        {/* Photo or initial */}
        {candidate.photo_url ? (
          <img
            src={candidate.photo_url}
            alt={candidate.name}
            className="w-12 h-12 rounded-full object-cover border-2 flex-shrink-0"
            style={{ borderColor: partyColor }}
          />
        ) : (
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
            style={{ backgroundColor: partyColor }}
          >
            {candidate.name.charAt(0)}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-zinc-900 text-sm">{candidate.name}</h4>
          <div className="flex items-center gap-2 mt-0.5">
            <span
              className="text-xs font-medium px-2 py-0.5 rounded-full"
              style={{ backgroundColor: `${partyColor}15`, color: partyColor }}
            >
              {candidate.party}
            </span>
          </div>
        </div>

        <motion.svg
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="w-4 h-4 text-zinc-400 flex-shrink-0"
          fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </motion.svg>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-zinc-100 pt-3 flex flex-col gap-3">
              {/* Experience */}
              {candidate.experience.length > 0 && (
                <div>
                  <p className="text-xs text-zinc-400 uppercase tracking-wider font-medium mb-1">Current Role</p>
                  <ul className="text-sm text-zinc-700">
                    {candidate.experience.map((exp, i) => (
                      <li key={i} className="flex items-center gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-zinc-300" />
                        {exp}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Contact / Links */}
              <div className="flex flex-wrap gap-2">
                {candidate.website && (
                  <a
                    href={candidate.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-100 hover:bg-zinc-200 text-xs font-medium text-zinc-700 transition-colors"
                  >
                    🌐 Website
                  </a>
                )}
                {candidate.phone && (
                  <a
                    href={`tel:${candidate.phone}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-100 hover:bg-zinc-200 text-xs font-medium text-zinc-700 transition-colors"
                  >
                    📞 {candidate.phone}
                  </a>
                )}
                {candidate.social?.twitter && (
                  <a
                    href={`https://twitter.com/${candidate.social.twitter}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 hover:bg-blue-100 text-xs font-medium text-blue-700 transition-colors"
                  >
                    𝕏 @{candidate.social.twitter}
                  </a>
                )}
                {candidate.social?.facebook && (
                  <a
                    href={`https://facebook.com/${candidate.social.facebook}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 hover:bg-blue-100 text-xs font-medium text-blue-700 transition-colors"
                  >
                    📘 Facebook
                  </a>
                )}
              </div>

              {/* Sources */}
              {candidate.sources.length > 0 && (
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-[10px] text-zinc-400">Source:</span>
                  {candidate.sources.map((s, i) => (
                    <a
                      key={i}
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-blue-500 hover:underline"
                    >
                      {s.title}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function RaceCard({ race, index }: { race: Race; index: number }) {
  const icon = JURISDICTION_ICONS[race.jurisdiction] || '📋';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.4 }}
      className="bg-white rounded-2xl p-5 shadow-sm border border-zinc-100"
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">{icon}</span>
        <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">
          {race.jurisdiction}
        </span>
      </div>

      <h3 className="font-bold text-zinc-900 text-base mb-3">{race.position}</h3>

      <div className="flex flex-col gap-2">
        {race.candidates.map((c, i) => (
          <CandidateCard key={`${c.name}-${i}`} candidate={c} />
        ))}
      </div>
    </motion.div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl p-5 border border-zinc-100 animate-pulse">
      <div className="h-3 w-16 bg-zinc-200 rounded mb-2" />
      <div className="h-5 w-48 bg-zinc-200 rounded mb-4" />
      <div className="h-16 bg-zinc-100 rounded-xl" />
    </div>
  );
}

export default function RacesPage() {
  const router = useRouter();
  const { profile } = useUserProfile();
  const { races, isLoading, error } = useRaces(profile);

  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem('candid_user_profile')) {
      router.replace('/');
    }
  }, [router]);

  // Group by jurisdiction
  const groups: Record<string, Race[]> = {};
  for (const race of races) {
    const key = race.jurisdiction;
    if (!groups[key]) groups[key] = [];
    groups[key].push(race);
  }

  const order = ['Federal', 'country', 'State', 'administrativeArea1', 'County', 'administrativeArea2', 'City', 'locality'];
  const sortedKeys = Object.keys(groups).sort((a, b) => order.indexOf(a) - order.indexOf(b));

  return (
    <div className="max-w-lg mx-auto px-4 py-6 pb-20">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-bold text-zinc-900">
          Your Races{profile ? ` — ${profile.zip_code}` : ''}
        </h1>
      </div>
      <div className="flex items-center gap-2 mb-6">
        <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-medium">
          Real officeholder data
        </span>
        <span className="text-xs text-zinc-400">via Google Civic Information API</span>
      </div>

      {isLoading && (
        <div className="flex flex-col gap-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm text-red-700 font-medium">Could not load race data</p>
          <p className="text-xs text-red-500 mt-1">{error.message}</p>
        </div>
      )}

      {!isLoading && !error && (
        <div className="flex flex-col gap-6">
          {sortedKeys.map(key => (
            <div key={key}>
              <h2 className="text-xs text-zinc-400 uppercase tracking-wider font-semibold mb-3">
                {JURISDICTION_ICONS[key] || '📋'} {key} offices
              </h2>
              <div className="flex flex-col gap-3">
                {groups[key].map((race, i) => (
                  <RaceCard key={race.race_id} race={race} index={i} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
