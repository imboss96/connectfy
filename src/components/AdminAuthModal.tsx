import React, { FormEvent, useState } from 'react';
import { LockKeyhole, X } from 'lucide-react';

interface AdminAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (email: string, password: string) => Promise<void>;
}

export const AdminAuthModal: React.FC<AdminAuthModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await onSubmit(email.trim(), password);
      onClose();
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Admin authentication failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-cyan-700"><LockKeyhole className="h-5 w-5" /><span className="text-xs font-bold uppercase tracking-wider">Protected access</span></div>
            <h2 className="text-xl font-black text-slate-900">Admin workspace</h2>
            <p className="mt-1 text-sm text-slate-500">Authenticate before opening project operations.</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close admin authentication"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-xs font-bold text-slate-700">Admin email<input required type="email" value={email} onChange={event => setEmail(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-cyan-600" autoComplete="username" /></label>
          <label className="block text-xs font-bold text-slate-700">Password<input required type="password" value={password} onChange={event => setPassword(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-cyan-600" autoComplete="current-password" /></label>
          {error && <p className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700" role="alert">{error}</p>}
          <button disabled={isSubmitting} className="w-full rounded-xl bg-cyan-700 px-4 py-3 text-sm font-bold text-white transition hover:bg-cyan-800 disabled:opacity-60">{isSubmitting ? 'Verifying access...' : 'Open admin dashboard'}</button>
        </form>
      </div>
    </div>
  );
};
