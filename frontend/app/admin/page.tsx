'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import api from '@/lib/api';
import { getToken, isAdmin } from '@/lib/auth';
import {
  Users, Trophy, AlertTriangle, TrendingUp, ShieldAlert, Wallet,
  ArrowDownToLine, Plus, Pencil, Trash2, X, CheckCircle, Code2, Calendar,
} from 'lucide-react';

type Tab = 'dashboard'|'users'|'submissions'|'flags'|'challenges'|'contests'|'finance';

const EMPTY_CHALLENGE = {
  title: '', description: '', difficulty: 'easy' as string,
  category: '', supported_languages: ['javascript','python'] as string[],
  time_limit_ms: 5000, memory_limit_mb: 256,
  max_submissions: 10, submission_cooldown_seconds: 30, is_published: false,
};
const EMPTY_TC = { input: '', expected_output: '', is_sample: false, points: 10, explanation: '' };
const EMPTY_CONTEST = {
  title: '', description: '', entry_fee: 0,
  start_time: '', end_time: '', max_participants: '', is_rated: false,
  challenge_ids: [] as string[],
};

export default function AdminPage() {
  const router = useRouter();
  const [tab,        setTab]        = useState<Tab>('dashboard');
  const [data,       setData]       = useState<any>(null);
  const [users,      setUsers]      = useState<any[]>([]);
  const [subs,       setSubs]       = useState<any[]>([]);
  const [flags,      setFlags]      = useState<any[]>([]);
  const [contests,   setContests]   = useState<any[]>([]);
  const [challenges, setChallenges] = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [loadError,  setLoadError]  = useState('');
  const [msg,        setMsg]        = useState('');
  const [wallet,     setWallet]     = useState<any>(null);
  const [depositAmt, setDepositAmt] = useState('');
  const [depositNote,setDepositNote]= useState('');
  const [depositing, setDepositing] = useState(false);

  // Challenge management
  const [chModal,   setChModal]   = useState(false);
  const [editingCh, setEditingCh] = useState<any>(null);
  const [chForm,    setChForm]    = useState({ ...EMPTY_CHALLENGE });
  const [testCases, setTestCases] = useState([{ ...EMPTY_TC }]);
  const [chSaving,  setChSaving]  = useState(false);
  const [chError,   setChError]   = useState('');

  // Contest creation
  const [showCreateContest, setShowCreateContest] = useState(false);
  const [contestForm,    setContestForm]    = useState({ ...EMPTY_CONTEST });
  const [contestSaving,  setContestSaving]  = useState(false);
  const [contestError,   setContestError]   = useState('');

  useEffect(() => {
    if (!getToken() || !isAdmin()) { router.push('/auth/login'); return; }
    setAuthorized(true);
    load('dashboard');
  }, []);

  const load = async (t: Tab) => {
    setLoading(true); setLoadError('');
    try {
      if (t === 'dashboard')       { const r = await api.get('/admin/dashboard');                            setData(r.data); }
      else if (t === 'users')      { const r = await api.get('/admin/users');                                setUsers(r.data || []); }
      else if (t === 'submissions'){ const r = await api.get('/admin/submissions?suspicious=true');          setSubs(r.data || []); }
      else if (t === 'flags')      { const r = await api.get('/anti-cheat/flags');                           setFlags(r.data || []); }
      else if (t === 'challenges') { const r = await api.get('/challenges?limit=200');                       setChallenges(r.data.challenges || []); }
      else if (t === 'contests')   {
        const [c, ch] = await Promise.all([api.get('/contests'), api.get('/challenges?limit=200')]);
        setContests(c.data || []); setChallenges(ch.data.challenges || []);
      }
      else if (t === 'finance')    { const r = await api.get('/admin/wallet');                               setWallet(r.data); }
    } catch (e: any) {
      setLoadError(e?.response?.data?.message || e?.message || 'Failed to load data — check your connection');
    }
    setLoading(false);
  };

  const switchTab = (t: Tab) => { setTab(t); load(t); };
  const notify    = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 4000); };

  // ── Challenge CRUD ────────────────────────────────────────────────
  const openNewChallenge = () => {
    setEditingCh(null); setChForm({ ...EMPTY_CHALLENGE }); setTestCases([{ ...EMPTY_TC }]);
    setChError(''); setChModal(true);
  };
  const openEditChallenge = (c: any) => {
    setEditingCh(c);
    setChForm({
      title: c.title, description: c.description || '', difficulty: c.difficulty,
      category: c.category || '', supported_languages: c.supported_languages || ['javascript','python'],
      time_limit_ms: c.time_limit_ms || 5000, memory_limit_mb: c.memory_limit_mb || 256,
      max_submissions: c.max_submissions || 10, submission_cooldown_seconds: c.submission_cooldown_seconds || 30,
      is_published: !!c.is_published,
    });
    setTestCases([{ ...EMPTY_TC }]);
    setChError(''); setChModal(true);
  };
  const toggleLang = (lang: string) => {
    setChForm(f => ({
      ...f,
      supported_languages: f.supported_languages.includes(lang)
        ? f.supported_languages.filter(l => l !== lang)
        : [...f.supported_languages, lang],
    }));
  };
  const addTC    = () => setTestCases(t => [...t, { ...EMPTY_TC }]);
  const removeTC = (i: number) => setTestCases(t => t.filter((_, idx) => idx !== i));
  const updateTC = (i: number, field: string, val: any) =>
    setTestCases(t => t.map((tc, idx) => idx === i ? { ...tc, [field]: val } : tc));

  const saveChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chForm.title.trim() || !chForm.description.trim()) { setChError('Title and description are required'); return; }
    const validTC = testCases.filter(t => t.input.trim() && t.expected_output.trim());
    if (validTC.length === 0) { setChError('At least one test case with input and expected output is required'); return; }
    setChSaving(true); setChError('');
    try {
      const payload = { ...chForm, test_cases: validTC };
      if (editingCh) await api.put(`/challenges/${editingCh.id}`, payload);
      else            await api.post('/challenges', payload);
      setChModal(false); load('challenges');
      notify(editingCh ? 'Challenge updated ✓' : 'Challenge created ✓');
    } catch (e: any) { setChError(e.response?.data?.message || 'Error saving challenge'); }
    finally { setChSaving(false); }
  };

  const deleteChallenge = async (id: string) => {
    if (!confirm('Delete this challenge? This cannot be undone.')) return;
    try { await api.delete(`/challenges/${id}`); load('challenges'); notify('Challenge deleted'); }
    catch (e: any) { notify(e.response?.data?.message || 'Error'); }
  };

  // ── Contest creation ──────────────────────────────────────────────
  const toggleContestChallenge = (id: string) => {
    setContestForm(f => ({
      ...f,
      challenge_ids: f.challenge_ids.includes(id)
        ? f.challenge_ids.filter(c => c !== id)
        : [...f.challenge_ids, id],
    }));
  };
  const createContest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (contestForm.challenge_ids.length === 0) { setContestError('Select at least one challenge'); return; }
    setContestSaving(true); setContestError('');
    try {
      await api.post('/contests', {
        ...contestForm,
        entry_fee: Number(contestForm.entry_fee),
        max_participants: contestForm.max_participants ? Number(contestForm.max_participants) : undefined,
      });
      setContestForm({ ...EMPTY_CONTEST }); setShowCreateContest(false);
      load('contests'); notify('Contest created ✓');
    } catch (e: any) { setContestError(e.response?.data?.message || 'Error creating contest'); }
    finally { setContestSaving(false); }
  };

  // ── Other actions ─────────────────────────────────────────────────
  const doDeposit = async () => {
    const amount = Number(depositAmt);
    if (!amount || amount < 1) return;
    setDepositing(true);
    try {
      await api.post('/admin/wallet/deposit', { amount, note: depositNote || 'Manual top-up' });
      notify(`${amount.toLocaleString()} RWF deposited to platform wallet`);
      setDepositAmt(''); setDepositNote('');
      const r = await api.get('/admin/wallet'); setWallet(r.data);
    } catch (e: any) { notify(e.response?.data?.message || 'Deposit failed'); }
    finally { setDepositing(false); }
  };
  const banUser = async (id: string, ban: boolean) => {
    try { await api.post(`/admin/users/${id}/${ban ? 'ban' : 'unban'}`, { reason: 'Admin action' }); notify(`User ${ban ? 'banned' : 'unbanned'}`); load('users'); }
    catch { notify('Error'); }
  };
  const finalizeContest = async (id: string) => {
    try { await api.post(`/admin/contests/${id}/finalize`); notify('Contest finalized and prizes distributed ✓'); load('contests'); }
    catch (e: any) { notify(e.response?.data?.message || 'Error'); }
  };
  const reviewFlag = async (id: string, action: string) => {
    try { await api.post(`/anti-cheat/flags/${id}/review`, { action, notes: `Admin: ${action}` }); notify(`Flag ${action}d`); load('flags'); }
    catch { notify('Error'); }
  };

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: 'dashboard',   label: 'Dashboard',   icon: TrendingUp    },
    { key: 'users',       label: 'Users',        icon: Users         },
    { key: 'challenges',  label: 'Challenges',   icon: Code2         },
    { key: 'contests',    label: 'Contests',     icon: Trophy        },
    { key: 'submissions', label: 'Suspicious',   icon: ShieldAlert   },
    { key: 'flags',       label: 'Cheat Flags',  icon: AlertTriangle },
    { key: 'finance',     label: 'Finance',      icon: Wallet        },
  ];

  if (!authorized) return <div className="min-h-screen bg-gray-950" />;

  return (
    <div className="min-h-screen bg-gray-950">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        <div>
          <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
          <p className="text-gray-500 text-sm mt-1">Platform management</p>
        </div>

        {msg && (
          <div className="rounded-xl px-4 py-3 text-sm font-medium bg-green-900/30 border border-green-700 text-green-300">
            {msg}
          </div>
        )}

        {/* Tab bar */}
        <div className="flex flex-wrap border-b border-gray-800">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => switchTab(key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === key ? 'border-green-500 text-green-400' : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}>
              <Icon className="w-3.5 h-3.5" />{label}
            </button>
          ))}
        </div>

        {loadError && <div className="card p-4 border-red-800 bg-red-900/20 text-red-400 text-sm">{loadError}</div>}

        {/* ── Dashboard ── */}
        {!loading && tab === 'dashboard' && data && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Total Users',       value: data.users?.total       || 0, sub: `+${data.users?.today || 0} today`,                 color: 'text-blue-400'   },
                { label: 'Total Submissions', value: data.submissions?.total || 0, sub: `${data.submissions?.accepted || 0} accepted`,       color: 'text-green-400'  },
                { label: 'Active Contests',   value: data.contests?.active   || 0, sub: `${data.contests?.total || 0} total`,                color: 'text-purple-400' },
                { label: 'Open Flags',        value: data.flags?.open        || 0, sub: `${data.submissions?.cheating || 0} suspicious`,     color: 'text-red-400'    },
              ].map(s => (
                <div key={s.label} className="card p-5">
                  <p className="text-xs text-gray-500 uppercase font-semibold tracking-wide mb-2">{s.label}</p>
                  <p className={`text-3xl font-black ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-gray-600 mt-1">{s.sub}</p>
                </div>
              ))}
            </div>
            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-800">
                <h2 className="font-semibold text-white text-sm">Top Users by Problems Solved</h2>
              </div>
              <table className="w-full text-sm">
                <thead className="border-b border-gray-800">
                  <tr>{['Name','Email','Solved','Earnings','Risk'].map(h => (
                    <th key={h} className="text-left px-4 py-2 text-xs text-gray-500 font-semibold uppercase">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {(data.topUsers || []).map((u: any) => (
                    <tr key={u.email}>
                      <td className="px-4 py-2.5 font-medium text-white">{u.name}</td>
                      <td className="px-4 py-2.5 text-gray-400 text-xs">{u.email}</td>
                      <td className="px-4 py-2.5 text-green-400 font-semibold">{u.solved}</td>
                      <td className="px-4 py-2.5 text-yellow-400">{Number(u.total_earnings).toLocaleString()} RWF</td>
                      <td className="px-4 py-2.5">
                        <span className={`badge text-xs ${u.risk_score > 60 ? 'badge-red' : u.risk_score > 30 ? 'badge-yellow' : 'badge-green'}`}>{u.risk_score}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Users ── */}
        {!loading && tab === 'users' && (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-800">
                <tr>{['Name','Email','Balance','Status','Joined',''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs text-gray-500 font-semibold uppercase">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {users.map((u: any) => (
                  <tr key={u.id} className="hover:bg-gray-800/20">
                    <td className="px-4 py-3 font-medium text-white">{u.name}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{u.email}</td>
                    <td className="px-4 py-3 text-green-400 font-semibold">{Number(u.balance||0).toLocaleString()} RWF</td>
                    <td className="px-4 py-3">
                      <span className={`badge text-xs ${u.is_banned ? 'badge-red' : 'badge-green'}`}>{u.is_banned ? 'Banned' : 'Active'}</span>
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

        {/* ── Challenges ── */}
        {!loading && tab === 'challenges' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">{challenges.length} challenge{challenges.length !== 1 ? 's' : ''}</p>
              <button onClick={openNewChallenge} className="btn-primary btn-sm">
                <Plus className="w-4 h-4" /> New Challenge
              </button>
            </div>
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-800">
                  <tr>{['Title','Difficulty','Category','Status',''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs text-gray-500 font-semibold uppercase">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {challenges.map((c: any) => (
                    <tr key={c.id} className="hover:bg-gray-800/20">
                      <td className="px-4 py-3 font-medium text-white">{c.title}</td>
                      <td className="px-4 py-3">
                        <span className={`badge text-xs capitalize ${c.difficulty === 'easy' ? 'badge-green' : c.difficulty === 'hard' ? 'badge-red' : 'badge-yellow'}`}>{c.difficulty}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{c.category || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`badge text-xs ${c.is_published ? 'badge-green' : 'badge'}`}>{c.is_published ? 'Published' : 'Draft'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => openEditChallenge(c)} className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white"><Pencil className="w-3.5 h-3.5" /></button>
                          <button onClick={() => deleteChallenge(c.id)} className="p-1.5 rounded-lg hover:bg-red-900/30 text-gray-500 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {challenges.length === 0 && (
                <div className="p-16 text-center">
                  <Code2 className="w-10 h-10 mx-auto text-gray-700 mb-3" />
                  <p className="text-gray-500">No challenges yet</p>
                  <button onClick={openNewChallenge} className="btn-primary btn-sm mt-4">Create your first challenge</button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Contests ── */}
        {!loading && tab === 'contests' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">{contests.length} contest{contests.length !== 1 ? 's' : ''}</p>
              <button onClick={() => { setShowCreateContest(v => !v); setContestError(''); }} className="btn-primary btn-sm">
                <Plus className="w-4 h-4" /> {showCreateContest ? 'Cancel' : 'Create Contest'}
              </button>
            </div>

            {showCreateContest && (
              <div className="card p-6 border-green-800/40 bg-green-900/5">
                <h2 className="font-bold text-white flex items-center gap-2 mb-5"><Calendar className="w-4 h-4 text-green-400" /> New Contest</h2>
                {contestError && <div className="bg-red-900/20 border border-red-800 text-red-400 text-sm rounded-xl px-4 py-3 mb-4">{contestError}</div>}
                <form onSubmit={createContest} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label className="label">Title *</label>
                      <input className="input" value={contestForm.title} onChange={e => setContestForm(f => ({...f, title: e.target.value}))} required placeholder="e.g. Weekend Coding Sprint" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="label">Description</label>
                      <textarea className="input" rows={2} value={contestForm.description} onChange={e => setContestForm(f => ({...f, description: e.target.value}))} placeholder="Brief description..." />
                    </div>
                    <div>
                      <label className="label">Entry Fee (RWF)</label>
                      <input type="number" min="0" className="input" value={contestForm.entry_fee} onChange={e => setContestForm(f => ({...f, entry_fee: Number(e.target.value)}))} placeholder="0 for free" />
                    </div>
                    <div>
                      <label className="label">Max Participants</label>
                      <input type="number" min="2" className="input" value={contestForm.max_participants} onChange={e => setContestForm(f => ({...f, max_participants: e.target.value}))} placeholder="Blank = unlimited" />
                    </div>
                    <div>
                      <label className="label">Start Time *</label>
                      <input type="datetime-local" className="input" value={contestForm.start_time} onChange={e => setContestForm(f => ({...f, start_time: e.target.value}))} required />
                    </div>
                    <div>
                      <label className="label">End Time *</label>
                      <input type="datetime-local" className="input" value={contestForm.end_time} onChange={e => setContestForm(f => ({...f, end_time: e.target.value}))} required />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="rated" checked={contestForm.is_rated} onChange={e => setContestForm(f => ({...f, is_rated: e.target.checked}))} className="w-4 h-4 accent-green-500" />
                    <label htmlFor="rated" className="text-sm text-gray-300">Rated contest (affects leaderboard)</label>
                  </div>
                  <div>
                    <label className="label">Challenges * (select at least one)</label>
                    <div className="max-h-48 overflow-y-auto border border-gray-700 rounded-xl divide-y divide-gray-800">
                      {challenges.length === 0 && <p className="text-gray-500 text-sm p-4">No challenges yet — create challenges first</p>}
                      {challenges.map((c: any) => {
                        const selected = contestForm.challenge_ids.includes(c.id);
                        return (
                          <label key={c.id} className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${selected ? 'bg-green-900/20' : 'hover:bg-gray-800/40'}`}>
                            <input type="checkbox" checked={selected} onChange={() => toggleContestChallenge(c.id)} className="w-4 h-4 accent-green-500 shrink-0" />
                            <span className="text-sm text-white flex-1">{c.title}</span>
                            <span className={`badge text-xs capitalize ${c.difficulty === 'easy' ? 'badge-green' : c.difficulty === 'hard' ? 'badge-red' : 'badge-yellow'}`}>{c.difficulty}</span>
                          </label>
                        );
                      })}
                    </div>
                    {contestForm.challenge_ids.length > 0 && <p className="text-xs text-green-400 mt-1">{contestForm.challenge_ids.length} selected</p>}
                  </div>
                  <div className="flex gap-3">
                    <button type="button" onClick={() => setShowCreateContest(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
                    <button type="submit" disabled={contestSaving} className="btn-primary flex-1 justify-center">{contestSaving ? 'Creating...' : 'Create Contest'}</button>
                  </div>
                </form>
              </div>
            )}

            {contests.map((c: any) => (
              <div key={c.id} className="card p-5 flex items-center justify-between gap-4">
                <div>
                  <p className="font-bold text-white">{c.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`badge text-xs capitalize ${c.status === 'active' ? 'badge-green' : c.status === 'completed' ? 'badge' : 'badge-blue'}`}>{c.status}</span>
                    <span className="text-gray-500 text-xs">{c.participant_count || 0} participants · {Number(c.prize_pool||0).toLocaleString()} RWF pool</span>
                  </div>
                </div>
                {c.status === 'active' && <button onClick={() => finalizeContest(c.id)} className="btn-primary btn-sm">🏆 Finalize & Pay</button>}
                {c.status === 'completed' && <span className="text-green-400 text-xs font-semibold">✓ Prizes distributed</span>}
              </div>
            ))}
            {contests.length === 0 && !showCreateContest && (
              <div className="card p-12 text-center">
                <Trophy className="w-10 h-10 mx-auto text-gray-700 mb-3" />
                <p className="text-gray-500">No contests yet</p>
                <button onClick={() => setShowCreateContest(true)} className="btn-primary btn-sm mt-4">Create first contest</button>
              </div>
            )}
          </div>
        )}

        {/* ── Suspicious Submissions ── */}
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
                    <span className="badge-yellow badge text-xs">Paste: {s.paste_count}</span>
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

        {/* ── Cheat Flags ── */}
        {!loading && tab === 'flags' && (
          <div className="space-y-3">
            {flags.length === 0 && <div className="card p-10 text-center text-gray-500">No open flags</div>}
            {flags.map((f: any) => (
              <div key={f.id} className="card p-5 flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`badge text-xs ${f.severity === 'critical' ? 'badge-red' : f.severity === 'high' ? 'badge-yellow' : 'badge'}`}>{f.severity}</span>
                    <span className="badge text-xs">{f.flag_type?.replace(/_/g,' ')}</span>
                  </div>
                  <p className="text-white font-medium">{f.user_name} <span className="text-gray-500 text-sm">({f.user_email})</span></p>
                  <p className="text-gray-500 text-xs mt-1">Risk score: {f.risk_score} · {new Date(f.created_at).toLocaleString()}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => reviewFlag(f.id, 'dismiss')} className="btn-secondary btn-sm">Dismiss</button>
                  <button onClick={() => reviewFlag(f.id, 'ban')} className="btn-danger btn-sm">Ban User</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Finance ── */}
        {!loading && tab === 'finance' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="card p-6 space-y-4">
                <div className="flex items-center gap-2"><Wallet className="w-5 h-5 text-green-400" /><h2 className="font-bold text-white">Platform Wallet</h2></div>
                <p className="text-4xl font-black text-green-400">{wallet ? Number(wallet.balance).toLocaleString() : '—'} <span className="text-xl text-green-600">RWF</span></p>
                <div className="grid grid-cols-2 gap-3 pt-2">
                  {[
                    { label: 'Total Bets',      value: wallet?.stats?.total_bets      || 0,     color: 'text-blue-400'   },
                    { label: 'Active Bets',     value: wallet?.stats?.active_bets     || 0,     color: 'text-yellow-400' },
                    { label: 'Total Collected', value: `${Number(wallet?.stats?.total_collected||0).toLocaleString()} RWF`, color: 'text-green-400' },
                    { label: 'Total Paid Out',  value: `${Number(wallet?.stats?.total_paid_out ||0).toLocaleString()} RWF`, color: 'text-red-400'   },
                  ].map(s => (
                    <div key={s.label} className="bg-gray-800/60 rounded-xl p-3">
                      <p className="text-xs text-gray-500 mb-1">{s.label}</p>
                      <p className={`font-bold text-sm ${s.color}`}>{s.value}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="card p-6 space-y-4">
                <div className="flex items-center gap-2"><ArrowDownToLine className="w-5 h-5 text-amber-400" /><h2 className="font-bold text-white">Deposit to Platform</h2></div>
                <p className="text-sm text-gray-500">Add real cash to the platform pool to pay out winning bets.</p>
                <div className="space-y-3">
                  <div><label className="label">Amount (RWF)</label><input type="number" min="1000" placeholder="e.g. 100000" value={depositAmt} onChange={e => setDepositAmt(e.target.value)} className="input" /></div>
                  <div><label className="label">Note (optional)</label><input type="text" placeholder="e.g. Monthly top-up" value={depositNote} onChange={e => setDepositNote(e.target.value)} className="input" /></div>
                  <div className="flex gap-2 flex-wrap">
                    {[10000,50000,100000,500000].map(v => (
                      <button key={v} onClick={() => setDepositAmt(String(v))} className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium">{v/1000}K</button>
                    ))}
                  </div>
                  <button onClick={doDeposit} disabled={depositing || !depositAmt} className="btn-primary w-full justify-center py-3">{depositing ? 'Processing...' : 'Deposit to Platform Wallet'}</button>
                </div>
              </div>
            </div>
            {wallet?.recent?.length > 0 && (
              <div className="card overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-800"><h2 className="font-semibold text-white text-sm">Recent Bet Activity</h2></div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-gray-800">
                      <tr>{['User','Challenge','Bet','×','Payout','Status','Date'].map(h => (
                        <th key={h} className="text-left px-4 py-2 text-xs text-gray-500 font-semibold uppercase">{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {wallet.recent.map((b: any, i: number) => (
                        <tr key={i}>
                          <td className="px-4 py-2.5 font-medium text-white">{b.user_name}</td>
                          <td className="px-4 py-2.5 text-gray-400 text-xs max-w-[140px] truncate">{b.challenge_title}</td>
                          <td className="px-4 py-2.5 text-yellow-400 font-medium">{Number(b.amount).toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-gray-400">{b.multiplier}×</td>
                          <td className="px-4 py-2.5 text-green-400 font-medium">{Number(b.potential_payout).toLocaleString()}</td>
                          <td className="px-4 py-2.5"><span className={`badge text-xs ${b.status==='won'?'badge-green':b.status==='lost'?'badge-red':'badge-yellow'}`}>{b.status}</span></td>
                          <td className="px-4 py-2.5 text-gray-500 text-xs">{new Date(b.created_at).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {loading && <div className="card p-16 text-center text-gray-500 animate-pulse">Loading...</div>}
      </main>

      {/* ── Challenge create/edit modal ── */}
      {chModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-4 overflow-y-auto">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-3xl my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
              <h2 className="font-bold text-white text-lg">{editingCh ? 'Edit Challenge' : 'New Challenge'}</h2>
              <button onClick={() => setChModal(false)}><X className="w-5 h-5 text-gray-400 hover:text-white" /></button>
            </div>
            <form onSubmit={saveChallenge} className="p-6 space-y-5">
              {chError && <div className="bg-red-900/20 border border-red-800 text-red-400 text-sm rounded-xl px-4 py-3">{chError}</div>}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="label">Title *</label>
                  <input className="input" value={chForm.title} onChange={e => setChForm(f => ({...f, title: e.target.value}))} required placeholder="e.g. Two Sum" />
                </div>
                <div>
                  <label className="label">Difficulty *</label>
                  <select className="input" value={chForm.difficulty} onChange={e => setChForm(f => ({...f, difficulty: e.target.value}))}>
                    <option value="easy">Easy (2× bet multiplier)</option>
                    <option value="medium">Medium (3× bet multiplier)</option>
                    <option value="hard">Hard (5× bet multiplier)</option>
                  </select>
                </div>
                <div>
                  <label className="label">Category</label>
                  <input className="input" value={chForm.category} onChange={e => setChForm(f => ({...f, category: e.target.value}))} placeholder="e.g. Arrays, Strings, DP..." />
                </div>
              </div>

              <div>
                <label className="label">Description * (Markdown supported)</label>
                <textarea className="input font-mono text-sm" rows={7} value={chForm.description}
                  onChange={e => setChForm(f => ({...f, description: e.target.value}))} required
                  placeholder={`## Problem\nGiven an array of integers nums and an integer target...\n\n## Constraints\n- 2 <= nums.length <= 10^4\n- All inputs are valid\n\n## Example\nInput: nums = [2,7,11,15], target = 9\nOutput: [0,1]`} />
              </div>

              <div>
                <label className="label">Supported Languages</label>
                <div className="flex gap-4 mt-1">
                  {['javascript','python'].map(lang => (
                    <label key={lang} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={chForm.supported_languages.includes(lang)} onChange={() => toggleLang(lang)} className="w-4 h-4 accent-green-500" />
                      <span className="text-sm text-gray-300 capitalize">{lang}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div><label className="label">Time Limit (ms)</label><input type="number" min="1000" max="30000" step="1000" className="input" value={chForm.time_limit_ms} onChange={e => setChForm(f => ({...f, time_limit_ms: Number(e.target.value)}))} /></div>
                <div><label className="label">Memory (MB)</label><input type="number" min="32" max="1024" className="input" value={chForm.memory_limit_mb} onChange={e => setChForm(f => ({...f, memory_limit_mb: Number(e.target.value)}))} /></div>
                <div><label className="label">Max Subs/hr</label><input type="number" min="1" max="50" className="input" value={chForm.max_submissions} onChange={e => setChForm(f => ({...f, max_submissions: Number(e.target.value)}))} /></div>
                <div><label className="label">Cooldown (sec)</label><input type="number" min="0" className="input" value={chForm.submission_cooldown_seconds} onChange={e => setChForm(f => ({...f, submission_cooldown_seconds: Number(e.target.value)}))} /></div>
              </div>

              <div className="flex items-center gap-2">
                <input type="checkbox" id="pub" checked={chForm.is_published} onChange={e => setChForm(f => ({...f, is_published: e.target.checked}))} className="w-4 h-4 accent-green-500" />
                <label htmlFor="pub" className="text-sm text-gray-300">Published — visible to all users immediately</label>
              </div>

              {/* Test Cases */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="label mb-0">Test Cases *</label>
                  <button type="button" onClick={addTC} className="text-xs text-green-400 hover:text-green-300 flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Add test case
                  </button>
                </div>
                <div className="space-y-3">
                  {testCases.map((tc, i) => (
                    <div key={i} className="bg-gray-800/60 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500 font-semibold uppercase">Test Case #{i + 1}</span>
                        {testCases.length > 1 && <button type="button" onClick={() => removeTC(i)} className="text-red-400 hover:text-red-300 text-xs">Remove</button>}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="label text-xs">Input (stdin)</label>
                          <textarea className="input font-mono text-xs" rows={3} value={tc.input} onChange={e => updateTC(i, 'input', e.target.value)} placeholder="9&#10;2 7 11 15" />
                        </div>
                        <div>
                          <label className="label text-xs">Expected Output (stdout)</label>
                          <textarea className="input font-mono text-xs" rows={3} value={tc.expected_output} onChange={e => updateTC(i, 'expected_output', e.target.value)} placeholder="0 1" />
                        </div>
                      </div>
                      <div className="flex items-center gap-4 flex-wrap">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={tc.is_sample} onChange={e => updateTC(i, 'is_sample', e.target.checked)} className="w-3.5 h-3.5 accent-green-500" />
                          <span className="text-xs text-gray-400">Show as sample in problem statement</span>
                        </label>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">Points:</span>
                          <input type="number" min="1" className="input w-20 text-xs py-1" value={tc.points} onChange={e => updateTC(i, 'points', Number(e.target.value))} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setChModal(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
                <button type="submit" disabled={chSaving} className="btn-primary flex-1 justify-center">
                  <CheckCircle className="w-4 h-4" />
                  {chSaving ? 'Saving...' : editingCh ? 'Update Challenge' : 'Create Challenge'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
