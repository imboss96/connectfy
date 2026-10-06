import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  MailCheck,
  RefreshCw,
  Search,
  XCircle
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ApprovalEmailLog, ApprovalEmailStatus, fetchApprovalEmailLogPage } from '../lib/adminEmailService';

const PAGE_SIZE = 100;
type StatusFilter = 'all' | ApprovalEmailStatus;

const statusStyles: Record<ApprovalEmailStatus, { label: string; className: string; icon: React.ComponentType<{ className?: string }> }> = {
  sent: { label: 'Sent', className: 'bg-emerald-100 text-emerald-800', icon: CheckCircle2 },
  pending: { label: 'Queued', className: 'bg-amber-100 text-amber-800', icon: Clock3 },
  processing: { label: 'Sending', className: 'bg-blue-100 text-blue-800', icon: RefreshCw },
  failed: { label: 'Failed', className: 'bg-rose-100 text-rose-800', icon: XCircle }
};

const formatDateTime = (value: string | null) => {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(parsed);
};

export const ApprovalEmailLogSection: React.FC = () => {
  const { projects } = useApp();
  const [rows, setRows] = useState<ApprovalEmailLog[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [projectFilter, setProjectFilter] = useState('all');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const page = await fetchApprovalEmailLogPage(0, PAGE_SIZE);
      setRows(page.emails);
      setOffset(page.emails.length);
      setHasMore(page.hasMore);
    } catch (loadError) {
      console.error('Unable to load project approval email log:', loadError);
      setError(loadError instanceof Error ? loadError.message : 'Unable to load approval email history.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const loadOlder = async () => {
    setLoadingOlder(true);
    setError('');
    try {
      const page = await fetchApprovalEmailLogPage(offset, PAGE_SIZE);
      setRows((current) => {
        const existingIds = new Set(current.map((row) => row.id));
        return [...current, ...page.emails.filter((row) => !existingIds.has(row.id))];
      });
      setOffset((current) => current + page.emails.length);
      setHasMore(page.hasMore);
    } catch (loadError) {
      console.error('Unable to load older project approval emails:', loadError);
      setError(loadError instanceof Error ? loadError.message : 'Unable to load older email history.');
    } finally {
      setLoadingOlder(false);
    }
  };

  const counts = useMemo(() => ({
    all: rows.length,
    sent: rows.filter((row) => row.status === 'sent').length,
    pending: rows.filter((row) => row.status === 'pending').length,
    processing: rows.filter((row) => row.status === 'processing').length,
    failed: rows.filter((row) => row.status === 'failed').length
  }), [rows]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return rows.filter((row) => {
      if (statusFilter !== 'all' && row.status !== statusFilter) return false;
      if (projectFilter !== 'all' && row.project_id !== projectFilter) return false;
      if (!term) return true;
      return [
        row.project_title,
        row.project_company,
        row.recipient_name,
        row.recipient_email,
        row.provider_message_id || ''
      ].some((value) => value.toLocaleLowerCase().includes(term));
    });
  }, [rows, search, statusFilter, projectFilter]);

  const statusFilters: StatusFilter[] = ['all', 'sent', 'pending', 'processing', 'failed'];

  return (
    <section aria-labelledby="approval-email-log-heading" className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">Finance operations</p>
          <h1 id="approval-email-log-heading" className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
            Project approval email log
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Delivery history for completion approval emails sent to registered Connectfy testers after their project status is approved.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh log
        </button>
      </header>

      <div className="flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 p-4 text-xs leading-5 text-sky-950">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          A <strong>Sent</strong> status means the email provider accepted the message. Queued and failed messages are retried automatically according to the backend retry policy. The log shows the latest 100 records first; use Load older to browse further back.
        </p>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      <section aria-label="Email delivery summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {([
          ['Emails sent', counts.sent, CheckCircle2, 'text-emerald-700 bg-emerald-50'],
          ['Queued', counts.pending, Clock3, 'text-amber-700 bg-amber-50'],
          ['Sending', counts.processing, RefreshCw, 'text-blue-700 bg-blue-50'],
          ['Failed', counts.failed, XCircle, 'text-rose-700 bg-rose-50']
        ] as const).map(([label, count, Icon, tone]) => (
          <article key={label} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div>
              <p className="text-xs font-semibold text-slate-500">{label}</p>
              <p className="mt-2 text-2xl font-bold text-slate-950">{loading ? '—' : count}</p>
              <p className="mt-1 text-[10px] text-slate-500">Among {rows.length} loaded records</p>
            </div>
            <span className={`rounded-xl p-2.5 ${tone}`}><Icon className="h-5 w-5" /></span>
          </article>
        ))}
      </section>

      <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4 sm:px-5">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Delivery history</h2>
            <p className="mt-1 text-xs text-slate-500">{filteredRows.length} matching · {rows.length} loaded</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search recipient or project"
                className="w-52 rounded-lg border border-slate-200 py-2 pl-8 pr-2 text-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <select
              aria-label="Filter email log by project"
              value={projectFilter}
              onChange={(event) => setProjectFilter(event.target.value)}
              className="max-w-48 rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs text-slate-700 outline-none focus:border-blue-400"
            >
              <option value="all">All projects</option>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
            </select>
          </div>
        </div>

        <div className="flex gap-1 overflow-x-auto border-b border-slate-100 px-4 pt-3 sm:px-5">
          {statusFilters.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              aria-pressed={statusFilter === status}
              className={`shrink-0 rounded-t-lg border-b-2 px-3 py-2 text-xs font-semibold transition ${
                statusFilter === status
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {status === 'all' ? 'All' : statusStyles[status].label}
              <span className="ml-1 text-[10px] text-slate-400">{counts[status]}</span>
            </button>
          ))}
        </div>

        {loading && rows.length === 0 ? (
          <p className="p-10 text-center text-sm text-slate-500">Loading approval email history…</p>
        ) : filteredRows.length === 0 ? (
          <div className="p-10 text-center">
            <MailCheck className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-700">No matching approval emails</p>
            <p className="mt-1 text-xs text-slate-500">Newly approved Connectfy members will appear here after a project status sync.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[780px] w-full text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-bold sm:px-5">Member</th>
                  <th className="px-4 py-3 font-bold">Project</th>
                  <th className="px-4 py-3 font-bold">Status</th>
                  <th className="px-4 py-3 font-bold">Attempts</th>
                  <th className="px-4 py-3 font-bold">Sent / updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.map((row) => {
                  const badge = statusStyles[row.status];
                  const Icon = badge.icon;
                  return (
                    <tr key={row.id} className="align-top hover:bg-slate-50/70">
                      <td className="px-4 py-3.5 sm:px-5">
                        <p className="font-semibold text-slate-900">{row.recipient_name}</p>
                        <p className="mt-1 text-[10px] text-slate-500">{row.recipient_email}</p>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="font-semibold text-slate-800">{row.project_title}</p>
                        <p className="mt-1 text-[10px] text-slate-500">{row.project_company}</p>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ${badge.className}`}>
                          <Icon className="h-3 w-3" /> {badge.label}
                        </span>
                        {row.last_error && <p className="mt-1.5 max-w-xs text-[10px] leading-4 text-rose-700">{row.last_error}</p>}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">{row.attempt_count}</td>
                      <td className="px-4 py-3.5 text-slate-600">
                        <p>{formatDateTime(row.sent_at || row.updated_at)}</p>
                        {row.provider_message_id && (
                          <p className="mt-1 max-w-48 truncate font-mono text-[9px] text-slate-400" title={row.provider_message_id}>
                            Provider ID: {row.provider_message_id}
                          </p>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {hasMore && (
          <div className="border-t border-slate-100 p-4 text-center">
            <button
              type="button"
              onClick={() => void loadOlder()}
              disabled={loadingOlder}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              <Clock3 className={`h-4 w-4 ${loadingOlder ? 'animate-pulse' : ''}`} />
              {loadingOlder ? 'Loading…' : 'Load older emails'}
            </button>
          </div>
        )}
      </article>
    </section>
  );
};
