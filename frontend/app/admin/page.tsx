'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import api from '@/lib/api';
import { getToken, isAdmin, getUser, logout } from '@/lib/auth';
import { useI18n } from '@/lib/i18n-context';
import {
  LayoutDashboard, Users, Trophy, Wallet, ShieldAlert, AlertTriangle,
  Settings, Code2, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  Search, Bell, ChevronDown, MoreHorizontal, Ban, Eye, Pencil, Trash2,
  Plus, X, CheckCircle, XCircle, Clock, LogOut, Activity, Zap,
  DollarSign, UserCheck, Calendar, Filter, RefreshCw, Download,
  ChevronLeft, ChevronRight, Star, Award, Target, Layers, Building2,
} from 'lucide-react';

const AreaChart    = dynamic(() => import('recharts').then(m => ({ default: m.AreaChart    })), { ssr: false });
const BarChart     = dynamic(() => import('recharts').then(m => ({ default: m.BarChart     })), { ssr: false });
const Area         = dynamic(() => import('recharts').then(m => ({ default: m.Area         })), { ssr: false });
const Bar          = dynamic(() => import('recharts').then(m => ({ default: m.Bar          })), { ssr: false });
const XAxis        = dynamic(() => import('recharts').then(m => ({ default: m.XAxis        })), { ssr: false });
const YAxis        = dynamic(() => import('recharts').then(m => ({ default: m.YAxis        })), { ssr: false });
const CartesianGrid= dynamic(() => import('recharts').then(m => ({ default: m.CartesianGrid})), { ssr: false });
const Tooltip      = dynamic(() => import('recharts').then(m => ({ default: m.Tooltip      })), { ssr: false });
const ResponsiveContainer = dynamic(() => import('recharts').then(m => ({ default: m.ResponsiveContainer })), { ssr: false });

type View = 'overview'|'users'|'financial'|'challenges'|'contests'|'anticheat'|'withdrawals'|'rewards'|'import'|'ailogs'|'system';

