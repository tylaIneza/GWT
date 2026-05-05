import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CodeArena — Win Real Money with Code',
  description: 'Skill-based coding competitions. Solve challenges, beat the leaderboard, earn real rewards.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  );
}
