import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock3, Mail, RefreshCw, Search, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { fetchConsentReminderEmailLog } from '../lib/adminEmailService';

type EmailLogStatus = 'pending' | 'processing' | 'sent' | 'failed' | 'unverified';

type EmailLogEntry = {
  id: string;
  recipient_email: string;
  recipient_name: string;
  email_type: string;
  subject: string;
  status: EmailLogStatus;
  error_message: string | null;
  created_by: string | null;
  created_at: string;
  sent_at: string | null;
};

const statusPresentation: Record<EmailLogStatus, { label: string; className: string; icon: React.ComponentType<{ className?: string }> }> = {
  pending: { label: 'Pending / unknown', className: 'border-amber-200 bg-amber-50 text-amber-700', icon: Clock3 },
  processing: { label: 'Sending', className: 'border-blue-200 bg-blue-50 text-blue-700', icon: RefreshCw },
  sent: { label: 'Sent', className: 'border-emerald-200 bg-emerald-50 text-emerald-700', icon: CheckCircle2 },
  failed: { label: 'Failed', className: 'border-rose-200 bg-rose-50 text-rose-700', icon: XCircle },
  unverified: { label: 'Sent, confirmation unavailable', className: 'border-amber-200 bg-amber-50 text-amber-700', icon: AlertCircle }
};

export const EmailHistorySection: React.FC<{ projectId?: string; projectTitle?: string }> = ({ projectId, projectTitle }) => {
  const [entries, setEntries] = useState<EmailLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reminderLogError, setReminderLogError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const loadEntries = useCallback(async () => {
    if (!supabase) {
      setError('Supabase is not configured. Email history cannot be loaded.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('legacy_sheet_email_log')
        .select('id,recipient_email,recipient_name,email_type,subject,status,error_message,created_by,created_at,sent_at')
        .order('created_at', { ascending: false });
      if (projectId) query = query.eq('project_id', projectId);
      const { data, error: queryError } = await query;
      if (queryError) throw queryError;
      let consentReminderEntries: EmailLogEntry[] = [];
      setReminderLogError(null);
      if (projectId) {
        try {
          const reminders = await fetchConsentReminderEmailLog(projectId);
          consentReminderEntries = reminders.map((row) => ({
            id: `consent-reminder-${row.id}`,
            recipient_email: row.recipient_email,
            recipient_name: row.recipient_name,
            email_type: 'applause_consent_pending_reminder',
            subject: `Action required: complete your consent step for ${row.project_title}`,
            status: row.status,
            error_message: row.last_error,
            created_by: row.queued_by,
            created_at: row.updated_at || row.created_at,
            sent_at: row.sent_at
          }));
        } catch (reminderLoadError) {
          console.error('Unable to load consent reminder email history:', reminderLoadError);
          setReminderLogError(reminderLoadError instanceof Error ? reminderLoadError.message : 'Unable to load consent reminder email history.');
        }
      }
      setEntries([...(data || []) as EmailLogEntry[], ...consentReminderEntries]
        .sort((left, right) => right.created_at.localeCompare(left.created_at)));
    } catch (loadError) {
      console.error('Unable to load legacy sheet email history:', loadError);
      setError(loadError instanceof Error ? loadError.message : 'Unable to load email history.');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  const normalizedSearch = search.trim().toLowerCase();
  const filteredEntries = entries.filter((entry) => (
    !normalizedSearch
    || entry.recipient_email.toLowerCase().includes(normalizedSearch)
    || entry.recipient_name.toLowerCase().includes(normalizedSearch)
    || entry.subject.toLowerCase().includes(normalizedSearch)
    || entry.status.toLowerCase().includes(normalizedSearch)
  ));
  const sentCount = entries.filter((entry) => entry.status === 'sent').length;
  const pendingCount = entries.filter((entry) => entry.status === 'pending' || entry.status === 'processing' || entry.status === 'unverified').length;
  const failedCount = entries.filter((entry) => entry.status === 'failed').length;

  return (
    <section className="space-y-5 animate-fade-in">
      <header className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-xl border border-[#007AFF]/20 bg-[#007AFF]/10 p-3 text-[#007AFF]">
            <Mail className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900">{projectTitle ? `${projectTitle} · Email History` : 'Email History'}</h1>
            <p className="mt-1 text-xs text-slate-600">Track sheet eligibility emails and manual consent-pending payout reminders for this project.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void loadEntries()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Confirmed sent</p>
          <p className="mt-1 text-2xl font-black text-emerald-700">{sentCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Pending / confirmation needed</p>
          <p className="mt-1 text-2xl font-black text-amber-700">{pendingCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Failed</p>
          <p className="mt-1 text-2xl font-black text-rose-700">{failedCount}</p>
        </div>
      </div>

      {reminderLogError && (
        <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          Legacy email history is available, but consent reminder statuses could not be loaded: {reminderLogError}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Sent campaign and reminder records</h2>
            <p className="mt-1 text-[11px] text-slate-500">Includes eligibility emails and manually sent consent-pending reminders.</p>
          </div>
          <label className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search recipients or status"
              className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-xs outline-none focus:border-[#007AFF]"
            />
          </label>
        </div>

        {error ? (
          <div role="alert" className="m-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            <p className="font-semibold">Could not load email history.</p>
            <p className="mt-1 text-xs">{error}</p>
            <button type="button" onClick={() => void loadEntries()} className="mt-3 rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-semibold hover:bg-rose-100">
              Try again
            </button>
          </div>
        ) : loading ? (
          <div className="p-10 text-center text-sm text-slate-500">Loading email records...</div>
        ) : filteredEntries.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            {entries.length === 0 ? 'No emails have been logged yet.' : 'No email records match your search.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Recipient</th>
                  <th className="px-4 py-3">Subject</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Sent / attempted</th>
                  <th className="px-4 py-3">Admin ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEntries.map((entry) => {
                  const basePresentation = statusPresentation[entry.status] || statusPresentation.pending;
                  const presentation = entry.email_type === 'applause_consent_pending_reminder' && entry.status === 'pending'
                    ? { ...basePresentation, label: 'Queued' }
                    : basePresentation;
                  const StatusIcon = presentation.icon;
                  return (
                    <tr key={entry.id} className="align-top hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900">{entry.recipient_name || 'Name not provided'}</p>
                        <p className="mt-0.5 text-slate-500">{entry.recipient_email}</p>
                      </td>
                      <td className="max-w-xs px-4 py-3 text-slate-700">{entry.subject}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-1 text-[10px] font-bold ${presentation.className}`}>
                          <StatusIcon className="h-3 w-3" />
                          {presentation.label}
                        </span>
                        {entry.error_message && <p className="mt-1 max-w-xs text-[10px] leading-4 text-rose-700">{entry.error_message}</p>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {new Date(entry.sent_at || entry.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 font-mono text-[10px] text-slate-500">{entry.created_by ? entry.created_by.slice(0, 8) : 'Unavailable'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
};
