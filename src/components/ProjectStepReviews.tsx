import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Check, RefreshCw, RotateCcw } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface PendingStepReview {
  project_id: string;
  tester_id: string;
  project_title: string;
  tester_name: string;
  tester_email: string;
  step_id: string;
  updated_at: string;
  latest_note: string | null;
}

const stepLabels: Record<string, string> = {
  slack: 'Join the Connectfy Slack team and say hi',
  consent: 'Sign the project consent',
  languageSettings: 'Submit the language settings video',
  recordings: 'Complete the Google Selfie Collection tasks'
};

const formatDateTime = (value: string) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
};

export const ProjectStepReviews: React.FC = () => {
  const [reviews, setReviews] = useState<PendingStepReview[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [savingKey, setSavingKey] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    if (!supabase) {
      setError('Project step review is unavailable because Supabase is not configured.');
      setReviews([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError('');
    const { data, error: queryError } = await supabase.rpc('fetch_pending_project_step_reviews');
    if (queryError) {
      console.error('Unable to load pending project step reviews:', queryError);
      setError(queryError.message);
      setReviews([]);
    } else {
      setReviews((data || []) as PendingStepReview[]);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const decide = async (review: PendingStepReview, approved: boolean) => {
    if (!supabase) return;
    const key = `${review.project_id}:${review.tester_id}:${review.step_id}`;
    if (!approved && !notes[key]?.trim()) {
      setError('Add a review note explaining the requested changes.');
      return;
    }
    setSavingKey(key);
    setError('');
    setNotice('');
    const { error: decisionError } = await supabase.rpc('review_project_step', {
      p_project_id: review.project_id,
      p_tester_id: review.tester_id,
      p_step_id: review.step_id,
      p_approved: approved,
      p_note: notes[key]?.trim() || ''
    });
    if (decisionError) {
      console.error('Unable to save project step review:', decisionError);
      setError(decisionError.message);
    } else {
      setNotice(approved
        ? `Approved ${stepLabels[review.step_id] || 'project step'} for ${review.tester_name}.`
        : `Requested changes to ${stepLabels[review.step_id] || 'project step'} for ${review.tester_name}.`);
      setNotes((current) => ({ ...current, [key]: '' }));
      await refresh();
    }
    setSavingKey('');
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">Project workflow</p>
          <h1 className="mt-1 text-2xl font-black text-slate-900">Step approvals</h1>
          <p className="mt-1 text-sm text-slate-600">Approve or request changes for each tester checklist step. Approval unlocks the next step.</p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={isLoading}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </header>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </div>
      )}
      {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}

      {isLoading && reviews.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Loading pending steps…</p>
      ) : reviews.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          There are no steps waiting for approval.
        </p>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => {
            const key = `${review.project_id}:${review.tester_id}:${review.step_id}`;
            return (
              <article key={key} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-bold text-slate-900">{stepLabels[review.step_id] || review.step_id}</h2>
                    <p className="mt-1 text-sm text-slate-600">{review.tester_name} · {review.tester_email}</p>
                    <p className="text-xs text-slate-500">{review.project_title} · Submitted {formatDateTime(review.updated_at)}</p>
                  </div>
                  <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">Awaiting review</span>
                </div>
                {review.latest_note && (
                  <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                    Previous feedback: {review.latest_note}
                  </p>
                )}
                <label className="mt-4 block text-xs font-semibold text-slate-700">
                  Review note
                  <textarea
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-800 focus:border-blue-500 focus:outline-none"
                    rows={2}
                    maxLength={2000}
                    value={notes[key] || ''}
                    onChange={(event) => setNotes((current) => ({ ...current, [key]: event.target.value }))}
                    placeholder="Optional on approval; explain what needs to change when returning the step."
                  />
                </label>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                    disabled={Boolean(savingKey)}
                    onClick={() => void decide(review, true)}
                  >
                    <Check className="h-4 w-4" /> Approve and unlock next step
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                    disabled={Boolean(savingKey) || !notes[key]?.trim()}
                    onClick={() => void decide(review, false)}
                  >
                    <RotateCcw className="h-4 w-4" /> Request changes
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
