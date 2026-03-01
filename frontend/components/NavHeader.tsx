'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';

const KEY = 'candid_user_profile';

export default function NavHeader() {
  const [profile, setProfile] = useState<{ zip_code: string } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    try {
      const stored = localStorage.getItem(KEY);
      if (stored) setProfile(JSON.parse(stored));
      else setProfile(null);
    } catch {}
  }, [pathname]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const hasProfile = !!profile;

  function handleChangeZip() {
    localStorage.removeItem(KEY);
    setProfile(null);
    setMenuOpen(false);
    router.push('/onboarding');
  }

  function handleStartOver() {
    localStorage.removeItem(KEY);
    setProfile(null);
    setMenuOpen(false);
    router.push('/');
  }

  const navLinks = [
    { href: '/', label: 'Home' },
    { href: hasProfile ? '/ballot' : '/onboarding', label: 'Ballot' },
    { href: '/map', label: 'Map' },
    { href: '/simulator', label: 'Simulate' },
  ];

  return (
    <>
      <header className="fixed top-0 inset-x-0 z-50 bg-white/90 backdrop-blur-md border-b border-zinc-200">
        <div className="max-w-6xl mx-auto flex items-center justify-between h-12 px-4 md:px-6">
          {/* Logo */}
          <Link href="/" className="text-base font-black tracking-tight text-zinc-900 hover:text-zinc-600 transition-colors flex-shrink-0">
            candid<span className="text-blue-500">.</span>
          </Link>

          {/* Desktop nav links */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map(link => {
              const isActive = link.href === '/'
                ? pathname === '/'
                : link.label === 'Ballot'
                ? pathname.startsWith('/ballot') || pathname.startsWith('/onboarding')
                : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.label}
                  href={link.href}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-zinc-100 text-zinc-900'
                      : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Right side: ZIP badge + profile menu */}
          <div className="hidden md:flex items-center gap-2">
            {hasProfile && (
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="flex items-center gap-2 pl-3 pr-2 py-1 rounded-full border border-zinc-200 hover:border-zinc-400 bg-white text-sm transition-colors"
                >
                  <svg className="w-3.5 h-3.5 text-zinc-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="text-zinc-700 font-medium">{profile!.zip_code}</span>
                  <svg className={`w-3 h-3 text-zinc-400 transition-transform ${menuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {menuOpen && (
                  <div className="absolute right-0 top-10 w-52 bg-white rounded-xl border border-zinc-200 shadow-xl py-1.5 z-50">
                    <button
                      onClick={handleChangeZip}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors text-left"
                    >
                      <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Change ZIP code
                    </button>
                    <button
                      onClick={handleChangeZip}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors text-left"
                    >
                      <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Edit profile
                    </button>
                    <div className="border-t border-zinc-100 my-1" />
                    <button
                      onClick={handleStartOver}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors text-left"
                    >
                      <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Start over
                    </button>
                  </div>
                )}
              </div>
            )}

            {!hasProfile && (
              <Link
                href="/onboarding"
                className="px-4 py-1.5 rounded-full text-sm font-semibold bg-zinc-900 text-white hover:bg-zinc-800 transition-colors"
              >
                Get started
              </Link>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-100 transition-colors"
            aria-label="Menu"
          >
            {mobileOpen ? (
              <svg className="w-5 h-5 text-zinc-700" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-zinc-700" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden border-t border-zinc-100 bg-white px-4 pb-4 pt-2">
            <nav className="flex flex-col gap-1">
              {navLinks.map(link => {
                const isActive = link.href === '/'
                  ? pathname === '/'
                  : link.label === 'Ballot'
                  ? pathname.startsWith('/ballot') || pathname.startsWith('/onboarding')
                  : pathname.startsWith(link.href);
                return (
                  <Link
                    key={link.label}
                    href={link.href}
                    className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-zinc-100 text-zinc-900'
                        : 'text-zinc-600 hover:bg-zinc-50'
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>

            {hasProfile && (
              <div className="mt-3 pt-3 border-t border-zinc-100 flex flex-col gap-1">
                <div className="px-3 py-1.5 text-xs text-zinc-400 font-medium">
                  ZIP: {profile!.zip_code}
                </div>
                <button
                  onClick={handleChangeZip}
                  className="px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-colors text-left"
                >
                  Change ZIP code
                </button>
                <button
                  onClick={handleChangeZip}
                  className="px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-colors text-left"
                >
                  Edit profile
                </button>
                <button
                  onClick={handleStartOver}
                  className="px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors text-left"
                >
                  Start over
                </button>
              </div>
            )}

            {!hasProfile && (
              <div className="mt-3 pt-3 border-t border-zinc-100">
                <Link
                  href="/onboarding"
                  className="block text-center px-4 py-2.5 rounded-full text-sm font-semibold bg-zinc-900 text-white hover:bg-zinc-800 transition-colors"
                >
                  Get started
                </Link>
              </div>
            )}
          </div>
        )}
      </header>
    </>
  );
}
