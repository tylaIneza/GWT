'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Globe, ChevronDown } from 'lucide-react';
import api from '@/lib/api';
import { setAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n-context';
import { LANGUAGES, COUNTRIES } from '@/lib/i18n';

export default function RegisterPage() {
  const router = useRouter();
  const { t, lang, setLang } = useI18n();
  const [form, setForm] = useState({
    name: '', email: '', password: '',
    phone: '', country_code: 'US',
  });
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState('');
  const [showLang,     setShowLang]     = useState(false);
  const [showCountry,  setShowCountry]  = useState(false);
  const [countrySearch, setCountrySearch] = useState('');

  const selectedCountry = COUNTRIES.find(c => c.code === form.country_code) || COUNTRIES[0];
  const filteredCountries = COUNTRIES.filter(c =>
    c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
    c.code.toLowerCase().includes(countrySearch.toLowerCase())
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters'); return;
    }
    setLoading(true); setError('');
    try {
      const res = await api.post('/auth/register', {
        name: form.name,
        email: form.email,
        password: form.password,
        phone: form.phone || undefined,
        country_code: form.country_code,
      });
      setAuth(res.data.token, res.data.user);
      router.push('/dashboard');
    } catch (e: any) {
      setError(e.response?.data?.message || e.response?.data?.error || 'Registration failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-950">
      {/* Language selector */}
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
          <h1 className="text-2xl font-bold text-white">{t('auth_register_title')}</h1>
          <p className="text-gray-500 text-sm mt-1">{t('auth_register_subtitle')}</p>
        </div>

        <form onSubmit={submit} className="card p-8 space-y-4">
          {error && (
            <div className="bg-red-900/30 border border-red-800 text-red-400 rounded-xl px-4 py-3 text-sm">
              {error}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="label">{t('auth_register_name')}</label>
            <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              className="input" placeholder="John Doe" required autoComplete="name" />
          </div>

          {/* Email */}
          <div>
            <label className="label">{t('auth_login_email')}</label>
            <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              className="input" placeholder="you@example.com" required autoComplete="email" />
          </div>

          {/* Country picker */}
          <div>
            <label className="label">{t('auth_register_country')}</label>
            <div className="relative">
              <button type="button" onClick={() => setShowCountry(v => !v)}
                className="input flex items-center justify-between cursor-pointer">
                <span className="flex items-center gap-2">
                  <span>{selectedCountry.flag}</span>
                  <span>{selectedCountry.name}</span>
                </span>
                <ChevronDown className="w-4 h-4 text-gray-500" />
              </button>
              {showCountry && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-gray-900 border border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden">
                  <div className="p-2 border-b border-gray-700">
                    <input
                      value={countrySearch}
                      onChange={e => setCountrySearch(e.target.value)}
                      placeholder="Search country..."
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
                      autoFocus
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {filteredCountries.map(c => (
                      <button key={c.code} type="button"
                        onClick={() => { setForm(p => ({ ...p, country_code: c.code })); setShowCountry(false); setCountrySearch(''); }}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-800 transition-colors ${form.country_code === c.code ? 'text-green-400' : 'text-gray-300'}`}>
                        <span>{c.flag}</span>
                        <span>{c.name}</span>
                        <span className="ml-auto text-gray-600 text-xs">{c.currency}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Phone */}
          <div>
            <label className="label">{t('auth_register_phone')}</label>
            <div className="flex gap-2">
              <div className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-gray-400 text-sm whitespace-nowrap">
                {selectedCountry.dialCode}
              </div>
              <input
                value={form.phone}
                onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                className="input flex-1"
                placeholder="Phone number"
                type="tel"
                autoComplete="tel"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="label">{t('auth_login_password')}</label>
            <input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
              className="input" placeholder="Min 8 chars" required minLength={8} autoComplete="new-password" />
            {form.password && form.password.length > 0 && (
              <div className="flex gap-1 mt-2">
                {[form.password.length >= 8, /[A-Z]/.test(form.password), /[0-9]/.test(form.password), /[^A-Za-z0-9]/.test(form.password)].map((ok, i) => (
                  <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${ok ? 'bg-green-500' : 'bg-gray-700'}`} />
                ))}
              </div>
            )}
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3 mt-2">
            {loading ? t('auth_register_loading') : t('auth_register_button')}
          </button>

          <p className="text-center text-xs text-gray-600">18+ · Skill-based competitions only · <a href="#" className="underline">Terms</a></p>
          <p className="text-center text-gray-500 text-sm">
            {t('auth_register_have_account')}{' '}
            <Link href="/auth/login" className="text-green-400 hover:text-green-300 font-medium">
              {t('auth_register_signin')}
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
