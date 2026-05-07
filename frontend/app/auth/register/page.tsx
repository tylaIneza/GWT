'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { setAuth } from '@/lib/auth';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await api.post('/auth/register', { ...form, country_code: 'RW' });
      setAuth(res.data.token, res.data.user);
      router.push('/dashboard');
    } catch (e: any) {
      setError(e.response?.data?.message || e.response?.data?.error || 'Registration failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-700 flex items-center justify-center font-black text-xl">C</div>
            <span className="font-bold text-white text-xl">CodeArena</span>
          </Link>
          <h1 className="text-2xl font-bold text-white">Create account</h1>
          <p className="text-gray-500 text-sm mt-1">Start competing for free</p>
        </div>

        <form onSubmit={submit} className="card p-8 space-y-4">
          {error && <div className="bg-red-900/30 border border-red-800 text-red-400 rounded-xl px-4 py-3 text-sm">{error}</div>}

          <div>
            <label className="label">Full Name</label>
            <input value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))}
              className="input" placeholder="Your name" required />
          </div>
          <div>
            <label className="label">Email</label>
            <input type="email" value={form.email} onChange={e => setForm(p => ({...p, email: e.target.value}))}
              className="input" placeholder="you@example.com" required />
          </div>
          <div>
            <label className="label">Phone (for MoMo/Airtel)</label>
            <input
              value={form.phone}
              onChange={e => {
                const v = e.target.value.replace(/[^\d]/g, '').slice(0, 10);
                setForm(p => ({...p, phone: v}));
              }}
              pattern="07[2-9][0-9]{7}"
              title="Enter a valid Rwandan phone number (07X XXXXXXX)"
              className="input" placeholder="07XXXXXXXX" />
            {form.phone && !/^07[2-9]\d{7}$/.test(form.phone) && form.phone.length > 2 && (
              <p className="text-xs text-red-400 mt-1">Must be 07X followed by 7 digits (e.g. 0781234567)</p>
            )}
          </div>
          <div>
            <label className="label">Password</label>
            <input type="password" value={form.password} onChange={e => setForm(p => ({...p, password: e.target.value}))}
              className="input" placeholder="Min 8 chars, uppercase + number" required minLength={8} />
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3 mt-2">
            {loading ? 'Creating account...' : 'Create Account & Compete'}
          </button>

          <p className="text-center text-xs text-gray-600 mt-2">Must be 18+ · Skill-based competitions only</p>
          <p className="text-center text-gray-500 text-sm">
            Have an account?{' '}
            <Link href="/auth/login" className="text-green-400 hover:text-green-300 font-medium">Sign in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
