'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { getUser, clearAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n-context';
import { LANGUAGES, CURRENCIES, COUNTRIES } from '@/lib/i18n';
import { Code2, Trophy, LayoutDashboard, Wallet, LogOut, Settings, Users, Globe } from 'lucide-react';

export default function Navbar() {
  const router   = useRouter();
  const path     = usePathname();
  const { t, lang, setLang } = useI18n();
  const [user,       setUser]       = useState<any>(null);
  const [showLang,   setShowLang]   = useState(false);

  useEffect(() => { setUser(getUser()); }, []);

  const logout = () => { clearAuth(); setUser(null); router.push('/'); };

  const currency = user?.preferred_currency || COUNTRIES.find(c => c.code === user?.country_code)?.currency || 'USD';
  const symbol   = CURRENCIES[currency]?.symbol || '$';

  const links = [
    { href: '/dashboard',   label: t('nav_dashboard'),   icon: LayoutDashboard },
    { href: '/challenges',  label: t('nav_challenges'),  icon: Code2           },
    { href: '/contests',    label: t('nav_contests'),    icon: Trophy          },
    { href: '/leaderboard', label: t('nav_leaderboard'), icon: Users           },
    { href: '/wallet',      label: t('nav_wallet'),      icon: Wallet          },
    ...(user?.role === 'admin' ? [{ href: '/admin', label: t('nav_admin'), icon: Settings }] : []),
  ];

  return (
    <nav className="sticky top-0 z-50 border-b border-gray-800 bg-gray-950/90 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        {/* Logo */}
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-700 flex items-center justify-center font-black text-sm">C</div>
            <span className="font-bold text-white hidden sm:block">CodeArena</span>
            <span className="hidden sm:block text-xs bg-green-900/30 border border-green-800/50 text-green-400 rounded-full px-1.5 py-0.5">Global</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-0.5">
            {links.map(l => (
              <Link key={l.href} href={l.href}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  path.startsWith(l.href)
                    ? 'bg-green-900/30 text-green-400'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}>
                <l.icon className="w-4 h-4" />{l.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {/* Balance */}
          {user && (
            <Link href="/wallet" className="hidden sm:flex items-center gap-2 bg-green-900/20 border border-green-800/30 rounded-xl px-3 py-1.5 hover:border-green-700 transition-colors">
              <Wallet className="w-3.5 h-3.5 text-green-400" />
              <span className="text-green-300 font-bold text-sm">
                {symbol}{Number(user.balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </Link>
          )}

          {/* Language picker */}
          <div className="relative">
            <button onClick={() => setShowLang(v => !v)}
              className="flex items-center gap-1 p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">
              <Globe className="w-4 h-4" />
              <span className="text-sm">{LANGUAGES.find(l => l.code === lang)?.flag}</span>
            </button>
            {showLang && (
              <div className="absolute right-0 top-full mt-1 bg-gray-900 border border-gray-700 rounded-xl shadow-xl z-50 py-1 min-w-[160px]">
                {LANGUAGES.map(l => (
                  <button key={l.code} onClick={() => { setLang(l.code); setShowLang(false); }}
                    className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-gray-800 transition-colors ${lang === l.code ? 'text-green-400' : 'text-gray-300'}`}>
                    <span>{l.flag}</span>{l.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Avatar */}
          {user && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-600 to-emerald-700 flex items-center justify-center text-xs font-bold text-white">
                {user?.name?.charAt(0)?.toUpperCase()}
              </div>
              <span className="text-sm text-gray-300 hidden lg:block">{user?.name}</span>
            </div>
          )}

          <button onClick={logout} className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors" title="Logout">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mobile bottom nav */}
      <div className="md:hidden flex border-t border-gray-800 overflow-x-auto">
        {links.map(l => (
          <Link key={l.href} href={l.href}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-xs font-medium min-w-[52px] transition-colors ${
              path.startsWith(l.href) ? 'text-green-400' : 'text-gray-500'
            }`}>
            <l.icon className="w-4 h-4" />{l.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
