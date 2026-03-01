'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Citation } from '@/lib/types';

// ── Official title lookup ─────────────────────────────────────────────────────
const OFFICIAL_TITLES: Record<string, string> = {
  'crs-k12-funding':        'Congressional Research Service: K–12 Education Funding (Title I)',
  'american-teacher-act':   'H.R. 2021 — American Teacher Act (119th Congress)',
  '21st-century-learning':  'Nita M. Lowey 21st Century Community Learning Centers Program',
  'ed-budget-fy25':         'U.S. Department of Education: FY 2025 Budget Summary',
  'crs-housing-programs':   'Congressional Research Service: Federal Housing Assistance Programs',
  'hud-rental-assistance':  'HUD: Rental Assistance Programs Overview',
  'hud-homebuyer':          'HUD: First-Time Homebuyer Assistance Resources',
  'crs-rent-income':        'Congressional Research Service: Rent & Income Eligibility Thresholds',
  'crs-transit-program':    'Congressional Research Service: Federal Public Transportation Program',
  'dot-electric-buses':     'U.S. DOT: Electric Bus & Zero-Emission Fleet Grants',
  'dot-bike-funding':       'U.S. DOT: Pedestrian & Bicycle Infrastructure Funding Opportunities',
  'cahoots-vera':           'Vera Institute of Justice: CAHOOTS Crisis Assistance Program',
  'samhsa-988':             'SAMHSA: 988 Suicide & Crisis Lifeline Overview',
  'fema-safer':             'FEMA: Staffing for Adequate Fire & Emergency Response (SAFER)',
  'samhsa-mobile-crisis':   'SAMHSA: Mobile Crisis Response Team Grant Program',
  'doe-energy-legislation': 'U.S. DOE: Key Federal Clean Energy Legislation',
  'nps-lwcf':               'National Park Service: Land & Water Conservation Fund',
  'epa-dwsrf':              'EPA: Drinking Water State Revolving Fund',
  'clean-energy-act':       'S. 1298 — Clean Energy for America Act (117th Congress)',
  'hrsa-health-centers':    'HRSA: Federally Qualified Health Center Program',
  'hrsa-hpsa':              'HRSA: Health Professional Shortage Area Designations',
  'hrsa-hpsa-dashboard':    'HRSA: Shortage Areas Interactive Data Dashboard',
  'hrsa-find-center':       'HRSA: Find a Health Center Locator Tool',
  'dol-wioa':               'U.S. DOL: Workforce Innovation & Opportunity Act (WIOA)',
  'dol-wioa-programs':      'U.S. DOL: WIOA-Authorized Workforce Development Programs',
  'sba-loans':              'U.S. SBA: Small Business Loan Programs Overview',
  'crs-apprenticeships':    'Congressional Research Service: Federal Registered Apprenticeship System',
  'gao-water-utilities':    'U.S. GAO: Water Utility Ownership & Oversight Report',
  'unc-public-private':     'UNC Environmental Finance Center: Public vs. Private Water Systems',
  'fww-privatization':      'Food & Water Watch: Water Privatization Facts & Figures',
  'nih-water-ownership':    'NIH PubMed Central: Public vs. Private Water Utility Policy Effects',
};

function titleFromId(id: string): string {
  return id.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function domainFrom(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); }
  catch { return 'Source'; }
}

