import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import 'mapbox-gl/dist/mapbox-gl.css';
import NavHeader from '@/components/NavHeader';
import BottomNav from '@/components/BottomNav';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Candid — Your ballot in plain English',
  description: 'Personalized ballot measure explanations with real legislative citations.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-[#F8F7F4] min-h-screen`}>
        <NavHeader />
        <main className="pt-12 pb-16">{children}</main>
        <BottomNav />
      </body>
    </html>
  );
}
