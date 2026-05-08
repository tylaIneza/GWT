'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { KeyRound } from 'lucide-react';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n-context';

export default function ForgotPasswordPage() {
  const router     = useRouter();
  const { t }      = useI18n();
  const [email,    setEmail]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [sent,     setSent]     = useState(false);
  const [error,    setError]    = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Something went wrong.');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-950">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-700 flex items-center justify-center font-black text-xl">D</div>
            <span className="font-bold text-white text-xl">DevixCode</span>
          </Link>
          <div className="w-16 h-16 rounded-2xl bg-amber-900/30 border border-amber-800/50 flex items-center justify-center mx-auto mb-4">
            <KeyRound className="w-8 h-8 text-amber-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">{t('forgot_title')}</h1>
          <p className="text-gray-500 text-sm mt-1">{t('forgot_subtitle')}</p>
        </div>

        <div className="card p-8 space-y-5">
          {error && (
            <div className="bg-red-900/30 border border-red-800 text-red-400 rounded-xl px-4 py-3 text-sm">
              {error}
            </div>
          )}

          {sent ? (
            <div className="space-y-4">
              <div className="bg-green-900/30 border border-green-800 text-green-400 rounded-xl px-4 py-4 text-sm text-center">
                {t('forgot_sent')}
              </div>
              <button
                onClick={() => router.push(`/auth/reset-password?email=${encodeURIComponent(email)}`)}
                className="btn-primary w-full justify-center py-3">
                {t('forgot_goto_reset')}
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-5">
              <div>
                <label className="label">{t('forgot_email')}</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="input"
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                  autoFocus
                />
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3">
                {loading ? t('forgot_loading') : t('forgot_submit')}
              </button>
            </form>
          )}

          <div className="text-center">
            <Link href="/auth/login" className="text-sm text-gray-500 hover:text-gray-400 transition-colors">
              ← {t('forgot_back')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
