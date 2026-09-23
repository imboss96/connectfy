import React, { FormEvent, useState } from 'react';
import { ArrowLeft, ArrowRight, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { ConnectfyLogo } from './UTestLogo';

interface LoginPageProps {
  onLogin: (email: string, password: string) => Promise<void>;
  onSignUp: (name: string, email: string, password: string) => Promise<void>;
  onGoogleLogin: () => Promise<void>;
  onResetPassword: (email: string) => Promise<void>;
  onBackToLanding: () => void;
  initialMode?: 'login' | 'signup';
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin, onSignUp, onGoogleLogin, onResetPassword, onBackToLanding, initialMode = 'login' }) => {
  const [isSignUp, setIsSignUp] = useState(initialMode === 'signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  return (
    <div className="login-page min-h-screen">
      <div className="login-panel">
        <div className="login-brand-row"><button type="button" onClick={onBackToLanding} className="login-back-button"><ArrowLeft /> Back to home</button><ConnectfyLogo size="md" /></div>
        <div className="login-heading">
          <p className="login-kicker">{isSignUp ? 'Join Connectfy' : 'Welcome back'}</p>
          <h1>{isSignUp ? 'Start shaping better work.' : 'Connect to better work.'}</h1>
          <p>{isSignUp ? 'Create your Connectfy account and find flexible opportunities that match your skills.' : 'Sign in to manage your testing projects, submissions, earnings, and profile.'}</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {isSignUp && <label>
            Full name
            <span className="login-input-wrap"><input type="text" value={name} onChange={event => setName(event.target.value)} placeholder="Your full name" autoComplete="name" /></span>
          </label>}
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

        <div className="login-divider"><span>or</span></div>
        <button type="button" disabled={isSubmitting} onClick={() => { setIsSubmitting(true); onGoogleLogin().catch(error => setError(error instanceof Error ? error.message : 'Unable to continue with Google.')).finally(() => setIsSubmitting(false)); }} className="login-google-button">
          <span className="login-google-mark" aria-hidden="true">G</span>
          Continue with Google
        </button>
        <p className="login-signup">{isSignUp ? 'Already have an account?' : 'New to Connectfy?'} <button type="button" onClick={() => { setIsSignUp(!isSignUp); setError(''); }}>{isSignUp ? 'Sign in' : 'Create an account'}</button></p>
        <div className="login-trust"><ShieldCheck /> Secure workspace access for testers, clients, and operations teams.</div>
      </div>
      <div className="login-art" aria-hidden="true"><div className="login-art-glow" /><div className="login-art-card"><span>Connectfy workspace</span><strong>Build better digital experiences together.</strong><div><i /><i /><i /></div></div></div>
    </div>
  );
};
