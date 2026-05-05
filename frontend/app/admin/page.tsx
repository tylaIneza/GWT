'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import api from '@/lib/api';
import { getToken, isAdmin } from '@/lib/auth';
import { Users, Code2, Trophy, AlertTriangle, TrendingUp, ShieldAlert } from 'lucide-react';

type Tab = 'dashboard'|'users'|'submissions'|'flags'|'contests';

export default function AdminPage() {
  const router = useRouter();
  const [tab,     setTab]     = useState<Tab>('dashboard');
  const [data,    setData]    = useState<any>(null);
  const [users,   setUsers]   = useState<any[]>([]);
  const [subs,    setSubs]    = useState<any[]>([]);
  const [flags,   setFlags]   = useState<any[]>([]);
  const [contests,setContests]= useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [msg,        setMsg]        = useState('');
  const [search,     setSearch]     = useState('');

  useEffect(() => {
    if (!getToken() || !isAdmin()) { router.push('/auth/login'); return; }
    setAuthorized(true);
    load('dashboard');
  }, []);

  const load = async (t: Tab) => {
    setLoading(true);
    try {
      if (t === 'dashboard') { const r = await api.get('/admin/dashboard'); setData(r.data); }
      else if (t === 'users') { const r = await api.get('/admin/users'); setUsers(r.data || []); }
      else if (t === 'submissions') { const r = await api.get('/admin/submissions?suspicious=true'); setSubs(r.data || []); }
      else if (t === 'flags') { const r = await api.get('/anti-cheat/flags'); setFlags(r.data || []); }
      else if (t === 'contests') { const r = await api.get('/contests'); setContests(r.data || []); }
    } catch {}
    setLoading(false);
  };

  const switchTab = (t: Tab) => { setTab(t); load(t); };
  const notify    = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3000); };

  const banUser = async (id: string, ban: boolean) => {
    try {
      await api.post(`/admin/users/${id}/${ban ? 'ban' : 'unban'}`, { reason: 'Admin action' });
      notify(`User ${ban ? 'banned' : 'unbanned'}`); load('users');
    } catch { notify('Error'); }
  };

  const finalizeContest = async (id: string) => {
    try {
      await api.post(`/admin/contests/${id}/finalize`);
      notify('Contest finalized and prizes distributed ✓'); load('contests');
    } catch (e: any) { notify(e.response?.data?.message || 'Error'); }
  };

  const reviewFlag = async (id: string, action: string) => {
    try {
      await api.post(`/anti-cheat/flags/${id}/review`, { action, notes: `Admin: ${action}` });
      notify(`Flag ${action}d`); load('flags');
    } catch { notify('Error'); }
  };

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: 'dashboard',    label: 'Dashboard',    icon: TrendingUp  },
    { key: 'users',        label: 'Users',        icon: Users       },
    { key: 'submissions',  label: 'Suspicious',   icon: ShieldAlert },
    { key: 'flags',        label: 'Cheat Flags',  icon: AlertTriangle},
    { key: 'contests',     label: 'Contests',     icon: Trophy      },
  ];

  if (!authorized) return <div className="min-h-screen bg-gray-950" />;

  return (
    <div className="min-h-screen bg-gray-950">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <h1 className="text-2xl font-black text-white">Admin Panel</h1>

        {msg && <div className="bg-green-900/30 border border-green-700 text-green-300 rounded-xl px-4 py-3 text-sm">{msg}</div>}

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1 flex-wrap">
          {tabs.map(t => (
            <button key={t.key} onClick={() => switchTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.key ? 'bg-green-800 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
              <t.icon className="w-3.5 h-3.5" />{t.label}
            </button>
          ))}
        </div>

        {loading && <div className="card p-12 text-center text-gray-500 animate-pulse">Loading...</div>}

        {/* Dashboard */}
        {!loading && tab === 'dashboard' && data && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {[
                { label: 'Total Users',    value: data.users?.total    || 0, color: 'text-blue-400'   },
                { label: 'New Today',      value: data.users?.today    || 0, color: 'text-green-400'  },
                { label: 'Total Subs',     value: data.submissions?.total || 0, color: 'text-purple-400'},
                { label: 'Accepted',       value: data.submissions?.accepted || 0, color: 'text-green-400'},
                { label: 'Cheating Sus.',  value: data.submissions?.cheating || 0, color: 'text-red-400'},
                { label: 'Open Flags',     value: data.flags?.open     || 0, color: 'text-amber-400'  },
              ].map(s => (
                <div key={s.label} className="card p-4">
                  <p className="text-xs text-gray-500 mb-1">{s.label}</p>
                  <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                </div>
              ))}
            </div>

            {data.topUsers?.length > 0 && (
              <div className="card overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-800">
                  <h2 className="font-semibold text-white text-sm">Top Users</h2>
                </div>
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-800">
                    <tr>{['Name','Email','Solved','Risk Score','Earnings'].map(h => (
                      <th key={h} className="text-left px-4 py-2 text-xs text-gray-500 font-semibold uppercase">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {data.topUsers.map((u: any) => (
                      <tr key={u.email}>
                        <td className="px-4 py-2.5 font-medium text-white">{u.name}</td>
                        <td className="px-4 py-2.5 text-gray-400">{u.email}</td>
                        <td className="px-4 py-2.5 text-blue-400 font-semibold">{u.solved}</td>
                        <td className="px-4 py-2.5">
                          <span className={`badge text-xs ${u.risk_score >= 60 ? 'badge-red' : u.risk_score >= 30 ? 'badge-yellow' : 'badge-green'}`}>
                            {u.risk_score}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-green-400">{Number(u.total_earnings).toLocaleString()} RWF</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Users */}
        {!loading && tab === 'users' && (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-800">
                <tr>{['Name','Email','Balance','Risk','Status','Joined','Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs text-gray-500 font-semibold uppercase">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {users.map((u: any) => (
                  <tr key={u.id} className={u.is_banned ? 'opacity-50' : ''}>
                    <td className="px-4 py-3 font-medium text-white">{u.name}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{u.email}</td>
                    <td className="px-4 py-3 text-green-400">{Number(u.balance||0).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={`badge text-xs ${u.risk_score >= 60 ? 'badge-red' : u.risk_score >= 30 ? 'badge-yellow' : 'badge-green'}`}>
                        {u.risk_score}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge text-xs ${u.is_banned ? 'badge-red' : 'badge-green'}`}>
                        {u.is_banned ? 'Banned' : 'Active'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{new Date(u.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => banUser(u.id, !u.is_banned)}
                        className={`text-xs px-2 py-1 rounded-lg font-medium ${u.is_banned ? 'text-green-400 hover:bg-green-900/30' : 'text-red-400 hover:bg-red-900/30'}`}>
                        {u.is_banned ? 'Unban' : 'Ban'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Suspicious Submissions */}
        {!loading && tab === 'submissions' && (
          <div className="space-y-3">
            <p className="text-sm text-gray-500">Submissions flagged as suspicious (risk score ≥ 60 or cheating suspected)</p>
            {subs.length === 0 && <div className="card p-10 text-center text-gray-500">No suspicious submissions</div>}
            {subs.map((s: any) => (
              <div key={s.id} className="card p-4 flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="badge-red badge text-xs">Risk: {s.risk_score}</span>
                    <span className="badge text-xs capitalize">{s.language}</span>
                    <span className="badge-yellow badge text-xs">Paste count: {s.paste_count}</span>
                  </div>
                  <p className="text-white font-medium">{s.user_name}</p>
                  <p className="text-gray-500 text-sm">{s.challenge_title}</p>
                  <p className="text-gray-600 text-xs mt-1">{new Date(s.submitted_at).toLocaleString()}</p>
                </div>
                <span className={`badge text-xs ${s.status === 'accepted' ? 'badge-green' : 'badge-red'}`}>{s.status}</span>
              </div>
            ))}
          </div>
        )}

        {/* Cheat Flags */}
        {!loading && tab === 'flags' && (
          <div className="space-y-3">
            {flags.length === 0 && <div className="card p-10 text-center text-gray-500">No open flags</div>}
            {flags.map((f: any) => (
              <div key={f.id} className="card p-5 flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`badge text-xs ${f.severity === 'critical' ? 'badge-red' : f.severity === 'high' ? 'badge-yellow' : 'badge'}`}>
                      {f.severity}
                    </span>
                    <span className="badge text-xs">{f.flag_type?.replace(/_/g,' ')}</span>
                  </div>
                  <p className="text-white font-medium">{f.user_name} <span className="text-gray-500 text-sm">({f.user_email})</span></p>
                  <p className="text-gray-500 text-xs mt-1">Risk score: {f.risk_score} · {new Date(f.created_at).toLocaleString()}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => reviewFlag(f.id, 'dismiss')} className="btn-secondary btn-sm">Dismiss</button>
                  <button onClick={() => reviewFlag(f.id, 'ban')}     className="btn-danger btn-sm">Ban User</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Contests management */}
        {!loading && tab === 'contests' && (
          <div className="space-y-3">
            {contests.map((c: any) => (
              <div key={c.id} className="card p-5 flex items-center justify-between gap-4">
                <div>
                  <p className="font-bold text-white">{c.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`badge text-xs capitalize ${c.status === 'active' ? 'badge-green' : c.status === 'completed' ? 'badge' : 'badge-blue'}`}>{c.status}</span>
                    <span className="text-gray-500 text-xs">{c.participant_count || 0} participants · {Number(c.prize_pool||0).toLocaleString()} RWF pool</span>
                  </div>
                </div>
                {c.status === 'active' && (
                  <button onClick={() => finalizeContest(c.id)} className="btn-primary btn-sm">
                    🏆 Finalize & Pay
                  </button>
                )}
                {c.status === 'completed' && <span className="text-green-400 text-xs font-semibold">✓ Prizes distributed</span>}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
