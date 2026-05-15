'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ShieldCheck, Eye, EyeOff, ArrowLeft, CheckCircle, ArrowRight } from 'lucide-react';
import api from '@/lib/api';

export default function ResetPasswordPage() {
  const router  = useRouter();
  const params  = useSearchParams();
  const email   = params.get('email') || '';

  const [otp,      setOtp]      = useState(['', '', '', '', '', '']);
  const [form,     setForm]     = useState({ password: '', confirm: '' });
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [success,  setSuccess]  = useState(false);
  const [showPass, setShowPass] = useState(false);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => { if (!email) router.push('/auth/forgot-password'); }, [email]);

  const handleOtpChange = (i: number, val: string) => {
    if (!/^\d*$/.test(val)) return;
    const next = [...otp];
    next[i] = val.slice(-1);
    setOtp(next);
    if (val && i < 5) inputs.current[i + 1]?.focus();
  };

  const handleOtpKey = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[i] && i > 0) inputs.current[i - 1]?.focus();
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setOtp(pasted.split(''));
      inputs.current[5]?.focus();
    }
  };

  const passwordStrength = (p: string) => {
    let s = 0;
    if (p.length >= 8) s++;
    if (/[A-Z]/.test(p)) s++;
    if (/[0-9]/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    return s;
  };
  const strength = passwordStrength(form.password);
  const strengthColor = ['', 'bg-red-500', 'bg-yellow-500', 'bg-blue-500', 'bg-green-500'][strength];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirm) { setError("Passwords don't match"); return; }
    if (form.password.length < 8) { setError('Password must be at least 8 characters'); return; }
    const otpCode = otp.join('');
    if (otpCode.length < 6) { setError('Enter the 6-digit OTP code'); return; }
    setLoading(true); setError('');
    try {
      await api.post('/auth/reset-password', { email, otp: otpCode, new_password: form.password });
      setSuccess(true);
      setTimeout(() => router.push('/auth/login'), 2500);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Reset failed. Check your OTP and try again.');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md animate-slide-up">

        <Link href="/auth/forgot-password" className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-300 text-sm mb-8 transition-colors group">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Back
        </Link>

        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-500/10 border border-green-800/30 flex items-center justify-center mb-6">
          <ShieldCheck className="w-7 h-7 text-green-400" />
        </div>

        {success ? (
          <div className="animate-slide-up text-center py-8">
            <div className="w-16 h-16 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
            <h2 className="text-2xl font-black text-white mb-2">Password reset!</h2>
            <p className="text-gray-400 text-sm">Redirecting you to login…</p>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-black text-white mb-1">Reset password</h1>
            <p className="text-gray-400 text-sm mb-6">
              Enter the code sent to <span className="text-white font-medium">{email}</span>
            </p>

            {error && (
              <div className="mb-5 flex items-center gap-3 bg-red-900/20 border border-red-800/50 text-red-400 rounded-2xl px-4 py-3 text-sm">
                <span className="w-5 h-5 rounded-full border border-red-500/50 flex items-center justify-center text-xs shrink-0">!</span>
                {error}
              </div>
            )}

            <form onSubmit={submit} className="space-y-5">

              {/* OTP boxes */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-3">6-digit OTP code</label>
                <div className="flex gap-2 justify-between" onPaste={handleOtpPaste}>
                  {otp.map((digit, i) => (
                    <input key={i}
                      ref={el => { inputs.current[i] = el; }}
                      type="text" inputMode="numeric" maxLength={1}
                      value={digit}
                      onChange={e => handleOtpChange(i, e.target.value)}
                      onKeyDown={e => handleOtpKey(i, e)}
                      className={`w-12 h-14 text-center text-xl font-black rounded-2xl border bg-gray-900
                                  focus:outline-none focus:ring-2 transition-all
                                  ${digit ? 'border-green-500 text-green-400 focus:ring-green-500/20' : 'border-gray-700 text-white focus:border-green-500 focus:ring-green-500/20'}`}
                    />
                  ))}
                </div>
              </div>

              {/* New password */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">New password</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'} value={form.password}
                    onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                    placeholder="Min. 8 characters" required autoComplete="new-password"
                    className="w-full bg-gray-900 border border-gray-700 rounded-2xl px-4 py-3.5 pr-12 text-white placeholder-gray-600
                               focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20
                               hover:border-gray-600 transition-all text-sm"
                  />
                  <button type="button" onClick={() => setShowPass(v => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {form.password && (
                  <div className="mt-2 flex gap-1">
                    {[1,2,3,4].map(i => (
                      <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i <= strength ? strengthColor : 'bg-gray-700'}`} />
                    ))}
                  </div>
                )}
              </div>

              {/* Confirm */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Confirm password</label>
                <input
                  type="password" value={form.confirm}
                  onChange={e => setForm(p => ({ ...p, confirm: e.target.value }))}
                  placeholder="Repeat password" required autoComplete="new-password"
                  className={`w-full bg-gray-900 border rounded-2xl px-4 py-3.5 text-white placeholder-gray-600
                              focus:outline-none focus:ring-2 transition-all text-sm
                              ${form.confirm && form.confirm !== form.password
                                ? 'border-red-600 focus:border-red-500 focus:ring-red-500/20'
                                : 'border-gray-700 focus:border-green-500 focus:ring-green-500/20 hover:border-gray-600'}`}
                />
                {form.confirm && form.confirm !== form.password && (
                  <p className="text-xs text-red-400 mt-1">Passwords don't match</p>
                )}
              </div>

              <button type="submit" disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500
                           disabled:opacity-50 text-white font-bold py-3.5 rounded-2xl transition-all hover:-translate-y-0.5 mt-2">
                {loading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    Resetting…
                  </>
                ) : (
                  <>Set new password <ArrowRight className="w-4 h-4" /></>
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
