'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Mail, ArrowRight, KeyRound } from 'lucide-react';
import api from '@/lib/api';

export default function ForgotPasswordPage() {
  const router     = useRouter();
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
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to send reset code');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md animate-slide-up">

        {/* Back */}
        <Link href="/auth/login" className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-300 text-sm mb-8 transition-colors group">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Back to login
        </Link>

        {/* Icon */}
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-500/10 border border-green-800/30 flex items-center justify-center mb-6">
          <KeyRound className="w-7 h-7 text-green-400" />
        </div>

        {sent ? (
          <div className="animate-slide-up">
            <h1 className="text-2xl font-black text-white mb-2">Check your inbox</h1>
            <p className="text-gray-400 text-sm mb-6 leading-relaxed">
              We sent a reset code to <span className="text-white font-medium">{email}</span>.
              If email is unavailable, check the backend console logs for the OTP.
            </p>
            <div className="bg-green-900/20 border border-green-800/40 rounded-2xl p-4 mb-6">
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-green-400 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-green-300">Reset code sent</p>
                  <p className="text-xs text-gray-500 mt-0.5">Check your email or backend terminal for the OTP code</p>
                </div>
              </div>
            </div>
            <button onClick={() => router.push(`/auth/reset-password?email=${encodeURIComponent(email)}`)}
              className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white font-bold py-3.5 rounded-2xl transition-all hover:-translate-y-0.5">
              Enter reset code <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-black text-white mb-2">Forgot password?</h1>
            <p className="text-gray-400 text-sm mb-6">Enter your email and we'll send you a reset code.</p>

            {error && (
              <div className="mb-5 flex items-center gap-3 bg-red-900/20 border border-red-800/50 text-red-400 rounded-2xl px-4 py-3 text-sm">
                <span className="w-5 h-5 rounded-full border border-red-500/50 flex items-center justify-center text-xs shrink-0">!</span>
                {error}
              </div>
            )}

            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Email address</label>
                <input
                  type="email" value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com" required autoFocus
                  className="w-full bg-gray-900 border border-gray-700 rounded-2xl px-4 py-3.5 text-white placeholder-gray-600
                             focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20
                             hover:border-gray-600 transition-all text-sm"
                />
              </div>
              <button type="submit" disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500
                           disabled:opacity-50 text-white font-bold py-3.5 rounded-2xl transition-all hover:-translate-y-0.5">
                {loading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    Sending…
                  </>
                ) : (
                  <>Send reset code <ArrowRight className="w-4 h-4" /></>
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
