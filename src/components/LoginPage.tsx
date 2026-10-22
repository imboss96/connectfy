import React, { FormEvent, useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, Video, X } from 'lucide-react';
import { ConnectfyLogo } from './UTestLogo';

const SLACK_INVITE_URL = 'https://join.slack.com/t/connectfyops/shared_invite/zt-4cmuhc6av-4dwkrhonBEtgxVaHBW6tJQ';
const UTEST_GUIDE_SEEN_KEY = 'connectfy_utest_signup_guide_seen';
const UTEST_GUIDE_VIDEO_URL = 'https://www.youtube.com/watch?v=F_XmEVQZaHc';

interface LoginPageProps {
  onLogin: (email: string, password: string) => Promise<void>;
  onSignUp: (name: string, email: string, password: string) => Promise<void>;
  onGoogleAuth: (intent: 'login' | 'signup') => Promise<void>;
  onResetPassword: (email: string) => Promise<void>;
  onBackToLanding: () => void;
  initialMode?: 'login' | 'signup';
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin, onSignUp, onGoogleAuth, onResetPassword, onBackToLanding, initialMode = 'login' }) => {
  const [isSignUp, setIsSignUp] = useState(initialMode === 'signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUtestGuideOpen, setIsUtestGuideOpen] = useState(false);

  useEffect(() => {
    if (isSignUp && localStorage.getItem(UTEST_GUIDE_SEEN_KEY) !== 'true') {
      setIsUtestGuideOpen(true);
    }
  }, [isSignUp]);

  useEffect(() => {
    if (!isUtestGuideOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        localStorage.setItem(UTEST_GUIDE_SEEN_KEY, 'true');
        setIsUtestGuideOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isUtestGuideOpen]);

  const closeUtestGuide = () => {
    localStorage.setItem(UTEST_GUIDE_SEEN_KEY, 'true');
    setIsUtestGuideOpen(false);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!email.trim() || !email.includes('@')) {
      setError('Enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (isSignUp && !name.trim()) {
      setError('Enter your name to create an account.');
      return;
    }
    if (isSignUp && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setError('');
    setMessage('');
    setIsSubmitting(true);
    try {
      if (isSignUp) await onSignUp(name.trim(), email.trim(), password);
      else await onLogin(email.trim(), password);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Unable to sign in.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email.trim() || !email.includes('@')) {
      setError('Enter your email address first.');
      return;
    }
    setError('');
    setMessage('');
    setIsSubmitting(true);
    try {
      await onResetPassword(email.trim());
      setMessage('Password reset instructions have been sent to your email.');
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : 'Unable to send reset instructions.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleAuth = async () => {
    setError('');
    setMessage('');
    setIsSubmitting(true);
    try {
      await onGoogleAuth(isSignUp ? 'signup' : 'login');
    } catch (googleError) {
      setError(googleError instanceof Error ? googleError.message : 'Unable to continue with Google.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-page min-h-screen">
      <div className="login-panel">
        <div className="login-brand-row"><button type="button" onClick={onBackToLanding} className="login-back-button"><ArrowLeft /> Back to home</button><ConnectfyLogo size="md" /></div>
        <div className="login-heading">
          <p className="login-kicker">{isSignUp ? 'Join Connectfy' : 'Welcome back'}</p>
          <h1>{isSignUp ? 'Start shaping better work.' : 'Connect to better work.'}</h1>
          <p>{isSignUp ? 'Create your Connectfy account and find flexible opportunities that match your skills.' : 'Sign in to manage your testing projects, submissions, earnings, and profile.'}</p>
        </div>

        {isSignUp && <button type="button" className="utest-guide-link" onClick={() => setIsUtestGuideOpen(true)}><Video /> Watch the uTest account setup guide</button>}
        {isSignUp && (
          <p className="utest-signup-notice">
            Most of our projects are carried out through uTest and require a valid uTest account. Create your uTest account, then add your uTest ID to your Connectfy profile under Profile Settings so we can match you with eligible projects. Check each project listing for its specific requirements.
          </p>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          {isSignUp && <label>
            Full name
            <span className="login-input-wrap"><input type="text" value={name} onChange={event => setName(event.target.value)} placeholder="Your full name" autoComplete="name" /></span>
          </label>}
          {isSignUp && (
            <div className="rounded-xl border border-purple-200 bg-purple-50 p-3 text-sm text-purple-950">
              <p className="font-semibold">Join the Connectfy Slack team</p>
              <p className="mt-1 text-xs leading-relaxed">After creating your account, accept the Slack invitation using the same email address so the testing team can find you.</p>
              <a
                href={SLACK_INVITE_URL}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 font-bold text-purple-800 underline underline-offset-2"
              >
                Open Slack invitation <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </div>
          )}
          <label>
            Email address
            <span className="login-input-wrap"><Mail /><input type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" /></span>
          </label>
          {isSignUp && <label>
            Confirm password
            <span className="login-input-wrap"><LockKeyhole /><input type="password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} placeholder="Repeat your password" autoComplete="new-password" /></span>
          </label>}
          <label>
            Password
            <span className="login-input-wrap"><LockKeyhole /><input type={showPassword ? 'text' : 'password'} value={password} onChange={event => setPassword(event.target.value)} placeholder="Enter your password" autoComplete="current-password" /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff /> : <Eye />}</button></span>
          </label>
          {error && <p className="login-error" role="alert">{error}</p>}
          {message && <p className="login-success" role="status">{message}</p>}
          {!isSignUp && <div className="login-options"><label className="login-checkbox"><input type="checkbox" /> Keep me signed in</label><button type="button" className="login-link" onClick={handleResetPassword}>Forgot password?</button></div>}
          <button type="submit" className="login-submit" disabled={isSubmitting}>{isSubmitting ? 'Please wait...' : isSignUp ? 'Create account' : 'Sign in'} {!isSubmitting && <ArrowRight />}</button>
        </form>

        <div className="my-5 flex items-center gap-3 text-xs text-slate-400" aria-hidden="true">
          <span className="h-px flex-1 bg-slate-200" />
          <span>or continue with</span>
          <span className="h-px flex-1 bg-slate-200" />
        </div>
        <button
          type="button"
          onClick={() => void handleGoogleAuth()}
          disabled={isSubmitting}
          className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <svg aria-hidden="true" viewBox="0 0 48 48" className="h-5 w-5">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" transform="translate(0 4)" />
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.76 7.18l7.73 6C44.42 38.05 46.98 31.89 46.98 24.55Z" />
            <path fill="#FBBC05" d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.13.76-4.59l-7.98-6.2A23.9 23.9 0 0 0 0 24c0 3.88.93 7.57 2.56 10.78l7.97-6.19Z" transform="translate(0 4)" />
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.14 1.44-4.89 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z" transform="translate(0 -4)" />
          </svg>
          {isSubmitting ? 'Connecting to Google…' : `${isSignUp ? 'Sign up' : 'Sign in'} with Google`}
        </button>

        <p className="login-signup">{isSignUp ? 'Already have an account?' : 'New to Connectfy?'} <button type="button" onClick={() => { setIsSignUp(!isSignUp); setError(''); }}>{isSignUp ? 'Sign in' : 'Create an account'}</button></p>
        <div className="login-trust"><ShieldCheck /> Secure workspace access for testers, clients, and operations teams.</div>
      </div>
      <div className="login-art" aria-hidden="true"><div className="login-art-glow" /><div className="login-art-card"><span>Connectfy workspace</span><strong>Build better digital experiences together.</strong><div><i /><i /><i /></div></div></div>
      {isUtestGuideOpen && (
        <div className="utest-guide-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) closeUtestGuide(); }}>
          <section className="utest-guide-dialog" role="dialog" aria-modal="true" aria-labelledby="utest-guide-title">
            <button type="button" className="utest-guide-close" onClick={closeUtestGuide} aria-label="Close uTest account setup guide"><X /></button>
            <p className="login-kicker">Before you get started</p>
            <h2 id="utest-guide-title">Create your uTest account</h2>
            <p className="utest-guide-description">Most of our projects are carried out through uTest and require a valid uTest account. Follow the video to create your account, then add your uTest ID to your Connectfy profile under Profile Settings so we can match you with eligible projects. Check each project listing for its specific requirements.</p>
            <div className="utest-guide-video">
              <iframe
                src="https://www.youtube-nocookie.com/embed/F_XmEVQZaHc"
                title="How to create a uTest account"
                allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            </div>
            <div className="utest-guide-actions">
              <a href={UTEST_GUIDE_VIDEO_URL} target="_blank" rel="noreferrer">Open video on YouTube <ArrowRight /></a>
              <button type="button" onClick={closeUtestGuide}>Continue to signup</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
