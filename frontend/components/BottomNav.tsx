'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function BottomNav() {
  const pathname = usePathname();

  // Hide on landing page and onboarding
  if (pathname === '/' || pathname === '/onboarding') return null;

  const isBalllot = pathname.startsWith('/ballot');
  const isMap = pathname.startsWith('/map');

  return (
    <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-zinc-200 flex h-14 z-50">
      <Link
        href="/ballot"
        className={`flex-1 flex flex-col items-center justify-center text-xs gap-0.5 transition-colors ${
          isBalllot ? 'text-zinc-900 font-semibold' : 'text-zinc-400 hover:text-zinc-600'
        }`}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
        Ballot
      </Link>
      <Link
        href="/map"
        className={`flex-1 flex flex-col items-center justify-center text-xs gap-0.5 transition-colors ${
          isMap ? 'text-zinc-900 font-semibold' : 'text-zinc-400 hover:text-zinc-600'
        }`}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
        Map
      </Link>
    </nav>
  );
}
