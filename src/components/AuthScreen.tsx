import React, { useState } from 'react';
import { ArrowRight, CheckCircle2, Eye, Lock, Mail, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';

interface AuthScreenProps {
  onOpenSharedToken: (token: string) => void;
}

export function AuthScreen({ onOpenSharedToken }: AuthScreenProps) {
  const {
    signInWithGoogle,
    signInWithEmail,
    registerWithEmail,
    authError,
    clearAuthError,
  } = useAuth();

  const [mode, setMode] = useState<'signin' | 'register'>('signin');
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sharedInput, setSharedInput] = useState('');
  const [sharedInputError, setSharedInputError] = useState<string | null>(null);

  const handleGoogle = async () => {
    setSubmitting(true);
    try {
      await signInWithGoogle();
    } catch {
      // Handled by context
    } finally {
      setSubmitting(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (mode === 'register') {
        await registerWithEmail(name, email, password);
      } else {
        await signInWithEmail(email, password);
      }
    } catch {
      // Handled by context
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenShared = (e: React.FormEvent) => {
    e.preventDefault();
    setSharedInputError(null);
    const raw = sharedInput.trim();
    if (!raw) return;

    let token = raw;
    const match = raw.match(/\/view\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      token = match[1];
    }
    if (token.length < 6) {
      setSharedInputError('Please paste a valid TrackMo family share link.');
      return;
    }
    onOpenSharedToken(token);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col">
      {/* Top Bar following 3-Zone Contract */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white">
        <a
          href="/"
          className="text-lg font-bold tracking-tight text-slate-900"
        >
          TrackMo
        </a>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          <a href="#how-it-works" className="hover:text-slate-900 transition-colors">
            How It Works
          </a>
          <a href="#family-sharing" className="hover:text-slate-900 transition-colors">
            Family Sharing
          </a>
          <a href="#monthly-carry" className="hover:text-slate-900 transition-colors">
            Monthly Rollover
          </a>
          <a href="#open-link" className="hover:text-slate-900 transition-colors">
            Open Shared Link
          </a>
        </nav>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleGoogle}
            disabled={submitting}
            className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap"
          >
            Sign In
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-10 sm:py-16 grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        {/* Left Column: Value Proposition & Live Ledger Preview */}
        <div className="lg:col-span-7 space-y-8">
          <div className="space-y-4">
            <div className="text-xs font-semibold text-emerald-700">
              Private Family Money Ledger
            </div>
            <h1
              className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 leading-tight"
              style={{ textWrap: 'balance' }}
            >
              Track allowance received from home and share a clear live view with
              family.
            </h1>
            <p className="text-base text-slate-600 leading-relaxed max-w-xl">
              Record money received from your parents, log daily expenses in
              seconds, and share a read-only live link so your family always sees
              how much remains—without needing an account.
            </p>
          </div>

          {/* Interactive Example Ledger Preview */}
          <div
            id="how-it-works"
            className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <div className="text-xs font-medium text-slate-500">
                  Available Balance
                </div>
                <div className="text-3xl font-bold font-mono-tabular text-slate-900 mt-0.5">
                  ₹18,450
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  ₹20,000 received this month + ₹5,000 carried forward − ₹6,550
                  spent
                </div>
              </div>
              <div className="text-right hidden sm:block">
                <span className="text-xs text-slate-500">October 2026</span>
              </div>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between py-1.5">
                <div className="flex items-center gap-3">
                  <span className="text-base">🍔</span>
                  <div>
                    <div className="font-semibold text-slate-900">
                      Food · Lunch with friends
                    </div>
                    <div className="text-slate-500">Oct 2 · UPI</div>
                  </div>
                </div>
                <span className="font-mono-tabular font-semibold text-slate-900">
                  -₹350
                </span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-t border-slate-100">
                <div className="flex items-center gap-3">
                  <span className="text-base">🚕</span>
                  <div>
                    <div className="font-semibold text-slate-900">
                      Travel · Uber to college
                    </div>
                    <div className="text-slate-500">Oct 2 · UPI</div>
                  </div>
                </div>
                <span className="font-mono-tabular font-semibold text-slate-900">
                  -₹180
                </span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-t border-slate-100">
                <div className="flex items-center gap-3">
                  <span className="text-base">🟢</span>
                  <div>
                    <div className="font-semibold text-slate-900">
                      Dad — Money Received
                    </div>
                    <div className="text-slate-500">
                      Oct 1 · October allowance
                    </div>
                  </div>
                </div>
                <span className="font-mono-tabular font-semibold text-emerald-700">
                  +₹20,000
                </span>
              </div>
            </div>
          </div>

          {/* Key Principles */}
          <div
            id="family-sharing"
            className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                5-Second Clarity
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Parents immediately see money left, money received, and where it
                was spent.
              </p>
            </div>

            <div id="monthly-carry" className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                Auto Carry-Forward
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Each month&apos;s remaining balance automatically becomes next
                month&apos;s starting balance.
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                Read-Only Sharing
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Share a private live link on WhatsApp. Viewers never need to
                create an account.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Authentication Card & Viewer Link Opener */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 space-y-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                {showEmailForm
                  ? mode === 'register'
                    ? 'Create your ledger account'
                    : 'Sign in to your ledger'
                  : 'Get started with TrackMo'}
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Each family member has a completely private, independent ledger.
              </p>
            </div>

            {authError && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs font-medium text-red-700">
                {authError}
              </div>
            )}

            {/* Primary Google Sign-In Button */}
            <button
              type="button"
              onClick={handleGoogle}
              disabled={submitting}
              className="w-full min-h-[48px] px-4 py-3 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-3 transition-colors disabled:opacity-50"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#ffffff"
                  d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 15.25 5 12c0-3.25 3.36-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81Z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>

            <div className="relative flex items-center justify-center">
              <div className="border-t border-slate-200 w-full" />
              <span className="bg-white px-3 text-xs text-slate-400 whitespace-nowrap">
                or email &amp; password
              </span>
              <div className="border-t border-slate-200 w-full" />
            </div>

            {!showEmailForm ? (
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    clearAuthError();
                    setMode('signin');
                    setShowEmailForm(true);
                  }}
                  className="min-h-[42px] px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors whitespace-nowrap"
                >
                  Sign In with Email
                </button>
                <button
                  type="button"
                  onClick={() => {
                    clearAuthError();
                    setMode('register');
                    setShowEmailForm(true);
                  }}
                  className="min-h-[42px] px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors whitespace-nowrap"
                >
                  Create Account
                </button>
              </div>
            ) : (
              <form onSubmit={handleEmailSubmit} className="space-y-4">
                {mode === 'register' && (
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Your Name
                    </label>
                    <div className="relative flex items-center">
                      <User className="w-4 h-4 text-slate-400 absolute left-3.5" />
                      <input
                        type="text"
                        required
                        placeholder="e.g. Divyam"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:border-slate-900"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Email Address
                  </label>
                  <div className="relative flex items-center">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5" />
                    <input
                      type="email"
                      required
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:border-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Password
                  </label>
                  <div className="relative flex items-center">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5" />
                    <input
                      type="password"
                      required
                      minLength={6}
                      placeholder="At least 6 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:border-slate-900"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full min-h-[44px] py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-colors disabled:opacity-50"
                >
                  {submitting
                    ? 'Please wait...'
                    : mode === 'register'
                      ? 'Create Account'
                      : 'Sign In'}
                </button>

                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      clearAuthError();
                      setMode(mode === 'signin' ? 'register' : 'signin');
                    }}
                    className="text-xs text-slate-600 hover:text-slate-900 font-medium"
                  >
                    {mode === 'signin'
                      ? "Don't have an account? Create one"
                      : 'Already have an account? Sign in'}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Viewer Quick Access Card */}
          <div
            id="open-link"
            className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3"
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Eye className="w-4 h-4 text-slate-600" />
              <span>Viewing a family member&apos;s ledger?</span>
            </div>
            <p className="text-xs text-slate-500">
              Paste their shared link or token below to open the read-only view
              without logging in.
            </p>
            {sharedInputError && (
              <p className="text-xs text-red-600">{sharedInputError}</p>
            )}
            <form onSubmit={handleOpenShared} className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Paste /view/abc123xyz link..."
                value={sharedInput}
                onChange={(e) => setSharedInput(e.target.value)}
                className="flex-1 px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:border-slate-900"
              />
              <button
                type="submit"
                className="min-h-[38px] px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1 transition-colors whitespace-nowrap"
              >
                <span>Open</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
