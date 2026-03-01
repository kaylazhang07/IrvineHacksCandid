import type { Metadata } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import './globals.css';
import 'mapbox-gl/dist/mapbox-gl.css';
import NavHeader from '@/components/NavHeader';
import GlobalExportHub from '@/components/GlobalExportHub';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-serif' });

export const metadata: Metadata = {
  title: 'Candid — Your ballot in plain English',
  description: 'Personalized ballot measure explanations with real legislative citations.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${playfair.variable} ${inter.className} bg-[#F8F7F4] min-h-screen`}>
        <NavHeader />
        <GlobalExportHub />
        <main className="pt-12 pb-16">{children}</main>
      </body>
    </html>
  );
}
