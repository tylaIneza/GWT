'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import api from '@/lib/api';
import { getToken, getUser } from '@/lib/auth';
import { useI18n } from '@/lib/i18n-context';
import { COUNTRIES } from '@/lib/i18n';
import {
  Trophy, CheckCircle, Wallet, Globe, Flag, Flame, Crown,
  Search, ChevronDown, Star,
} from 'lucide-react';

const MEDAL = ['🥇','🥈','🥉'];
const PLAN_ICON: Record<string, string> = { elite: '👑', pro: '⚡', free: '' };

type LeaderTab = 'global' | 'country' | 'countries';

function PlayerRow({ p, rank, user, currencySymbol }: any) {
  const isMe = p.id === user?.id;
  return (
    <tr className={`transition-colors ${isMe ? 'bg-green-900/10' : 'hover:bg-gray-800/20'}`}>
      <td className="px-4 py-3 text-center w-12">
        {rank < 3
          ? <span className="text-xl">{MEDAL[rank]}</span>
          : <span className="text-gray-500 font-semibold text-sm">#{rank + 1}</span>}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-xs font-black text-white shrink-0">
            {p.name?.charAt(0)?.toUpperCase()}
          </div>
          <div>
            <p className={`font-semibold text-sm flex items-center gap-1 ${isMe ? 'text-green-400' : 'text-white'}`}>
              {p.name}
              {PLAN_ICON[p.subscription_plan] && <span title={p.subscription_plan}>{PLAN_ICON[p.subscription_plan]}</span>}
              {isMe && <span className="text-xs text-gray-500 ml-1">(you)</span>}
            </p>
            <p className="text-xs text-gray-500 flex items-center gap-1">
              {p.country_code}
              {p.current_streak > 0 && (
                <span className="flex items-center gap-0.5 text-orange-400">
                  <Flame className="w-3 h-3" />{p.current_streak}d
                </span>
              )}
            </p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-center">
        <span className="text-blue-400 font-semibold">{p.problems_solved}</span>
      </td>
      <td className="px-4 py-3 text-center">
        <span className="text-green-400 font-semibold">${Number(p.total_earnings || 0).toFixed(2)}</span>
      </td>
      <td className="px-4 py-3 text-center">
        <span className="text-yellow-400 font-semibold">{p.wins || 0}</span>
      </td>
      <td className="px-4 py-3 text-center">
        <span className="text-purple-400">{p.contests_joined || 0}</span>
      </td>
    </tr>
  );
}

export default function LeaderboardPage() {
  const router    = useRouter();
  const user      = getUser();
  const { t }     = useI18n();

  const [tab,         setTab]         = useState<LeaderTab>('global');
  const [data,        setData]        = useState<any[]>([]);
  const [countries,   setCountries]   = useState<any[]>([]);
  const [myRank,      setMyRank]      = useState<number | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [countryCode, setCountryCode] = useState(user?.country_code || 'US');
  const [search,      setSearch]      = useState('');

  useEffect(() => { if (!getToken()) router.push('/auth/login'); }, []);

  const loadGlobal = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get('/leaderboard/global?limit=100'),
      api.get('/leaderboard/my-rank').catch(() => ({ data: null })),
    ])
      .then(([g, r]) => {
        setData(g.data || []);
        setMyRank(r.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const loadCountry = useCallback((code: string) => {
    setLoading(true);
    api.get(`/leaderboard/country/${code}?limit=100`)
      .then(r => setData(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const loadCountries = useCallback(() => {
    setLoading(true);
    api.get('/leaderboard/countries')
      .then(r => setCountries(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (tab === 'global')    loadGlobal();
    else if (tab === 'country') loadCountry(countryCode);
    else if (tab === 'countries') loadCountries();
  }, [tab, countryCode]);

  const filtered = data.filter(p =>
    !search || p.name?.toLowerCase().includes(search.toLowerCase())
  );

  const myPosition = data.findIndex(p => p.id === user?.id);

  return (
    <div className="min-h-screen bg-gray-950">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Trophy className="w-6 h-6 text-yellow-400" /> {t('lb_title')}
            </h1>
            <p className="text-gray-500 text-sm mt-1">{t('lb_subtitle')}</p>
          </div>
          {myRank !== null && tab === 'global' && (
            <div className="text-right">
              <p className="text-xs text-gray-500">Your global rank</p>
              <p className="text-2xl font-black text-yellow-400">#{myRank}</p>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex border-b border-gray-800 gap-0 flex-1">
            {([
              ['global',    <Globe    className="w-3.5 h-3.5" key="g" />, 'Global'],
              ['country',   <Flag     className="w-3.5 h-3.5" key="c" />, 'By Country'],
              ['countries', <Crown    className="w-3.5 h-3.5" key="cs"/>, 'Country Ranking'],
            ] as const).map(([k, icon, label]) => (
              <button key={k} onClick={() => setTab(k as LeaderTab)}
                className={`flex items-center gap-1.5 pb-3 mr-6 text-sm font-medium border-b-2 transition-colors ${tab === k ? 'border-yellow-500 text-yellow-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
                {icon}{label}
              </button>
            ))}
          </div>

          {/* Search */}
          {tab !== 'countries' && (
            <div className="relative shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search player..." className="input pl-8 py-1.5 text-sm w-44" />
            </div>
          )}
        </div>

        {/* Country selector */}
        {tab === 'country' && (
          <div className="flex items-center gap-3">
            <Flag className="w-4 h-4 text-gray-500 shrink-0" />
            <select value={countryCode} onChange={e => setCountryCode(e.target.value)} className="input max-w-xs">
              {COUNTRIES.map(c => (
                <option key={c.code} value={c.code}>{c.flag} {c.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="space-y-2">
            {[1,2,3,4,5].map(i => <div key={i} className="card p-4 animate-pulse h-14" />)}
          </div>
        ) : tab === 'countries' ? (
          /* Country Rankings */
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-800">
                <tr>
                  {['Rank', 'Country', 'Users', 'Solved', 'Earnings'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs text-gray-500 font-semibold uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {countries.map((c: any, i: number) => {
                  const country = COUNTRIES.find(x => x.code === c.country_code);
                  return (
                    <tr key={c.country_code}
                      className={`transition-colors hover:bg-gray-800/20 ${c.country_code === user?.country_code ? 'bg-yellow-900/10' : ''}`}>
                      <td className="px-4 py-3 text-center w-12">
                        {i < 3
                          ? <span className="text-xl">{MEDAL[i]}</span>
                          : <span className="text-gray-500 font-semibold">#{i+1}</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{country?.flag || '🌍'}</span>
                          <span className="text-white font-semibold">{country?.name || c.country_code}</span>
                          {c.country_code === user?.country_code && (
                            <span className="text-xs text-yellow-400">(yours)</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-300">{c.users}</td>
                      <td className="px-4 py-3 text-blue-400 font-semibold">{c.solved}</td>
                      <td className="px-4 py-3 text-green-400 font-semibold">
                        ${Number(c.total_earnings || 0).toFixed(0)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {countries.length === 0 && (
              <div className="p-12 text-center text-gray-500">No country data yet</div>
            )}
          </div>
        ) : (
          /* Player Rankings */
          <div className="card overflow-hidden">
            {/* My position banner */}
            {myPosition >= 10 && tab === 'global' && (
              <div className="px-4 py-2.5 bg-green-900/20 border-b border-green-800/30 text-green-400 text-xs flex items-center gap-2">
                <Star className="w-3.5 h-3.5" />
                You are ranked #{myPosition + 1} globally
              </div>
            )}
            <table className="w-full text-sm">
              <thead className="border-b border-gray-800">
                <tr>
                  {['Rank', 'Player', 'Solved', 'Earnings', 'Wins', 'Contests'].map(h => (
                    <th key={h} className="text-center px-4 py-3 text-xs text-gray-500 font-semibold uppercase first:text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filtered.map((p: any, i: number) => (
                  <PlayerRow key={p.id} p={p} rank={i} user={user} />
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="p-12 text-center text-gray-500">{t('lb_empty')}</div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
