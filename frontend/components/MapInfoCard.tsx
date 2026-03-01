'use client';
import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { MapPin } from '@/lib/types';
import { useExplanation } from '@/hooks/useExplanation';
import { useUserProfile } from '@/hooks/useUserProfile';

// Mirrors CityMap PILL_COLORS
const CAT_COLORS: Record<string, string> = {
  housing:        '#8B7EC8',
  education:      '#C47B76',
  transportation: '#6A9EB8',
  public_safety:  '#B87560',
  environment:    '#6B9E82',
  healthcare:     '#B5789C',
  economy:        '#A88E44',
  water:          '#6A9EB8',
  civil_rights:   '#9B82C2',
  government:     '#8A9AA8',
  family:         '#C08070',
  immigration:    '#9B82C2',
  technology:     '#5EA8B8',
  taxes:          '#A88E44',
  foreign_policy: '#8A9AA8',
  other:          '#8A9AA8',
};

const CAT_LABELS: Record<string, string> = {
  housing: 'Housing', education: 'Education', transportation: 'Transit',
  public_safety: 'Safety', environment: 'Environment', healthcare: 'Health',
  economy: 'Economy', water: 'Water', civil_rights: 'Civil Rights',
  government: 'Government', family: 'Family', immigration: 'Immigration',
  technology: 'Technology', taxes: 'Taxes', foreign_policy: 'Foreign Policy',
  other: 'Other',
};

// ── Shimmer skeleton ──────────────────────────────────────────────────────────

const SKELETON_STYLE_ID = 'map-card-skeleton-styles';

function injectSkeletonStyles() {
  if (typeof document === 'undefined' || document.getElementById(SKELETON_STYLE_ID)) return;
  const s = document.createElement('style');
  s.id = SKELETON_STYLE_ID;
  s.textContent = `
    @keyframes map-card-shimmer {
      0%   { background-position: 200% center; }
      100% { background-position: -200% center; }
    }
    .map-card-skeleton {
      background: linear-gradient(90deg, #F0EEE9 25%, #E4E0D8 50%, #F0EEE9 75%);
      background-size: 200% 100%;
      animation: map-card-shimmer 1.6s ease-in-out infinite;
      border-radius: 6px;
    }
  `;
  document.head.appendChild(s);
}

function SkeletonLine({ width = '100%', height = 13 }: { width?: string | number; height?: number }) {
  return <div className="map-card-skeleton" style={{ width, height, marginBottom: 0 }} />;
}

function ExplanationSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* "In Simple Terms" label */}
      <SkeletonLine width={90} height={9} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <SkeletonLine width="100%" height={13} />
        <SkeletonLine width="97%" height={13} />
        <SkeletonLine width="82%" height={13} />
      </div>

      <div style={{ height: 6 }} />

      {/* "How This Affects You" block */}
      <div style={{ background: '#F5F3EF', borderRadius: 10, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 7 }}>
        <SkeletonLine width={130} height={9} />
        <SkeletonLine width="100%" height={13} />
        <SkeletonLine width="68%" height={13} />
      </div>

      <div style={{ height: 4 }} />

      {/* confidence */}
      <SkeletonLine width={140} height={9} />
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  pin: MapPin | null;
  onClose: () => void;
}

