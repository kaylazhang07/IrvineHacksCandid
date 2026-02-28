'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { MapPin } from '@/lib/types';

interface Props {
  pin: MapPin | null;
  onClose: () => void;
}

const PILL_COLORS: Record<string, string> = {
  housing:       '#818cf8',
  education:     '#a78bfa',
  transportation:'#38bdf8',
  public_safety: '#fb7185',
  environment:   '#4ade80',
  healthcare:    '#f472b6',
  economy:       '#fbbf24',
  other:         '#94a3b8',
};

const CATEGORY_LABELS: Record<string, string> = {
  housing: 'Housing', education: 'Education', transportation: 'Transit',
  public_safety: 'Safety', environment: 'Environment', healthcare: 'Health',
  economy: 'Economy', other: 'Other',
};

export function MapInfoCard({ pin, onClose }: Props) {
  const router = useRouter();
  const [citationsOpen, setCitationsOpen] = useState(false);

  function handleViewMeasure() {
    if (!pin) return;
    sessionStorage.setItem(`measure_${pin.measure_id}`, JSON.stringify({ title: pin.label, text: '' }));
    router.push(`/ballot/${pin.measure_id}`);
  }

  const color = pin ? (PILL_COLORS[pin.category] ?? PILL_COLORS.other) : '#94a3b8';
  const label = pin ? (CATEGORY_LABELS[pin.category] ?? pin.category) : '';

  return (
    <AnimatePresence>
      {pin && (
        <>
          {/* Backdrop tap-to-close */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-10"
            onClick={onClose}
          />

          {/* Slide-up card */}
          <motion.div
            key="card"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="absolute bottom-0 left-0 right-0 z-20 bg-white rounded-t-3xl shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-zinc-200" />
            </div>

            <div className="px-6 pb-8 pt-2">
              {/* Header */}
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex-1 min-w-0">
                  <span
                    className="inline-block text-xs font-bold px-2.5 py-0.5 rounded-full text-white mb-2"
                    style={{ backgroundColor: color }}
                  >
                    {label}
                  </span>
                  <h2 className="text-lg font-bold text-zinc-900 leading-tight">{pin.label}</h2>
                </div>
                <button
                  onClick={onClose}
                  className="flex-shrink-0 mt-1 text-zinc-400 hover:text-zinc-700 transition-colors"
                  aria-label="Close"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* What this means for you */}
              {pin.address && (
                <div className="bg-zinc-50 rounded-2xl px-4 py-3 mb-4">
                  <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1">
                    What this means here
                  </p>
                  <p className="text-sm text-zinc-800 font-medium leading-relaxed">{pin.address}</p>
                </div>
              )}

              {/* Citations accordion */}
              <button
                onClick={() => setCitationsOpen(o => !o)}
                className="flex items-center justify-between w-full text-sm text-zinc-500 hover:text-zinc-800 transition-colors py-2 border-t border-zinc-100"
              >
                <span className="font-medium">See citations & sources</span>
                <svg
                  className={`w-4 h-4 transition-transform ${citationsOpen ? 'rotate-180' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              <AnimatePresence>
                {citationsOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="pt-2 pb-1 text-sm text-zinc-500 space-y-1.5">
                      <p className="text-xs">Full legislative citations, budget analysis, and confidence scoring are available on the measure page.</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* CTA */}
              <button
                onClick={handleViewMeasure}
                className="mt-4 w-full py-3 rounded-2xl text-sm font-bold text-white transition-opacity hover:opacity-90 active:opacity-80"
                style={{ backgroundColor: color }}
              >
                View full measure & explanation →
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
