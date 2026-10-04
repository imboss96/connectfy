import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Mail, RefreshCw, Search, Send, Users, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { fetchSheetCsv, parseProjectEligibilitySheet } from '../lib/projectSheetSync';
import { EmailTemplateMismatchError, sendProjectEmail } from '../lib/emailService';
import {
  LEGACY_SHEET_EMAIL_INSTRUCTIONS,
  LEGACY_SHEET_EMAIL_INTRO,
  LEGACY_SHEET_EMAIL_SIGN_OFF,
  LEGACY_SHEET_EMAIL_SUBJECT,
  LEGACY_SHEET_EMAIL_SUPPORT,
  LEGACY_SHEET_EMAIL_UTEST_SIGNUP
} from '../lib/legacySheetEmail.js';

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
  formRecipients: { email: string; name: string }[];
  lastActivity: string;
};

const normalizeUtestId = (value: string) => value.trim().toLowerCase();
const normalizeEmail = (value: string) => value.trim().toLowerCase();
const EMAIL_VALIDATION_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
        formRecipients: [],
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
    const formEmail = normalizeEmail(row.email);
    if (formEmail && !participant.formRecipients.some((recipient) => recipient.email === formEmail)) {
      participant.formRecipients.push({ email: formEmail, name: normalizedText(row.full_name) });
    }
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
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(() => new Set());
  const [blockedEmails, setBlockedEmails] = useState<Set<string>>(() => new Set());
  const [sentEmails, setSentEmails] = useState<Set<string>>(() => new Set());
  const [emailTrackingReady, setEmailTrackingReady] = useState(false);
  const [sendingEmails, setSendingEmails] = useState(false);
  const [emailPreviewOpen, setEmailPreviewOpen] = useState(false);
  const [emailResult, setEmailResult] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

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

  useEffect(() => {
    let cancelled = false;
    setEmailTrackingReady(false);
    if (!supabase) {
      setEmailError('Supabase is not configured. Email sending and tracking are unavailable.');
      return () => { cancelled = true; };
    }

    void supabase
      .from('legacy_sheet_email_log')
      .select('recipient_email,status')
      .eq('project_id', projectId)
      .in('status', ['sent', 'pending', 'unverified'])
      .then(({ data, error: logError }) => {
        if (cancelled) return;
        if (logError) {
          console.error('Unable to load project eligibility email history:', logError);
          setEmailError(`Email tracking is unavailable: ${logError.message}`);
          setEmailTrackingReady(false);
          return;
        }
        const logRows = data || [];
        setBlockedEmails(new Set(logRows.map((entry) => normalizeEmail(entry.recipient_email))));
        setSentEmails(new Set(logRows
          .filter((entry) => entry.status === 'sent')
          .map((entry) => normalizeEmail(entry.recipient_email))));
        setEmailError(null);
        setEmailTrackingReady(true);
      });

    return () => { cancelled = true; };
  }, [projectId]);

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
  const visibleSheetRecipients = useMemo(() => [...new Set(filteredRows
    .flatMap((row) => row.formRecipients.map((recipient) => recipient.email))
    .filter((email) => EMAIL_VALIDATION_PATTERN.test(email) && !blockedEmails.has(email)))], [filteredRows, blockedEmails]);
  const selectedRecipients = useMemo(() => {
    const recipients = new Map<string, { email: string; name: string }>();
    mergedRows.forEach((row) => row.formRecipients.forEach((recipient) => {
      if (selectedEmails.has(recipient.email) && !blockedEmails.has(recipient.email) && !recipients.has(recipient.email)) {
        recipients.set(recipient.email, recipient);
      }
    }));
    return [...recipients.values()];
  }, [mergedRows, selectedEmails, blockedEmails]);

  const toggleRecipient = (email: string) => {
    if (blockedEmails.has(email) || !emailTrackingReady) return;
    setSelectedEmails((current) => {
      const next = new Set(current);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
    setEmailResult(null);
    setEmailError(null);
  };

  const toggleVisibleRecipients = () => {
    setSelectedEmails((current) => {
      const next = new Set(current);
      const allSelected = visibleSheetRecipients.length > 0 && visibleSheetRecipients.every((email) => next.has(email));
      visibleSheetRecipients.forEach((email) => allSelected ? next.delete(email) : next.add(email));
      return next;
    });
    setEmailResult(null);
    setEmailError(null);
  };

  const sendEligibilityEmails = async () => {
    if (!supabase || !emailTrackingReady || selectedRecipients.length === 0) {
      setEmailError('Email tracking is not ready. Confirm the project email-log migration is applied and retry.');
      return;
    }

    setSendingEmails(true);
    setEmailError(null);
    setEmailResult(null);
    const sent: string[] = [];
    const failed: string[] = [];
    const blocked: string[] = [];
    const failureMessages: string[] = [];

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) throw new Error(userError?.message || 'Sign in again before sending eligibility emails.');

      for (const recipient of selectedRecipients) {
        const { data: logEntry, error: logInsertError } = await supabase
          .from('legacy_sheet_email_log')
          .insert({
            recipient_email: recipient.email,
            recipient_name: recipient.name,
            project_id: projectId,
            email_type: 'legacy_sheet_reapply',
            subject: LEGACY_SHEET_EMAIL_SUBJECT,
            status: 'pending',
            created_by: userData.user.id
          })
          .select('id')
          .single();
        if (logInsertError || !logEntry) {
          failed.push(recipient.email);
          failureMessages.push(`${recipient.email}: Could not create the email tracking record, so no email was sent. ${logInsertError?.message || ''}`);
          continue;
        }

        let sendError: unknown;
        try {
          await sendProjectEmail({
            type: 'legacy_sheet_reapply',
            toEmail: recipient.email,
            toName: recipient.name || 'there',
            projectTitle,
            projectCompany: 'Connectfy',
            projectDescription: 'Thank you for your interest in this project. This opportunity has a uTest account eligibility requirement.',
            actionUrl: window.location.origin,
            projectLink: window.location.origin,
            supportEmail: 'support@connectfy.tech'
          });
        } catch (error) {
          sendError = error;
        }

        const templateMismatch = sendError instanceof EmailTemplateMismatchError;
        const sendMessage = sendError instanceof Error ? sendError.message : 'Email request failed.';
        const { error: updateError } = await supabase
          .from('legacy_sheet_email_log')
          .update(sendError
            ? { status: templateMismatch ? 'unverified' : 'failed', error_message: sendMessage }
            : { status: 'sent', sent_at: new Date().toISOString(), error_message: null })
          .eq('id', logEntry.id);

        if (!sendError && !updateError) {
          sent.push(recipient.email);
        } else if (templateMismatch || updateError) {
          blocked.push(recipient.email);
          if (!sendError) sent.push(recipient.email);
          failureMessages.push(`${recipient.email}: ${sendMessage}${updateError ? ` Tracking update failed: ${updateError.message}` : ''}`);
        } else {
          failed.push(recipient.email);
          failureMessages.push(`${recipient.email}: ${sendMessage}`);
        }
      }

      setSentEmails((current) => new Set([...current, ...sent]));
      setBlockedEmails((current) => new Set([...current, ...sent, ...blocked]));
      setSelectedEmails(new Set(failed));
      setEmailResult(`Sent ${sent.length} email${sent.length === 1 ? '' : 's'}; ${failed.length} failed${blocked.length ? `; ${blocked.length} need tracking review and cannot be retried` : ''}.`);
      if (failureMessages.length) setEmailError(failureMessages.slice(0, 5).join(' '));
    } catch (error) {
      setEmailError(describeError(error));
    } finally {
      setSendingEmails(false);
      setEmailPreviewOpen(false);
    }
  };

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
        <div className="flex flex-col gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              type="button"
              onClick={toggleVisibleRecipients}
              disabled={visibleSheetRecipients.length === 0 || sendingEmails || !emailTrackingReady}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {visibleSheetRecipients.length > 0 && visibleSheetRecipients.every((email) => selectedEmails.has(email))
                ? 'Clear visible emails'
                : `Select visible sheet emails (${visibleSheetRecipients.length})`}
            </button>
            <span className="text-slate-600">{selectedRecipients.length} selected</span>
            {sentEmails.size > 0 && <span className="text-emerald-700">{sentEmails.size} already sent</span>}
            {!emailTrackingReady && <span className="text-amber-700">Email history loading or unavailable</span>}
          </div>
          <button
            type="button"
            onClick={() => { setEmailPreviewOpen(true); setEmailError(null); setEmailResult(null); }}
            disabled={selectedRecipients.length === 0 || sendingEmails || !emailTrackingReady}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#007AFF] px-3 py-2 text-xs font-bold text-white hover:bg-[#005fce] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" />
            Send eligibility email
          </button>
        </div>
        {emailResult && <p role="status" className="mx-4 mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{emailResult}</p>}
        {emailError && <p role="alert" className="mx-4 mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{emailError}</p>}
        {loading && mergedRows.length === 0 ? (
          <p className="p-10 text-center text-sm text-slate-500">Loading and merging participants...</p>
        ) : filteredRows.length === 0 ? (
          <p className="p-10 text-center text-sm text-slate-500">No participants match this search.</p>
        ) : (
          <div className="max-h-[70vh] overflow-auto">
            <table className="min-w-full border-collapse text-left text-xs">
              <thead className="sticky top-0 z-10 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="whitespace-nowrap border-b border-slate-200 px-4 py-3">Eligibility email</th>
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
                      <div className="space-y-2">
                        {row.formRecipients.length === 0 ? (
                          <span className="text-slate-400">—</span>
                        ) : row.formRecipients.map((recipient) => {
                          const emailValid = EMAIL_VALIDATION_PATTERN.test(recipient.email);
                          const isBlocked = blockedEmails.has(recipient.email);
                          return (
                            <label key={recipient.email} className="flex items-start gap-2">
                              <input
                                type="checkbox"
                                aria-label={`Select eligibility email for ${recipient.email}`}
                                checked={selectedEmails.has(recipient.email)}
                                disabled={!emailValid || isBlocked || sendingEmails || !emailTrackingReady}
                                onChange={() => toggleRecipient(recipient.email)}
                                className="mt-0.5 h-4 w-4 accent-[#007AFF] disabled:cursor-not-allowed"
                              />
                              <span className="min-w-0">
                                <span className="block break-all text-slate-700">{recipient.email}</span>
                                {!emailValid && <span className="text-[10px] text-rose-600">Invalid email</span>}
                                {sentEmails.has(recipient.email) && <span className="text-[10px] font-semibold text-emerald-700">Sent</span>}
                                {isBlocked && !sentEmails.has(recipient.email) && <span className="text-[10px] font-semibold text-amber-700">Check email status</span>}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </td>
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
      {emailPreviewOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="eligibility-email-preview-title" className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5">
              <div>
                <h3 id="eligibility-email-preview-title" className="text-base font-bold text-slate-900">Review eligibility emails</h3>
                <p className="mt-1 text-xs text-slate-500">A separate email will be sent to each of the {selectedRecipients.length} selected sheet recipient{selectedRecipients.length === 1 ? '' : 's'} for {projectTitle}.</p>
              </div>
              <button type="button" onClick={() => setEmailPreviewOpen(false)} disabled={sendingEmails} aria-label="Close eligibility email preview" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-50">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="max-h-[60vh] space-y-3 overflow-y-auto p-5">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
                <p className="text-slate-500">Subject</p>
                <p className="mt-1 font-bold text-slate-900">{LEGACY_SHEET_EMAIL_SUBJECT}</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-4 text-sm leading-6 text-slate-700">
                <p>Hello [Member name],</p>
                <p className="mt-3">{LEGACY_SHEET_EMAIL_INTRO}</p>
                <p className="mt-3">{LEGACY_SHEET_EMAIL_INSTRUCTIONS}</p>
                <p className="mt-3 text-[#007AFF]">{LEGACY_SHEET_EMAIL_UTEST_SIGNUP}</p>
                <p className="mt-3">{LEGACY_SHEET_EMAIL_SIGN_OFF}</p>
                <p className="mt-3 text-xs text-slate-500">{LEGACY_SHEET_EMAIL_SUPPORT}</p>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                Verify the recipients before sending. Sent or uncertain deliveries are tracked to prevent accidental duplicate emails.
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 p-4">
              <button type="button" onClick={() => setEmailPreviewOpen(false)} disabled={sendingEmails} className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Cancel</button>
              <button type="button" onClick={() => void sendEligibilityEmails()} disabled={sendingEmails || selectedRecipients.length === 0} className="inline-flex items-center gap-2 rounded-lg bg-[#007AFF] px-4 py-2 text-xs font-bold text-white hover:bg-[#005fce] disabled:cursor-wait disabled:opacity-60">
                <Mail className="h-3.5 w-3.5" />
                {sendingEmails ? 'Sending...' : `Send to ${selectedRecipients.length} recipient${selectedRecipients.length === 1 ? '' : 's'}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