export function MapInfoCard({ pin, onClose }: Props) {
  const router = useRouter();
  const { profile } = useUserProfile();

  useEffect(() => { injectSkeletonStyles(); }, []);

  // Pass `null` as user when there's no pin — SWR key becomes null → no fetch
  const { data: explanation, isLoading, error } = useExplanation(
    pin?.measure_id ?? '',
    '',               // no measure text from map pins; backend falls back to SAMPLE_MEASURES
    pin ? profile : null,
    pin?.label,
  );

  const color = pin ? (CAT_COLORS[pin.category] ?? CAT_COLORS.other) : CAT_COLORS.other;
  const label = pin ? (CAT_LABELS[pin.category] ?? pin.category.replace(/_/g, ' ')) : '';

  function handleViewMeasure() {
    if (!pin) return;
    sessionStorage.setItem(
      `measure_${pin.measure_id}`,
      JSON.stringify({ title: pin.label, text: '' }),
    );
    router.push(`/ballot/${pin.measure_id}`);
  }

  return (
    <AnimatePresence>
      {pin && (
        <>
          {/* Tap-to-dismiss backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-0 z-10"
            onClick={onClose}
          />

          {/* Slide-up card */}
          <motion.div
            key={pin.measure_id}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="absolute bottom-0 left-0 right-0 z-20"
            style={{
              background: '#FFFFFF',
              borderRadius: '22px 22px 0 0',
              boxShadow: '0 -4px 6px rgba(0,0,0,0.02), 0 -12px 40px rgba(0,0,0,0.07), 0 -32px 80px rgba(0,0,0,0.05)',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '75vh',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* ── Drag handle ───────────────────────────────────────────── */}
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 10, paddingBottom: 2, flexShrink: 0 }}>
              <div style={{ width: 36, height: 4, borderRadius: 99, background: '#E4E4E7' }} />
            </div>

            {/* ── Header: category tag + close ─────────────────────────── */}
            <div className="flex items-center justify-between px-6 pt-3 pb-0" style={{ flexShrink: 0 }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                fontSize: 10, fontWeight: 700, letterSpacing: '0.09em',
                textTransform: 'uppercase', padding: '4px 9px',
                borderRadius: 6, background: `${color}16`, color,
              }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
                {label}
              </span>

              <motion.button
                onClick={onClose}
                aria-label="Close"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.92 }}
                style={{
                  width: 28, height: 28, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: '#F4F4F5', border: 'none', cursor: 'pointer', color: '#6B7280',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#E4E4E7')}
                onMouseLeave={e => (e.currentTarget.style.background = '#F4F4F5')}
              >
                <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </motion.button>
            </div>

            {/* ── Scrollable body ───────────────────────────────────────── */}
            <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
              {/* Location title + address */}
              <div className="px-6 pt-3">
                <h2 style={{
                  fontFamily: 'Georgia, "Times New Roman", serif',
                  fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em',
                  color: '#111827', lineHeight: 1.25, marginBottom: 6,
                }}>
                  {pin.label}
                </h2>
                {pin.address && (
                  <p style={{ fontSize: 13, color: '#9CA3AF', lineHeight: 1.6, margin: 0 }}>
                    {pin.address}
                  </p>
                )}
              </div>

              {/* Divider */}
              <div style={{ height: 1, background: '#F3F4F6', margin: '16px 0' }} />

              {/* Explanation content */}
              <div style={{ padding: '0 24px 16px' }}>
                {isLoading && <ExplanationSkeleton />}

                {!isLoading && error && (
                  <p style={{ fontSize: 13, color: '#9CA3AF', lineHeight: 1.65 }}>
                    Unable to load explanation — try again shortly.
                  </p>
                )}

                {!isLoading && explanation && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                    {/* In Simple Terms */}
                    <div>
                      <p style={{
                        fontSize: 9.5, fontWeight: 700, letterSpacing: '0.12em',
                        textTransform: 'uppercase', color: '#A8A09A', marginBottom: 7,
                      }}>
                        In Simple Terms
                      </p>
                      <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.72, margin: 0 }}>
                        {explanation.plain_english_summary}
                      </p>
                    </div>

                    {/* How This Affects You */}
                    <div style={{
                      background: `${color}0D`,
                      border: `1px solid ${color}28`,
                      borderRadius: 11,
                      padding: '11px 14px',
                    }}>
                      <p style={{
                        fontSize: 9.5, fontWeight: 700, letterSpacing: '0.12em',
                        textTransform: 'uppercase', color, marginBottom: 6,
                      }}>
                        How This Affects You
                      </p>
                      <p style={{ fontSize: 13.5, color: '#374151', lineHeight: 1.68, margin: 0, fontWeight: 500 }}>
                        {explanation.personal_impact_statement}
                      </p>
                    </div>

                    {/* Citations */}
                    {explanation.citations.length > 0 && (
                      <div>
                        <p style={{
                          fontSize: 9.5, fontWeight: 700, letterSpacing: '0.12em',
                          textTransform: 'uppercase', color: '#A8A09A', marginBottom: 8,
                        }}>
                          Sources
                        </p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {explanation.citations.slice(0, 3).map(c => (
                            <a
                              key={c.chunk_id}
                              href={c.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                fontSize: 11.5, fontWeight: 600,
                                padding: '4px 10px', borderRadius: 99,
                                background: '#F4F4F5', color: '#6B7280',
                                textDecoration: 'none',
                                border: '1px solid #E4E4E7',
                                transition: 'background 0.12s, color 0.12s',
                              }}
                              onMouseEnter={e => {
                                (e.currentTarget as HTMLElement).style.background = '#E4E4E7';
                                (e.currentTarget as HTMLElement).style.color = '#374151';
                              }}
                              onMouseLeave={e => {
                                (e.currentTarget as HTMLElement).style.background = '#F4F4F5';
                                (e.currentTarget as HTMLElement).style.color = '#6B7280';
                              }}
                            >
                              #{c.chunk_id}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Confidence */}
                    <p style={{ fontSize: 11, color: '#C4BDB5', margin: 0 }}>
                      {Math.round(explanation.confidence_score * 100)}% confidence
                      {explanation.citations.length > 0 &&
                        ` · ${explanation.citations.length} source${explanation.citations.length !== 1 ? 's' : ''}`}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* ── Footer: full measure CTA ──────────────────────────────── */}
            <div style={{
              flexShrink: 0,
              borderTop: '1px solid #F3F4F6',
              padding: '14px 20px 28px',
            }}>
              <button
                onClick={handleViewMeasure}
                style={{
                  width: '100%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  background: '#1C1917', color: '#FDFCF8',
                  border: 'none', borderRadius: 13,
                  padding: '13px 20px',
                  fontSize: 13.5, fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#292524')}
                onMouseLeave={e => (e.currentTarget.style.background = '#1C1917')}
              >
                View Full Measure
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
