import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, RefreshCw, Search, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { fetchSheetCsv, parseProjectEligibilitySheet } from '../lib/projectSheetSync';

type FormParticipant = {
  source_key: string;
  source_timestamp: string;
  consent: string;
  full_name: string;
  date_of_birth: string;
  gender: string;
  email: string;
  terms_agreed: string;
  utest_id: string;
  matched_profile_id: string | null;
  match_status: 'matched' | 'unmatched' | 'ambiguous';
  synced_at: string;
};

type WebsiteParticipant = {
  application_id: string;
  tester_id: string;
  full_name: string;
  email: string;
  utest_id: string;
  application_status: string;
  applied_at: string;
};

type MergedParticipant = {
  key: string;
  utestId: string;
  names: string[];
  emails: string[];
  sources: Set<'Website' | 'Form sheet'>;
  websiteStatuses: Set<string>;
  formConsents: Set<string>;
  terms: Set<string>;
  lastActivity: string;
};

const normalizeUtestId = (value: string) => value.trim().toLowerCase();

const normalizedText = (value: string | null | undefined) => (value || '').trim();
const uniqueValues = (values: string[]) => [...new Set(values.map(normalizedText).filter(Boolean))];

const mergeParticipants = (websiteRows: WebsiteParticipant[], formRows: FormParticipant[]) => {
  const merged = new Map<string, MergedParticipant>();

  const getOrCreate = (utestId: string, sourceKey: string) => {
    const normalizedId = normalizeUtestId(utestId);
    const key = normalizedId ? `utest:${normalizedId}` : sourceKey;
    let participant = merged.get(key);
    if (!participant) {
      participant = {
        key,
        utestId: normalizedText(utestId),
        names: [],
        emails: [],
        sources: new Set(),
        websiteStatuses: new Set(),
        formConsents: new Set(),
        terms: new Set(),
        lastActivity: ''
      };
      merged.set(key, participant);
    }
    return participant;
  };

  websiteRows.forEach((row) => {
    const participant = getOrCreate(row.utest_id, `website:${row.application_id}`);
    participant.sources.add('Website');
    participant.names.push(row.full_name);
    participant.emails.push(row.email);
    participant.websiteStatuses.add(row.application_status);
    if (row.applied_at > participant.lastActivity) participant.lastActivity = row.applied_at;
    if (!participant.utestId) participant.utestId = row.utest_id;
  });

  formRows.forEach((row) => {
    const participant = getOrCreate(row.utest_id, `form:${row.source_key}`);
    participant.sources.add('Form sheet');
    participant.names.push(row.full_name);
    participant.emails.push(row.email);
    participant.formConsents.add(row.consent);
    participant.terms.add(row.terms_agreed);
    if (row.source_timestamp > participant.lastActivity) participant.lastActivity = row.source_timestamp;
    if (!participant.utestId) participant.utestId = row.utest_id;
  });

  return [...merged.values()]
    .map((participant) => ({
      ...participant,
      names: uniqueValues(participant.names),
      emails: uniqueValues(participant.emails)
    }))
    .sort((left, right) => right.lastActivity.localeCompare(left.lastActivity));
};

const describeError = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return 'Unable to load and merge project participants.';
};

