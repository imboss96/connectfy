import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Check, CheckCheck, RefreshCw, RotateCcw, Search } from 'lucide-react';
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
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [savingKey, setSavingKey] = useState('');
  const [isBulkApproving, setIsBulkApproving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const reviewKey = (review: PendingStepReview) =>
    `${review.project_id}:${review.tester_id}:${review.step_id}`;
  const projects = Array.from(new Map(
    reviews.map((review) => [review.project_id, review.project_title])
  ).entries()).sort((left, right) => left[1].localeCompare(right[1]));
  const filteredReviews = reviews.filter((review) => {
    const query = search.trim().toLowerCase();
    return (!projectFilter || review.project_id === projectFilter)
      && (!query
        || (review.tester_name || '').toLowerCase().includes(query)
        || (review.tester_email || '').toLowerCase().includes(query));
  });
  const groupedReviews = Array.from(new Map(
    filteredReviews.map((review) => [review.project_id, {
      projectId: review.project_id,
      projectTitle: review.project_title,
      reviews: filteredReviews.filter((item) => item.project_id === review.project_id)
    }])
  ).values());
  const visibleSelectedCount = filteredReviews.filter((review) => selectedKeys.has(reviewKey(review))).length;
  const allVisibleSelected = filteredReviews.length > 0 && visibleSelectedCount === filteredReviews.length;

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
      const loadedReviews = (data || []) as PendingStepReview[];
      setReviews(loadedReviews);
      const loadedKeys = new Set(loadedReviews.map(reviewKey));
      setSelectedKeys((current) => new Set([...current].filter((key) => loadedKeys.has(key))));
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const decide = async (review: PendingStepReview, approved: boolean) => {
    if (!supabase) return;
    const key = reviewKey(review);
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

  const toggleSelected = (review: PendingStepReview) => {
    const key = reviewKey(review);
    setSelectedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleAllVisible = () => {
    setSelectedKeys((current) => {
      const next = new Set(current);
      if (allVisibleSelected) filteredReviews.forEach((review) => next.delete(reviewKey(review)));
      else filteredReviews.forEach((review) => next.add(reviewKey(review)));
      return next;
    });
  };

  const approveSelected = async () => {
    if (!supabase || visibleSelectedCount === 0) return;
    const selectedReviews = filteredReviews.filter((review) => selectedKeys.has(reviewKey(review)));
    setIsBulkApproving(true);
    setError('');
    setNotice('');

    let approvedCount = 0;
    const failures: string[] = [];
    const succeededKeys = new Set<string>();
    for (const review of selectedReviews) {
      const key = reviewKey(review);
      try {
        const { error: decisionError } = await supabase.rpc('review_project_step', {
          p_project_id: review.project_id,
          p_tester_id: review.tester_id,
          p_step_id: review.step_id,
          p_approved: true,
          p_note: notes[key]?.trim() || ''
        });
        if (decisionError) throw decisionError;
        approvedCount += 1;
        succeededKeys.add(key);
      } catch (decisionError) {
        console.error('Unable to save selected project step review:', decisionError);
        const message = decisionError instanceof Error ? decisionError.message : 'Approval failed.';
        failures.push(`${review.tester_name} (${review.tester_email}): ${message}`);
      }
    }

    setNotes((current) => {
      const next = { ...current };
      succeededKeys.forEach((key) => { next[key] = ''; });
      return next;
    });
    setSelectedKeys((current) => new Set([...current].filter((key) => !succeededKeys.has(key))));
    if (approvedCount > 0) {
      setNotice(`Approved ${approvedCount} of ${selectedReviews.length} selected step${selectedReviews.length === 1 ? '' : 's'}.`);
    }
    await refresh();
    if (failures.length > 0) {
      setError(`Could not approve ${failures.length} step${failures.length === 1 ? '' : 's'}: ${failures.join(' · ')}`);
    }
    setIsBulkApproving(false);
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">Project workflow</p>
          <h1 className="mt-1 text-2xl font-black text-slate-900">Step approvals</h1>
          <p className="mt-1 text-sm text-slate-600">Search by tester name or Gmail, then review steps individually or approve several at once. Approval unlocks the next step.</p>
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
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(220px,0.5fr)]">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setSelectedKeys(new Set());
                  }}
                  placeholder="Search tester name or Gmail"
                  aria-label="Search pending reviews by tester name or Gmail"
                  className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
                />
              </label>
              <label className="text-xs font-semibold text-slate-700">
                Filter by project
                <select
                  value={projectFilter}
                  onChange={(event) => {
                    setProjectFilter(event.target.value);
                    setSelectedKeys(new Set());
                  }}
                  aria-label="Filter pending reviews by project"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal text-slate-800 focus:border-blue-500 focus:outline-none"
                >
                  <option value="">All projects</option>
                  {projects.map(([projectId, projectTitle]) => (
                    <option key={projectId} value={projectId}>{projectTitle}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleAllVisible}
                  disabled={filteredReviews.length === 0 || isBulkApproving || Boolean(savingKey)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                Select all {filteredReviews.length} matching step{filteredReviews.length === 1 ? '' : 's'}
              </label>
              <button
                type="button"
                onClick={() => void approveSelected()}
                disabled={visibleSelectedCount === 0 || isBulkApproving || Boolean(savingKey)}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <CheckCheck className="h-4 w-4" />
                {isBulkApproving ? 'Approving…' : `Approve selected (${visibleSelectedCount})`}
              </button>
            </div>
          </section>
          {filteredReviews.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
              No pending reviews match that name or Gmail.
            </p>
          ) : groupedReviews.map((group) => (
            <section key={group.projectId} className="space-y-3">
              <h2 className="px-1 text-sm font-bold text-slate-700">
                {group.projectTitle}
                <span className="ml-2 font-medium text-slate-500">
                  {group.reviews.length} pending step{group.reviews.length === 1 ? '' : 's'}
                </span>
              </h2>
              {group.reviews.map((review) => {
                const key = reviewKey(review);
                return (
              <article key={key} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedKeys.has(key)}
                      onChange={() => toggleSelected(review)}
                      disabled={isBulkApproving || Boolean(savingKey)}
                      aria-label={`Select ${review.tester_name} ${review.tester_email}, ${stepLabels[review.step_id] || review.step_id}`}
                      className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <h3 className="font-bold text-slate-900">{stepLabels[review.step_id] || review.step_id}</h3>
                      <p className="mt-1 text-sm text-slate-600">{review.tester_name} · {review.tester_email}</p>
                      <p className="text-xs text-slate-500">Submitted {formatDateTime(review.updated_at)}</p>
                    </div>
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
                    disabled={Boolean(savingKey) || isBulkApproving}
                    onClick={() => void decide(review, true)}
                  >
                    <Check className="h-4 w-4" /> Approve and unlock next step
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                    disabled={Boolean(savingKey) || isBulkApproving || !notes[key]?.trim()}
                    onClick={() => void decide(review, false)}
                  >
                    <RotateCcw className="h-4 w-4" /> Request changes
                  </button>
                </div>
              </article>
                );
              })}
            </section>
          ))}
        </div>
      )}
    </div>
  );
};