// ── Source pill — solid fill + arrow slide on hover ───────────────────────────
function SourceLink({ url, catColor }: { url: string; catColor: string }) {
  const [hovered, setHovered] = useState(false);
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        fontSize: 11, fontWeight: 600,
        padding: '5px 11px', borderRadius: 99, flexShrink: 0,
        textDecoration: 'none', letterSpacing: '0.02em',
        background: hovered ? catColor : `${catColor}14`,
        color: hovered ? '#FFFFFF' : catColor,
        transition: 'background 0.18s ease, color 0.18s ease',
      }}
    >
      <span>{domainFrom(url)}</span>
      <motion.svg
        animate={{ x: hovered ? 3 : 0 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        style={{ width: 10, height: 10, flexShrink: 0 }}
        fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </motion.svg>
    </a>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
interface Props {
  citations: Citation[];
  catColor?: string;
}

const WARM_BORDER = '1px solid rgba(180,155,120,0.22)';
const CARD_SHADOW = '0 1px 2px rgba(60,40,20,0.04), 0 6px 18px rgba(60,40,20,0.07), 0 24px 48px rgba(60,40,20,0.04)';

export function CitationSection({ citations, catColor = '#2563EB' }: Props) {
  const [open, setOpen] = useState(false);

  if (!citations || citations.length === 0) return null;

  return (
    <div style={{
      borderRadius: 20,
      overflow: 'hidden',
      border: WARM_BORDER,
      background: '#FFFFFF',
      boxShadow: CARD_SHADOW,
    }}>
      {/* ── Accordion trigger ──────────────────────────────────────────────── */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between"
        style={{ padding: '18px 24px', transition: 'background 0.15s' }}
        onMouseEnter={e => (e.currentTarget.style.background = '#FAFAF9')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        <div className="flex items-center gap-3">
          {/* Icon chip */}
          <div style={{
            width: 30, height: 30, borderRadius: 9, flexShrink: 0,
            background: `${catColor}14`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg style={{ width: 13, height: 13, color: catColor }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          </div>

          <span style={{ fontSize: 13, fontWeight: 700, color: '#1C1917', letterSpacing: '-0.01em' }}>
            Sources &amp; Citations
          </span>

          {/* Count badge */}
          <span style={{
            fontSize: 11, fontWeight: 600, color: '#78716C',
            background: 'rgba(180,155,120,0.12)',
            padding: '2px 8px', borderRadius: 99,
          }}>
            {citations.length}
          </span>
        </div>

        {/* Animated chevron */}
        <motion.svg
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          style={{ width: 14, height: 14, color: '#A8A09A', flexShrink: 0 }}
          fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </motion.svg>
      </button>

      {/* ── Smooth accordion body ───────────────────────────────────────────── */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: 'easeInOut' }}
            style={{ overflow: 'hidden', borderTop: '1px solid rgba(180,155,120,0.16)' }}
          >
            {citations.map((c, i) => {
              const title     = OFFICIAL_TITLES[c.chunk_id] ?? titleFromId(c.chunk_id ?? `source-${i + 1}`);
              const relevance = Math.round((c.relevance_score ?? 0) * 100);

              return (
                <motion.div
                  key={c.chunk_id ?? i}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.045, duration: 0.28, ease: 'easeOut' }}
                  style={{
                    padding: '20px 24px',
                    borderBottom: i < citations.length - 1
                      ? '1px solid rgba(180,155,120,0.12)'
                      : 'none',
                  }}
                >
                  {/* High-contrast sans-serif title */}
                  <p style={{
                    fontSize: 13.5, fontWeight: 700, letterSpacing: '-0.01em',
                    color: '#1C1917', lineHeight: 1.45,
                    marginBottom: 8,
                  }}>
                    {title}
                  </p>

                  {/* Description — open line-height to prevent clustering */}
                  {(c.plain_translation || c.chunk_text) && (
                    <p style={{
                      fontSize: 13, color: '#78716C', lineHeight: 1.85,
                      marginBottom: 14,
                    }}>
                      {c.plain_translation || c.chunk_text}
                    </p>
                  )}

                  {/* Footer: thin relevance bar (supporting detail) + source pill */}
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-2" style={{ minWidth: 0, flex: '1 1 120px', maxWidth: 240 }}>
                      <span style={{ fontSize: 10, color: '#B8B0A8', flexShrink: 0, letterSpacing: '0.04em' }}>
                        relevance
                      </span>
                      {/* Thinner, more subtle track */}
                      <div style={{
                        flex: 1, height: 3, borderRadius: 99, overflow: 'hidden',
                        background: `${catColor}12`,
                      }}>
                        <motion.div
                          style={{ height: '100%', borderRadius: 99, background: catColor, opacity: 0.5 }}
                          initial={{ width: '0%' }}
                          animate={{ width: `${relevance}%` }}
                          transition={{ delay: i * 0.045 + 0.08, duration: 0.7, ease: 'easeOut' }}
                        />
                      </div>
                      <span style={{
                        fontSize: 10, color: '#B8B0A8',
                        fontVariantNumeric: 'tabular-nums',
                        flexShrink: 0, width: 26, textAlign: 'right',
                      }}>
                        {relevance}%
                      </span>
                    </div>

                    {c.source_url && <SourceLink url={c.source_url} catColor={catColor} />}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