// ── Generate synthetic trend data ────────────────────────────────────────────
function genDays(n: number, base: number, variance: number) {
  const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  return Array.from({ length: n }, (_, i) => ({
    day:      days[i % 7],
    label:    new Date(Date.now() - (n - 1 - i) * 86400000).toLocaleDateString('en', { month:'short', day:'numeric' }),
    users:    Math.max(0, Math.round(base + (Math.random() - 0.4) * variance)),
    revenue:  Math.max(0, Math.round(base * 120 + (Math.random() - 0.4) * variance * 200)),
    solved:   Math.max(0, Math.round(base * 3 + (Math.random() - 0.3) * variance * 4)),
    payouts:  Math.max(0, Math.round(base * 80 + (Math.random() - 0.5) * variance * 150)),
  }));
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmt  = (n: number) => Number(n || 0).toLocaleString();
const fmtK = (n: number) => n >= 1000 ? `${(n/1000).toFixed(1)}K` : String(n);
const avatar = (name: string) => (name || '?').charAt(0).toUpperCase();
const avatarColor = (name: string) => {
  const colors = ['bg-green-600','bg-blue-600','bg-purple-600','bg-amber-600','bg-pink-600','bg-cyan-600'];
  return colors[(name || '').charCodeAt(0) % colors.length];
};

// ── Constants ────────────────────────────────────────────────────────────────
const EMPTY_CH = {
  title:'', description:'', difficulty:'easy', category:'',
  supported_languages:['javascript','python'] as string[],
  time_limit_ms:5000, memory_limit_mb:256,
  max_submissions:10, submission_cooldown_seconds:30, is_published:false,
};
const EMPTY_TC = { input:'', expected_output:'', is_sample:false, points:10 };
const EMPTY_CT = { title:'', description:'', entry_fee:0, start_time:'', end_time:'', max_participants:'', is_rated:false, challenge_ids:[] as string[] };

// ── StatCard ─────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, trend, color, glow }: any) {
  const up = trend >= 0;
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gray-900 border border-gray-800 p-5 hover:border-gray-700 transition-all group cursor-default`}>
      <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-br ${glow} pointer-events-none`} />
      <div className="relative">
        <div className="flex items-start justify-between mb-4">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color}`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <span className={`flex items-center gap-0.5 text-xs font-semibold px-2 py-1 rounded-full ${up ? 'bg-green-900/40 text-green-400' : 'bg-red-900/40 text-red-400'}`}>
            {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(trend)}%
          </span>
        </div>
        <p className="text-2xl font-black text-white tracking-tight">{value}</p>
        <p className="text-xs text-gray-500 mt-0.5">{label}</p>
        {sub && <p className="text-xs text-gray-600 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const router = useRouter();
  const admin  = getUser();
  const { t }  = useI18n();

  const [view,       setView]       = useState<View>('overview');
  const [sideOpen,   setSideOpen]   = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [toast,      setToast]      = useState('');
  const [range,      setRange]      = useState<7|30>(7);

  // Data
  const [dash,       setDash]       = useState<any>(null);
  const [users,      setUsers]      = useState<any[]>([]);
  const [challenges, setChallenges] = useState<any[]>([]);
  const [contests,   setContests]   = useState<any[]>([]);
  const [flags,      setFlags]      = useState<any[]>([]);
  const [subs,       setSubs]       = useState<any[]>([]);
  const [wallet,     setWallet]     = useState<any>(null);
  const [leaderboard,setLeaderboard]= useState<any[]>([]);
  const [chartData,  setChartData]  = useState<any[]>([]);
  const [loading,    setLoading]    = useState<Record<View,boolean>>({
    overview:true, users:false, financial:false, challenges:false,
    contests:false, anticheat:false, withdrawals:false, rewards:false, import:false, ailogs:false, system:false,
  });
  const [withdrawals,   setWithdrawals]   = useState<any[]>([]);
  const [rewardSettings,setRewardSettings]= useState<any[]>([]);
  const [aiLogs,        setAiLogs]        = useState<any[]>([]);
  const [importFile,    setImportFile]    = useState<File | null>(null);
  const [importResult,  setImportResult]  = useState<any>(null);
  const [importLoading, setImportLoading] = useState(false);

  // User table state
  const [userSearch, setUserSearch] = useState('');
  const [userPage,   setUserPage]   = useState(1);
  const [userFilter, setUserFilter] = useState('all');
  const [adjustUser, setAdjustUser] = useState<any>(null);
  const [adjustAmt,  setAdjustAmt]  = useState('');
  const [adjustNote, setAdjustNote] = useState('');

  // Challenge state
  const [chModal,   setChModal]   = useState(false);
  const [editingCh, setEditingCh] = useState<any>(null);
  const [chForm,    setChForm]    = useState({ ...EMPTY_CH });
  const [testCases, setTestCases] = useState([{ ...EMPTY_TC }]);
  const [chSaving,  setChSaving]  = useState(false);
  const [chError,   setChError]   = useState('');

  // Contest state
  const [showNewContest, setShowNewContest] = useState(false);
  const [contestForm,    setContestForm]    = useState({ ...EMPTY_CT });
  const [contestSaving,  setContestSaving]  = useState(false);
  const [contestError,   setContestError]   = useState('');

  // Finance
  const [depositAmt,  setDepositAmt]  = useState('');
  const [depositNote, setDepositNote] = useState('');

  const notify = (m: string) => { setToast(m); setTimeout(() => setToast(''), 4000); };

  useEffect(() => {
    if (!getToken() || !isAdmin()) { router.push('/auth/login'); return; }
    setAuthorized(true);
    loadOverview();
  }, []);

  useEffect(() => { setChartData(genDays(range, 12, 8)); }, [range]);

  const setLoad = (v: View, val: boolean) => setLoading(l => ({ ...l, [v]: val }));

  const loadOverview = async () => {
    setLoad('overview', true);
    try {
      const [d, lb] = await Promise.all([
        api.get('/admin/dashboard'),
        api.get('/leaderboard/global').catch(() => ({ data: [] })),
      ]);
      setDash(d.data);
      setLeaderboard((lb.data || []).slice(0, 5));
      setChartData(genDays(7, Math.max(d.data?.users?.total || 0, 5), 6));
    } catch {}
    setLoad('overview', false);
  };

  const loadUsers = async (page = 1, search = '') => {
    setLoad('users', true);
    try {
      const r = await api.get(`/admin/users?page=${page}&search=${search}`);
      setUsers(r.data || []);
    } catch {}
    setLoad('users', false);
  };

  const loadChallenges = async () => {
    setLoad('challenges', true);
    try { const r = await api.get('/challenges?limit=200'); setChallenges(r.data.challenges || []); }
    catch {} setLoad('challenges', false);
  };

  const loadContests = async () => {
    setLoad('contests', true);
    try {
      const [c, ch] = await Promise.all([api.get('/contests'), api.get('/challenges?limit=200')]);
      setContests(c.data || []); setChallenges(ch.data.challenges || []);
    } catch {} setLoad('contests', false);
  };

  const loadAntiCheat = async () => {
    setLoad('anticheat', true);
    try {
      const [f, s] = await Promise.all([
        api.get('/anti-cheat/flags'),
        api.get('/admin/submissions?suspicious=true'),
      ]);
      setFlags(f.data || []); setSubs(s.data || []);
    } catch {} setLoad('anticheat', false);
  };

  const loadFinancial = async () => {
    setLoad('financial', true);
    try { const r = await api.get('/admin/wallet'); setWallet(r.data); }
    catch {} setLoad('financial', false);
  };

  const loadWithdrawals = async () => {
    setLoad('withdrawals', true);
    try { const r = await api.get('/admin/withdrawals'); setWithdrawals(r.data || []); }
    catch {} setLoad('withdrawals', false);
  };

  const loadRewards = async () => {
    setLoad('rewards', true);
    try { const r = await api.get('/admin/rewards'); setRewardSettings(r.data || []); }
    catch {} setLoad('rewards', false);
  };

  const loadAiLogs = async () => {
    setLoad('ailogs', true);
    try { const r = await api.get('/admin/ai-logs'); setAiLogs(r.data || []); }
    catch {} setLoad('ailogs', false);
  };

  const approveWithdrawal = async (id: string) => {
    try {
      await api.post(`/admin/withdrawals/${id}/approve`);
      notify('Withdrawal approved');
      loadWithdrawals();
    } catch (e: any) { notify(e.response?.data?.message || 'Failed'); }
  };

  const rejectWithdrawal = async (id: string) => {
    const reason = prompt('Rejection reason:');
    if (!reason) return;
    try {
      await api.post(`/admin/withdrawals/${id}/reject`, { reason });
      notify('Withdrawal rejected'); loadWithdrawals();
    } catch (e: any) { notify(e.response?.data?.message || 'Failed'); }
  };

  const updateReward = async (difficulty: string, amount: number) => {
    try {
      await api.put(`/admin/rewards/${difficulty}`, { amount });
      notify(`${difficulty} reward updated to $${amount}`); loadRewards();
    } catch (e: any) { notify(e.response?.data?.message || 'Failed'); }
  };

  const handleImport = async () => {
    if (!importFile) return;
    setImportLoading(true); setImportResult(null);
    const fd = new FormData();
    fd.append('file', importFile);
    try {
      const r = await api.post('/admin/challenges/import', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setImportResult(r.data); notify(`Imported ${r.data.inserted} challenges`);
    } catch (e: any) { notify(e.response?.data?.message || 'Import failed'); }
    finally { setImportLoading(false); }
  };

  const switchView = (v: View) => {
    setView(v);
    if (v === 'users')        loadUsers();
    if (v === 'challenges')   loadChallenges();
    if (v === 'contests')     loadContests();
    if (v === 'anticheat')    loadAntiCheat();
    if (v === 'financial')    loadFinancial();
    if (v === 'withdrawals')  loadWithdrawals();
    if (v === 'rewards')      loadRewards();
    if (v === 'ailogs')       loadAiLogs();
  };

  // Challenge CRUD
  const openNewCh = () => { setEditingCh(null); setChForm({ ...EMPTY_CH }); setTestCases([{ ...EMPTY_TC }]); setChError(''); setChModal(true); };
  const openEditCh = (c: any) => {
    setEditingCh(c);
    setChForm({ title:c.title, description:c.description||'', difficulty:c.difficulty, category:c.category||'',
      supported_languages:c.supported_languages||['javascript','python'],
      time_limit_ms:c.time_limit_ms||5000, memory_limit_mb:c.memory_limit_mb||256,
      max_submissions:c.max_submissions||10, submission_cooldown_seconds:c.submission_cooldown_seconds||30,
      is_published:!!c.is_published });
    setTestCases([{ ...EMPTY_TC }]); setChError(''); setChModal(true);
  };
  const toggleLang = (lang: string) =>
    setChForm(f => ({ ...f, supported_languages: f.supported_languages.includes(lang)
      ? f.supported_languages.filter(l => l !== lang) : [...f.supported_languages, lang] }));
  const saveCh = async (e: React.FormEvent) => {
    e.preventDefault();
    const valid = testCases.filter(t => t.input.trim() && t.expected_output.trim());
    if (!chForm.title || !chForm.description) { setChError('Title and description required'); return; }
    if (!valid.length) { setChError('Add at least one test case'); return; }
    setChSaving(true); setChError('');
    try {
      if (editingCh) await api.put(`/challenges/${editingCh.id}`, { ...chForm, test_cases: valid });
      else            await api.post('/challenges', { ...chForm, test_cases: valid });
      setChModal(false); loadChallenges(); notify(editingCh ? 'Challenge updated' : 'Challenge created ✓');
    } catch (e: any) { setChError(e.response?.data?.message || 'Error'); }
    setChSaving(false);
  };
  const deleteCh = async (id: string) => {
    if (!confirm('Delete this challenge?')) return;
    try { await api.delete(`/challenges/${id}`); loadChallenges(); notify('Challenge deleted'); }
    catch (e: any) { notify(e.response?.data?.message || 'Error'); }
  };

  // Contest CRUD
  const saveContest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contestForm.challenge_ids.length) { setContestError('Select at least one challenge'); return; }
    setContestSaving(true); setContestError('');
    try {
      await api.post('/contests', { ...contestForm, entry_fee: Number(contestForm.entry_fee),
        max_participants: contestForm.max_participants ? Number(contestForm.max_participants) : undefined });
      setContestForm({ ...EMPTY_CT }); setShowNewContest(false); loadContests(); notify('Contest created ✓');
    } catch (e: any) { setContestError(e.response?.data?.message || 'Error'); }
    setContestSaving(false);
  };
  const finalizeContest = async (id: string) => {
    try { await api.post(`/admin/contests/${id}/finalize`); loadContests(); notify('Contest finalized & prizes paid ✓'); }
    catch (e: any) { notify(e.response?.data?.message || 'Error'); }
  };

  // Users
  const banUser = async (id: string, ban: boolean) => {
    try { await api.post(`/admin/users/${id}/${ban?'ban':'unban'}`, { reason:'Admin action' }); loadUsers(userPage, userSearch); notify(`User ${ban?'banned':'unbanned'}`); }
    catch { notify('Error'); }
  };
  const activateUser = async (id: string) => {
    try { await api.post(`/admin/users/${id}/activate`); loadUsers(userPage, userSearch); notify('User activated ✓'); }
    catch { notify('Error activating user'); }
  };
  const deleteUser = async (id: string, name: string) => {
    if (!confirm(`Delete user "${name}"? This cannot be undone.`)) return;
    try { await api.delete(`/admin/users/${id}`); loadUsers(userPage, userSearch); notify('User deleted'); }
    catch (e: any) { notify(e.response?.data?.message || 'Error deleting user'); }
  };
  const doAdjust = async () => {
    if (!adjustUser || !adjustAmt) return;
    try {
      await api.post(`/admin/users/${adjustUser.id}/adjust-balance`, { amount: Number(adjustAmt), reason: adjustNote || 'Admin adjustment' });
      setAdjustUser(null); setAdjustAmt(''); setAdjustNote('');
      loadUsers(userPage, userSearch); notify('Balance adjusted ✓');
    } catch (e: any) { notify(e.response?.data?.message || 'Error'); }
  };

  // Anti-cheat
  const reviewFlag = async (id: string, action: string) => {
    try { await api.post(`/anti-cheat/flags/${id}/review`, { action, notes:`Admin: ${action}` }); loadAntiCheat(); notify(`Flag ${action}d`); }
    catch { notify('Error'); }
  };

  // Quick actions
  const exportUsersCSV = async () => {
    try {
      const r = await api.get('/admin/users/export');
      const rows: any[] = r.data;
      const headers = ['ID','Name','Email','Balance','Total Earnings','Risk Score','Email Verified','Banned','KYC Verified','Joined'];
      const csv = [
        headers.join(','),
        ...rows.map(u => [
          u.id, `"${u.name}"`, u.email,
          u.balance ?? 0, u.total_earnings ?? 0,
          u.risk_score, u.email_verified ? 'Yes':'No',
          u.is_banned ? 'Yes':'No',
          u.kyc_verified ? 'Yes':'No',
          new Date(u.created_at).toLocaleDateString(),
        ].join(',')),
      ].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a'); a.href = url;
      a.download = `devixcode-users-${Date.now()}.csv`; a.click();
      URL.revokeObjectURL(url);
      notify(`Exported ${rows.length} users ✓`);
    } catch { notify('Export failed'); }
  };

  const doRefreshLeaderboard = async () => {
    try {
      await api.post('/admin/leaderboard/refresh');
      const r = await api.get('/leaderboard/global');
      setLeaderboard((r.data || []).slice(0, 5));
      notify('Leaderboard refreshed ✓');
    } catch { notify('Refresh failed'); }
  };

  const doBulkDismissFlags = async () => {
    if (!confirm('Dismiss all low-risk unreviewed flags?')) return;
    try {
      const r = await api.post('/admin/flags/bulk-dismiss');
      loadAntiCheat();
      notify(`Dismissed ${r.data.dismissed} low-risk flags ✓`);
    } catch { notify('Error'); }
  };

  // Finance
  const doDeposit = async () => {
    if (!depositAmt) return;
    try {
      await api.post('/admin/wallet/deposit', { amount: Number(depositAmt), note: depositNote || 'Manual top-up' });
      setDepositAmt(''); setDepositNote(''); loadFinancial(); notify(`${Number(depositAmt).toLocaleString()} RWF deposited ✓`);
    } catch (e: any) { notify(e.response?.data?.message || 'Error'); }
  };

  const filteredUsers = users.filter(u => {
    if (userFilter === 'banned') return u.is_banned;
    if (userFilter === 'active') return !u.is_banned && u.email_verified;
    if (userFilter === 'pending') return !u.email_verified;
    return true;
  });

  if (!authorized) return <div className="min-h-screen bg-gray-950" />;

  // ── Sidebar nav items
  const nav = [
    { key: 'overview',     label: t('adm_overview'),   icon: LayoutDashboard },
    { key: 'users',        label: t('adm_users'),       icon: Users           },
    { key: 'financial',    label: t('adm_financial'),   icon: Wallet          },
    { key: 'withdrawals',  label: 'Withdrawals',        icon: ArrowUpRight    },
    { key: 'rewards',      label: 'Reward Settings',    icon: DollarSign      },
    { key: 'challenges',   label: t('adm_challenges'),  icon: Code2           },
    { key: 'import',       label: 'Import Challenges',  icon: Download        },
    { key: 'contests',     label: t('adm_contests'),    icon: Trophy          },
    { key: 'anticheat',    label: t('adm_anticheat'),   icon: ShieldAlert     },
    { key: 'ailogs',       label: 'AI Logs',            icon: Zap             },
    { key: 'system',       label: t('adm_system'),      icon: Settings        },
  ] as const;

  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden">

      {/* ══════════════════ SIDEBAR ══════════════════ */}
      <aside className={`${sideOpen ? 'w-60' : 'w-16'} shrink-0 h-screen bg-gray-900 border-r border-gray-800 flex flex-col transition-all duration-300 z-30`}>

        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-gray-800">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-green-500 to-emerald-700 flex items-center justify-center font-black text-lg shrink-0">D</div>
          {sideOpen && <div>
            <p className="font-black text-white text-sm leading-tight">DevixCode</p>
            <p className="text-xs text-green-500 font-semibold">Admin Panel</p>
          </div>}
        </div>

        {/* Live pulse */}
        {sideOpen && (
          <div className="mx-3 mt-3 rounded-xl bg-green-900/20 border border-green-800/30 px-3 py-2 flex items-center gap-2">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            <p className="text-xs text-green-400 font-semibold">{dash?.users?.today || 0} active today</p>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
          {nav.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => switchView(key as View)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                view === key
                  ? 'bg-green-600/20 text-green-400 border border-green-600/30'
                  : 'text-gray-500 hover:text-white hover:bg-gray-800'
              }`}>
              <Icon className="w-4 h-4 shrink-0" />
              {sideOpen && <span>{label}</span>}
            </button>
          ))}
        </nav>

        {/* Admin profile */}
        <div className="border-t border-gray-800 p-3">
          <div className={`flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-gray-800 transition-colors cursor-pointer ${sideOpen ? '' : 'justify-center'}`}>
            <div className={`w-8 h-8 rounded-full bg-green-700 flex items-center justify-center text-xs font-bold text-white shrink-0`}>
              {avatar(admin?.name || 'A')}
            </div>
            {sideOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white truncate">{admin?.name || 'Admin'}</p>
                <p className="text-xs text-gray-500 truncate">{admin?.email}</p>
              </div>
            )}
          </div>
          <button onClick={logout}
            className={`w-full mt-1 flex items-center gap-3 px-3 py-2 rounded-xl text-xs text-gray-500 hover:text-red-400 hover:bg-red-900/20 transition-all ${sideOpen ? '' : 'justify-center'}`}>
            <LogOut className="w-3.5 h-3.5 shrink-0" />
            {sideOpen && 'Sign out'}
          </button>
        </div>
      </aside>

      {/* ══════════════════ MAIN ══════════════════ */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Top bar */}
        <header className="h-14 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-5 shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setSideOpen(v => !v)} className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors">
              <Layers className="w-4 h-4" />
            </button>
            <div className="relative hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
              <input className="bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-4 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-green-500 w-56" placeholder="Search..." />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="relative p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors">
              <Bell className="w-4 h-4" />
              {flags.length > 0 && <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full" />}
            </button>
            <div className="w-8 h-8 rounded-full bg-green-700 flex items-center justify-center text-xs font-bold text-white">{avatar(admin?.name||'A')}</div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">

          {/* Toast */}
          {toast && (
            <div className="fixed top-4 right-4 z-50 bg-green-800 text-white text-sm font-medium px-5 py-3 rounded-xl shadow-2xl border border-green-600 animate-fade-in">
              {toast}
            </div>
          )}

          {/* ════════ OVERVIEW ════════ */}
          {view === 'overview' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-black text-white">Platform Overview</h1>
                  <p className="text-xs text-gray-500 mt-0.5">Real-time DevixCode analytics</p>
                </div>
                <button onClick={loadOverview} className="btn-secondary btn-sm gap-1.5">
                  <RefreshCw className="w-3 h-3" /> Refresh
                </button>
              </div>

              {/* Stat cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={Users}      label="Total Users"         value={fmt(dash?.users?.total)}            trend={12}  color="bg-blue-600"   glow="from-blue-900/20 to-transparent" sub={`+${dash?.users?.today||0} today`} />
                <StatCard icon={Activity}   label="Questions Solved"    value={fmt(dash?.submissions?.accepted)}   trend={8}   color="bg-green-600"  glow="from-green-900/20 to-transparent" sub="all time accepted" />
                <StatCard icon={DollarSign} label="Total Submissions"   value={fmt(dash?.submissions?.total)}      trend={15}  color="bg-purple-600" glow="from-purple-900/20 to-transparent" sub="across all challenges" />
                <StatCard icon={Trophy}     label="Active Contests"     value={dash?.contests?.active||0}          trend={5}   color="bg-amber-600"  glow="from-amber-900/20 to-transparent"  sub={`${dash?.contests?.total||0} total`} />
                <StatCard icon={Wallet}     label="Platform Balance"    value={`${fmtK(wallet?.balance||0)} RWF`} trend={3}   color="bg-cyan-600"   glow="from-cyan-900/20 to-transparent"   sub="available to pay out" />
                <StatCard icon={ShieldAlert}label="Open Cheat Flags"   value={dash?.flags?.open||0}               trend={-4}  color="bg-red-600"    glow="from-red-900/20 to-transparent"    sub="require review" />
                <StatCard icon={Award}      label="Total Bets Placed"   value={fmt(wallet?.stats?.total_bets)}    trend={20}  color="bg-pink-600"   glow="from-pink-900/20 to-transparent"   sub="platform betting volume" />
                <StatCard icon={Target}     label="Total Paid Out"      value={`${fmtK(wallet?.stats?.total_paid_out||0)} RWF`} trend={10} color="bg-orange-600" glow="from-orange-900/20 to-transparent" sub="to winning bettors" />
              </div>

              {/* Charts row */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
                {/* Area chart */}
                <div className="xl:col-span-2 bg-gray-900 border border-gray-800 rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <h2 className="font-bold text-white text-sm">Platform Activity</h2>
                      <p className="text-xs text-gray-500">Users, submissions & revenue trends</p>
                    </div>
                    <div className="flex gap-1">
                      {([7,30] as const).map(r => (
                        <button key={r} onClick={() => setRange(r)}
                          className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${range===r ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
                          {r}d
                        </button>
                      ))}
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={chartData} margin={{ top:5, right:10, left:0, bottom:0 }}>
                      <defs>
                        <linearGradient id="gUsers"   x1="0" y1="0" x2="0" y2="1"><stop offset="5%"  stopColor="#22c55e" stopOpacity={0.3}/><stop offset="95%" stopColor="#22c55e" stopOpacity={0}/></linearGradient>
                        <linearGradient id="gRevenue" x1="0" y1="0" x2="0" y2="1"><stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.3}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient>
                        <linearGradient id="gSolved"  x1="0" y1="0" x2="0" y2="1"><stop offset="5%"  stopColor="#a855f7" stopOpacity={0.3}/><stop offset="95%" stopColor="#a855f7" stopOpacity={0}/></linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                      <XAxis dataKey="label" tick={{ fontSize:10, fill:'#6b7280' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize:10, fill:'#6b7280' }} axisLine={false} tickLine={false} width={35} />
                      <Tooltip contentStyle={{ background:'#111827', border:'1px solid #1f2937', borderRadius:'12px', fontSize:'12px' }} />
                      <Area type="monotone" dataKey="users"   name="Users Active"  stroke="#22c55e" strokeWidth={2} fill="url(#gUsers)" />
                      <Area type="monotone" dataKey="solved"  name="Solved"        stroke="#a855f7" strokeWidth={2} fill="url(#gSolved)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Leaderboard */}
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-bold text-white text-sm">Top Coders</h2>
                    <span className="badge-green badge text-xs">Global</span>
                  </div>
                  {leaderboard.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 text-gray-600">
                      <Trophy className="w-8 h-8 mb-2" />
                      <p className="text-xs">No data yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {leaderboard.map((p: any, i: number) => (
                        <div key={p.id} className="flex items-center gap-3">
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${i===0?'bg-yellow-500 text-black':i===1?'bg-gray-400 text-black':i===2?'bg-amber-700 text-white':'bg-gray-800 text-gray-400'}`}>
                            {i<3?['🥇','🥈','🥉'][i]:i+1}
                          </span>
                          <div className={`w-7 h-7 rounded-full ${avatarColor(p.name)} flex items-center justify-center text-xs font-bold text-white shrink-0`}>
                            {avatar(p.name)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-white truncate">{p.name}</p>
                            <p className="text-xs text-gray-500">{p.solved || 0} solved</p>
                          </div>
                          <span className="text-xs font-bold text-green-400">{fmtK(p.total_earnings||0)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Revenue bar chart */}
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h2 className="font-bold text-white text-sm">Revenue vs Payouts</h2>
                    <p className="text-xs text-gray-500">Platform income & disbursements (RWF)</p>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={chartData} margin={{ top:0, right:10, left:0, bottom:0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize:10, fill:'#6b7280' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize:10, fill:'#6b7280' }} axisLine={false} tickLine={false} width={40} tickFormatter={v=>`${(v/1000).toFixed(0)}k`} />
                    <Tooltip contentStyle={{ background:'#111827', border:'1px solid #1f2937', borderRadius:'12px', fontSize:'12px' }} formatter={(v:any)=>`${Number(v).toLocaleString()} RWF`} />
                    <Bar dataKey="revenue" name="Revenue"  fill="#22c55e" radius={[4,4,0,0]} maxBarSize={32} />
                    <Bar dataKey="payouts" name="Payouts"  fill="#3b82f6" radius={[4,4,0,0]} maxBarSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ════════ USERS ════════ */}
          {view === 'users' && (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h1 className="text-xl font-black text-white">User Management</h1>
                  <p className="text-xs text-gray-500 mt-0.5">{users.length} users loaded</p>
                </div>
              </div>

              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                  <input className="input pl-9 text-sm" placeholder="Search by name or email..."
                    value={userSearch} onChange={e => { setUserSearch(e.target.value); loadUsers(1, e.target.value); }} />
                </div>
                <div className="flex gap-2">
                  {[['all','All'],['active','Active'],['pending','Pending'],['banned','Banned']].map(([v,l]) => (
                    <button key={v} onClick={() => setUserFilter(v)}
                      className={`btn btn-sm ${userFilter===v?'btn-primary':'btn-secondary'}`}>{l}</button>
                  ))}
                </div>
              </div>

              {/* Table */}
              <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-gray-800">
                      <tr>{['User','Email','Balance','Earnings','Status','Risk','Joined','Actions'].map(h=>(
                        <th key={h} className="text-left px-4 py-3 text-xs text-gray-500 font-semibold uppercase tracking-wider">{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/50">
                      {loading.users ? (
                        Array.from({length:5}).map((_,i)=>(
                          <tr key={i}><td colSpan={8} className="px-4 py-3"><div className="h-8 bg-gray-800 rounded-lg animate-pulse" /></td></tr>
                        ))
                      ) : filteredUsers.length === 0 ? (
                        <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-500">No users found</td></tr>
                      ) : filteredUsers.map((u: any) => (
                        <tr key={u.id} className="hover:bg-gray-800/30 transition-colors group">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className={`w-8 h-8 rounded-full ${avatarColor(u.name)} flex items-center justify-center text-xs font-bold text-white shrink-0`}>
                                {avatar(u.name)}
                              </div>
                              <span className="font-medium text-white text-sm">{u.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-400 text-xs">{u.email}</td>
                          <td className="px-4 py-3 text-green-400 font-semibold text-xs">{fmt(u.balance)} RWF</td>
                          <td className="px-4 py-3 text-amber-400 font-semibold text-xs">{fmt(u.total_earnings)} RWF</td>
                          <td className="px-4 py-3">
                            {u.is_banned
                              ? <span className="badge text-xs badge-red">Banned</span>
                              : !u.email_verified
                              ? <span className="badge text-xs badge-yellow">Pending</span>
                              : <span className="badge text-xs badge-green">Active</span>}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`badge text-xs ${u.risk_score>60?'badge-red':u.risk_score>30?'badge-yellow':'badge-green'}`}>{u.risk_score}</span>
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs">{new Date(u.created_at).toLocaleDateString()}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => { setAdjustUser(u); setAdjustAmt(''); setAdjustNote(''); }}
                                title="Adjust balance" className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-green-400">
                                <Wallet className="w-3.5 h-3.5" />
                              </button>
                              {!u.email_verified && (
                                <button onClick={() => activateUser(u.id)} title="Activate account"
                                  className="p-1.5 rounded-lg hover:bg-green-900/30 text-gray-400 hover:text-green-400 transition-colors">
                                  <UserCheck className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button onClick={() => banUser(u.id, !u.is_banned)}
                                title={u.is_banned ? 'Unban user' : 'Ban user'}
                                className={`p-1.5 rounded-lg transition-colors ${u.is_banned?'hover:bg-green-900/30 text-gray-400 hover:text-green-400':'hover:bg-red-900/30 text-gray-400 hover:text-red-400'}`}>
                                <Ban className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => deleteUser(u.id, u.name)} title="Delete user"
                                className="p-1.5 rounded-lg hover:bg-red-900/30 text-gray-400 hover:text-red-400 transition-colors">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-4 py-3 border-t border-gray-800 flex items-center justify-between">
                  <p className="text-xs text-gray-500">{filteredUsers.length} users</p>
                  <div className="flex gap-1">
                    <button onClick={() => { const p = Math.max(1,userPage-1); setUserPage(p); loadUsers(p,userSearch); }}
                      disabled={userPage===1} className="btn-secondary btn-sm disabled:opacity-40"><ChevronLeft className="w-3.5 h-3.5" /></button>
                    <span className="px-3 py-1.5 text-xs text-gray-400">Page {userPage}</span>
                    <button onClick={() => { const p = userPage+1; setUserPage(p); loadUsers(p,userSearch); }}
                      disabled={users.length < 30} className="btn-secondary btn-sm disabled:opacity-40"><ChevronRight className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ════════ FINANCIAL ════════ */}
          {view === 'financial' && (
            <div className="space-y-5">
              <h1 className="text-xl font-black text-white">Financial Management</h1>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { label:'Platform Balance',  value:`${fmt(wallet?.balance||0)} RWF`,                   color:'text-green-400',  icon:Wallet     },
                  { label:'Total Bets',        value:fmt(wallet?.stats?.total_bets||0),                  color:'text-blue-400',   icon:Target     },
                  { label:'Total Paid Out',    value:`${fmt(wallet?.stats?.total_paid_out||0)} RWF`,     color:'text-red-400',    icon:ArrowUpRight },
                ].map(s => (
                  <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs text-gray-500 uppercase font-semibold tracking-wide">{s.label}</p>
                      <s.icon className={`w-4 h-4 ${s.color}`} />
                    </div>
                    <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Deposit to platform */}
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
                  <h2 className="font-bold text-white flex items-center gap-2">
                    <ArrowDownRight className="w-4 h-4 text-green-400" /> Deposit to Platform Pool
                  </h2>
                  <p className="text-xs text-gray-500">Add funds to the platform wallet to cover winning bet payouts.</p>
                  <div className="space-y-3">
                    <div><label className="label">Amount (RWF)</label>
                      <input type="number" min="1000" className="input" value={depositAmt} onChange={e => setDepositAmt(e.target.value)} placeholder="e.g. 100000" /></div>
                    <div><label className="label">Note (optional)</label>
                      <input className="input" value={depositNote} onChange={e => setDepositNote(e.target.value)} placeholder="e.g. Monthly top-up" /></div>
                    <div className="flex gap-2 flex-wrap">
                      {[10000,50000,100000,500000].map(v => (
                        <button key={v} onClick={() => setDepositAmt(String(v))}
                          className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium">{v/1000}K</button>
                      ))}
                    </div>
                    <button onClick={doDeposit} disabled={!depositAmt} className="btn-primary w-full justify-center py-3">Deposit to Platform</button>
                  </div>
                </div>

                {/* Recent bet activity */}
                <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-800">
                    <h2 className="font-bold text-white text-sm">Recent Bet Activity</h2>
                  </div>
                  {!wallet?.recent?.length ? (
                    <div className="p-12 text-center text-gray-600 text-sm">No bets yet</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="border-b border-gray-800">
                          <tr>{['User','Bet','×','Status'].map(h=>(
                            <th key={h} className="text-left px-4 py-2.5 text-gray-500 font-semibold uppercase tracking-wider">{h}</th>
                          ))}</tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800/50">
                          {wallet.recent.map((b: any, i: number) => (
                            <tr key={i} className="hover:bg-gray-800/20">
                              <td className="px-4 py-2.5 font-medium text-white">{b.user_name}</td>
                              <td className="px-4 py-2.5 text-yellow-400 font-bold">{fmt(b.amount)}</td>
                              <td className="px-4 py-2.5 text-gray-400">{b.multiplier}×</td>
                              <td className="px-4 py-2.5"><span className={`badge text-xs ${b.status==='won'?'badge-green':b.status==='lost'?'badge-red':'badge-yellow'}`}>{b.status}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ════════ CHALLENGES ════════ */}
          {view === 'challenges' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-black text-white">Challenge Management</h1>
                  <p className="text-xs text-gray-500 mt-0.5">{challenges.length} challenges</p>
                </div>
                <button onClick={openNewCh} className="btn-primary btn-sm"><Plus className="w-3.5 h-3.5" /> New Challenge</button>
              </div>

              {/* Difficulty breakdown */}
              <div className="grid grid-cols-3 gap-3">
                {['easy','medium','hard'].map(d => {
                  const count = challenges.filter(c => c.difficulty===d).length;
                  const pub   = challenges.filter(c => c.difficulty===d && c.is_published).length;
                  return (
                    <div key={d} className={`bg-gray-900 border ${d==='easy'?'border-green-800/40':d==='medium'?'border-yellow-800/40':'border-red-800/40'} rounded-2xl p-4`}>
                      <p className={`text-xs font-bold uppercase tracking-wide mb-1 ${d==='easy'?'text-green-400':d==='medium'?'text-yellow-400':'text-red-400'}`}>{d}</p>
                      <p className="text-2xl font-black text-white">{count}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{pub} published</p>
                    </div>
                  );
                })}
              </div>

              <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-gray-800">
                      <tr>{['Title','Difficulty','Category','Languages','Status','Actions'].map(h=>(
                        <th key={h} className="text-left px-4 py-3 text-xs text-gray-500 font-semibold uppercase tracking-wider">{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/50">
                      {loading.challenges ? Array.from({length:4}).map((_,i)=>(
                        <tr key={i}><td colSpan={6} className="px-4 py-3"><div className="h-7 bg-gray-800 rounded animate-pulse" /></td></tr>
                      )) : challenges.length === 0 ? (
                        <tr><td colSpan={6} className="px-4 py-16 text-center">
                          <Code2 className="w-10 h-10 mx-auto text-gray-700 mb-3" />
                          <p className="text-gray-500 text-sm">No challenges yet</p>
                          <button onClick={openNewCh} className="btn-primary btn-sm mt-3">Create first challenge</button>
                        </td></tr>
                      ) : challenges.map((c: any) => (
                        <tr key={c.id} className="hover:bg-gray-800/30 transition-colors group">
                          <td className="px-4 py-3 font-medium text-white">{c.title}</td>
                          <td className="px-4 py-3"><span className={`badge text-xs capitalize ${c.difficulty==='easy'?'badge-green':c.difficulty==='hard'?'badge-red':'badge-yellow'}`}>{c.difficulty}</span></td>
                          <td className="px-4 py-3 text-gray-400 text-xs">{c.category||'—'}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs">{(c.supported_languages||[]).join(', ')}</td>
                          <td className="px-4 py-3"><span className={`badge text-xs ${c.is_published?'badge-green':'badge'}`}>{c.is_published?'Published':'Draft'}</span></td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => openEditCh(c)} className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white"><Pencil className="w-3.5 h-3.5" /></button>
                              <button onClick={() => deleteCh(c.id)} className="p-1.5 rounded-lg hover:bg-red-900/30 text-gray-400 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ════════ CONTESTS ════════ */}
          {view === 'contests' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-black text-white">Contest Management</h1>
                  <p className="text-xs text-gray-500 mt-0.5">{contests.length} contests total</p>
                </div>
                <button onClick={() => { setShowNewContest(v => !v); setContestError(''); }} className="btn-primary btn-sm">
                  <Plus className="w-3.5 h-3.5" /> {showNewContest ? 'Cancel' : 'New Contest'}
                </button>
              </div>

              {showNewContest && (
                <div className="bg-gray-900 border border-green-800/30 rounded-2xl p-6">
                  <h2 className="font-bold text-white flex items-center gap-2 mb-5"><Calendar className="w-4 h-4 text-green-400" /> Create New Contest</h2>
                  {contestError && <div className="bg-red-900/20 border border-red-800 text-red-400 text-sm rounded-xl px-4 py-3 mb-4">{contestError}</div>}
                  <form onSubmit={saveContest} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="sm:col-span-2"><label className="label">Title *</label><input className="input" value={contestForm.title} onChange={e=>setContestForm(f=>({...f,title:e.target.value}))} required placeholder="e.g. Weekend Sprint #12" /></div>
                      <div className="sm:col-span-2"><label className="label">Description</label><textarea className="input" rows={2} value={contestForm.description} onChange={e=>setContestForm(f=>({...f,description:e.target.value}))} placeholder="Brief description..." /></div>
                      <div><label className="label">Entry Fee (RWF)</label><input type="number" min="0" className="input" value={contestForm.entry_fee} onChange={e=>setContestForm(f=>({...f,entry_fee:Number(e.target.value)}))} placeholder="0 = free" /></div>
                      <div><label className="label">Max Participants</label><input type="number" min="2" className="input" value={contestForm.max_participants} onChange={e=>setContestForm(f=>({...f,max_participants:e.target.value}))} placeholder="Blank = unlimited" /></div>
                      <div><label className="label">Start Time *</label><input type="datetime-local" className="input" value={contestForm.start_time} onChange={e=>setContestForm(f=>({...f,start_time:e.target.value}))} required /></div>
                      <div><label className="label">End Time *</label><input type="datetime-local" className="input" value={contestForm.end_time} onChange={e=>setContestForm(f=>({...f,end_time:e.target.value}))} required /></div>
                    </div>
                    <div className="flex items-center gap-2"><input type="checkbox" id="rated2" checked={contestForm.is_rated} onChange={e=>setContestForm(f=>({...f,is_rated:e.target.checked}))} className="w-4 h-4 accent-green-500" /><label htmlFor="rated2" className="text-sm text-gray-300">Rated contest</label></div>
                    <div>
                      <label className="label">Challenges * <span className="text-gray-500 font-normal">(select from list)</span></label>
                      <div className="max-h-44 overflow-y-auto border border-gray-700 rounded-xl divide-y divide-gray-800">
                        {challenges.length === 0 && <p className="p-4 text-sm text-gray-500">Create challenges first</p>}
                        {challenges.map((c: any) => {
                          const sel = contestForm.challenge_ids.includes(c.id);
                          return (
                            <label key={c.id} className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${sel?'bg-green-900/20':'hover:bg-gray-800/40'}`}>
                              <input type="checkbox" checked={sel} onChange={() => setContestForm(f=>({...f, challenge_ids: sel ? f.challenge_ids.filter(x=>x!==c.id):[...f.challenge_ids,c.id]}))} className="w-4 h-4 accent-green-500 shrink-0" />
                              <span className="text-sm text-white flex-1">{c.title}</span>
                              <span className={`badge text-xs capitalize ${c.difficulty==='easy'?'badge-green':c.difficulty==='hard'?'badge-red':'badge-yellow'}`}>{c.difficulty}</span>
                            </label>
                          );
                        })}
                      </div>
                      {contestForm.challenge_ids.length > 0 && <p className="text-xs text-green-400 mt-1">{contestForm.challenge_ids.length} selected</p>}
                    </div>
                    <div className="flex gap-3"><button type="button" onClick={()=>setShowNewContest(false)} className="btn-secondary flex-1 justify-center">Cancel</button><button type="submit" disabled={contestSaving} className="btn-primary flex-1 justify-center">{contestSaving?'Creating...':'Create Contest'}</button></div>
                  </form>
                </div>
              )}

              <div className="space-y-3">
                {loading.contests ? Array.from({length:3}).map((_,i)=><div key={i} className="h-20 bg-gray-900 border border-gray-800 rounded-2xl animate-pulse" />) :
                  contests.length === 0 && !showNewContest ? (
                    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-16 text-center">
                      <Trophy className="w-10 h-10 mx-auto text-gray-700 mb-3" />
                      <p className="text-gray-500">No contests yet</p>
                      <button onClick={()=>setShowNewContest(true)} className="btn-primary btn-sm mt-4">Create first contest</button>
                    </div>
                  ) : contests.map((c: any) => (
                    <div key={c.id} className="bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-2xl p-5 flex items-center justify-between gap-4 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`badge text-xs capitalize ${c.status==='active'?'badge-green':c.status==='completed'?'badge':'badge-blue'}`}>{c.status}</span>
                          {c.is_rated && <span className="badge text-xs">Rated</span>}
                        </div>
                        <p className="font-bold text-white truncate">{c.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {c.participant_count||0} participants · {Number(c.prize_pool||0).toLocaleString()} RWF pool · Entry: {Number(c.entry_fee)===0?'Free':`${Number(c.entry_fee).toLocaleString()} RWF`}
                        </p>
                      </div>
                      {c.status==='active' && <button onClick={()=>finalizeContest(c.id)} className="btn-primary btn-sm shrink-0">🏆 Finalize & Pay</button>}
                      {c.status==='completed' && <span className="text-green-400 text-xs font-semibold shrink-0">✓ Paid</span>}
                    </div>
                  ))
                }
              </div>
            </div>
          )}

          {/* ════════ ANTI-CHEAT ════════ */}
          {view === 'anticheat' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-black text-white">Anti-Cheat Center</h1>
                  <p className="text-xs text-gray-500 mt-0.5">{flags.length} open flags · {subs.length} suspicious submissions</p>
                </div>
                <button onClick={loadAntiCheat} className="btn-secondary btn-sm"><RefreshCw className="w-3 h-3" /> Refresh</button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Flags */}
                <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <h2 className="font-bold text-white text-sm">Cheat Flags</h2>
                    {flags.length > 0 && <span className="badge-red badge text-xs ml-auto">{flags.length}</span>}
                  </div>
                  <div className="divide-y divide-gray-800/50 max-h-96 overflow-y-auto">
                    {flags.length === 0 ? <div className="p-10 text-center text-gray-500 text-sm">No open flags</div> :
                      flags.map((f: any) => (
                        <div key={f.id} className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-1">
                                <span className={`badge text-xs ${f.severity==='critical'?'badge-red':f.severity==='high'?'badge-yellow':'badge'}`}>{f.severity}</span>
                                <span className="text-xs text-gray-500">{f.flag_type?.replace(/_/g,' ')}</span>
                              </div>
                              <p className="text-sm font-medium text-white truncate">{f.user_name}</p>
                              <p className="text-xs text-gray-500">Risk: {f.risk_score} · {new Date(f.created_at).toLocaleDateString()}</p>
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <button onClick={()=>reviewFlag(f.id,'dismiss')} className="btn-secondary btn-sm text-xs">Dismiss</button>
                              <button onClick={()=>reviewFlag(f.id,'ban')} className="btn-danger btn-sm text-xs">Ban</button>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Suspicious submissions */}
                <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-red-400" />
                    <h2 className="font-bold text-white text-sm">Suspicious Submissions</h2>
                    {subs.length > 0 && <span className="badge-red badge text-xs ml-auto">{subs.length}</span>}
                  </div>
                  <div className="divide-y divide-gray-800/50 max-h-96 overflow-y-auto">
                    {subs.length === 0 ? <div className="p-10 text-center text-gray-500 text-sm">None found</div> :
                      subs.map((s: any) => (
                        <div key={s.id} className="p-4 flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className="badge-red badge text-xs">Risk {s.risk_score}</span>
                              <span className="badge text-xs capitalize">{s.language}</span>
                              <span className="badge-yellow badge text-xs">Paste ×{s.paste_count}</span>
                            </div>
                            <p className="text-sm font-medium text-white truncate">{s.user_name}</p>
                            <p className="text-xs text-gray-500 truncate">{s.challenge_title}</p>
                          </div>
                          <span className={`badge text-xs shrink-0 ${s.status==='accepted'?'badge-green':'badge-red'}`}>{s.status}</span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ════════ SYSTEM ════════ */}
          {view === 'system' && (
            <div className="space-y-5">
              <h1 className="text-xl font-black text-white">System Settings</h1>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Platform info */}
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
                  <h2 className="font-bold text-white text-sm flex items-center gap-2"><Building2 className="w-4 h-4 text-green-400" /> Platform Info</h2>
                  {[
                    { label:'Platform Name', value:'DevixCode' },
                    { label:'Version',       value:'1.0.0' },
                    { label:'Environment',   value:'Production' },
                    { label:'Database',      value:'MySQL (MariaDB)' },
                    { label:'Code Runner',   value:'Docker Sandboxed' },
                    { label:'Currency',      value:'RWF (Rwandan Franc)' },
                  ].map(r => (
                    <div key={r.label} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                      <span className="text-xs text-gray-500">{r.label}</span>
                      <span className="text-xs font-semibold text-white">{r.value}</span>
                    </div>
                  ))}
                </div>

                {/* Quick actions */}
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-3">
                  <h2 className="font-bold text-white text-sm flex items-center gap-2"><Zap className="w-4 h-4 text-amber-400" /> Quick Actions</h2>
                  {[
                    { label:'View All Submissions',    desc:'Browse full submission history',         action:()=>switchView('anticheat'), icon:Eye      },
                    { label:'Export User Data',        desc:'Download CSV of all user records',       action:exportUsersCSV,              icon:Download },
                    { label:'Refresh Leaderboard',     desc:'Recalculate global rankings now',        action:doRefreshLeaderboard,        icon:RefreshCw},
                    { label:'Clear Suspicious Flags',  desc:'Bulk dismiss low-risk flags',            action:doBulkDismissFlags,          icon:CheckCircle},
                  ].map(a => (
                    <button key={a.label} onClick={a.action}
                      className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-800 hover:border-gray-700 hover:bg-gray-800/40 transition-all text-left group">
                      <div className="w-8 h-8 rounded-lg bg-gray-800 group-hover:bg-gray-700 flex items-center justify-center transition-colors shrink-0">
                        <a.icon className="w-4 h-4 text-gray-400 group-hover:text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{a.label}</p>
                        <p className="text-xs text-gray-500">{a.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Admin account */}
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4 lg:col-span-2">
                  <h2 className="font-bold text-white text-sm flex items-center gap-2"><UserCheck className="w-4 h-4 text-blue-400" /> Admin Account</h2>
                  <div className="flex items-center gap-4 p-4 bg-gray-800/50 rounded-xl">
                    <div className={`w-14 h-14 rounded-2xl ${avatarColor(admin?.name||'A')} flex items-center justify-center text-xl font-black text-white`}>
                      {avatar(admin?.name||'A')}
                    </div>
                    <div>
                      <p className="font-bold text-white">{admin?.name}</p>
                      <p className="text-sm text-gray-400">{admin?.email}</p>
                      <span className="badge-green badge text-xs mt-1">Super Admin</span>
                    </div>
                  </div>
                  <button onClick={logout} className="btn-danger btn-sm w-full justify-center"><LogOut className="w-3.5 h-3.5" /> Sign Out</button>
                </div>
              </div>
            </div>
          )}

          {/* ══════════ WITHDRAWALS ══════════ */}
          {view === 'withdrawals' && (
            <div className="space-y-5">
              <h1 className="text-xl font-black text-white flex items-center gap-2">
                <ArrowUpRight className="w-5 h-5 text-amber-400" /> Withdrawal Requests
              </h1>
              {loading.withdrawals ? (
                <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="card p-4 animate-pulse h-14" />)}</div>
              ) : (
                <div className="card overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="border-b border-gray-800">
                      <tr>
                        {['User','Amount','Method','Account','Status','Date','Actions'].map(h => (
                          <th key={h} className="text-left px-4 py-3 text-xs text-gray-500 font-semibold uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {withdrawals.map((w: any) => (
                        <tr key={w.id} className="hover:bg-gray-800/20">
                          <td className="px-4 py-3">
                            <p className="text-sm text-white font-medium">{w.user_name}</p>
                            <p className="text-xs text-gray-500">{w.user_email}</p>
                          </td>
                          <td className="px-4 py-3 text-green-400 font-bold">${Number(w.amount).toFixed(2)}</td>
                          <td className="px-4 py-3 text-gray-300 capitalize">{w.method}</td>
                          <td className="px-4 py-3">
                            <span className="text-xs font-mono text-gray-400">
                              {typeof w.account_details === 'object' ? w.account_details.account : w.account_details}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`badge text-xs ${w.status==='approved'?'badge-green':w.status==='rejected'?'bg-red-900/30 text-red-400':'badge-yellow'}`}>
                              {w.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500">{new Date(w.created_at).toLocaleDateString()}</td>
                          <td className="px-4 py-3">
                            {w.status === 'pending' && (
                              <div className="flex gap-2">
                                <button onClick={() => approveWithdrawal(w.id)}
                                  className="px-3 py-1 bg-green-700 hover:bg-green-600 text-white text-xs rounded-lg font-semibold transition-colors">
                                  Approve
                                </button>
                                <button onClick={() => rejectWithdrawal(w.id)}
                                  className="px-3 py-1 bg-red-800 hover:bg-red-700 text-white text-xs rounded-lg font-semibold transition-colors">
                                  Reject
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {withdrawals.length === 0 && (
                    <div className="p-12 text-center text-gray-500">No withdrawal requests</div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ══════════ REWARD SETTINGS ══════════ */}
          {view === 'rewards' && (
            <div className="space-y-5">
              <h1 className="text-xl font-black text-white flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-green-400" /> Reward Settings
              </h1>
              <p className="text-gray-500 text-sm">Configure how much users earn per difficulty level. Changes take effect immediately.</p>
              {loading.rewards ? (
                <div className="space-y-2">{[1,2,3].map(i=><div key={i} className="card p-4 animate-pulse h-16"/>)}</div>
              ) : (
                <div className="space-y-4 max-w-xl">
                  {rewardSettings.length === 0 && (
                    <div className="card p-6 text-gray-500 text-sm">No reward settings found. They will be initialized on first submission.</div>
                  )}
                  {['easy','medium','hard'].map(diff => {
                    const rs = rewardSettings.find((r:any) => r.difficulty === diff);
                    const defaultAmt = diff === 'easy' ? 5 : diff === 'medium' ? 15 : 40;
                    const currentAmt = rs?.amount_usd ?? defaultAmt;
                    return (
                      <div key={diff} className="card p-5">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <span className={`badge text-sm font-bold capitalize ${diff==='easy'?'text-green-400 bg-green-900/30':diff==='medium'?'text-yellow-400 bg-yellow-900/30':'text-red-400 bg-red-900/30'}`}>
                              {diff}
                            </span>
                          </div>
                          <span className="text-lg font-black text-white">${currentAmt}</span>
                        </div>
                        <div className="flex gap-3 items-center">
                          <input type="number" defaultValue={currentAmt} id={`reward-${diff}`}
                            className="input flex-1" min={0.5} step={0.5} />
                          <button
                            onClick={() => {
                              const el = document.getElementById(`reward-${diff}`) as HTMLInputElement;
                              updateReward(diff, Number(el.value));
                            }}
                            className="btn-primary px-4 py-2 shrink-0">
                            Save
                          </button>
                        </div>
                        {rs && (
                          <p className="text-xs text-gray-600 mt-2">
                            Last updated: {new Date(rs.updated_at).toLocaleString()}
                          </p>
                        )}
                      </div>
                    );
                  })}
                  <div className="card p-4 bg-blue-900/10 border-blue-800/30">
                    <p className="text-xs text-blue-300">
                      💡 Pro subscribers get ×1.5 multiplier, Elite get ×2.0. These base amounts are for Free users.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══════════ IMPORT CHALLENGES ══════════ */}
          {view === 'import' && (
            <div className="space-y-5">
              <h1 className="text-xl font-black text-white flex items-center gap-2">
                <Download className="w-5 h-5 text-blue-400" /> Import Challenges
              </h1>
              <div className="card p-6 max-w-xl space-y-5">
                <div>
                  <p className="text-gray-300 font-semibold mb-2">Upload CSV, Excel (.xlsx), or JSON file</p>
                  <p className="text-xs text-gray-500 mb-4">
                    Required columns: <code className="bg-gray-800 px-1 rounded">title</code>, <code className="bg-gray-800 px-1 rounded">description</code>, <code className="bg-gray-800 px-1 rounded">difficulty</code> (easy/medium/hard).
                    Optional: <code className="bg-gray-800 px-1 rounded">category</code>, <code className="bg-gray-800 px-1 rounded">languages</code> (comma-separated), <code className="bg-gray-800 px-1 rounded">sample_input</code>, <code className="bg-gray-800 px-1 rounded">sample_output</code>.
                  </p>
                  <div className="border-2 border-dashed border-gray-700 rounded-xl p-8 text-center hover:border-gray-600 transition-colors">
                    <input type="file" accept=".csv,.xlsx,.xls,.json"
                      onChange={e => setImportFile(e.target.files?.[0] || null)}
                      className="hidden" id="import-file" />
                    <label htmlFor="import-file" className="cursor-pointer">
                      <Download className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                      <p className="text-gray-400 text-sm">
                        {importFile ? importFile.name : 'Click to select file or drag & drop'}
                      </p>
                      {importFile && <p className="text-xs text-gray-600 mt-1">{(importFile.size / 1024).toFixed(1)} KB</p>}
                    </label>
                  </div>
                </div>

                <button onClick={handleImport} disabled={!importFile || importLoading}
                  className="btn-primary w-full justify-center py-3">
                  {importLoading ? (
                    <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Importing...</>
                  ) : (
                    <>Import Challenges</>
                  )}
                </button>

                {importResult && (
                  <div className={`p-4 rounded-xl text-sm space-y-1 ${importResult.error ? 'bg-red-900/20 text-red-400 border border-red-800' : 'bg-green-900/20 text-green-300 border border-green-800'}`}>
                    {importResult.error ? (
                      <p>{importResult.error}</p>
                    ) : (
                      <>
                        <p className="font-bold">Import complete!</p>
                        <p>✅ Inserted: {importResult.inserted}</p>
                        <p>⏭️ Skipped (duplicates): {importResult.skipped}</p>
                        {importResult.errors?.length > 0 && (
                          <p>❌ Errors: {importResult.errors.length}</p>
                        )}
                      </>
                    )}
                  </div>
                )}

                <div className="border-t border-gray-800 pt-4">
                  <p className="text-xs text-gray-500 font-semibold uppercase mb-2">Sample JSON format</p>
                  <pre className="text-xs text-gray-400 bg-gray-800 p-3 rounded-xl overflow-x-auto">{JSON.stringify([{
                    title: "Hello World",
                    description: "Print Hello World",
                    difficulty: "easy",
                    category: "strings",
                    languages: "javascript,python,java",
                    sample_input: "",
                    sample_output: "Hello World"
                  }], null, 2)}</pre>
                </div>
              </div>
            </div>
          )}

          {/* ══════════ AI LOGS ══════════ */}
          {view === 'ailogs' && (
            <div className="space-y-5">
              <h1 className="text-xl font-black text-white flex items-center gap-2">
                <Zap className="w-5 h-5 text-purple-400" /> AI Validation Logs
              </h1>
              {loading.ailogs ? (
                <div className="space-y-2">{[1,2,3].map(i=><div key={i} className="card p-4 animate-pulse h-14"/>)}</div>
              ) : (
                <div className="card overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="border-b border-gray-800">
                      <tr>
                        {['User','Challenge','Difficulty','AI Score','Status','Model','Date'].map(h=>(
                          <th key={h} className="text-left px-4 py-3 text-xs text-gray-500 font-semibold uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {aiLogs.map((l: any) => (
                        <tr key={l.id} className="hover:bg-gray-800/20">
                          <td className="px-4 py-3 text-sm text-white">{l.user_name}</td>
                          <td className="px-4 py-3 text-sm text-gray-300">{l.challenge_title}</td>
                          <td className="px-4 py-3">
                            <span className={`badge text-xs capitalize ${l.difficulty==='easy'?'text-green-400':l.difficulty==='medium'?'text-yellow-400':'text-red-400'}`}>
                              {l.difficulty}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`font-bold ${(l.ai_score||0)>=80?'text-green-400':(l.ai_score||0)>=50?'text-yellow-400':'text-red-400'}`}>
                              {l.ai_score ?? 'N/A'}%
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`badge text-xs ${l.ai_status==='accepted'?'badge-green':l.ai_status?.includes('error')?'text-red-400':'badge-yellow'}`}>
                              {l.ai_status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500">{l.model_used || 'gemini-1.5-flash'}</td>
                          <td className="px-4 py-3 text-xs text-gray-500">{new Date(l.created_at).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {aiLogs.length === 0 && (
                    <div className="p-12 text-center text-gray-500">No AI validation logs yet</div>
                  )}
                </div>
              )}
            </div>
          )}

        </main>
      </div>

      {/* ══════════════════ MODALS ══════════════════ */}

      {/* Challenge modal */}
      {chModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/80 p-4 overflow-y-auto backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-3xl my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
              <h2 className="font-black text-white">{editingCh ? 'Edit Challenge' : 'New Challenge'}</h2>
              <button onClick={() => setChModal(false)} className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={saveCh} className="p-6 space-y-5">
              {chError && <div className="bg-red-900/20 border border-red-800 text-red-400 text-sm rounded-xl px-4 py-3">{chError}</div>}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2"><label className="label">Title *</label><input className="input" value={chForm.title} onChange={e=>setChForm(f=>({...f,title:e.target.value}))} required placeholder="e.g. Two Sum" /></div>
                <div>
                  <label className="label">Difficulty *</label>
                  <select className="input" value={chForm.difficulty} onChange={e=>setChForm(f=>({...f,difficulty:e.target.value}))}>
                    <option value="easy">Easy — 2× bet multiplier</option>
                    <option value="medium">Medium — 3× bet multiplier</option>
                    <option value="hard">Hard — 5× bet multiplier</option>
                  </select>
                </div>
                <div><label className="label">Category</label><input className="input" value={chForm.category} onChange={e=>setChForm(f=>({...f,category:e.target.value}))} placeholder="Arrays, DP, Strings..." /></div>
              </div>
              <div><label className="label">Description * (Markdown supported)</label>
                <textarea className="input font-mono text-sm" rows={7} value={chForm.description} onChange={e=>setChForm(f=>({...f,description:e.target.value}))} required
                  placeholder={`## Problem\nDescribe the problem...\n\n## Constraints\n- 1 ≤ n ≤ 10^4\n\n## Example\nInput: [2,7,11,15], target = 9\nOutput: [0,1]`} />
              </div>
              <div>
                <label className="label">Languages</label>
                <div className="flex gap-4 mt-1">{['javascript','python'].map(lang=>(
                  <label key={lang} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={chForm.supported_languages.includes(lang)} onChange={()=>toggleLang(lang)} className="w-4 h-4 accent-green-500" />
                    <span className="text-sm text-gray-300 capitalize">{lang}</span>
                  </label>
                ))}</div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div><label className="label">Time (ms)</label><input type="number" min="1000" max="30000" step="1000" className="input" value={chForm.time_limit_ms} onChange={e=>setChForm(f=>({...f,time_limit_ms:Number(e.target.value)}))} /></div>
                <div><label className="label">Memory (MB)</label><input type="number" min="32" max="1024" className="input" value={chForm.memory_limit_mb} onChange={e=>setChForm(f=>({...f,memory_limit_mb:Number(e.target.value)}))} /></div>
                <div><label className="label">Max Subs/hr</label><input type="number" min="1" max="50" className="input" value={chForm.max_submissions} onChange={e=>setChForm(f=>({...f,max_submissions:Number(e.target.value)}))} /></div>
                <div><label className="label">Cooldown (s)</label><input type="number" min="0" className="input" value={chForm.submission_cooldown_seconds} onChange={e=>setChForm(f=>({...f,submission_cooldown_seconds:Number(e.target.value)}))} /></div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="pub2" checked={chForm.is_published} onChange={e=>setChForm(f=>({...f,is_published:e.target.checked}))} className="w-4 h-4 accent-green-500" />
                <label htmlFor="pub2" className="text-sm text-gray-300">Published — visible to users immediately</label>
              </div>
              {/* Test Cases */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="label mb-0">Test Cases *</label>
                  <button type="button" onClick={()=>setTestCases(t=>[...t,{...EMPTY_TC}])} className="text-xs text-green-400 hover:text-green-300 flex items-center gap-1"><Plus className="w-3 h-3"/>Add case</button>
                </div>
                <div className="space-y-3">
                  {testCases.map((tc,i)=>(
                    <div key={i} className="bg-gray-800/60 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500 font-bold uppercase">Test #{i+1}</span>
                        {testCases.length>1 && <button type="button" onClick={()=>setTestCases(t=>t.filter((_,idx)=>idx!==i))} className="text-xs text-red-400 hover:text-red-300">Remove</button>}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div><label className="label text-xs">Input (stdin)</label><textarea className="input font-mono text-xs" rows={3} value={tc.input} onChange={e=>setTestCases(t=>t.map((x,idx)=>idx===i?{...x,input:e.target.value}:x))} placeholder="stdin..." /></div>
                        <div><label className="label text-xs">Expected Output</label><textarea className="input font-mono text-xs" rows={3} value={tc.expected_output} onChange={e=>setTestCases(t=>t.map((x,idx)=>idx===i?{...x,expected_output:e.target.value}:x))} placeholder="stdout..." /></div>
                      </div>
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-400">
                          <input type="checkbox" checked={tc.is_sample} onChange={e=>setTestCases(t=>t.map((x,idx)=>idx===i?{...x,is_sample:e.target.checked}:x))} className="w-3.5 h-3.5 accent-green-500" />
                          Show as sample
                        </label>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">Points:</span>
                          <input type="number" min="1" className="input w-20 text-xs py-1" value={tc.points} onChange={e=>setTestCases(t=>t.map((x,idx)=>idx===i?{...x,points:Number(e.target.value)}:x))} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={()=>setChModal(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
                <button type="submit" disabled={chSaving} className="btn-primary flex-1 justify-center"><CheckCircle className="w-4 h-4"/>{chSaving?'Saving...':editingCh?'Update':'Create Challenge'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Adjust balance modal */}
      {adjustUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
              <h2 className="font-bold text-white">Adjust Balance</h2>
              <button onClick={()=>setAdjustUser(null)} className="p-1 rounded-lg hover:bg-gray-800 text-gray-400"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-3 p-3 bg-gray-800 rounded-xl">
                <div className={`w-9 h-9 rounded-full ${avatarColor(adjustUser.name)} flex items-center justify-center text-sm font-bold text-white`}>{avatar(adjustUser.name)}</div>
                <div>
                  <p className="text-sm font-semibold text-white">{adjustUser.name}</p>
                  <p className="text-xs text-gray-400">Current: {fmt(adjustUser.balance)} RWF</p>
                </div>
              </div>
              <div><label className="label">Amount (positive = add, negative = deduct)</label><input type="number" className="input" value={adjustAmt} onChange={e=>setAdjustAmt(e.target.value)} placeholder="e.g. 5000 or -1000" /></div>
              <div><label className="label">Reason</label><input className="input" value={adjustNote} onChange={e=>setAdjustNote(e.target.value)} placeholder="e.g. Prize correction" /></div>
              <div className="flex gap-3">
                <button onClick={()=>setAdjustUser(null)} className="btn-secondary flex-1 justify-center">Cancel</button>
                <button onClick={doAdjust} disabled={!adjustAmt} className="btn-primary flex-1 justify-center">Apply</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
