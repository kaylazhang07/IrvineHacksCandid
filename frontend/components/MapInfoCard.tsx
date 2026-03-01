'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { MapPin } from '@/lib/types';

// Muted accent palette — mirrors CityMap PILL_COLORS
const CAT_COLORS: Record<string, string> = {
  housing:       '#8B7EC8',
  education:     '#C47B76',
  transportation:'#6A9EB8',
  public_safety: '#B87560',
  environment:   '#6B9E82',
  healthcare:    '#B5789C',
  economy:       '#A88E44',
  water:         '#6A9EB8',
  civil_rights:  '#9B82C2',
  government:    '#8A9AA8',
  family:        '#C08070',
  immigration:   '#9B82C2',
  technology:    '#5EA8B8',
  taxes:         '#A88E44',
  foreign_policy:'#8A9AA8',
  other:         '#8A9AA8',
};

const CAT_LABELS: Record<string, string> = {
  housing: 'Housing', education: 'Education', transportation: 'Transit',
  public_safety: 'Safety', environment: 'Environment', healthcare: 'Health',
  economy: 'Economy', water: 'Water', civil_rights: 'Civil Rights',
  government: 'Government', family: 'Family', immigration: 'Immigration',
  technology: 'Technology', taxes: 'Taxes', foreign_policy: 'Foreign Policy',
  other: 'Other',
};

interface Props {
  pin: MapPin | null;
  onClose: () => void;
}

export function MapInfoCard({ pin, onClose }: Props) {
  const router = useRouter();

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
          {/* Tap-to-dismiss backdrop — invisible, full-screen */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-0 z-10"
            onClick={onClose}
          />

          {/* Slide-up card — spring: stiffness 300, damping 30 */}
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
              // Large-radius ambient shadow — depth without "dirtiness"
              boxShadow: '0 -4px 6px rgba(0,0,0,0.02), 0 -12px 40px rgba(0,0,0,0.07), 0 -32px 80px rgba(0,0,0,0.05)',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* ── Header: category tag + close ───────────────────────────── */}
            <div className="flex items-center justify-between px-6 pt-5">
              {/* Category pill — muted, small, rounded-rect */}
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.09em',
                  textTransform: 'uppercase',
                  padding: '4px 9px',
                  borderRadius: 6,
                  background: `${color}16`,
                  color: color,
                }}
              >
                {/* Colored dot */}
                <span style={{
                  width: 5, height: 5, borderRadius: '50%',
                  background: color, display: 'inline-block', flexShrink: 0,
                }} />
                {label}
              </span>

              {/* Thin X close button */}
              <motion.button
                onClick={onClose}
                aria-label="Close"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.92 }}
                style={{
                  width: 28, height: 28,
                  borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: '#F4F4F5',
                  border: 'none', cursor: 'pointer',
                  color: '#6B7280',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#E4E4E7')}
                onMouseLeave={e => (e.currentTarget.style.background = '#F4F4F5')}
              >
                <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </motion.button>
            </div>

            {/* ── Body: bold title + description ─────────────────────────── */}
            <div className="px-6 pt-3 pb-0">
              <h2 style={{
                fontFamily: 'Georgia, "Times New Roman", serif',
                fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em',
                color: '#111827', lineHeight: 1.25, marginBottom: 10,
              }}>
                {pin.label}
              </h2>

              {pin.address && (
                <p style={{
                  fontSize: 13.5, color: '#6B7280',
                  lineHeight: 1.75, margin: 0,
                }}>
                  {pin.address}
                </p>
              )}
            </div>

            {/* ── Footer: Citations link ──────────────────────────────────── */}
            <div
              style={{
                borderTop: '1px solid #F3F4F6',
                margin: '18px 0 0',
                padding: '0 24px 28px',
              }}
            >
              <button
                onClick={handleViewMeasure}
                className="w-full flex items-center justify-between pt-4 group"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '16px 0 0' }}
              >
                <span style={{
                  fontSize: 13, fontWeight: 500, color: '#6B5F80',
                  transition: 'color 0.15s',
                }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#3D3550')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#6B5F80')}
                >
                  See full measure &amp; citations
                </span>
                <motion.svg
                  width="14" height="14" fill="none" stroke="#9CA3AF"
                  strokeWidth={2.5} viewBox="0 0 24 24"
                  whileHover={{ y: 2 }}
                  transition={{ duration: 0.15 }}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </motion.svg>
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
