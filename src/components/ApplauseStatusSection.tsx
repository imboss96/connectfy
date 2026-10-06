import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ExternalLink, FileSpreadsheet, RefreshCw, Search, Send } from 'lucide-react';
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
  if (error && typeof error === 'object') {
    const details = error as { code?: unknown; message?: unknown; details?: unknown; hint?: unknown };
    const parts = [details.message, details.details, details.hint]
      .filter((part): part is string => typeof part === 'string' && part.length > 0);
    if (error instanceof Error && error.message && !parts.includes(error.message)) parts.unshift(error.message);
    if (details.code === 'PGRST202') {
      parts.unshift('Supabase cannot find the requested RPC. Confirm its migration is applied to this project and reload the PostgREST schema cache.');
    } else if (details.code === '42501') {
      parts.unshift('Supabase denied the sync. Confirm the signed-in account has the admin role.');
    }
    if (parts.length) return [...new Set(parts)].join(' ');
    return JSON.stringify(error);
  }
  if (error instanceof Error) return error.message;
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
  const [reminderMessage, setReminderMessage] = useState<string | null>(null);
  const [reminderError, setReminderError] = useState<string | null>(null);
  const [selectedConsentRows, setSelectedConsentRows] = useState<Set<string>>(() => new Set());
  const [sendingConsentEmails, setSendingConsentEmails] = useState(false);
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
      setSyncMessage(
        `Synced ${typeof importedCount === 'number' ? importedCount : importedRows.length} records. Approval emails and scheduled payments are limited to matched Connectfy tester accounts; external sheet users are excluded. Consent-pending reminders can be sent manually to selected matched testers.`
      );
      onSynced?.();
    } catch (syncFailure) {
      if (syncFailure instanceof DOMException && syncFailure.name === 'AbortError') return;
      syncError = describeError(syncFailure);
      console.error(`Unable to sync Applause project statuses: ${syncError}`, {
        code: syncFailure && typeof syncFailure === 'object' && 'code' in syncFailure ? syncFailure.code : undefined,
        details: syncFailure && typeof syncFailure === 'object' && 'details' in syncFailure ? syncFailure.details : undefined,
        hint: syncFailure && typeof syncFailure === 'object' && 'hint' in syncFailure ? syncFailure.hint : undefined,
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
    setSelectedConsentRows(new Set());
    setReminderMessage(null);
    setReminderError(null);
  }, [projectId]);

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

  const pendingConsentRows = filteredRows.filter((row) => row.consent_name.trim().toLowerCase() === 'pending');
  const selectedPendingCount = selectedConsentRows.size;

  const toggleConsentRow = (sourceKey: string) => {
    setSelectedConsentRows((current) => {
      const next = new Set(current);
      if (next.has(sourceKey)) next.delete(sourceKey);
      else next.add(sourceKey);
      return next;
    });
  };

  const toggleAllVisiblePending = () => {
    setSelectedConsentRows((current) => {
      const next = new Set(current);
      const allSelected = pendingConsentRows.every((row) => next.has(row.source_key));
      pendingConsentRows.forEach((row) => {
        if (allSelected) next.delete(row.source_key);
        else next.add(row.source_key);
      });
      return next;
    });
  };

  const sendSelectedConsentReminders = async () => {
    if (!supabase || selectedConsentRows.size === 0) return;
    setSendingConsentEmails(true);
    setReminderError(null);
    setReminderMessage(null);
    try {
      const { data, error: queueError } = await supabase.rpc('queue_project_applause_consent_reminders', {
        p_project_id: projectId,
        p_source_keys: Array.from(selectedConsentRows)
      });
      if (queueError) throw queueError;
      const queuedCount = Number(data || 0);
      setSelectedConsentRows(new Set());
      setReminderMessage(
        queuedCount > 0
          ? `Queued ${queuedCount} consent reminder email${queuedCount === 1 ? '' : 's'}. The email service will send them shortly.`
          : 'No emails were queued. The selected rows may not match registered testers or may already be queued.'
      );
    } catch (queueFailure) {
      const rpcError = queueFailure && typeof queueFailure === 'object'
        ? queueFailure as { code?: unknown; message?: unknown }
        : null;
      if (rpcError?.code === 'PGRST202'
        || (typeof rpcError?.message === 'string' && rpcError.message.includes('queue_project_applause_consent_reminders'))) {
        setReminderError('Supabase cannot find the consent reminder queue function. Apply migration 202610060008_applause_consent_pending_reminders.sql to this Supabase project, then reload the PostgREST schema cache.');
      } else {
        setReminderError(describeError(queueFailure));
      }
    } finally {
      setSendingConsentEmails(false);
    }
  };

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
      {reminderMessage && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{reminderMessage}</p>}
      {reminderError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{reminderError}</p>}

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

        {pendingConsentRows.length > 0 && (
          <div className="flex flex-col gap-3 border-b border-slate-200 bg-amber-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-slate-700">
              <p className="font-semibold">Consent name pending: {pendingConsentRows.length} visible</p>
              <p className="mt-1 text-slate-500">Select testers to send a payout reminder email with a WhatsApp support link.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={toggleAllVisiblePending}
                disabled={sendingConsentEmails}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {pendingConsentRows.every((row) => selectedConsentRows.has(row.source_key)) ? 'Clear visible' : 'Select visible'}
              </button>
              <span className="text-xs text-slate-500">{selectedPendingCount} selected</span>
              <button
                type="button"
                onClick={() => void sendSelectedConsentReminders()}
                disabled={sendingConsentEmails || selectedPendingCount === 0}
                className="inline-flex items-center gap-2 rounded-lg bg-[#007f8b] px-3 py-2 text-xs font-semibold text-white hover:bg-[#006c76] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" />
                {sendingConsentEmails ? 'Queueing...' : 'Email selected testers'}
              </button>
            </div>
          </div>
        )}

        {loading && rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">Syncing Applause statuses...</div>
        ) : filteredRows.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">{tabRows.length ? 'No records match your search.' : 'No records in this project stage.'}</div>
        ) : (
          <div className="max-h-[70vh] overflow-auto">
            <table className="min-w-full border-collapse text-left text-xs">
              <thead className="sticky top-0 z-10 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="whitespace-nowrap border-b border-slate-200 px-3 py-3 font-bold">
                    <input
                      type="checkbox"
                      aria-label="Select visible consent-pending testers"
                      checked={pendingConsentRows.length > 0 && pendingConsentRows.every((row) => selectedConsentRows.has(row.source_key))}
                      onChange={toggleAllVisiblePending}
                      disabled={sendingConsentEmails || pendingConsentRows.length === 0}
                    />
                  </th>
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
                    <td className="whitespace-nowrap px-3 py-3">
                      {row.consent_name.trim().toLowerCase() === 'pending' ? (
                        <input
                          type="checkbox"
                          aria-label={`Select ${row.tester_email || row.tester_id || row.source_key} for a consent reminder`}
                          checked={selectedConsentRows.has(row.source_key)}
                          onChange={() => toggleConsentRow(row.source_key)}
                          disabled={sendingConsentEmails}
                        />
                      ) : null}
                    </td>
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
