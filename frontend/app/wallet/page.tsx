'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import api from '@/lib/api';
import { getToken, getUser } from '@/lib/auth';
import { useI18n } from '@/lib/i18n-context';
import { COUNTRIES, CURRENCIES } from '@/lib/i18n';
import { Wallet, ArrowDownLeft, ArrowUpRight, Clock, CreditCard, Copy, Check } from 'lucide-react';

const TX_ICON: Record<string, string> = {
  deposit: '💰', withdrawal: '💸', contest_entry: '🏆',
  prize_payout: '🎉', refund: '↩️', adjustment: '⚙️', bet_win: '🎯', bet_loss: '❌',
};

const isCredit = (type: string) => ['deposit','prize_payout','refund','adjustment','bet_win'].includes(type);

type PaymentProvider = 'card' | 'paypal' | 'crypto' | 'mtn' | 'airtel' | 'bank';

const CRYPTO_ADDRESSES = {
  BTC:  'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
  USDT: '0x742d35Cc6634C0532925a3b8D4C9E4e3B2c8D5b1',
  ETH:  '0x742d35Cc6634C0532925a3b8D4C9E4e3B2c8D5b1',
};

export default function WalletPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [wallet,    setWallet]    = useState<any>(null);
  const [txns,      setTxns]      = useState<any[]>([]);
  const [tab,       setTab]       = useState<'overview'|'deposit'|'withdraw'>('overview');
  const [provider,  setProvider]  = useState<PaymentProvider>('card');
  const [loading,   setLoading]   = useState(false);
  const [msg,       setMsg]       = useState('');
  const [msgType,   setMsgType]   = useState<'success'|'error'|'info'>('info');
  const [pending,   setPending]   = useState<string|null>(null);
  const [copied,    setCopied]    = useState<string|null>(null);
  const [cryptoCoin, setCryptoCoin] = useState<'BTC'|'USDT'|'ETH'>('BTC');

  // Card form
  const [card, setCard] = useState({ number: '', expiry: '', cvv: '', name: '' });
  // Mobile money form
  const [mobile, setMobile] = useState({ phone: '', amount: '' });
  // Amount
  const [amount, setAmount] = useState('');

  const user = getUser();
  const userCountry = COUNTRIES.find(c => c.code === (user?.country_code || 'US'));
  const currency = wallet?.currency || userCountry?.currency || 'USD';
  const currencySymbol = CURRENCIES[currency]?.symbol || '$';

  useEffect(() => { if (!getToken()) router.push('/auth/login'); }, []);

  const load = () => {
    api.get('/wallet').then(r => setWallet(r.data)).catch(() => {});
    api.get('/wallet/transactions').then(r => setTxns(r.data.transactions || [])).catch(() => {});
  };
  useEffect(load, []);

  const notify = (m: string, type: 'success'|'error'|'info' = 'info') => {
    setMsg(m); setMsgType(type); setTimeout(() => setMsg(''), 6000);
  };

  const copyAddress = (addr: string, coin: string) => {
    navigator.clipboard.writeText(addr).then(() => {
      setCopied(coin); setTimeout(() => setCopied(null), 2000);
    });
  };

  const handleMobileDeposit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    try {
      const mobileProvider = provider === 'mtn' ? 'mtn' : 'airtel';
      const res = await api.post('/payments/deposit', {
        amount: Number(mobile.amount), phone: mobile.phone, provider: mobileProvider,
      });
      setPending(res.data.reference);
      notify(`Check your ${provider === 'mtn' ? 'MTN MoMo' : 'Airtel Money'} to confirm. Ref: ${res.data.reference}`, 'success');
    } catch (e: any) {
      notify(e.response?.data?.message || 'Deposit failed', 'error');
    } finally { setLoading(false); }
  };

  const handleMobileWithdraw = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    try {
      const mobileProvider = provider === 'mtn' ? 'mtn' : 'airtel';
      await api.post('/payments/withdraw', {
        amount: Number(mobile.amount), phone: mobile.phone, provider: mobileProvider,
      });
      notify('Withdrawal initiated! Money arrives in 1–5 minutes.', 'success');
      setMobile({ phone: '', amount: '' }); load();
    } catch (e: any) {
      notify(e.response?.data?.message || 'Withdrawal failed', 'error');
    } finally { setLoading(false); }
  };

  const handleCardDeposit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    try {
      await api.post('/payments/card/deposit', { amount: Number(amount), currency, card });
      notify('Card deposit initiated! Processing within 2 minutes.', 'success');
      setAmount(''); setCard({ number: '', expiry: '', cvv: '', name: '' }); load();
    } catch (e: any) {
      notify(e.response?.data?.message || 'Card payment failed. Please try again.', 'error');
    } finally { setLoading(false); }
  };

  const handlePayPalDeposit = async () => {
    setLoading(true);
    try {
      const res = await api.post('/payments/paypal/create', { amount: Number(amount), currency });
      window.location.href = res.data.approval_url;
    } catch (e: any) {
      notify(e.response?.data?.message || 'PayPal redirect failed', 'error');
      setLoading(false);
    }
  };

  const handleCardWithdraw = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    try {
      await api.post('/payments/card/withdraw', { amount: Number(amount), currency });
      notify('Withdrawal to card initiated. 2-5 business days.', 'success');
      setAmount(''); load();
    } catch (e: any) {
      notify(e.response?.data?.message || 'Withdrawal failed', 'error');
    } finally { setLoading(false); }
  };

  const verifyDeposit = async () => {
    if (!pending) return;
    try {
      const res = await api.get(`/payments/deposit/verify?reference=${pending}`);
      if (res.data.status === 'credited') {
        notify(`${Number(res.data.amount).toLocaleString()} ${currency} credited to your wallet!`, 'success');
        setPending(null); load();
      } else if (res.data.status === 'failed') {
        notify('Payment failed or cancelled.', 'error'); setPending(null);
      } else {
        notify('Still pending. Confirm on your phone if you haven\'t.', 'info');
      }
    } catch { notify('Error checking payment status', 'error'); }
  };

  const msgColors = {
    success: 'bg-green-900/30 border-green-700 text-green-300',
    error:   'bg-red-900/20 border-red-800 text-red-400',
    info:    'bg-blue-900/20 border-blue-800 text-blue-300',
  };

  const providers: { id: PaymentProvider; label: string; icon: string; group: 'card'|'digital'|'mobile'|'crypto' }[] = [
    { id: 'card',   label: t('pay_card'),   icon: '💳', group: 'card'    },
    { id: 'paypal', label: t('pay_paypal'), icon: '🅿️', group: 'digital' },
    { id: 'crypto', label: t('pay_crypto'), icon: '₿',  group: 'crypto'  },
    { id: 'mtn',    label: 'MTN MoMo',      icon: '📱', group: 'mobile'  },
    { id: 'airtel', label: 'Airtel Money',  icon: '📲', group: 'mobile'  },
    { id: 'bank',   label: t('pay_bank'),   icon: '🏦', group: 'card'    },
  ];

  return (
    <div className="min-h-screen bg-gray-950">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <h1 className="text-2xl font-bold text-white">{t('wallet_title')}</h1>

        {msg && (
          <div className={`rounded-xl px-4 py-3 text-sm font-medium border ${msgColors[msgType]}`}>
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
              <p className="text-xs text-gray-500 uppercase font-semibold">{t('wallet_balance')}</p>
              <p className="text-3xl font-black text-green-300">
                {currencySymbol}{Number(wallet?.balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                <span className="text-lg font-semibold text-gray-400 ml-1">{currency}</span>
              </p>
            </div>
          </div>
          {wallet?.locked_balance > 0 && (
            <p className="text-xs text-amber-500 mb-3">
              🔒 {currencySymbol}{Number(wallet.locked_balance).toLocaleString()} locked in active contests
            </p>
          )}
          <div className="flex gap-3">
            <button onClick={() => setTab('deposit')} className="btn-primary flex-1 justify-center">
              <ArrowDownLeft className="w-4 h-4" /> {t('wallet_deposit')}
            </button>
            <button onClick={() => setTab('withdraw')} className="btn-secondary flex-1 justify-center">
              <ArrowUpRight className="w-4 h-4" /> {t('wallet_withdraw')}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-800 gap-0">
          {(['overview', 'deposit', 'withdraw'] as const).map(k => (
            <button key={k} onClick={() => setTab(k)}
              className={`pb-3 mr-6 text-sm font-medium border-b-2 transition-colors capitalize ${tab === k ? 'border-green-500 text-green-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
              {k === 'overview' ? t('wallet_transactions') : k === 'deposit' ? t('wallet_deposit') : t('wallet_withdraw')}
            </button>
          ))}
        </div>

        {/* Transaction history */}
        {tab === 'overview' && (
          <div className="card overflow-hidden">
            {txns.length === 0 ? (
              <div className="p-12 text-center text-gray-500">{t('wallet_no_txns')}</div>
            ) : (
              <div className="divide-y divide-gray-800">
                {txns.map((tx: any) => (
                  <div key={tx.id} className="px-4 py-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{TX_ICON[tx.type] || '📋'}</span>
                      <div>
                        <p className="font-medium text-white text-sm capitalize">{tx.type.replace(/_/g, ' ')}</p>
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />{new Date(tx.created_at).toLocaleString()}
                          {tx.payment_provider && <span className="ml-1 badge text-xs">{tx.payment_provider}</span>}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold ${isCredit(tx.type) ? 'text-green-400' : 'text-red-400'}`}>
                        {isCredit(tx.type) ? '+' : '-'}{currencySymbol}{Number(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </p>
                      <span className={`badge text-xs ${tx.status === 'completed' ? 'badge-green' : tx.status === 'pending' ? 'badge-yellow' : ''}`}>
                        {tx.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Deposit / Withdraw panel */}
        {(tab === 'deposit' || tab === 'withdraw') && (
          <div className="card p-6 space-y-6">
            <div>
              <h2 className="font-bold text-white mb-1">
                {tab === 'deposit' ? t('wallet_deposit') : t('wallet_withdraw')} Funds
              </h2>
              <p className="text-gray-500 text-sm">
                {tab === 'deposit'
                  ? `${t('wallet_min_deposit')}: ${currencySymbol}5`
                  : `${t('wallet_min_withdraw')}: ${currencySymbol}10 · Balance: ${currencySymbol}${Number(wallet?.balance || 0).toFixed(2)}`}
              </p>
            </div>

            {/* Provider selection */}
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Payment Method</p>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {providers.map(p => (
                  <button key={p.id} type="button" onClick={() => setProvider(p.id)}
                    className={`p-2.5 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 transition-all ${provider === p.id ? 'border-green-500 bg-green-900/20 text-green-300' : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'}`}>
                    <span className="text-lg">{p.icon}</span>
                    <span className="leading-tight text-center">{p.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Card form */}
            {provider === 'card' && (
              <form onSubmit={tab === 'deposit' ? handleCardDeposit : handleCardWithdraw} className="space-y-4">
                {tab === 'deposit' && (
                  <>
                    <div>
                      <label className="label">{t('pay_card_number')}</label>
                      <input value={card.number}
                        onChange={e => setCard(p => ({ ...p, number: e.target.value.replace(/\D/g,'').slice(0,16) }))}
                        className="input font-mono tracking-widest" placeholder="1234 5678 9012 3456" required
                        pattern="\d{13,16}" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="label">{t('pay_expiry')}</label>
                        <input value={card.expiry}
                          onChange={e => { let v = e.target.value.replace(/\D/g,''); if (v.length >= 2) v = v.slice(0,2)+'/'+v.slice(2,4); setCard(p => ({...p, expiry: v})); }}
                          className="input font-mono" placeholder="MM/YY" maxLength={5} required />
                      </div>
                      <div>
                        <label className="label">{t('pay_cvv')}</label>
                        <input value={card.cvv} type="password"
                          onChange={e => setCard(p => ({ ...p, cvv: e.target.value.replace(/\D/g,'').slice(0,4) }))}
                          className="input font-mono" placeholder="•••" maxLength={4} required />
                      </div>
                    </div>
                    <div>
                      <label className="label">{t('pay_name')}</label>
                      <input value={card.name} onChange={e => setCard(p => ({ ...p, name: e.target.value }))}
                        className="input" placeholder="John Doe" required />
                    </div>
                  </>
                )}
                <div>
                  <label className="label">Amount ({currency})</label>
                  <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                    className="input" placeholder={`Min ${currencySymbol}${tab === 'deposit' ? '5' : '10'}`}
                    min={tab === 'deposit' ? 5 : 10} max={tab === 'withdraw' ? wallet?.balance : undefined} required step="0.01" />
                </div>
                <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3">
                  <CreditCard className="w-4 h-4" />
                  {loading ? t('loading') : tab === 'deposit' ? t('pay_deposit_btn') : t('pay_withdraw_btn')}
                </button>
                <p className="text-xs text-gray-600 text-center">🔒 Secured by Stripe · PCI DSS Level 1</p>
              </form>
            )}

            {/* PayPal */}
            {provider === 'paypal' && (
              <div className="space-y-4">
                <div>
                  <label className="label">Amount ({currency})</label>
                  <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                    className="input" placeholder={`Min ${currencySymbol}5`} min={5} required step="0.01" />
                </div>
                {tab === 'deposit' ? (
                  <button onClick={handlePayPalDeposit} disabled={loading || !amount} className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50">
                    🅿️ {loading ? 'Redirecting...' : `Pay ${amount ? currencySymbol + Number(amount).toFixed(2) : ''} with PayPal`}
                  </button>
                ) : (
                  <button disabled className="w-full py-3 rounded-xl bg-gray-700 text-gray-400 font-bold flex items-center justify-center gap-2 cursor-not-allowed">
                    🅿️ PayPal Withdrawal — Coming Soon
                  </button>
                )}
                <p className="text-xs text-gray-600 text-center">You'll be redirected to PayPal to complete payment</p>
              </div>
            )}

            {/* Crypto */}
            {provider === 'crypto' && tab === 'deposit' && (
              <div className="space-y-4">
                <div className="flex gap-2">
                  {(['BTC','USDT','ETH'] as const).map(coin => (
                    <button key={coin} type="button" onClick={() => setCryptoCoin(coin)}
                      className={`flex-1 py-2 rounded-xl border text-sm font-bold transition-all ${cryptoCoin === coin ? 'border-orange-500 bg-orange-900/20 text-orange-300' : 'border-gray-700 bg-gray-800 text-gray-400'}`}>
                      {coin === 'BTC' ? '₿' : coin === 'USDT' ? '💵' : 'Ξ'} {coin}
                    </button>
                  ))}
                </div>
                <div className="bg-gray-800 rounded-xl p-4 space-y-3">
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Send {cryptoCoin} to this address</p>
                  <div className="flex items-center gap-2 bg-gray-900 rounded-lg p-3">
                    <code className="text-green-400 text-xs flex-1 break-all">{CRYPTO_ADDRESSES[cryptoCoin]}</code>
                    <button onClick={() => copyAddress(CRYPTO_ADDRESSES[cryptoCoin], cryptoCoin)}
                      className="shrink-0 p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-green-400 transition-colors">
                      {copied === cryptoCoin ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="text-xs text-amber-400 bg-amber-900/20 border border-amber-800/30 rounded-lg p-3">
                    ⚠️ Send only {cryptoCoin} to this address. Other tokens will be lost. Minimum: 0.0001 BTC / $5 USDT.
                    Confirmations required: {cryptoCoin === 'BTC' ? '3' : '12'}.
                  </div>
                </div>
                <p className="text-xs text-gray-600 text-center">Balance credited after {cryptoCoin === 'BTC' ? '3' : '12'} network confirmations (~10-30 min)</p>
              </div>
            )}

            {/* Crypto withdraw */}
            {provider === 'crypto' && tab === 'withdraw' && (
              <div className="space-y-4">
                <div className="flex gap-2">
                  {(['BTC','USDT','ETH'] as const).map(coin => (
                    <button key={coin} type="button" onClick={() => setCryptoCoin(coin)}
                      className={`flex-1 py-2 rounded-xl border text-sm font-bold transition-all ${cryptoCoin === coin ? 'border-orange-500 bg-orange-900/20 text-orange-300' : 'border-gray-700 bg-gray-800 text-gray-400'}`}>
                      {coin === 'BTC' ? '₿' : coin === 'USDT' ? '💵' : 'Ξ'} {coin}
                    </button>
                  ))}
                </div>
                <div>
                  <label className="label">Your {cryptoCoin} Address</label>
                  <input className="input font-mono text-xs" placeholder={`Your ${cryptoCoin} wallet address`} required />
                </div>
                <div>
                  <label className="label">Amount (USD equivalent)</label>
                  <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                    className="input" placeholder="Min $10" min={10} max={wallet?.balance} step="0.01" required />
                </div>
                <button disabled className="btn-primary w-full justify-center py-3 opacity-50 cursor-not-allowed">
                  Crypto Withdrawal — Coming Soon
                </button>
              </div>
            )}

            {/* Mobile Money */}
            {(provider === 'mtn' || provider === 'airtel') && (
              <>
                {pending && (
                  <div className="bg-amber-900/20 border border-amber-800 rounded-xl p-4 space-y-3">
                    <p className="text-amber-300 text-sm font-semibold">Payment pending — check your phone!</p>
                    <p className="text-amber-400/70 text-xs font-mono">{pending}</p>
                    <button onClick={verifyDeposit} className="btn-primary btn-sm">Check Payment Status</button>
                  </div>
                )}
                <form onSubmit={tab === 'deposit' ? handleMobileDeposit : handleMobileWithdraw} className="space-y-4">
                  <div>
                    <label className="label">Phone Number</label>
                    <input value={mobile.phone}
                      onChange={e => setMobile(p => ({ ...p, phone: e.target.value }))}
                      className="input" placeholder="07XXXXXXXX" required type="tel" />
                  </div>
                  <div>
                    <label className="label">Amount ({currency})</label>
                    <input type="number" value={mobile.amount} onChange={e => setMobile(p => ({ ...p, amount: e.target.value }))}
                      className="input" placeholder={`Min ${tab === 'deposit' ? '500' : '1,000'} RWF`}
                      min={tab === 'deposit' ? 500 : 1000} max={tab === 'withdraw' ? wallet?.balance : undefined} required />
                  </div>
                  <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3">
                    {loading ? t('loading') : `${tab === 'deposit' ? 'Deposit' : 'Withdraw'} via ${provider === 'mtn' ? 'MTN MoMo' : 'Airtel Money'}`}
                  </button>
                </form>
              </>
            )}

            {/* Bank transfer */}
            {provider === 'bank' && (
              <div className="bg-gray-800 rounded-xl p-5 space-y-3">
                <p className="text-white font-semibold">Bank Transfer Details</p>
                <div className="space-y-2 text-sm">
                  {[
                    ['Bank', 'DevixCode Financial Services'],
                    ['Account Name', 'DevixCode Global Ltd'],
                    ['Account Number', '0012345678'],
                    ['Swift/BIC', 'CODARGLX'],
                    ['IBAN', 'GB29NWBK60161331926819'],
                    ['Reference', `USER-${user?.id?.slice(0,8)?.toUpperCase() || 'XXXXXXXX'}`],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-4">
                      <span className="text-gray-500">{k}</span>
                      <span className="text-white font-mono text-xs">{v}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-amber-400">Use your reference code. Processing: 1-3 business days.</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
