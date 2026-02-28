'use client';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Progress } from '@/components/ui/progress';
import { Citation } from '@/lib/types';

interface Props {
  citation: Citation | null;
  open: boolean;
  onClose: () => void;
}

export function CitationDrawer({ citation, open, onClose }: Props) {
  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        {citation && (
          <>
            <SheetHeader className="mb-4">
              <SheetTitle className="text-sm font-mono text-zinc-500">Source #{citation.chunk_id}</SheetTitle>
            </SheetHeader>

            <pre className="bg-amber-50 text-amber-900 text-xs font-mono p-4 rounded-xl whitespace-pre-wrap leading-relaxed mb-4 overflow-x-auto">
              {citation.chunk_text}
            </pre>

            <hr className="border-zinc-200 mb-4" />

            <p className="text-base text-zinc-800 leading-relaxed mb-6">{citation.plain_translation}</p>

            <div className="mb-6">
              <div className="flex justify-between text-xs text-zinc-500 mb-1">
                <span>Relevance</span>
                <span>{Math.round(citation.relevance_score * 100)}%</span>
              </div>
              <Progress value={citation.relevance_score * 100} className="h-2" />
            </div>

            <a
              href={citation.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-indigo-600 hover:underline"
            >
              View full source →
            </a>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