export const ProjectParticipantsSection: React.FC<{
  projectId: string;
  projectTitle: string;
  sheetCsvUrl: string;
}> = ({ projectId, projectTitle, sheetCsvUrl }) => {
  const [websiteRows, setWebsiteRows] = useState<WebsiteParticipant[]>([]);
  const [formRows, setFormRows] = useState<FormParticipant[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);

  const refresh = useCallback(async (syncSheet: boolean) => {
    if (!supabase) {
      setError('Supabase is not configured.');
      setLoading(false);
      return;
    }

    setLoading(true);
    if (syncSheet) setSyncing(true);
    setError(null);
    try {
      if (syncSheet) {
        if (!sheetCsvUrl) throw new Error('Configure this project’s eligibility sheet before syncing form responses.');
        const importedRows = await parseProjectEligibilitySheet(await fetchSheetCsv(sheetCsvUrl), projectId);
        const { error: syncError } = await supabase.rpc('sync_project_eligibility_responses', {
          p_project_id: projectId,
          p_rows: importedRows
        });
        if (syncError) throw syncError;
        setLastSynced(new Date());
      }

      const [applicationResult, formResult] = await Promise.all([
        supabase
          .from('applications')
          .select('id,tester_id,status,applied_at,profiles:tester_id(name,email),application_utest_details(utest_id,utest_email,full_name)')
          .eq('project_id', projectId)
          .order('applied_at', { ascending: false }),
        supabase
          .from('legacy_sheet_responses')
          .select('source_key,source_timestamp,consent,full_name,date_of_birth,gender,email,terms_agreed,utest_id,matched_profile_id,match_status,synced_at')
          .eq('project_id', projectId)
          .order('source_timestamp', { ascending: false })
      ]);
      if (applicationResult.error) throw applicationResult.error;
      if (formResult.error) throw formResult.error;

      const applicationRows: WebsiteParticipant[] = [];
      (applicationResult.data || []).forEach((application: any) => {
        const profile = Array.isArray(application.profiles) ? application.profiles[0] : application.profiles;
        const detailsList = Array.isArray(application.application_utest_details)
          ? application.application_utest_details
          : application.application_utest_details ? [application.application_utest_details] : [];
        const details = detailsList[0] || {};
        applicationRows.push({
          application_id: application.id,
          tester_id: application.tester_id,
          full_name: normalizedText(details.full_name) || normalizedText(profile?.name),
          email: normalizedText(details.utest_email) || normalizedText(profile?.email),
          utest_id: normalizedText(details.utest_id),
          application_status: normalizedText(application.status) || 'applied',
          applied_at: normalizedText(application.applied_at)
        });
      });

      setWebsiteRows(applicationRows);
      setFormRows((formResult.data || []) as FormParticipant[]);
    } catch (refreshError) {
      console.error('Unable to merge project participants:', refreshError);
      setError(describeError(refreshError));
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }, [projectId, sheetCsvUrl]);

  useEffect(() => {
    void refresh(false);
  }, [refresh]);

  const mergedRows = useMemo(() => mergeParticipants(websiteRows, formRows), [websiteRows, formRows]);
  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return mergedRows;
    return mergedRows.filter((row) =>
      [row.utestId, ...row.names, ...row.emails, ...row.websiteStatuses, ...row.formConsents]
        .join(' ')
        .toLowerCase()
        .includes(term)
    );
  }, [mergedRows, search]);
  const mergedCount = mergedRows.filter((row) => row.sources.size > 1).length;

  return (
    <section className="space-y-4">
      <header className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-[#007AFF]" />
            <h2 className="text-base font-bold text-slate-900">{projectTitle} participants</h2>
          </div>
          <p className="mt-1 text-xs text-slate-500">This view reads saved form responses from the database. Use Sync & merge to fetch the latest eligibility sheet snapshot. Website applications and form responses are deduplicated by uTest ID; records without an ID remain separate.</p>
          <p className="mt-1 text-[11px] text-slate-400">
            {websiteRows.length} website applications · {formRows.length} form responses · {mergedCount} matched across both sources
            {lastSynced ? ` · Last sheet sync ${lastSynced.toLocaleString()}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh(true)}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing sources...' : 'Sync & merge'}
        </button>
      </header>

      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-semibold text-slate-600">{filteredRows.length} of {mergedRows.length} unique participants</p>
          <label className="relative block sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search participants..." className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-xs text-slate-800 outline-none focus:border-[#007AFF]" />
          </label>
        </div>
        {loading && mergedRows.length === 0 ? (
          <p className="p-10 text-center text-sm text-slate-500">Loading and merging participants...</p>
        ) : filteredRows.length === 0 ? (
          <p className="p-10 text-center text-sm text-slate-500">No participants match this search.</p>
        ) : (
          <div className="max-h-[70vh] overflow-auto">
            <table className="min-w-full border-collapse text-left text-xs">
              <thead className="sticky top-0 z-10 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="whitespace-nowrap border-b border-slate-200 px-4 py-3">Participant</th>
                  <th className="whitespace-nowrap border-b border-slate-200 px-4 py-3">uTest ID</th>
                  <th className="whitespace-nowrap border-b border-slate-200 px-4 py-3">Sources</th>
                  <th className="whitespace-nowrap border-b border-slate-200 px-4 py-3">Website application</th>
                  <th className="whitespace-nowrap border-b border-slate-200 px-4 py-3">Form consent</th>
                  <th className="whitespace-nowrap border-b border-slate-200 px-4 py-3">Terms</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.map((row) => (
                  <tr key={row.key} className="align-top hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-800">{row.names.join(' / ') || 'Name unavailable'}</p>
                      <p className="mt-1 text-slate-500">{row.emails.join(' / ') || 'Email unavailable'}</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{row.utestId || 'Not provided — kept separate'}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {[...row.sources].map((source) => <span key={source} className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">{source}</span>)}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{[...row.websiteStatuses].join(', ') || '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{[...row.formConsents].join(', ') || '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{[...row.terms].join(', ') || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="text-[11px] text-slate-400">Only identical, non-empty uTest IDs are merged. Email or name differences never merge accounts.</p>
    </section>
  );
};
