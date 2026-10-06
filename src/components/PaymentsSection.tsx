import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowDownToLine,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clock3,
  RefreshCw,
  Search,
  Wallet
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';

type ScheduleStatus = 'scheduled' | 'paid' | 'cancelled';
type PaymentScheduleRow = {
  project_id: string;
  source_key: string;
  profile_id: string | null;
  tester_id: string;
  tester_email: string;
  amount: number;
  scheduled_date: string;
  status: ScheduleStatus;
  updated_at: string;
};
type StatusFilter = 'all' | ScheduleStatus;

const PAGE_SIZE = 1000;
const statuses: StatusFilter[] = ['all', 'scheduled', 'paid', 'cancelled'];

const localDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatUsd = (amount: number) => new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
}).format(amount);

const formatDate = (date: string) => {
  const parsed = new Date(`${date}T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? date
    : new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(parsed);
};

const escapeCsvCell = (value: string | number) => {
  const safeValue = String(value).replace(/^[=+\-@]/, "'$&");
  return `"${safeValue.replace(/"/g, '""')}"`;
};

export const PaymentsSection: React.FC = () => {
  const { projects, setActiveAdminProjectId, setActiveTab } = useApp();
  const [rows, setRows] = useState<PaymentScheduleRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [projectFilter, setProjectFilter] = useState('all');
  const [search, setSearch] = useState('');

  const refresh = useCallback(async () => {
    if (!supabase) {
      setError('Payments data is unavailable because Supabase is not configured.');
      setRows([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const allRows: PaymentScheduleRow[] = [];
      let offset = 0;
      while (true) {
        const { data, error: queryError } = await supabase
          .from('project_payroll_schedule')
          .select('project_id,source_key,profile_id,tester_id,tester_email,amount,scheduled_date,status,updated_at')
          .not('profile_id', 'is', null)
          .order('scheduled_date', { ascending: true })
          .range(offset, offset + PAGE_SIZE - 1);
        if (queryError) throw queryError;
        const page = (data || []) as PaymentScheduleRow[];
        allRows.push(...page);
        if (page.length < PAGE_SIZE) break;
        offset += PAGE_SIZE;
      }
      setRows(allRows);
    } catch (loadError) {
      console.error('Unable to load admin payment schedules:', loadError);
      setError(loadError instanceof Error ? loadError.message : 'Unable to load scheduled payments.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const projectById = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);
  const today = localDateKey(new Date());

  const filteredRows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return rows.filter((row) => {
      if (statusFilter !== 'all' && row.status !== statusFilter) return false;
      if (projectFilter !== 'all' && row.project_id !== projectFilter) return false;
      if (!query) return true;
      const projectTitle = projectById.get(row.project_id)?.title || '';
      return [projectTitle, row.tester_email, row.tester_id, row.source_key]
        .some((value) => value.toLocaleLowerCase().includes(query));
    });
  }, [rows, statusFilter, projectFilter, search, projectById]);

  const metrics = useMemo(() => {
    const scheduled = rows.filter((row) => row.status === 'scheduled');
    const paid = rows.filter((row) => row.status === 'paid');
    const overdue = scheduled.filter((row) => row.scheduled_date < today);
    return {
      scheduledCount: scheduled.length,
      scheduledTotal: scheduled.reduce((sum, row) => sum + Number(row.amount || 0), 0),
      paidCount: paid.length,
      paidTotal: paid.reduce((sum, row) => sum + Number(row.amount || 0), 0),
      overdueCount: overdue.length,
      overdueTotal: overdue.reduce((sum, row) => sum + Number(row.amount || 0), 0),
      projectCount: new Set(rows.filter((row) => row.status !== 'cancelled').map((row) => row.project_id)).size
    };
  }, [rows, today]);

  const projectSummaries = useMemo(() => {
    const summaries = new Map<string, { count: number; total: number; overdue: number; paid: number }>();
    for (const row of rows) {
      const summary = summaries.get(row.project_id) || { count: 0, total: 0, overdue: 0, paid: 0 };
      if (row.status === 'scheduled') {
        summary.count += 1;
        summary.total += Number(row.amount || 0);
        if (row.scheduled_date < today) summary.overdue += 1;
      }
      if (row.status === 'paid') summary.paid += 1;
      summaries.set(row.project_id, summary);
    }
    return [...summaries.entries()]
      .map(([projectId, summary]) => ({
        projectId,
        projectTitle: projectById.get(projectId)?.title || 'Project',
        ...summary
      }))
      .filter((summary) => summary.count > 0 || summary.paid > 0)
      .sort((left, right) => right.total - left.total || left.projectTitle.localeCompare(right.projectTitle));
  }, [rows, today, projectById]);

  const exportCsv = () => {
    const csvRows = [
      ['Project', 'Recipient email', 'Tester ID', 'Amount USD', 'Scheduled date', 'Status', 'Source key'],
      ...filteredRows.map((row) => [
        projectById.get(row.project_id)?.title || 'Project',
        row.tester_email,
        row.tester_id,
        Number(row.amount || 0).toFixed(2),
        row.scheduled_date,
        row.status,
        row.source_key
      ])
    ];
    const csv = csvRows.map((line) => line.map(escapeCsvCell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `connectfy-payment-schedule-${today}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const openProjectOperations = (projectId: string) => {
    setActiveAdminProjectId(projectId);
    setActiveTab('project_operations');
  };

  const metricCards = [
    {
      label: 'Scheduled total',
      value: formatUsd(metrics.scheduledTotal),
      detail: `${metrics.scheduledCount} approved participant ${metrics.scheduledCount === 1 ? 'payment' : 'payments'}`,
      icon: CalendarClock,
      color: 'text-blue-700 bg-blue-50'
    },
    {
      label: 'Paid to date',
      value: formatUsd(metrics.paidTotal),
      detail: `${metrics.paidCount} schedule ${metrics.paidCount === 1 ? 'entry' : 'entries'} marked paid`,
      icon: CheckCircle2,
      color: 'text-emerald-700 bg-emerald-50'
    },
    {
      label: 'Past due',
      value: String(metrics.overdueCount),
      detail: `${formatUsd(metrics.overdueTotal)} scheduled before today`,
      icon: Clock3,
      color: 'text-amber-700 bg-amber-50'
    },
    {
      label: 'Projects with payments',
      value: String(metrics.projectCount),
      detail: 'Projects with an active schedule or paid entry',
      icon: Wallet,
      color: 'text-violet-700 bg-violet-50'
    }
  ];

  return (
    <section aria-labelledby="payments-heading" className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">Finance operations</p>
          <h1 id="payments-heading" className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Payments & schedules</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Track participant payments scheduled from project completion approvals, monitor overdue items, and review project-level totals.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('payout_operations')}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Tester payout review <ArrowRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={exportCsv}
            disabled={filteredRows.length === 0}
            className="payments-export-button inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed"
          >
            <ArrowDownToLine className="h-4 w-4" /> Export CSV
          </button>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={isLoading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </header>

      <div className="flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 p-4 text-xs leading-5 text-sky-950">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          These are project participant schedules created from Applause sheet rows marked           <strong>Claimed Complete</strong> with an email matching a registered Connectfy tester profile. This dashboard is for visibility and export; it does not send these payments. Tester wallet withdrawals are managed separately in payout review.
        </p>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      <section aria-label="Payment schedule summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metricCards.map(({ label, value, detail, icon: Icon, color }) => (
          <article key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-slate-500">{label}</p>
                <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">{isLoading ? '—' : value}</p>
                <p className="mt-1 text-[11px] text-slate-500">{isLoading ? 'Loading schedule…' : detail}</p>
              </div>
              <span className={`rounded-xl p-2.5 ${color}`}><Icon className="h-5 w-5" /></span>
            </div>
          </article>
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-4 sm:px-5">
            <h2 className="text-sm font-bold text-slate-900">Project obligations</h2>
            <p className="mt-1 text-xs text-slate-500">Scheduled and paid amounts grouped by project.</p>
          </div>
          {isLoading && rows.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-500">Loading project totals…</p>
          ) : projectSummaries.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-500">No approved participant payments are scheduled yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {projectSummaries.slice(0, 8).map((summary) => (
                <li key={summary.projectId} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-slate-800">{summary.projectTitle}</p>
                    <p className="mt-1 text-[10px] text-slate-500">
                      {summary.count} scheduled · {summary.paid} paid
                      {summary.overdue > 0 && <span className="ml-1 font-semibold text-amber-700">· {summary.overdue} past due</span>}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs font-bold text-slate-900">{formatUsd(summary.total)}</p>
                    {projects.some((project) => project.id === summary.projectId) && (
                      <button
                        type="button"
                        onClick={() => openProjectOperations(summary.projectId)}
                        className="mt-1 text-[10px] font-semibold text-blue-700 hover:text-blue-900"
                      >
                        View project
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4 sm:px-5">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Payment schedule</h2>
              <p className="mt-1 text-xs text-slate-500">
                {isLoading ? 'Loading entries…' : `${filteredRows.length.toLocaleString()} of ${rows.length.toLocaleString()} entries`}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-slate-400" />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search recipient or project"
                  className="w-48 rounded-lg border border-slate-200 py-2 pl-8 pr-2 text-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <select
                aria-label="Filter by project"
                value={projectFilter}
                onChange={(event) => setProjectFilter(event.target.value)}
                className="max-w-44 rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs text-slate-700 outline-none focus:border-blue-400"
              >
                <option value="all">All projects</option>
                {projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
              </select>
            </div>
          </div>

          <div className="flex gap-1 overflow-x-auto border-b border-slate-100 px-4 pt-3 sm:px-5">
            {statuses.map((status) => {
              const count = status === 'all' ? rows.length : rows.filter((row) => row.status === status).length;
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  aria-pressed={statusFilter === status}
                  className={`shrink-0 rounded-t-lg border-b-2 px-3 py-2 text-xs font-semibold capitalize transition ${
                    statusFilter === status
                      ? 'border-blue-600 text-blue-700'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {status === 'all' ? 'All entries' : status} <span className="ml-1 text-[10px] text-slate-400">{count}</span>
                </button>
              );
            })}
          </div>

          {isLoading && rows.length === 0 ? (
            <p className="p-10 text-center text-sm text-slate-500">Loading payment schedule…</p>
          ) : filteredRows.length === 0 ? (
            <div className="p-10 text-center">
              <CalendarClock className="mx-auto h-7 w-7 text-slate-300" />
              <p className="mt-3 text-sm font-semibold text-slate-700">No matching payment entries</p>
              <p className="mt-1 text-xs text-slate-500">Try changing the filters or sync a project completion sheet.</p>
            </div>
          ) : (
            <div className="max-h-[34rem] overflow-auto">
              <table className="min-w-[720px] w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-bold sm:px-5">Participant / project</th>
                    <th className="px-4 py-3 font-bold">Amount</th>
                    <th className="px-4 py-3 font-bold">Scheduled date</th>
                    <th className="px-4 py-3 font-bold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRows.map((row) => {
                    const project = projectById.get(row.project_id);
                    const isOverdue = row.status === 'scheduled' && row.scheduled_date < today;
                    return (
                      <tr key={`${row.project_id}-${row.source_key}`} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3.5 sm:px-5">
                          <p className="font-semibold text-slate-900">{row.tester_email || 'No recipient email'}</p>
                          <p className="mt-1 text-[10px] text-slate-500">{project?.title || 'Project'} · Connectfy member · uTest ID {row.tester_id || '—'}</p>
                        </td>
                        <td className="px-4 py-3.5 font-bold text-slate-900">{formatUsd(Number(row.amount || 0))}</td>
                        <td className="px-4 py-3.5 text-slate-600">
                          {formatDate(row.scheduled_date)}
                          {isOverdue && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-bold text-amber-800">Past due</span>}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-bold capitalize ${
                            row.status === 'paid'
                              ? 'bg-emerald-100 text-emerald-800'
                              : row.status === 'cancelled'
                                ? 'bg-slate-100 text-slate-600'
                                : 'bg-blue-100 text-blue-800'
                          }`}>
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </article>
      </section>
    </section>
  );
};
