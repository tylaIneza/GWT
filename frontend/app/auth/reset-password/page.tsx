'use client';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n-context';

export default function ResetPasswordPage() {
  const router   = useRouter();
  const params   = useSearchParams();
  const email    = params.get('email') || '';
  const { t }    = useI18n();
  const [form,   setForm]    = useState({ otp: '', password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!email) router.push('/auth/forgot-password');
  }, [email]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirm) { setError(t('reset_mismatch')); return; }
    if (form.password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setLoading(true); setError('');
    try {
      await api.post('/auth/reset-password', {
        email,
        otp: form.otp.trim(),
        new_password: form.password,
      });
      setSuccess(true);
      setTimeout(() => router.push('/auth/login'), 2000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Reset failed. Please try again.');
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
          <div className="w-16 h-16 rounded-2xl bg-green-900/30 border border-green-800/50 flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="w-8 h-8 text-green-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">{t('reset_title')}</h1>
          <p className="text-gray-500 text-sm mt-1">
            {t('reset_subtitle')}<br />
            <span className="text-green-400 font-medium">{email}</span>
          </p>
        </div>

        <form onSubmit={submit} className="card p-8 space-y-5">
          {error && (
            <div className="bg-red-900/30 border border-red-800 text-red-400 rounded-xl px-4 py-3 text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-900/30 border border-green-800 text-green-400 rounded-xl px-4 py-3 text-sm text-center">
              {t('reset_success')}
            </div>
          )}

          <div>
            <label className="label">{t('reset_otp')}</label>
            <input
              value={form.otp}
              onChange={e => setForm(p => ({ ...p, otp: e.target.value }))}
              className="input font-mono tracking-widest text-center text-xl"
              placeholder="000000"
              maxLength={6}
              autoFocus
              required
            />
          </div>

          <div>
            <label className="label">{t('reset_new_password')}</label>
            <input
              type="password"
              value={form.password}
              onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
              className="input"
              placeholder="Min 8 characters"
              minLength={8}
              required
              autoComplete="new-password"
            />
            {form.password.length > 0 && (
              <div className="flex gap-1 mt-2">
                {[form.password.length >= 8, /[A-Z]/.test(form.password), /[0-9]/.test(form.password), /[^A-Za-z0-9]/.test(form.password)].map((ok, i) => (
                  <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${ok ? 'bg-green-500' : 'bg-gray-700'}`} />
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="label">{t('reset_confirm')}</label>
            <input
              type="password"
              value={form.confirm}
              onChange={e => setForm(p => ({ ...p, confirm: e.target.value }))}
              className="input"
              placeholder="Repeat password"
              required
              autoComplete="new-password"
            />
          </div>

          <button type="submit" disabled={loading || success} className="btn-primary w-full justify-center py-3">
            {loading ? t('reset_loading') : t('reset_submit')}
          </button>

          <div className="text-center">
            <Link href="/auth/forgot-password" className="text-sm text-gray-500 hover:text-gray-400 transition-colors">
              ← {t('reset_back')}
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
