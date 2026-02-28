'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { Citation } from '@/lib/types';

interface Props {
  citations: Citation[];
}

export function CitationSection({ citations }: Props) {
  const [open, setOpen] = useState(false);

  if (!citations || citations.length === 0) return null;

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 transition-colors"
      >
        <span>See Citations ({citations.length} source{citations.length !== 1 ? 's' : ''})</span>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="w-4 h-4 text-zinc-400" />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div key="citations" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
            <div className="px-5 pb-5 flex flex-col gap-4 border-t border-zinc-100">
              {citations.map((c, i) => (
                <div key={c.chunk_id ?? i} className="pt-4">
                  <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-2 font-mono text-xs text-amber-900 line-clamp-4 leading-relaxed">
                    {c.chunk_text}
                  </div>
                  {c.plain_translation && (
                    <p className="text-sm text-zinc-600 mb-2">
                      <span className="font-medium text-zinc-800">In plain terms: </span>
                      {c.plain_translation}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs text-zinc-400">Relevance</span>
                    <div className="flex-1 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${Math.round((c.relevance_score ?? 0) * 100)}%` }} />
                    </div>
                    <span className="text-xs text-zinc-400 w-8 text-right">{Math.round((c.relevance_score ?? 0) * 100)}%</span>
                  </div>
                  {c.source_url && (
                    <a href={c.source_url} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:underline">
                      View source →
                    </a>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
