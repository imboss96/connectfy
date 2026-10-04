import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ExternalLink, FileSpreadsheet, RefreshCw, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { fetchSheetCsv, parseProjectApplauseSheet } from '../lib/projectSheetSync';

const REFRESH_INTERVAL_MS = 60 * 60 * 1000;

type ApplauseStatusRow = {
  source_key: string;
  status: string;
  tester_id: string;
  tester_email: string;
  google_email: string;
  consent_name: string;
  id_scan_status: string;
  utest_id: string;
  issues: string;
  synced_at: string;
};

type StatusTab = 'completed' | 'ready' | 'in_progress' | 'consent_sent' | 'consent_not_sent' | 'issues';

const STATUS_TABS: { id: StatusTab; label: string }[] = [
  { id: 'completed', label: 'Completed' },
  { id: 'ready', label: 'Ready for settings' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'consent_sent', label: 'Consent form sent' },
  { id: 'consent_not_sent', label: 'Consent form not sent' },
  { id: 'issues', label: 'Issues' }
];

const describeError = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object') {
    const details = error as { code?: unknown; message?: unknown; details?: unknown; hint?: unknown };
    const parts = [details.message, details.details, details.hint]
      .filter((part): part is string => typeof part === 'string' && part.length > 0);
    if (details.code === 'PGRST202') {
      parts.unshift('The project status sync RPC is not installed or not yet in the Supabase schema cache. Apply the project operations migration and reload the schema cache.');
    } else if (details.code === '42501') {
      parts.unshift('Supabase denied the sync. Confirm the signed-in account has the admin role.');
    }
    if (parts.length) return [...new Set(parts)].join(' ');
    return JSON.stringify(error);
  }
  return 'Unable to sync the Applause status sheet.';
};

const hasStatusIssue = (row: Pick<ApplauseStatusRow, 'consent_name' | 'id_scan_status'>) => {
  const consentName = row.consent_name.trim().toLowerCase();
  const idScanStatus = row.id_scan_status.trim().toLowerCase();
  return consentName === 'name mismatch'
    || ['needs review', 'expired', 'failed'].includes(idScanStatus);
};

const statusForTab = (row: ApplauseStatusRow, tab: StatusTab) => {
  const normalizedStatus = row.status.trim().toLowerCase();
  switch (tab) {
    case 'completed':
      return normalizedStatus === 'claimed complete';
    case 'ready':
      return normalizedStatus === 'ready for settings check';
    case 'in_progress':
      return normalizedStatus === 'in progress';
    case 'consent_sent':
      return normalizedStatus === 'consent form sent';
    case 'consent_not_sent':
      return normalizedStatus === '';
    case 'issues':
      return hasStatusIssue(row);
  }
};

