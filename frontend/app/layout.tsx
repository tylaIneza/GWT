import type { Metadata } from 'next';
import './globals.css';
import { I18nProvider } from '@/lib/i18n-context';

export const metadata: Metadata = {
  title: 'CodeArena — Global Competitive Coding & Earn Real Money',
  description: 'Solve coding challenges, compete in global tournaments, and earn real money. Join 50,000+ coders from 150+ countries.',
  keywords: 'coding challenges, competitive programming, earn money coding, coding tournaments, global coding platform',
  openGraph: {
    title: 'CodeArena — Code. Compete. Earn.',
    description: 'Join coders worldwide. Solve challenges. Win real money.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>
        <I18nProvider>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
