'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Globe } from 'lucide-react';
import api from '@/lib/api';
import { setAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n-context';
import { LANGUAGES } from '@/lib/i18n';

export default function LoginPage() {
  const router = useRouter();
  const { t, lang, setLang } = useI18n();
  const [form,    setForm]    = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [showLang, setShowLang] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await api.post('/auth/login', form);
      setAuth(res.data.token, res.data.user);
      router.push(res.data.user.role === 'admin' ? '/admin' : '/dashboard');
    } catch (e: any) {
      setError(e.response?.data?.message || 'Login failed. Please check your credentials.');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-950">
      {/* Language selector top-right */}
      <div className="fixed top-4 right-4">
        <div className="relative">
          <button onClick={() => setShowLang(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-700 bg-gray-900 text-gray-400 text-sm hover:border-green-700 transition-colors">
            <Globe className="w-3.5 h-3.5" />
            {LANGUAGES.find(l => l.code === lang)?.flag}
          </button>
          {showLang && (
            <div className="absolute right-0 top-full mt-1 bg-gray-900 border border-gray-700 rounded-xl shadow-xl z-50 py-1 min-w-[160px]">
              {LANGUAGES.map(l => (
                <button key={l.code} onClick={() => { setLang(l.code); setShowLang(false); }}
                  className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-gray-800 ${lang === l.code ? 'text-green-400' : 'text-gray-300'}`}>
                  <span>{l.flag}</span>{l.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-700 flex items-center justify-center font-black text-xl">C</div>
            <span className="font-bold text-white text-xl">CodeArena</span>
          </Link>
          <h1 className="text-2xl font-bold text-white">{t('auth_login_title')}</h1>
          <p className="text-gray-500 text-sm mt-1">{t('auth_login_subtitle')}</p>
        </div>

        <form onSubmit={submit} className="card p-8 space-y-5">
          {error && (
            <div className="bg-red-900/30 border border-red-800 text-red-400 rounded-xl px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="label">{t('auth_login_email')}</label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              className="input"
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </div>
          <div>
            <label className="label">{t('auth_login_password')}</label>
            <input
              type="password"
              value={form.password}
              onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
              className="input"
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3">
            {loading ? t('auth_login_loading') : t('auth_login_button')}
          </button>

          <p className="text-center text-gray-500 text-sm">
            {t('auth_login_no_account')}{' '}
            <Link href="/auth/register" className="text-green-400 hover:text-green-300 font-medium">
              {t('auth_login_create')}
            </Link>
          </p>
        </form>

        {/* Demo credentials hint */}
        <div className="mt-4 card p-4 bg-blue-900/10 border-blue-800/30">
          <p className="text-xs text-blue-400 font-semibold mb-2">Test Accounts</p>
          <div className="space-y-1 text-xs text-gray-500">
            <p><span className="text-gray-400">Admin:</span> inezapaccy4@gmail.com / Ineza@12</p>
            <p><span className="text-gray-400">User:</span> testuser@codearena.com / Test@1234</p>
          </div>
        </div>
      </div>
    </div>
  );
}
