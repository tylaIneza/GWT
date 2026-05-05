import Link from 'next/link';
import { Code2, Trophy, Wallet, Shield, Zap, Users } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-950">
      {/* Nav */}
      <nav className="border-b border-gray-800 px-6 py-4 flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-green-500 to-emerald-700 flex items-center justify-center font-black text-lg">C</div>
          <span className="font-bold text-white text-xl">CodeArena</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/auth/login"    className="btn-ghost text-sm">Sign In</Link>
          <Link href="/auth/register" className="btn-primary text-sm">Get Started Free</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 py-24 text-center">
        <div className="inline-flex items-center gap-2 bg-green-900/30 border border-green-800/50 text-green-400 rounded-full px-4 py-1.5 text-sm font-medium mb-6">
          <Zap className="w-3.5 h-3.5" /> Skill-based · Not gambling
        </div>
        <h1 className="text-5xl sm:text-6xl font-black text-white leading-tight mb-6">
          Code Your Way<br />
          <span className="bg-gradient-to-r from-green-400 to-emerald-500 bg-clip-text text-transparent">
            To Real Rewards
          </span>
        </h1>
        <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-10">
          Solve coding challenges, compete in contests, and earn real money through pure skill.
          Deposit & withdraw via MTN MoMo and Airtel Money.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/auth/register" className="btn-primary px-8 py-3 text-base">Start Competing →</Link>
          <Link href="/challenges"    className="btn-secondary px-8 py-3 text-base">Browse Challenges</Link>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            { icon: Code2,   title: 'Monaco Editor',        desc: 'Professional code editor with syntax highlighting for JavaScript and Python.' },
            { icon: Shield,  title: 'Anti-Cheat System',    desc: 'Behavior tracking, plagiarism detection, and device fingerprinting keep competitions fair.' },
            { icon: Trophy,  title: 'Paid Contests',        desc: 'Entry-fee contests with prize pools distributed to top performers by score and speed.' },
            { icon: Wallet,  title: 'Mobile Money Payouts', desc: 'Deposit and withdraw via MTN MoMo or Airtel Money. Fast, secure, local.' },
            { icon: Zap,     title: 'Sandboxed Execution',  desc: 'Code runs in isolated Docker containers with CPU, memory, and time limits.' },
            { icon: Users,   title: 'Live Leaderboards',    desc: 'Real-time rankings during contests — ranked by score first, then by speed.' },
          ].map((f) => (
            <div key={f.title} className="card p-6 space-y-3">
              <div className="w-10 h-10 bg-green-900/30 border border-green-800/30 rounded-xl flex items-center justify-center">
                <f.icon className="w-5 h-5 text-green-400" />
              </div>
              <h3 className="font-bold text-white">{f.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-3xl mx-auto px-6 py-16 text-center">
        <div className="card p-10 bg-gradient-to-br from-green-900/20 to-emerald-900/10 border-green-800/30">
          <h2 className="text-3xl font-black text-white mb-3">Ready to Compete?</h2>
          <p className="text-gray-400 mb-6">Free to register · 1,000 practice coins on signup</p>
          <Link href="/auth/register" className="btn-primary px-8 py-3 text-base inline-flex">
            Create Free Account →
          </Link>
        </div>
      </section>

      <footer className="border-t border-gray-800 text-center py-6 text-gray-600 text-sm">
        © 2025 CodeArena · Skill-based competitions · Rwanda
      </footer>
    </div>
  );
}
