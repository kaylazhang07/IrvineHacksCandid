'use client';
import { BookOpen } from 'lucide-react';
import { ExplainResponse, Citation } from '@/lib/types';

interface Props {
  data: ExplainResponse;
  onCitationClick: (c: Citation) => void;
}

export function ExplanationPanel({ data, onCitationClick }: Props) {
  return (
    <div className="flex flex-col gap-4">
      {/* In Simple Terms */}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-2 text-blue-700">
          <BookOpen className="w-4 h-4" />
          <span className="text-xs font-semibold uppercase tracking-wide">In Simple Terms</span>
        </div>
        <p className="text-zinc-800 leading-relaxed">{data.plain_english_summary}</p>
      </div>

      {/* Personal impact */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-4">
        <p className="text-xs text-zinc-400 uppercase tracking-wide mb-1 font-medium">Your impact</p>
        <p className="font-semibold text-zinc-900 leading-snug">{data.personal_impact_statement}</p>
      </div>

      {/* Citations */}
      {data.citations.length > 0 && (
        <div>
          <p className="text-xs text-zinc-400 uppercase tracking-wide mb-2 font-medium">Legislative sources</p>
          <div className="flex flex-wrap gap-2">
            {data.citations.map(c => (
              <button
                key={c.chunk_id}
                onClick={() => onCitationClick(c)}
                className="px-3 py-1 rounded-full bg-zinc-100 hover:bg-zinc-200 text-xs font-medium text-zinc-700 transition-colors"
              >
                #{c.chunk_id}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Confidence */}
      <p className="text-xs text-zinc-400">
        {Math.round(data.confidence_score * 100)}% confidence · Based on {data.citations.length} legislative source{data.citations.length !== 1 ? 's' : ''}
      </p>
    </div>
  );
}
