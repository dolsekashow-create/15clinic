import type { Metadata, Viewport } from 'next';
import { Amiri, IBM_Plex_Mono, IBM_Plex_Sans_Arabic } from 'next/font/google';
import './globals.css';

/**
 * Type pairing: Amiri (a naskh serif rooted in Arabic print) for headlines,
 * IBM Plex Sans Arabic for interface text, and IBM Plex Mono for every number.
 * The mono face is not decorative — a clinic screen is full of queue numbers,
 * invoice numbers and amounts that must align in columns.
 */
const display = Amiri({
  weight: ['400', '700'],
  subsets: ['arabic', 'latin'],
  variable: '--font-display',
  display: 'swap',
});

const body = IBM_Plex_Sans_Arabic({
  weight: ['400', '500', '600', '700'],
  subsets: ['arabic', 'latin'],
  variable: '--font-body',
  display: 'swap',
});

const mono = IBM_Plex_Mono({
  weight: ['400', '500', '600'],
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'مجموعة عيادات — حجز ومتابعة',
  description: 'احجز في أقرب فرع، وتابع دورك ومواعيدك.',
};

export const viewport: Viewport = {
  themeColor: '#146B4E',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
