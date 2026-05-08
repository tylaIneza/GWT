import type { Metadata } from 'next';
import './globals.css';
import { I18nProvider } from '@/lib/i18n-context';

export const metadata: Metadata = {
  title: 'DevixCode — Competitive Coding Platform | Code. Compete. Earn.',
  description: 'DevixCode by Credly Software Solution — Solve real-world algorithm challenges, compete in global coding tournaments, and earn real money prizes. 50,000+ developers across 150+ countries.',
  keywords: 'competitive coding, algorithm challenges, earn money coding, programming tournaments, DevixCode, Credly Software Solution',
  openGraph: {
    title: 'DevixCode — Code. Compete. Earn.',
    description: 'The world\'s premier skill-based competitive coding platform by Credly Software Solution.',
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
