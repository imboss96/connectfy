import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Mail, Search, Send, Users } from 'lucide-react';
import { sendProjectEmail } from '../lib/emailService';
import {
  fetchTestersNeedingProfileUpdatesFromSupabase,
  TesterNeedingProfileUpdate
} from '../lib/projectRepository';

export const ProfileInformationRequestsSection: React.FC = () => {
  const [testers, setTesters] = useState<TesterNeedingProfileUpdate[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    let active = true;
    void fetchTestersNeedingProfileUpdatesFromSupabase()
      .then((results) => {
        if (active) setTesters(results);
      })
      .catch((loadError) => {
        console.error('Unable to load testers with incomplete profiles:', loadError);
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load tester profile completeness.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const visibleTesters = useMemo(() => {
    const query = search.trim().toLowerCase();
    return testers.filter((tester) => !query
      || tester.name.toLowerCase().includes(query)
      || tester.email.toLowerCase().includes(query)
      || tester.missingFields.some((field) => field.toLowerCase().includes(query)));
  }, [search, testers]);

  const toggleTester = (testerId: string) => {
    setSelectedIds((current) => current.includes(testerId)
      ? current.filter((id) => id !== testerId)
      : [...current, testerId]);
  };

  const toggleVisibleTesters = () => {
    const visibleIds = visibleTesters.map((tester) => tester.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
    setSelectedIds((current) => allSelected
      ? current.filter((id) => !visibleIds.includes(id))
      : Array.from(new Set([...current, ...visibleIds])));
  };

  const sendRequests = async () => {
    const selectedTesters = testers.filter((tester) => selectedIds.includes(tester.id));
    if (selectedTesters.length === 0) {
      setFeedback('Select at least one tester.');
      return;
    }
    if (!window.confirm(`Send profile-update requests to ${selectedTesters.length} tester${selectedTesters.length === 1 ? '' : 's'}?`)) return;

    setSending(true);
    setError('');
    setFeedback('');
    const failed: TesterNeedingProfileUpdate[] = [];
    let sent = 0;
    for (const tester of selectedTesters) {
      try {
        await sendProjectEmail({
          type: 'profile_update_request',
          toEmail: tester.email,
          toName: tester.name,
          testerId: tester.id,
          actionUrl: `${window.location.origin}/?settings=utest`
        });
        sent += 1;
      } catch (sendError) {
        console.error(`Unable to send a profile update request to tester ${tester.id}:`, sendError);
        failed.push(tester);
      }
    }

    const successfulIds = selectedTesters
      .filter((tester) => !failed.some((failedTester) => failedTester.id === tester.id))
      .map((tester) => tester.id);
    setSelectedIds((current) => current.filter((id) => !successfulIds.includes(id)));
    setFeedback(failed.length
      ? `${sent} request${sent === 1 ? '' : 's'} sent. Failed: ${failed.map((tester) => tester.name).join(', ')}. You can retry the selected profiles.`
      : `Profile update requests sent to ${sent} tester${sent === 1 ? '' : 's'}.`);
    setSending(false);
  };

  return (
    <div className="space-y-5 animate-fade-in text-slate-700">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-sky-50 p-2.5 text-sky-700"><Mail className="h-5 w-5" /></div>
          <div>
            <h1 className="text-xl font-black text-slate-900">Request tester profile updates</h1>
            <p className="mt-1 text-sm text-slate-600">
              Email testers missing their uTest ID or email, legal name, date of birth, phone number, or country.
              Completing these details helps us assess eligibility for current projects, but does not guarantee selection.
            </p>
          </div>
        </div>
      </header>

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        {error && <p role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800"><AlertCircle className="h-4 w-4 shrink-0" />{error}</p>}
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <label className="relative block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, email, or missing field"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-800 outline-none focus:border-[#007AFF]"
            />
          </label>
          <button
            type="button"
            onClick={() => void sendRequests()}
            disabled={loading || sending || selectedIds.length === 0}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#007AFF] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#0066EE] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {sending ? `Sending ${selectedIds.length}…` : `Email selected (${selectedIds.length})`}
          </button>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-3 py-2.5">
            <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={visibleTesters.length > 0 && visibleTesters.every((tester) => selectedIds.includes(tester.id))}
                onChange={toggleVisibleTesters}
                disabled={loading || sending || visibleTesters.length === 0}
                className="h-4 w-4 rounded border-slate-300 text-[#007AFF] focus:ring-[#007AFF]"
              />
              Select all {visibleTesters.length} visible
            </label>
            <span className="text-xs text-slate-600">{selectedIds.length} selected · {testers.length} need updates</span>
          </div>

          <div className="max-h-[min(60vh,34rem)] divide-y divide-slate-100 overflow-y-auto">
            {loading ? (
              <p className="flex items-center justify-center gap-2 px-4 py-8 text-xs text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Checking tester profiles…</p>
            ) : testers.length === 0 ? (
              <p className="flex items-center justify-center gap-2 px-4 py-8 text-xs text-emerald-700"><CheckCircle2 className="h-4 w-4" />No tester profiles are missing the required information.</p>
            ) : visibleTesters.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-slate-500">No profiles match this search.</p>
            ) : visibleTesters.map((tester) => (
              <label key={tester.id} className="flex cursor-pointer items-start gap-3 px-3 py-3 hover:bg-sky-50">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(tester.id)}
                  onChange={() => toggleTester(tester.id)}
                  disabled={sending}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-[#007AFF] focus:ring-[#007AFF]"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold text-slate-800">{tester.name}</span>
                  <span className="block truncate text-[11px] text-slate-500">{tester.email}</span>
                  <span className="mt-2 flex flex-wrap gap-1">
                    {tester.missingFields.map((field) => <span key={field} className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-800">{field}</span>)}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </div>

        {feedback && (
          <p role="status" className={`flex items-start gap-2 text-xs ${feedback.startsWith('Profile update requests sent') ? 'text-emerald-700' : 'text-amber-700'}`}>
            <Users className="h-4 w-4 shrink-0" />{feedback}
          </p>
        )}
      </section>
    </div>
  );
};
