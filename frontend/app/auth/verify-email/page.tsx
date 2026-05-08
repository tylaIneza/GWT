'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Mail, RefreshCw } from 'lucide-react';
import api from '@/lib/api';
import { setAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n-context';

export default function VerifyEmailPage() {
  const router       = useRouter();
  const params       = useSearchParams();
  const email        = params.get('email') || '';
  const { t }        = useI18n();
  const [otp,        setOtp]        = useState(['', '', '', '', '', '']);
  const [loading,    setLoading]    = useState(false);
  const [resending,  setResending]  = useState(false);
  const [error,      setError]      = useState('');
  const [resent,     setResent]     = useState(false);
  const [cooldown,   setCooldown]   = useState(0);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!email) router.push('/auth/login');
  }, [email]);

  useEffect(() => {
    if (cooldown > 0) {
      const id = setTimeout(() => setCooldown(c => c - 1), 1000);
      return () => clearTimeout(id);
    }
  }, [cooldown]);

  const handleChange = (i: number, val: string) => {
    const v = val.replace(/\D/g, '').slice(-1);
    const next = [...otp];
    next[i] = v;
    setOtp(next);
    if (v && i < 5) inputs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[i] && i > 0) {
      inputs.current[i - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (text.length === 6) {
      setOtp(text.split(''));
      inputs.current[5]?.focus();
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otp.join('');
    if (code.length < 6) { setError('Enter all 6 digits'); return; }
    setLoading(true); setError('');
    try {
      const res = await api.post('/auth/verify-email', { email, otp: code });
      setAuth(res.data.token, res.data.user);
      router.push(res.data.user.role === 'admin' ? '/admin' : '/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid code. Please try again.');
      setOtp(['', '', '', '', '', '']);
      inputs.current[0]?.focus();
    } finally { setLoading(false); }
  };

  const resend = async () => {
    if (cooldown > 0) return;
    setResending(true); setResent(false); setError('');
    try {
      await api.post('/auth/resend-otp', { email });
      setResent(true);
      setCooldown(60);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to resend.');
    } finally { setResending(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-950">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-700 flex items-center justify-center font-black text-xl">D</div>
            <span className="font-bold text-white text-xl">DevixCode</span>
          </Link>
          <div className="w-16 h-16 rounded-2xl bg-green-900/30 border border-green-800/50 flex items-center justify-center mx-auto mb-4">
            <Mail className="w-8 h-8 text-green-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">{t('verify_title')}</h1>
          <p className="text-gray-500 text-sm mt-1">
            {t('verify_subtitle')}<br />
            <span className="text-green-400 font-medium">{email}</span>
          </p>
        </div>

        <form onSubmit={submit} className="card p-8 space-y-6">
          {error && (
            <div className="bg-red-900/30 border border-red-800 text-red-400 rounded-xl px-4 py-3 text-sm">
              {error}
            </div>
          )}
          {resent && (
            <div className="bg-green-900/30 border border-green-800 text-green-400 rounded-xl px-4 py-3 text-sm">
              {t('verify_resent')}
            </div>
          )}

          <div className="flex gap-2 justify-center" onPaste={handlePaste}>
            {otp.map((digit, i) => (
              <input
                key={i}
                ref={el => { inputs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={e => handleChange(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                className="w-12 h-14 text-center text-2xl font-bold bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-colors"
                autoFocus={i === 0}
              />
            ))}
          </div>

          <button type="submit" disabled={loading || otp.join('').length < 6}
            className="btn-primary w-full justify-center py-3">
            {loading ? t('verify_loading') : t('verify_submit')}
          </button>

          <div className="text-center space-y-2">
            <button type="button" onClick={resend} disabled={resending || cooldown > 0}
              className="flex items-center gap-1.5 mx-auto text-sm text-gray-500 hover:text-green-400 transition-colors disabled:opacity-50">
              <RefreshCw className={`w-3.5 h-3.5 ${resending ? 'animate-spin' : ''}`} />
              {resending ? t('verify_resend_loading') : cooldown > 0 ? `${t('verify_resend')} (${cooldown}s)` : t('verify_resend')}
            </button>
            <Link href="/auth/login" className="block text-sm text-gray-600 hover:text-gray-400 transition-colors">
              {t('verify_back')}
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
