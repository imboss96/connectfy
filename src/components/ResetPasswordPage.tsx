import React, { FormEvent, useState } from 'react';
import { ArrowLeft, ArrowRight, Eye, EyeOff, LockKeyhole, ShieldCheck } from 'lucide-react';
import { ConnectfyLogo } from './UTestLogo';

interface ResetPasswordPageProps {
  onSubmit: (password: string) => Promise<void>;
  onBackToLogin: () => void;
}

export const ResetPasswordPage: React.FC<ResetPasswordPageProps> = ({ onSubmit, onBackToLogin }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setError('');
    setMessage('');
    setIsSubmitting(true);

    try {
      await onSubmit(password);
      setMessage('Password updated successfully. You can now sign in with your new password.');
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : 'Unable to update your password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-page min-h-screen">
      <div className="login-panel">
        <div className="login-brand-row">
          <button type="button" onClick={onBackToLogin} className="login-back-button">
            <ArrowLeft /> Back to sign in
          </button>
          <ConnectfyLogo size="md" />
        </div>

        <div className="login-heading">
          <p className="login-kicker">Secure access</p>
          <h1>Set a new password.</h1>
          <p>Create a strong password to keep your Connectfy account secure.</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <label>
            New password
            <span className="login-input-wrap">
              <LockKeyhole />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={event => setPassword(event.target.value)}
                placeholder="Enter a new password"
                autoComplete="new-password"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                {showPassword ? <EyeOff /> : <Eye />}
              </button>
            </span>
          </label>

          <label>
            Confirm new password
            <span className="login-input-wrap">
              <LockKeyhole />
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={event => setConfirmPassword(event.target.value)}
                placeholder="Repeat your new password"
                autoComplete="new-password"
              />
            </span>
          </label>

          {error && <p className="login-error" role="alert">{error}</p>}
          {message && <p className="login-success" role="status">{message}</p>}

          <button type="submit" className="login-submit" disabled={isSubmitting}>
            {isSubmitting ? 'Updating password...' : 'Update password'}
            {!isSubmitting && <ArrowRight />}
          </button>
        </form>

        <div className="login-trust">
          <ShieldCheck /> Keep your account protected with a unique password.
        </div>
      </div>

      <div className="login-art" aria-hidden="true">
        <div className="login-art-glow" />
        <div className="login-art-card">
          <span>Connectfy workspace</span>
          <strong>Security that keeps your work moving.</strong>
          <div>
            <i />
            <i />
            <i />
          </div>
        </div>
      </div>
    </div>
  );
};
