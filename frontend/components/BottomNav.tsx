'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function BottomNav() {
  const pathname = usePathname();
  if (pathname === '/' || pathname === '/onboarding') return null;

  const isBallot = pathname.startsWith('/ballot');
  const isRaces  = pathname.startsWith('/races');
  const isMap    = pathname.startsWith('/map');

  const tab = (href: string, active: boolean, label: string, icon: JSX.Element) => (
    <Link href={href} className={`flex-1 flex flex-col items-center justify-center text-xs gap-0.5 transition-colors ${active ? 'text-zinc-900 font-semibold' : 'text-zinc-400 hover:text-zinc-600'}`}>
      {icon}{label}
    </Link>
  );

  return (
    <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-zinc-200 flex h-14 z-50">
      {tab('/ballot', isBallot, 'Ballot',
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
      )}
      {tab('/races', isRaces, 'Races',
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
      )}
      {tab('/map', isMap, 'Map',
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
      )}
    </nav>
  );
}
