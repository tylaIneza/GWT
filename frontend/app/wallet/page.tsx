'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import api from '@/lib/api';
import { getToken } from '@/lib/auth';
import { Wallet, ArrowDownLeft, ArrowUpRight, Clock } from 'lucide-react';

const TX_ICON: Record<string, string> = {
  deposit: '💰', withdrawal: '💸', contest_entry: '🏆',
  prize_payout: '🎉', refund: '↩️', adjustment: '⚙️',
};

const isCredit = (type: string) => ['deposit','prize_payout','refund','adjustment'].includes(type);

export default function WalletPage() {
  const router = useRouter();
  const [wallet,   setWallet]   = useState<any>(null);
  const [txns,     setTxns]     = useState<any[]>([]);
  const [tab,      setTab]      = useState<'overview'|'deposit'|'withdraw'>('overview');
  const [form,     setForm]     = useState({ amount: '', phone: '', provider: 'mtn' as 'mtn'|'airtel' });
  const [loading,  setLoading]  = useState(false);
  const [msg,      setMsg]      = useState('');
  const [pending,  setPending]  = useState<string|null>(null);

  useEffect(() => { if (!getToken()) router.push('/auth/login'); }, []);

  const load = () => {
    api.get('/wallet').then(r => setWallet(r.data)).catch(() => {});
    api.get('/wallet/transactions').then(r => setTxns(r.data.transactions || [])).catch(() => {});
  };
  useEffect(load, []);

  const notify = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 5000); };

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/payments/deposit', {
        amount: Number(form.amount), phone: form.phone, provider: form.provider,
      });
      setPending(res.data.reference);
      notify(`📱 Check your ${form.provider === 'mtn' ? 'MTN MoMo' : 'Airtel Money'} to confirm payment. Ref: ${res.data.reference}`);
    } catch (e: any) {
      notify(e.response?.data?.message || 'Deposit failed');
    } finally { setLoading(false); }
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/payments/withdraw', {
        amount: Number(form.amount), phone: form.phone, provider: form.provider,
      });
      notify('✅ Withdrawal initiated! Money will arrive in 1–5 minutes.');
      load();
    } catch (e: any) {
      notify(e.response?.data?.message || 'Withdrawal failed');
    } finally { setLoading(false); }
  };

  const verifyDeposit = async () => {
    if (!pending) return;
    try {
      const res = await api.get(`/payments/deposit/verify?reference=${pending}`);
      if (res.data.status === 'credited') {
        notify(`✅ ${Number(res.data.amount).toLocaleString()} RWF credited to your wallet!`);
        setPending(null); load();
      } else if (res.data.status === 'failed') {
        notify('❌ Payment failed or cancelled.');
        setPending(null);
      } else {
        notify('⏳ Still pending. Check your phone and confirm if you haven\'t.');
      }
    } catch {
      notify('Error checking payment status');
    }
  };

  return (
    <div className="min-h-screen bg-gray-950">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <h1 className="text-2xl font-bold text-white">Wallet</h1>

        {msg && (
          <div className={`rounded-xl px-4 py-3 text-sm font-medium border ${msg.startsWith('✅') || msg.startsWith('📱') ? 'bg-green-900/30 border-green-700 text-green-300' : msg.startsWith('❌') ? 'bg-red-900/20 border-red-800 text-red-400' : 'bg-blue-900/20 border-blue-800 text-blue-300'}`}>
            {msg}
          </div>
        )}

        {/* Balance card */}
        <div className="card p-6 bg-gradient-to-br from-green-900/20 to-gray-900 border-green-800/20">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-green-900/40 rounded-xl flex items-center justify-center">
              <Wallet className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase font-semibold">Available Balance</p>
              <p className="text-3xl font-black text-green-300">{Number(wallet?.balance || 0).toLocaleString()} <span className="text-lg font-semibold text-gray-400">RWF</span></p>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setTab('deposit')}  className="btn-primary flex-1 justify-center">
              <ArrowDownLeft className="w-4 h-4" /> Deposit
            </button>
            <button onClick={() => setTab('withdraw')} className="btn-secondary flex-1 justify-center">
              <ArrowUpRight className="w-4 h-4" /> Withdraw
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-800 gap-0">
          {[['overview','Transactions'],['deposit','Deposit'],['withdraw','Withdraw']].map(([k,l]) => (
            <button key={k} onClick={() => setTab(k as any)}
              className={`pb-3 mr-6 text-sm font-medium border-b-2 transition-colors ${tab === k ? 'border-green-500 text-green-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
              {l}
            </button>
          ))}
        </div>

        {/* Transactions */}
        {tab === 'overview' && (
          <div className="card overflow-hidden">
            {txns.length === 0 ? (
              <div className="p-12 text-center text-gray-500">No transactions yet</div>
            ) : (
              <div className="divide-y divide-gray-800">
                {txns.map((t: any) => (
                  <div key={t.id} className="px-4 py-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{TX_ICON[t.type] || '📋'}</span>
                      <div>
                        <p className="font-medium text-white text-sm capitalize">{t.type.replace(/_/g,' ')}</p>
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />{new Date(t.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold ${isCredit(t.type) ? 'text-green-400' : 'text-red-400'}`}>
                        {isCredit(t.type) ? '+' : '-'}{Number(t.amount).toLocaleString()} RWF
                      </p>
                      <span className={`badge text-xs ${t.status === 'completed' ? 'badge-green' : t.status === 'pending' ? 'badge-yellow' : ''}`}>
                        {t.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Deposit Form */}
        {tab === 'deposit' && (
          <div className="card p-6 space-y-5">
            <div>
              <h2 className="font-bold text-white mb-1">Deposit Funds</h2>
              <p className="text-gray-500 text-sm">Min: 500 RWF · Funds credited instantly after confirmation</p>
            </div>

            {pending && (
              <div className="bg-amber-900/20 border border-amber-800 rounded-xl p-4 space-y-3">
                <p className="text-amber-300 text-sm font-semibold">Payment pending — check your phone!</p>
                <p className="text-amber-400/70 text-xs font-mono">{pending}</p>
                <button onClick={verifyDeposit} className="btn-primary btn-sm">Check Payment Status</button>
              </div>
            )}

            <form onSubmit={handleDeposit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {['mtn','airtel'].map(p => (
                  <button key={p} type="button" onClick={() => setForm(f => ({...f, provider: p as any}))}
                    className={`p-3 rounded-xl border text-sm font-semibold transition-all ${form.provider === p ? 'border-green-500 bg-green-900/20 text-green-300' : 'border-gray-700 bg-gray-800 text-gray-400'}`}>
                    {p === 'mtn' ? '📱 MTN MoMo' : '📲 Airtel Money'}
                  </button>
                ))}
              </div>
              <div>
                <label className="label">Phone Number</label>
                <input value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))}
                  className="input" placeholder="07XX XXX XXX" required />
              </div>
              <div>
                <label className="label">Amount (RWF)</label>
                <input type="number" value={form.amount} onChange={e => setForm(f => ({...f, amount: e.target.value}))}
                  className="input" placeholder="Minimum 500 RWF" min={500} required />
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3">
                {loading ? 'Initiating...' : `Deposit via ${form.provider === 'mtn' ? 'MTN MoMo' : 'Airtel Money'}`}
              </button>
            </form>
          </div>
        )}

        {/* Withdraw Form */}
        {tab === 'withdraw' && (
          <div className="card p-6 space-y-5">
            <div>
              <h2 className="font-bold text-white mb-1">Withdraw Funds</h2>
              <p className="text-gray-500 text-sm">Min: 1,000 RWF · Arrives in 1–5 minutes</p>
            </div>

            <form onSubmit={handleWithdraw} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {['mtn','airtel'].map(p => (
                  <button key={p} type="button" onClick={() => setForm(f => ({...f, provider: p as any}))}
                    className={`p-3 rounded-xl border text-sm font-semibold transition-all ${form.provider === p ? 'border-green-500 bg-green-900/20 text-green-300' : 'border-gray-700 bg-gray-800 text-gray-400'}`}>
                    {p === 'mtn' ? '📱 MTN MoMo' : '📲 Airtel Money'}
                  </button>
                ))}
              </div>
              <div>
                <label className="label">Your {form.provider === 'mtn' ? 'MTN' : 'Airtel'} Number</label>
                <input value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))}
                  className="input" placeholder="07XX XXX XXX" required />
              </div>
              <div>
                <label className="label">Amount (RWF)</label>
                <input type="number" value={form.amount} onChange={e => setForm(f => ({...f, amount: e.target.value}))}
                  className="input" placeholder={`Max: ${Number(wallet?.balance || 0).toLocaleString()} RWF`}
                  min={1000} max={wallet?.balance} required />
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3">
                {loading ? 'Processing...' : 'Withdraw'}
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