export const ApplauseStatusSection: React.FC<{ projectId: string; sheetCsvUrl: string; sheetUrl?: string; onSynced?: () => void }> = ({
  projectId,
  sheetCsvUrl,
  sheetUrl,
  onSynced
}) => {
  const [rows, setRows] = useState<ApplauseStatusRow[]>([]);
  const [search, setSearch] = useState('');
  const [activeStatusTab, setActiveStatusTab] = useState<StatusTab>('completed');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    setSyncMessage(null);

    if (!supabase) {
      setError('Supabase is not configured. Applause statuses cannot be synced or loaded.');
      setLoading(false);
      return;
    }

    let syncError: string | null = null;
    try {
      if (!sheetCsvUrl) throw new Error('Set this project’s Applause Google Sheet in Project Integrations before syncing.');
      const importedRows = await parseProjectApplauseSheet(await fetchSheetCsv(sheetCsvUrl, signal));
      if (signal?.aborted) return;

      const { data: importedCount, error: importError } = await supabase.rpc(
        'sync_project_applause_status',
        { p_project_id: projectId, p_rows: importedRows }
      );
      if (importError) throw importError;
      setLastSynced(new Date());
      setSyncMessage(`Synced ${typeof importedCount === 'number' ? importedCount : importedRows.length} records to the database.`);
      onSynced?.();
    } catch (syncFailure) {
      if (syncFailure instanceof DOMException && syncFailure.name === 'AbortError') return;
      syncError = describeError(syncFailure);
      console.error('Unable to sync Applause project statuses:', {
        message: syncError,
        code: syncFailure && typeof syncFailure === 'object' && 'code' in syncFailure ? syncFailure.code : undefined,
        error: syncFailure
      });
    }

    try {
      const { data, error: queryError } = await supabase
        .from('project_applause_status')
        .select('source_key,status,tester_id,tester_email,google_email,consent_name,id_scan_status,utest_id,issues,synced_at')
        .eq('project_id', projectId)
        .order('tester_id', { ascending: true });
      if (queryError) throw queryError;
      if (signal?.aborted) return;
      setRows((data || []) as ApplauseStatusRow[]);
      if (syncError) {
        setError(`Could not sync the latest sheet data; showing the last saved database snapshot. ${syncError}`);
      }
    } catch (queryFailure) {
      if (queryFailure instanceof DOMException && queryFailure.name === 'AbortError') return;
      const queryMessage = describeError(queryFailure);
      console.error('Unable to load Applause statuses from Supabase:', {
        message: queryMessage,
        code: queryFailure && typeof queryFailure === 'object' && 'code' in queryFailure ? queryFailure.code : undefined,
        error: queryFailure
      });
      setError(syncError ? `${syncError} Database load failed: ${queryMessage}` : queryMessage);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [onSynced, projectId, sheetCsvUrl]);

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    const intervalId = window.setInterval(() => void refresh(controller.signal), REFRESH_INTERVAL_MS);
    return () => {
      window.clearInterval(intervalId);
      controller.abort();
    };
  }, [refresh]);

  const tabRows = useMemo(
    () => rows.filter((row) => statusForTab(row, activeStatusTab)),
    [rows, activeStatusTab]
  );
  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return tabRows;
    return tabRows.filter((row) =>
      [row.status, row.tester_id, row.tester_email, row.google_email, row.consent_name, row.id_scan_status, row.utest_id, row.issues]
        .join(' ')
        .toLowerCase()
        .includes(term)
    );
  }, [tabRows, search]);

  const tabCounts = useMemo(
    () => Object.fromEntries(STATUS_TABS.map(({ id }) => [id, rows.filter((row) => statusForTab(row, id)).length])) as Record<StatusTab, number>,
    [rows]
  );

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-[#007AFF]" />
            <h1 className="text-lg font-bold text-slate-900">Applause completion status</h1>
          </div>
          <p className="mt-1 text-sm text-slate-500">Statuses are synced to Connectfy and refreshed from the sheet every hour.</p>
          <p className="mt-1 text-xs text-slate-400">
            {lastSynced ? `Last synced ${lastSynced.toLocaleString()}` : 'Waiting for first sync'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Syncing...' : 'Sync now'}
          </button>
          <a
            href={sheetUrl || sheetCsvUrl || undefined}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-[#007AFF] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#005fce]"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open sheet
          </a>
        </div>
      </div>

      {syncMessage && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{syncMessage}</p>}
      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex gap-1 overflow-x-auto border-b border-slate-200 p-3">
          {STATUS_TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveStatusTab(id)}
              className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                activeStatusTab === id ? 'bg-[#007AFF] text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {label}
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${activeStatusTab === id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                {tabCounts[id]}
              </span>
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-semibold text-slate-600">{filteredRows.length} of {tabRows.length} records</p>
          <label className="relative block sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search this status..."
              className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-xs text-slate-800 outline-none focus:border-[#007AFF]"
            />
          </label>
        </div>

        {loading && rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">Syncing Applause statuses...</div>
        ) : filteredRows.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">{tabRows.length ? 'No records match your search.' : 'No records in this project stage.'}</div>
        ) : (
          <div className="max-h-[70vh] overflow-auto">
            <table className="min-w-full border-collapse text-left text-xs">
              <thead className="sticky top-0 z-10 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="whitespace-nowrap border-b border-slate-200 px-4 py-3 font-bold">Status</th>
                  <th className="whitespace-nowrap border-b border-slate-200 px-4 py-3 font-bold">Tester ID</th>
                  <th className="whitespace-nowrap border-b border-slate-200 px-4 py-3 font-bold">Tester email</th>
                  <th className="whitespace-nowrap border-b border-slate-200 px-4 py-3 font-bold">Google email</th>
                  <th className="whitespace-nowrap border-b border-slate-200 px-4 py-3 font-bold">Consent name</th>
                  <th className="whitespace-nowrap border-b border-slate-200 px-4 py-3 font-bold">ID scan status</th>
                  <th className="whitespace-nowrap border-b border-slate-200 px-4 py-3 font-bold">uTest ID</th>
                  <th className="min-w-64 border-b border-slate-200 px-4 py-3 font-bold">Issues</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.map((row) => (
                  <tr key={row.source_key} className="transition hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-800">{row.status || 'Not sent'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{row.tester_id || '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{row.tester_email || '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{row.google_email || '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{row.consent_name || '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{row.id_scan_status || '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{row.utest_id || '—'}</td>
                    <td className="min-w-64 whitespace-pre-wrap px-4 py-3 text-slate-700">{row.issues || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="text-[11px] text-slate-400">“Completed” includes rows where Status is exactly “Claimed Complete”. Other tabs use the corresponding Status column values.</p>
    </section>
  );
};
