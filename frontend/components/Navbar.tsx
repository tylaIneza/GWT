'use client';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { getUser, clearAuth, isAdmin } from '@/lib/auth';
import { Code2, Trophy, LayoutDashboard, Wallet, LogOut, Settings, Users } from 'lucide-react';

export default function Navbar() {
  const router  = useRouter();
  const path    = usePathname();
  const user    = getUser();

  const logout = () => { clearAuth(); router.push('/'); };

  const links = [
    { href: '/dashboard',  label: 'Dashboard',  icon: LayoutDashboard },
    { href: '/challenges', label: 'Challenges', icon: Code2           },
    { href: '/contests',   label: 'Contests',   icon: Trophy          },
    { href: '/leaderboard',label: 'Leaderboard',icon: Users           },
    { href: '/wallet',     label: 'Wallet',     icon: Wallet          },
    ...(isAdmin() ? [{ href: '/admin', label: 'Admin', icon: Settings }] : []),
  ];

  return (
    <nav className="sticky top-0 z-50 border-b border-gray-800 bg-gray-950/90 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        {/* Logo */}
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-700 flex items-center justify-center font-black text-sm">C</div>
            <span className="font-bold text-white hidden sm:block">CodeArena</span>
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
        <div className="flex items-center gap-3">
          {user && (
            <div className="hidden sm:flex items-center gap-2 bg-green-900/20 border border-green-800/30 rounded-xl px-3 py-1.5">
              <Wallet className="w-3.5 h-3.5 text-green-400" />
              <span className="text-green-300 font-bold text-sm">
                {Number(user.balance || 0).toLocaleString()} RWF
              </span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-green-700 flex items-center justify-center text-xs font-bold text-white">
              {user?.name?.charAt(0)?.toUpperCase()}
            </div>
            <span className="text-sm text-gray-300 hidden sm:block">{user?.name}</span>
          </div>
          <button onClick={logout} className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors">
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
