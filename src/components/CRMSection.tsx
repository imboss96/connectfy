import React, { useEffect, useMemo, useState } from 'react';
import { Briefcase, CheckCircle2, ExternalLink, Mail, MapPin, PlusCircle, RefreshCw, Search, Send, ShieldCheck, Users, X, XCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import { AdminUserDetailsDialog } from './AdminUserDetailsDialog';
import { fetchSheetCsv, parseProjectApplauseSheet, parseProjectEligibilitySheet } from '../lib/projectSheetSync';
import { EmailTemplateMismatchError, sendProjectEmail } from '../lib/emailService';
import {
  LEGACY_SHEET_EMAIL_INSTRUCTIONS,
  LEGACY_SHEET_EMAIL_INTRO,
  LEGACY_SHEET_EMAIL_SIGN_OFF,
  LEGACY_SHEET_EMAIL_SUPPORT,
  LEGACY_SHEET_EMAIL_SUBJECT,
  LEGACY_SHEET_EMAIL_UTEST_SIGNUP
} from '../lib/legacySheetEmail.js';

type RoleFilter = 'all' | 'tester' | 'client' | 'admin';
type CRMView = 'members' | 'utest' | 'sheet' | 'participants';

type ImportedParticipant = {
  key: string;
  utestId: string;
  names: string[];
  emails: string[];
  projectIds: string[];
  sources: string[];
  statuses: string[];
  consent: string[];
  lastActivity: string;
};

type ParticipantSource = 'Website application' | 'Eligibility form' | 'Applause status sheet';
type ProjectSheetSettings = {
  project_id: string;
  eligibility_sheet_url: string;
  applause_sheet_url: string;
};

const normalizedUtestId = (value: string | null | undefined) => (value || '').trim().toLowerCase();
const cleanText = (value: string | null | undefined) => (value || '').trim();
const toCsvUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^https:\/\/docs\.google\.com\/spreadsheets\/d\/[^/]+\/export\?/.test(trimmed)) return trimmed;
  const match = trimmed.match(/docs\.google\.com\/spreadsheets\/d\/([^/]+)/);
  if (match) return `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv`;
  if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) return `https://docs.google.com/spreadsheets/d/${trimmed}/export?format=csv`;
  return '';
};

const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/1_iHEYxp6e1JN8dxI01n3iuqCbPHUijo244ocEhBJmyg/export?format=csv';
const SHEET_REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const LEGACY_PROJECT_TITLE = 'MyGov Identity & Video Verification Study';
const EMAIL_VALIDATION_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type LegacySheetMember = {
  timestamp: string;
  consent: string;
  fullName: string;
  dateOfBirth: string;
  gender: string;
  email: string;
  termsAgreed: string;
  utestId: string;
};

const parseCsv = (csv: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    if (char === '"') {
      if (quoted && csv[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      row.push(value);
      value = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && csv[index + 1] === '\n') index += 1;
      row.push(value);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      value = '';
    } else {
      value += char;
    }
  }

  if (value || row.length) {
    row.push(value);
    if (row.some((cell) => cell.trim())) rows.push(row);
  }
  return rows;
};

const parseLegacySheet = (csv: string): LegacySheetMember[] => {
  const [rawHeaders, ...rows] = parseCsv(csv);
  if (!rawHeaders || rows.length === 0) return [];

  const headers = rawHeaders.map((header) => header.replace(/^\uFEFF/, '').trim().toLowerCase().replace(/\s+/g, ' '));
  const findColumn = (matches: (header: string) => boolean) => headers.findIndex(matches);
  const columns = {
    timestamp: findColumn((header) => header.includes('timestamp')),
    consent: findColumn((header) => header.includes('consent to the information')),
    fullName: findColumn((header) => header.includes('your name')),
    dateOfBirth: findColumn((header) => header.includes('date of birth') || header.includes('(dob)')),
    gender: findColumn((header) => header.includes('gender')),
    email: findColumn((header) => header.includes('email address')),
    termsAgreed: findColumn((header) => header.includes('agree to the above terms')),
    utestId: findColumn((header) => header.includes('what is your utest id') || header === 'utest id')
  };

  if (columns.fullName < 0 || columns.email < 0) {
    throw new Error('The sheet is missing the expected name or email column. Check its header row.');
  }

  const read = (cells: string[], column: number) => column < 0 ? '' : (cells[column] || '').trim();
  return rows
    .map((cells) => ({
      timestamp: read(cells, columns.timestamp),
      consent: read(cells, columns.consent),
      fullName: read(cells, columns.fullName),
      dateOfBirth: read(cells, columns.dateOfBirth),
      gender: read(cells, columns.gender),
      email: read(cells, columns.email),
      termsAgreed: read(cells, columns.termsAgreed),
      utestId: read(cells, columns.utestId)
    }))
    .filter((member) => member.fullName || member.email || member.utestId);
};

type PlatformMember = {
  id: string;
  name: string | null;
  email: string | null;
  role: string | null;
  company: string | null;
  country: string | null;
  city: string | null;
  avatar_url: string | null;
  created_at: string | null;
  profile_data?: Record<string, any>;
};

type ApplicationUtestDetails = {
  application_id: string;
  tester_id: string;
  full_name: string;
  utest_id: string;
  utest_email: string;
  date_of_birth: string | null;
  age_range: string;
  country: string;
  smartphone: string;
  phone_number: string;
  device_confirmation: string;
  has_valid_id: boolean;
  willing_voice_recording: boolean;
  updated_at: string;
};

export const CRMSection: React.FC<{
  initialView?: CRMView;
  projectId?: string;
  projectTitle?: string;
  sheetCsvUrl?: string;
}> = ({
  initialView = 'members',
  projectId,
  projectTitle,
  sheetCsvUrl = SHEET_CSV_URL
}) => {
  const { projects } = useApp();
  const [members, setMembers] = useState<PlatformMember[]>([]);
  const [utestDetails, setUtestDetails] = useState<ApplicationUtestDetails[]>([]);
  const [activeView, setActiveView] = useState<CRMView>(initialView);
  const [projectParticipants, setProjectParticipants] = useState<ImportedParticipant[]>([]);
  const [projectParticipantsLoading, setProjectParticipantsLoading] = useState(false);
  const [projectParticipantsSyncing, setProjectParticipantsSyncing] = useState(false);
  const [projectParticipantsError, setProjectParticipantsError] = useState<string | null>(null);
  const [projectParticipantsSyncMessage, setProjectParticipantsSyncMessage] = useState<string | null>(null);
  const [projectParticipantsSearch, setProjectParticipantsSearch] = useState('');
  const [sheetMembers, setSheetMembers] = useState<LegacySheetMember[]>([]);
  const [sheetLoading, setSheetLoading] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [sheetSearch, setSheetSearch] = useState('');
  const [selectedSheetEmails, setSelectedSheetEmails] = useState<Set<string>>(() => new Set());
  const [sentSheetEmails, setSentSheetEmails] = useState<Set<string>>(() => new Set());
  const [blockedSheetEmails, setBlockedSheetEmails] = useState<Set<string>>(() => new Set());
  const [isSheetEmailTrackingReady, setIsSheetEmailTrackingReady] = useState(false);
  const [isSheetEmailPreviewOpen, setIsSheetEmailPreviewOpen] = useState(false);
  const [isSendingSheetEmails, setIsSendingSheetEmails] = useState(false);
  const [sheetEmailResult, setSheetEmailResult] = useState<string | null>(null);
  const [sheetEmailError, setSheetEmailError] = useState<string | null>(null);
  const [sheetLastRefreshed, setSheetLastRefreshed] = useState<Date | null>(null);
  const [isSyncingLegacyRecords, setIsSyncingLegacyRecords] = useState(false);
  const [legacySyncMessage, setLegacySyncMessage] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteStatus, setInviteStatus] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [dismissingAdminId, setDismissingAdminId] = useState<string | null>(null);
  const [adminDismissStatus, setAdminDismissStatus] = useState<string | null>(null);
  const [adminDismissError, setAdminDismissError] = useState<string | null>(null);
  const [selectedMember, setSelectedMember] = useState<PlatformMember | null>(null);

  const loadMembers = async () => {
    if (!supabase) {
      setMembers([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email, role, company, country, city, avatar_url, created_at, profile_data')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMembers((data || []) as PlatformMember[]);
    } catch (error) {
      console.error('Unable to load CRM members:', error);
      setMembers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadMembers();
    void loadUtestDetails();
  }, []);

  const loadProjectParticipants = async (): Promise<string | null> => {
    if (!supabase) {
      const message = 'Supabase is not configured.';
      setProjectParticipantsError(message);
      setProjectParticipantsLoading(false);
      return message;
    }

    setProjectParticipantsLoading(true);
    setProjectParticipantsError(null);
    try {
      const [formsResult, applauseResult, applicationsResult] = await Promise.all([
        supabase
          .from('legacy_sheet_responses')
          .select('source_key,project_id,source_timestamp,full_name,email,utest_id,consent,terms_agreed'),
        supabase
          .from('project_applause_status')
          .select('source_key,project_id,tester_id,tester_email,google_email,utest_id,status,consent_name,synced_at'),
        supabase
          .from('applications')
          .select('id,project_id,tester_id,status,applied_at,profiles:tester_id(name,email),application_utest_details(utest_id,utest_email,full_name)')
          .order('applied_at', { ascending: false })
      ]);
      if (formsResult.error) throw formsResult.error;
      if (applauseResult.error) throw applauseResult.error;
      if (applicationsResult.error) throw applicationsResult.error;

      const participants = new Map<string, ImportedParticipant>();
      const addParticipant = (
        source: ParticipantSource,
        rowKey: string,
        projectId: string,
        name: string,
        email: string,
        utestId: string,
        status: string,
        consent: string,
        activity: string
      ) => {
        const normalizedId = normalizedUtestId(utestId);
        const key = normalizedId ? `utest:${normalizedId}` : `${source}:${projectId}:${rowKey}`;
        let participant = participants.get(key);
        if (!participant) {
          participant = {
            key,
            utestId: cleanText(utestId),
            names: [],
            emails: [],
            projectIds: [],
            sources: [],
            statuses: [],
            consent: [],
            lastActivity: ''
          };
          participants.set(key, participant);
        }
        if (name) participant.names.push(name);
        if (email) participant.emails.push(email);
        if (projectId) participant.projectIds.push(projectId);
        participant.sources.push(source);
        if (status) participant.statuses.push(status);
        if (consent) participant.consent.push(consent);
        if (activity > participant.lastActivity) participant.lastActivity = activity;
        if (!participant.utestId) participant.utestId = cleanText(utestId);
      };

      (applicationsResult.data || []).forEach((application) => {
        const profile = Array.isArray(application.profiles) ? application.profiles[0] : application.profiles;
        const details = Array.isArray(application.application_utest_details)
          ? application.application_utest_details[0]
          : application.application_utest_details;
        addParticipant(
          'Website application',
          application.id,
          application.project_id,
          cleanText(details?.full_name) || cleanText(profile?.name),
          cleanText(details?.utest_email) || cleanText(profile?.email),
          cleanText(details?.utest_id),
          cleanText(application.status),
          '',
          cleanText(application.applied_at)
        );
      });

      (formsResult.data || []).forEach((response) => {
        addParticipant(
          'Eligibility form',
          response.source_key,
          response.project_id || '',
          cleanText(response.full_name),
          cleanText(response.email),
          cleanText(response.utest_id),
          cleanText(response.terms_agreed),
          cleanText(response.consent),
          cleanText(response.source_timestamp)
        );
      });

      (applauseResult.data || []).forEach((response) => {
        addParticipant(
          'Applause status sheet',
          response.source_key,
          response.project_id,
          '',
          cleanText(response.tester_email) || cleanText(response.google_email),
          cleanText(response.utest_id),
          cleanText(response.status),
          cleanText(response.consent_name),
          cleanText(response.synced_at)
        );
      });

      setProjectParticipants([...participants.values()].map((participant) => ({
        ...participant,
        names: [...new Set(participant.names)],
        emails: [...new Set(participant.emails)],
        projectIds: [...new Set(participant.projectIds)],
        sources: [...new Set(participant.sources)],
        statuses: [...new Set(participant.statuses)],
        consent: [...new Set(participant.consent)]
      })).sort((left, right) => right.lastActivity.localeCompare(left.lastActivity)));
      return null;
    } catch (error) {
      console.error('Unable to load unified CRM project participants:', error);
      const message =
        error instanceof Error
          ? error.message
          : error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
            ? error.message
            : 'Unable to load participants from project sources.';
      setProjectParticipantsError(message);
      return message;
    } finally {
      setProjectParticipantsLoading(false);
    }
  };

  const syncProjectParticipantSheets = async () => {
    if (!supabase) {
      setProjectParticipantsError('Supabase is not configured.');
      return;
    }

    setProjectParticipantsSyncing(true);
    setProjectParticipantsError(null);
    setProjectParticipantsSyncMessage(null);
    const syncErrors: string[] = [];
    let syncedCount = 0;

    try {
      if (projects.length === 0) throw new Error('No projects are available to sync.');
      const { data, error } = await supabase
        .from('project_operations_settings')
        .select('project_id,eligibility_sheet_url,applause_sheet_url')
        .in('project_id', projects.map((project) => project.id));
      if (error) throw error;

      const settingsByProject = new Map(
        ((data || []) as ProjectSheetSettings[]).map((settings) => [settings.project_id, settings])
      );
      const configuredProjects = projects.filter((project) => {
        const settings = settingsByProject.get(project.id);
        return Boolean(settings?.eligibility_sheet_url.trim() || settings?.applause_sheet_url.trim());
      });
      if (configuredProjects.length === 0) {
        throw new Error('No project Google Sheets are configured yet. Add eligibility or Applause sheet URLs under Project Operations → Integrations.');
      }

      for (const project of configuredProjects) {
        const settings = settingsByProject.get(project.id);
        if (!settings) continue;

        const eligibilityUrl = toCsvUrl(settings.eligibility_sheet_url);
        if (settings.eligibility_sheet_url.trim()) {
          try {
            if (!eligibilityUrl) throw new Error('The configured eligibility sheet URL is not a supported Google Sheets link.');
            const rows = await parseProjectEligibilitySheet(await fetchSheetCsv(eligibilityUrl), project.id);
            const { error: syncError } = await supabase.rpc('sync_project_eligibility_responses', {
              p_project_id: project.id,
              p_rows: rows
            });
            if (syncError) throw syncError;
            syncedCount += rows.length;
          } catch (error) {
            syncErrors.push(`${project.title} eligibility sheet: ${error instanceof Error ? error.message : 'sync failed'}`);
          }
        }

        const applauseUrl = toCsvUrl(settings.applause_sheet_url);
        if (settings.applause_sheet_url.trim()) {
          try {
            if (!applauseUrl) throw new Error('The configured Applause sheet URL is not a supported Google Sheets link.');
            const rows = await parseProjectApplauseSheet(await fetchSheetCsv(applauseUrl));
            const { error: syncError } = await supabase.rpc('sync_project_applause_status', {
              p_project_id: project.id,
              p_rows: rows
            });
            if (syncError) throw syncError;
            syncedCount += rows.length;
          } catch (error) {
            syncErrors.push(`${project.title} Applause sheet: ${error instanceof Error ? error.message : 'sync failed'}`);
          }
        }
      }

      const databaseError = await loadProjectParticipants();
      if (syncErrors.length > 0 || databaseError) {
        const message = [
          syncErrors.length ? `Some sheets could not be synced; showing the last saved database snapshot for those sources. ${syncErrors.join(' ')}` : '',
          databaseError ? `Unable to reload the saved database snapshot: ${databaseError}` : ''
        ].filter(Boolean).join(' ');
        setProjectParticipantsError(message);
        setProjectParticipantsSyncMessage(`Sync finished with errors. Successfully imported ${syncedCount} sheet rows.`);
      } else {
        setProjectParticipantsSyncMessage(`Synced ${syncedCount} rows from configured project sheets and loaded the saved database snapshot.`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to sync project participant sheets.';
      console.error('Unable to sync project participant sheets:', error);
      const databaseError = await loadProjectParticipants();
      setProjectParticipantsError(databaseError
        ? `${message} Unable to reload the saved database snapshot: ${databaseError}`
        : `${message} Showing the last saved database snapshot.`);
    } finally {
      setProjectParticipantsSyncing(false);
    }
  };

  useEffect(() => {
    if (activeView === 'participants') void loadProjectParticipants();
  }, [activeView, projects]);

  const filteredProjectParticipants = useMemo(() => {
    const term = projectParticipantsSearch.trim().toLowerCase();
    if (!term) return projectParticipants;
    return projectParticipants.filter((participant) => [
      participant.utestId,
      ...participant.names,
      ...participant.emails,
      ...participant.sources,
      ...participant.statuses,
      ...participant.projectIds.map((id) => projects.find((project) => project.id === id)?.title || '')
    ].join(' ').toLowerCase().includes(term));
  }, [projectParticipants, projectParticipantsSearch, projects]);

  const refreshSheet = async (signal?: AbortSignal) => {
    setSheetLoading(true);
    setSheetError(null);
    try {
      const response = await fetch(`${sheetCsvUrl}${sheetCsvUrl.includes('?') ? '&' : '?'}_=${Date.now()}`, { signal, cache: 'no-store' });
      if (!response.ok) throw new Error(`Google Sheets returned HTTP ${response.status}.`);
      const csv = await response.text();
      const parsedMembers = parseLegacySheet(csv);
      setSheetMembers(parsedMembers);
      setSheetLastRefreshed(new Date());
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      console.error('Unable to refresh Google Sheets members:', error);
      setSheetError(error instanceof Error ? error.message : 'Unable to load the Google Sheet.');
    } finally {
      if (!signal?.aborted) setSheetLoading(false);
    }
  };

  const syncLegacyResponses = async () => {
    if (!supabase) {
      setLegacySyncMessage('Supabase is not configured.');
      return;
    }
    if (sheetMembers.length === 0) {
      setLegacySyncMessage('Load the Google Sheet responses before syncing.');
      return;
    }

    setIsSyncingLegacyRecords(true);
    setLegacySyncMessage(null);
    try {
      const emails = sheetMembers.map((member) => member.email.trim().toLowerCase()).filter(Boolean);
      const matchingProfiles = members.filter((profile) => emails.includes((profile.email || '').trim().toLowerCase()));
      const profilesByEmail = new Map<string, PlatformMember[]>();
      matchingProfiles.forEach((profile) => {
        const email = (profile.email || '').trim().toLowerCase();
        profilesByEmail.set(email, [...(profilesByEmail.get(email) || []), profile]);
      });

      const rows = await Promise.all(sheetMembers.map(async (member) => {
        const email = member.email.trim().toLowerCase();
        const matches = profilesByEmail.get(email) || [];
        const match = matches.length === 1 ? matches[0] : null;
        const identity = `${projectId || 'global'}|${member.timestamp.trim()
          ? `timestamp:${member.timestamp.trim()}|email:${email}`
          : `row:${JSON.stringify([email, member.fullName, member.dateOfBirth, member.gender, member.utestId])}`}`;
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(identity));
        const sourceKey = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
        return {
          source_key: sourceKey,
          source_timestamp: member.timestamp,
          consent: member.consent,
          full_name: member.fullName,
          date_of_birth: member.dateOfBirth,
          gender: member.gender,
          email,
          project_id: projectId || null,
          terms_agreed: member.termsAgreed,
          utest_id: member.utestId,
          matched_profile_id: match?.id || null,
          match_status: matches.length > 1 ? 'ambiguous' : match ? 'matched' : 'unmatched',
          synced_at: new Date().toISOString()
        };
      }));
      const { error } = await supabase
        .from('legacy_sheet_responses')
        .upsert(rows, { onConflict: 'source_key' });
      if (error) throw error;

      const matchedCount = rows.filter((row) => row.match_status === 'matched').length;
      const reviewCount = rows.filter((row) => row.match_status === 'ambiguous').length;
      setLegacySyncMessage(`Synced ${rows.length} responses. Matched ${matchedCount} Connectfy accounts${reviewCount ? `; ${reviewCount} need manual review` : ''}.`);
    } catch (error) {
      console.error('Unable to sync legacy sheet responses to Connectfy:', error);
      setLegacySyncMessage(error instanceof Error ? error.message : 'Unable to sync sheet responses.');
    } finally {
      setIsSyncingLegacyRecords(false);
    }
  };

  useEffect(() => {
    if (activeView !== 'sheet') return;

    const controller = new AbortController();
    void refreshSheet(controller.signal);
    setIsSheetEmailTrackingReady(false);
    if (supabase) {
      let emailLogQuery = supabase
        .from('legacy_sheet_email_log')
        .select('recipient_email,status')
        .in('status', ['sent', 'pending', 'unverified']);
      if (projectId) emailLogQuery = emailLogQuery.eq('project_id', projectId);
      void emailLogQuery.then(({ data, error }) => {
          if (controller.signal.aborted) return;
          if (error) {
            console.error('Unable to load previously emailed sheet recipients:', error);
            setSheetEmailError(`Email tracking is unavailable: ${error.message}`);
            setIsSheetEmailTrackingReady(false);
            return;
          }
          setBlockedSheetEmails(new Set((data || []).map((entry) => entry.recipient_email.trim().toLowerCase())));
          setSentSheetEmails(new Set((data || [])
            .filter((entry) => entry.status === 'sent')
            .map((entry) => entry.recipient_email.trim().toLowerCase())));
          setIsSheetEmailTrackingReady(true);
        });
    } else {
      setSheetEmailError('Supabase is not configured. Email sending and tracking are unavailable.');
    }
    const intervalId = window.setInterval(() => {
      void refreshSheet(controller.signal);
    }, SHEET_REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
      controller.abort();
    };
  }, [activeView, projectId, projectTitle, sheetCsvUrl]);

  const filteredSheetMembers = useMemo(() => {
    const term = sheetSearch.trim().toLowerCase();
    if (!term) return sheetMembers;
    return sheetMembers.filter((member) =>
      [member.fullName, member.email, member.utestId, member.gender, member.consent, member.termsAgreed]
        .join(' ')
        .toLowerCase()
        .includes(term)
    );
  }, [sheetMembers, sheetSearch]);

  const membersWithUtestId = useMemo(
    () => sheetMembers.filter((member) => member.utestId).length,
    [sheetMembers]
  );

  const selectedSheetRecipients = useMemo(() => {
    const recipientsByEmail = new Map<string, LegacySheetMember>();
    sheetMembers.forEach((member) => {
      const email = member.email.trim().toLowerCase();
      if (selectedSheetEmails.has(email) && !blockedSheetEmails.has(email) && EMAIL_VALIDATION_PATTERN.test(email) && !recipientsByEmail.has(email)) {
        recipientsByEmail.set(email, member);
      }
    });
    return [...recipientsByEmail.entries()].map(([email, member]) => ({ email, member }));
  }, [selectedSheetEmails, blockedSheetEmails, sheetMembers]);

  const visibleSheetEmails = useMemo(
    () => [...new Set(filteredSheetMembers
      .map((member) => member.email.trim().toLowerCase())
      .filter((email) => EMAIL_VALIDATION_PATTERN.test(email) && !blockedSheetEmails.has(email)))],
    [filteredSheetMembers, blockedSheetEmails]
  );

  const toggleSheetRecipient = (email: string) => {
    if (blockedSheetEmails.has(email)) return;
    setSelectedSheetEmails((current) => {
      const next = new Set(current);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
    setSheetEmailResult(null);
    setSheetEmailError(null);
  };

  const toggleVisibleSheetRecipients = () => {
    setSelectedSheetEmails((current) => {
      const next = new Set(current);
      const allVisibleSelected = visibleSheetEmails.every((email) => next.has(email));
      visibleSheetEmails.forEach((email) => {
        if (allVisibleSelected) next.delete(email);
        else if (!blockedSheetEmails.has(email)) next.add(email);
      });
      return next;
    });
    setSheetEmailResult(null);
    setSheetEmailError(null);
  };

  const sendSheetEmails = async () => {
    if (selectedSheetRecipients.length === 0) return;
    if (!supabase || !isSheetEmailTrackingReady) {
      setSheetEmailError('Email tracking is not ready. Confirm the email log migration is applied and retry.');
      return;
    }

    setIsSendingSheetEmails(true);
    setSheetEmailResult(null);
    setSheetEmailError(null);
    const sent: string[] = [];
    const failed: string[] = [];
    const unverified: string[] = [];
    const blocked: string[] = [];
    const failureMessages: string[] = [];
    let userData;
    let userError;
    try {
      ({ data: userData, error: userError } = await supabase.auth.getUser());
    } catch (error) {
      setIsSendingSheetEmails(false);
      setSheetEmailError(error instanceof Error ? error.message : 'Unable to verify your admin session.');
      return;
    }
    if (userError || !userData.user) {
      setIsSendingSheetEmails(false);
      setSheetEmailError(userError?.message || 'Sign in again before sending and tracking emails.');
      return;
    }

    for (const { email, member } of selectedSheetRecipients) {
      let logEntry;
      let logInsertError;
      try {
        ({ data: logEntry, error: logInsertError } = await supabase
          .from('legacy_sheet_email_log')
          .insert({
            recipient_email: email,
            recipient_name: member.fullName || '',
            project_id: projectId || null,
            email_type: 'legacy_sheet_reapply',
            subject: LEGACY_SHEET_EMAIL_SUBJECT,
            status: 'pending',
            created_by: userData.user.id
          })
          .select('id')
          .single());
      } catch (error) {
        failed.push(email);
        failureMessages.push(`${email}: Could not create the email tracking record, so no email was sent. ${error instanceof Error ? error.message : ''}`);
        continue;
      }

      if (logInsertError || !logEntry) {
        failureMessages.push(`${email}: Could not create the email tracking record, so no email was sent. ${logInsertError?.message || ''}`);
        failed.push(email);
        continue;
      }

      let sendError: unknown;
      try {
        await sendProjectEmail({
          type: 'legacy_sheet_reapply',
          toEmail: email,
          toName: member.fullName || 'there',
          projectTitle: projectTitle || LEGACY_PROJECT_TITLE,
          projectCompany: 'Connectfy',
          projectDescription: 'Thank you for your interest in our project. This opportunity has a uTest account eligibility requirement.',
          actionUrl: window.location.origin,
          projectLink: window.location.origin,
          supportEmail: 'support@connectfy.tech'
        });
      } catch (error) {
        sendError = error;
      }

      const templateMismatch = sendError instanceof EmailTemplateMismatchError;
      const sendMessage = sendError instanceof Error ? sendError.message : 'Email request failed.';
      let updateError: { message: string } | null = null;
      try {
        const result = await supabase
          .from('legacy_sheet_email_log')
          .update(sendError
            ? { status: templateMismatch ? 'unverified' : 'failed', error_message: sendMessage }
            : { status: 'sent', sent_at: new Date().toISOString(), error_message: null })
          .eq('id', logEntry.id);
        updateError = result.error;
      } catch (error) {
        updateError = { message: error instanceof Error ? error.message : 'Database update failed.' };
      }

      if (!sendError) {
        if (updateError) {
          sent.push(email);
          unverified.push(email);
          blocked.push(email);
          failureMessages.push(`${email}: The email service confirmed the send, but the tracking record could not be updated from pending. ${updateError.message}`);
        } else {
          sent.push(email);
        }
      } else if (templateMismatch || updateError) {
        unverified.push(email);
        blocked.push(email);
        failureMessages.push(`${email}: ${sendMessage}${updateError ? ` Tracking update failed: ${updateError.message}` : ''}`);
      } else {
        failed.push(email);
        failureMessages.push(`${email}: ${sendMessage}`);
      }
    }

    if (sent.length > 0) {
      setSentSheetEmails((current) => new Set([...current, ...sent]));
    }
    if (sent.length > 0 || blocked.length > 0) {
      setBlockedSheetEmails((current) => new Set([...current, ...sent, ...blocked]));
    }
    setSelectedSheetEmails(new Set(failed));
    setIsSendingSheetEmails(false);
    setIsSheetEmailPreviewOpen(false);
    setSheetEmailResult(
      failed.length > 0 || unverified.length > 0
        ? `Sent ${sent.length} email${sent.length === 1 ? '' : 's'}; ${failed.length} failed${unverified.length > 0 ? `, and ${unverified.length} accepted or attempted without a confirmed tracking update (not marked for retry to avoid duplicates)` : ''}.${failed.length > 0 ? ' Failed recipients remain selected so you can retry.' : ''}`
        : `Successfully sent ${sent.length} email${sent.length === 1 ? '' : 's'}.`
    );
    if (failureMessages.length > 0) {
      setSheetEmailError(failureMessages.slice(0, 5).join(' '));
    }
  };

  const loadUtestDetails = async () => {
    if (!supabase) {
      setUtestDetails([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('application_utest_details')
        .select('application_id,tester_id,full_name,utest_id,utest_email,date_of_birth,age_range,country,smartphone,phone_number,device_confirmation,has_valid_id,willing_voice_recording,updated_at')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setUtestDetails((data || []) as ApplicationUtestDetails[]);
    } catch (error) {
      console.error('Unable to load application uTest details:', error);
      setUtestDetails([]);
    }
  };

  const handleInviteAdmin = async () => {
    const trimmed = inviteEmail.trim();
    if (!trimmed) {
      setInviteError('Enter an email address first.');
      setInviteStatus(null);
      return;
    }

    if (!supabase) {
      setInviteError('Supabase is not configured.');
      setInviteStatus(null);
      return;
    }

    setInviting(true);
    setInviteError(null);
    setInviteStatus(null);

    try {
      const { data, error } = await supabase.rpc('invite_user_as_admin', { p_email: trimmed });
      if (error) throw error;

      setInviteStatus(data ? `Admin access granted to ${trimmed}.` : `Admin access request processed for ${trimmed}.`);
      setInviteEmail('');
      await loadMembers();
    } catch (error) {
      console.error('Unable to invite admin:', error);
      setInviteError(error instanceof Error ? error.message : 'Unable to invite user as admin.');
    } finally {
      setInviting(false);
    }
  };

  const handleDismissAdmin = async (member: PlatformMember) => {
    if (!supabase) {
      setAdminDismissError('Supabase is not configured.');
      setAdminDismissStatus(null);
      return;
    }

    const memberLabel = member.name || member.email || 'this member';
    if (!window.confirm(`Remove admin access for ${memberLabel}? Their account will become a tester account.`)) {
      return;
    }

    setDismissingAdminId(member.id);
    setAdminDismissError(null);
    setAdminDismissStatus(null);
    try {
      const { error } = await supabase.rpc('dismiss_admin', { p_user_id: member.id });
      if (error) {
        if (error.code === 'PGRST202') {
          throw new Error('The admin-dismissal function is not installed in this Supabase project yet. Run supabase/migrations/202610030003_admin_dismissal_function.sql in the Supabase SQL Editor, then retry.');
        }
        throw error;
      }

      setAdminDismissStatus(`Admin access removed for ${memberLabel}. The account is now a tester.`);
      await loadMembers();
    } catch (error) {
      console.error('Unable to remove admin access:', error);
      setAdminDismissError(
        error instanceof Error
          ? error.message
          : error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
            ? error.message
            : 'Unable to remove admin access.'
      );
    } finally {
      setDismissingAdminId(null);
    }
  };

  const filteredMembers = useMemo(() => {
    const term = search.trim().toLowerCase();

    return members.filter((member) => {
      const matchesRole = roleFilter === 'all' || member.role === roleFilter;
      const haystack = [
        member.name || '',
        member.email || '',
        member.company || '',
        member.country || '',
        member.city || '',
        member.role || ''
      ].join(' ').toLowerCase();

      const matchesSearch = !term || haystack.includes(term);
      return matchesRole && matchesSearch;
    });
  }, [members, roleFilter, search]);

  const roleCounts = useMemo(() => ({
    tester: members.filter((m) => m.role === 'tester').length,
    client: members.filter((m) => m.role === 'client').length,
    admin: members.filter((m) => m.role === 'admin').length
  }), [members]);

  const testerMembers = useMemo(
    () => members.filter((member) => member.role === 'tester'),
    [members]
  );

  return (
    <>
    <div className="space-y-6 animate-fade-in text-slate-700">
      {activeView !== 'sheet' && <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-[#00A3E0]/8 via-[#007AFF]/4 to-transparent pointer-events-none rounded-full blur-2xl" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-3 bg-[#007AFF]/10 border border-[#007AFF]/20 rounded-2xl text-[#007AFF] shadow-sm">
              <Users className="w-7 h-7" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">CRM & Platform Members</h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-500/10 text-emerald-700 border border-emerald-500/20">Operations Access</span>
              </div>
              <p className="text-xs text-slate-600 mt-1 max-w-xl">Registered Connectfy accounts are shown under Platform Members. Project Participants includes people who applied through the website or project Google Forms and sheets, even if they do not have a Connectfy account.</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-6 pt-5 border-t border-slate-200 text-xs">
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <span className="text-slate-500 block text-[11px]">Connectfy Accounts</span>
            <span className="text-lg font-bold text-slate-900">{members.length}</span>
          </div>
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <span className="text-slate-500 block text-[11px]">Testers</span>
            <span className="text-lg font-bold text-[#007AFF]">{roleCounts.tester}</span>
          </div>
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <span className="text-slate-500 block text-[11px]">Clients & Admins</span>
            <span className="text-lg font-bold text-emerald-600">{roleCounts.client + roleCounts.admin}</span>
          </div>
        </div>
      </div>}

      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        {activeView !== 'sheet' && <div className="mb-4 flex items-center gap-2 border-b border-slate-200 pb-3">
          <button
            type="button"
            onClick={() => setActiveView('members')}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition ${activeView === 'members' ? 'bg-[#007AFF] text-white shadow-md shadow-[#007AFF]/20' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}
          >
            Platform Members
          </button>
          <button
            type="button"
            onClick={() => setActiveView('utest')}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition ${activeView === 'utest' ? 'bg-[#007AFF] text-white shadow-md shadow-[#007AFF]/20' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}
          >
            uTest Details
          </button>
          <button
            type="button"
            onClick={() => setActiveView('participants')}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition ${activeView === 'participants' ? 'bg-[#007AFF] text-white shadow-md shadow-[#007AFF]/20' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}
          >
            Project Participants
          </button>
        </div>
        }

        {activeView === 'sheet' ? (
          <div className="overflow-hidden rounded-2xl border border-[#1E2E4E] bg-[#0B132B] shadow-lg">
            <div className="flex flex-col gap-4 border-b border-[#1E2E4E] bg-gradient-to-r from-[#0B132B] to-[#111C33] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-bold text-white">{projectTitle ? `${projectTitle} eligibility responses` : 'Legacy project-interest responses'}</h2>
                  <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-bold text-cyan-300">Live sheet view</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-400">Read-only platform-style view. Updates automatically every 5 minutes. Select responses to send the project eligibility email.</p>
                <p className="mt-1 text-[10px] text-slate-500">
                  {sheetLastRefreshed ? `Last synced ${sheetLastRefreshed.toLocaleString()}` : 'Waiting for first sync'}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => void syncLegacyResponses()}
                  disabled={isSyncingLegacyRecords || sheetLoading || loading}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-400/20 disabled:cursor-wait disabled:opacity-60"
                >
                  <Users className="h-3.5 w-3.5" />
                  {isSyncingLegacyRecords ? 'Syncing records...' : 'Sync responses to Connectfy'}
                </button>
                <button
                  type="button"
                  onClick={() => void refreshSheet()}
                  disabled={sheetLoading}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#1E2E4E] bg-[#0B132B] px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-cyan-400/40 hover:bg-[#131E35] disabled:cursor-wait disabled:opacity-60"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${sheetLoading ? 'animate-spin' : ''}`} />
                  {sheetLoading ? 'Syncing...' : 'Refresh'}
                </button>
                <a
                  href={sheetCsvUrl.replace(/\/export\?format=csv(?:&.*)?$/, '/edit?usp=sharing')}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#007AFF] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#005fce]"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open sheet
                </a>
              </div>
            </div>
            {legacySyncMessage && (
              <div role="status" className="border-b border-[#1E2E4E] bg-[#111C33] px-4 py-2 text-xs text-cyan-200">
                {legacySyncMessage}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 border-b border-[#1E2E4E] p-3 sm:grid-cols-4">
              <div className="rounded-xl border border-[#1E2E4E] bg-[#111C33] px-3 py-2">
                <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Response rows</span>
                <span className="mt-1 block text-lg font-black text-white">{sheetMembers.length}</span>
              </div>
              <div className="rounded-xl border border-[#1E2E4E] bg-[#111C33] px-3 py-2">
                <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400">With uTest ID</span>
                <span className="mt-1 block text-lg font-black text-cyan-300">{membersWithUtestId}</span>
              </div>
              <label className="relative col-span-2 sm:col-span-2">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-cyan-400" />
                <input
                  type="search"
                  value={sheetSearch}
                  onChange={(event) => setSheetSearch(event.target.value)}
                  placeholder="Search name, email, uTest ID..."
                  className="h-full min-h-10 w-full rounded-xl border border-[#1E2E4E] bg-[#080D1A] py-2 pl-9 pr-3 text-xs text-white outline-none placeholder:text-slate-500 focus:border-cyan-400"
                />
              </label>
              <div className="col-span-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#1E2E4E] bg-[#111C33] px-3 py-2 sm:col-span-4">
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-300">
                  <button
                    type="button"
                    onClick={toggleVisibleSheetRecipients}
                  disabled={visibleSheetEmails.length === 0 || isSendingSheetEmails || !isSheetEmailTrackingReady}
                    className="rounded-lg border border-[#1E2E4E] bg-[#0B132B] px-3 py-1.5 font-semibold text-slate-200 hover:border-cyan-400/40 disabled:opacity-50"
                  >
                    {visibleSheetEmails.length > 0 && visibleSheetEmails.every((email) => selectedSheetEmails.has(email))
                      ? 'Clear visible'
                      : `Select visible emails (${visibleSheetEmails.length})`}
                  </button>
                  <span>{selectedSheetRecipients.length} selected</span>
                  {sentSheetEmails.size > 0 && <span className="text-emerald-300">{sentSheetEmails.size} already sent</span>}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsSheetEmailPreviewOpen(true);
                    setSheetEmailResult(null);
                    setSheetEmailError(null);
                  }}
                  disabled={selectedSheetRecipients.length === 0 || isSendingSheetEmails || !isSheetEmailTrackingReady}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#007AFF] px-3 py-2 text-xs font-bold text-white hover:bg-[#005fce] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" />
                  Send eligibility email
                </button>
              </div>
            </div>

            {sheetEmailResult && (
              <div role="status" className="mx-3 mt-3 rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-200">
                {sheetEmailResult}
              </div>
            )}
            {sheetEmailError && (
              <div role="alert" className="mx-3 mt-3 rounded-xl border border-rose-400/25 bg-rose-400/10 px-3 py-2 text-xs text-rose-200">
                {sheetEmailError}
              </div>
            )}

            {sheetError ? (
              <div className="m-4 rounded-xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-200">
                <p className="font-semibold">Could not refresh the Google Sheet.</p>
                <p className="mt-1 text-xs text-rose-200/80">{sheetError}</p>
                <button type="button" onClick={() => void refreshSheet()} className="mt-3 rounded-lg border border-rose-300/30 px-3 py-1.5 text-xs font-semibold hover:bg-rose-400/10">
                  Try again
                </button>
              </div>
            ) : sheetLoading && sheetMembers.length === 0 ? (
              <div className="p-12 text-center text-sm text-slate-400">
                <RefreshCw className="mx-auto mb-3 h-5 w-5 animate-spin text-cyan-400" />
                Loading responses from Google Sheets...
              </div>
            ) : filteredSheetMembers.length === 0 ? (
              <div className="p-12 text-center text-sm text-slate-400">
                {sheetMembers.length ? 'No responses match that search.' : 'No responses found in the connected sheet.'}
              </div>
            ) : (
              <div className="max-h-[70vh] overflow-auto">
                <table className="min-w-[1120px] w-full border-collapse text-left text-xs">
                  <thead className="sticky top-0 z-10 bg-[#111C33] text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                    <tr>
                      <th className="border-b border-[#1E2E4E] px-3 py-3">
                        <input
                          type="checkbox"
                          aria-label="Select all visible email addresses"
                          checked={visibleSheetEmails.length > 0 && visibleSheetEmails.every((email) => selectedSheetEmails.has(email))}
                          onChange={toggleVisibleSheetRecipients}
                          disabled={!isSheetEmailTrackingReady || isSendingSheetEmails}
                          className="h-4 w-4 accent-cyan-400"
                        />
                      </th>
                      <th className="border-b border-[#1E2E4E] px-4 py-3">#</th>
                      <th className="border-b border-[#1E2E4E] px-4 py-3">Member</th>
                      <th className="border-b border-[#1E2E4E] px-4 py-3">Email</th>
                      <th className="border-b border-[#1E2E4E] px-4 py-3">Date of birth</th>
                      <th className="border-b border-[#1E2E4E] px-4 py-3">Gender</th>
                      <th className="border-b border-[#1E2E4E] px-4 py-3">uTest ID</th>
                      <th className="border-b border-[#1E2E4E] px-4 py-3">Consent</th>
                      <th className="border-b border-[#1E2E4E] px-4 py-3">Terms</th>
                      <th className="border-b border-[#1E2E4E] px-4 py-3">Submitted</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1E2E4E]">
                    {filteredSheetMembers.map((member, index) => (
                      <tr key={`${member.email}-${member.timestamp}-${index}`} className="transition hover:bg-[#111C33]">
                        <td className="px-3 py-3">
                          <input
                            type="checkbox"
                            aria-label={`Select ${member.email || member.fullName || 'row'}`}
                            checked={Boolean(member.email && selectedSheetEmails.has(member.email.trim().toLowerCase()))}
                            disabled={!EMAIL_VALIDATION_PATTERN.test(member.email.trim().toLowerCase()) || blockedSheetEmails.has(member.email.trim().toLowerCase()) || isSendingSheetEmails || !isSheetEmailTrackingReady}
                            onChange={() => toggleSheetRecipient(member.email.trim().toLowerCase())}
                            className="h-4 w-4 accent-cyan-400 disabled:cursor-not-allowed"
                          />
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-[10px] font-semibold text-slate-500">{index + 1}</td>
                        <td className="whitespace-nowrap px-4 py-3 font-semibold text-white">{member.fullName || 'Name not provided'}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-cyan-300">{member.email || 'Email not provided'}{sentSheetEmails.has(member.email.trim().toLowerCase()) && <span className="ml-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300">Sent</span>}{blockedSheetEmails.has(member.email.trim().toLowerCase()) && !sentSheetEmails.has(member.email.trim().toLowerCase()) && <span className="ml-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-1.5 py-0.5 text-[9px] font-bold text-amber-300">Check status</span>}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-300">{member.dateOfBirth || '—'}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-300">{member.gender || '—'}</td>
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-slate-200">{member.utestId || <span className="text-slate-500">Not provided</span>}</td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold ${
                            member.consent.toLowerCase() === 'yes'
                              ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
                              : member.consent ? 'border-rose-400/20 bg-rose-400/10 text-rose-300' : 'border-slate-600 bg-slate-700/30 text-slate-400'
                          }`}>
                            {member.consent.toLowerCase() === 'yes' ? <CheckCircle2 className="h-3 w-3" /> : member.consent ? <XCircle className="h-3 w-3" /> : null}
                            {member.consent || 'No response'}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold ${
                            member.termsAgreed.toLowerCase() === 'yes'
                              ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
                              : member.termsAgreed ? 'border-rose-400/20 bg-rose-400/10 text-rose-300' : 'border-slate-600 bg-slate-700/30 text-slate-400'
                          }`}>
                            {member.termsAgreed.toLowerCase() === 'yes' ? <CheckCircle2 className="h-3 w-3" /> : member.termsAgreed ? <XCircle className="h-3 w-3" /> : null}
                            {member.termsAgreed || 'No response'}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-400">{member.timestamp || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="border-t border-[#1E2E4E] px-4 py-2.5 text-[10px] text-slate-500">
              Showing {filteredSheetMembers.length} of {sheetMembers.length} responses. Column 7 is intentionally excluded from this view.
            </div>

            {isSheetEmailPreviewOpen && (
              <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
                <div role="dialog" aria-modal="true" aria-labelledby="sheet-email-preview-title" className="w-full max-w-2xl overflow-hidden rounded-2xl border border-[#1E2E4E] bg-[#0B132B] shadow-2xl">
                  <div className="flex items-start justify-between gap-4 border-b border-[#1E2E4E] bg-[#111C33] p-5">
                    <div>
                      <h3 id="sheet-email-preview-title" className="text-base font-bold text-white">Review email before sending</h3>
                      <p className="mt-1 text-xs text-slate-400">This will send separate emails to {selectedSheetRecipients.length} selected recipient{selectedSheetRecipients.length === 1 ? '' : 's'}.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsSheetEmailPreviewOpen(false)}
                      disabled={isSendingSheetEmails}
                      aria-label="Close email preview"
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-[#1E2E4E] hover:text-white disabled:opacity-50"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="max-h-[65vh] space-y-4 overflow-y-auto p-5">
                    <div className="rounded-xl border border-[#1E2E4E] bg-[#080D1A] p-4 text-xs">
                      <p className="text-slate-500">Subject</p>
                      <p className="mt-1 font-bold text-white">{LEGACY_SHEET_EMAIL_SUBJECT}</p>
                    </div>
                    <div className="rounded-xl border border-[#1E2E4E] bg-[#080D1A] p-4 text-sm leading-6 text-slate-200">
                      <p>Hello [Member name],</p>
                      <p className="mt-3">{LEGACY_SHEET_EMAIL_INTRO}</p>
                      <p className="mt-3">{LEGACY_SHEET_EMAIL_INSTRUCTIONS}</p>
                      <p className="mt-3"><a href={LEGACY_SHEET_EMAIL_UTEST_SIGNUP} target="_blank" rel="noreferrer" className="font-semibold text-cyan-300 underline">Create a uTest account</a></p>
                      <p className="mt-3"><a href={window.location.origin} target="_blank" rel="noreferrer" className="font-semibold text-cyan-300 underline">Open Connectfy</a></p>
                      <p className="mt-3 whitespace-pre-line">{LEGACY_SHEET_EMAIL_SIGN_OFF}</p>
                      <p className="mt-3 whitespace-pre-line text-xs text-slate-400">{LEGACY_SHEET_EMAIL_SUPPORT}</p>
                    </div>
                    <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 p-3 text-[11px] text-amber-200">
                      Please verify the selected recipients before sending. Emails are sent individually; this action cannot be undone.
                    </div>
                  </div>
                  <div className="flex flex-col-reverse justify-end gap-2 border-t border-[#1E2E4E] bg-[#111C33] p-4 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => setIsSheetEmailPreviewOpen(false)}
                      disabled={isSendingSheetEmails}
                      className="rounded-lg border border-[#1E2E4E] px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-[#1E2E4E] disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => void sendSheetEmails()}
                      disabled={isSendingSheetEmails || selectedSheetRecipients.length === 0}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#007AFF] px-4 py-2 text-xs font-bold text-white hover:bg-[#005fce] disabled:cursor-wait disabled:opacity-60"
                    >
                      <Send className="h-3.5 w-3.5" />
                      {isSendingSheetEmails ? 'Sending...' : `Send to ${selectedSheetRecipients.length} recipient${selectedSheetRecipients.length === 1 ? '' : 's'}`}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : activeView === 'participants' ? (
          <section className="space-y-4">
            <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Project participants across onboarding sources</h2>
                <p className="mt-1 max-w-3xl text-[11px] text-slate-500">Displays the saved database snapshot from website applications, eligibility forms, and Applause sheets. Google Sheets are fetched and persisted only when you choose Sync sheets now; viewing or reloading this page does not replace the saved snapshot.</p>
                <p className="mt-1 text-[11px] text-slate-500">{filteredProjectParticipants.length} of {projectParticipants.length} participants</p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void loadProjectParticipants()}
                  disabled={projectParticipantsLoading || projectParticipantsSyncing}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-wait disabled:opacity-60"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${projectParticipantsLoading && !projectParticipantsSyncing ? 'animate-spin' : ''}`} />
                  Reload saved data
                </button>
                <button
                  type="button"
                  onClick={() => void syncProjectParticipantSheets()}
                  disabled={projectParticipantsLoading || projectParticipantsSyncing}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#007AFF] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#005fce] disabled:cursor-wait disabled:opacity-60"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${projectParticipantsSyncing ? 'animate-spin' : ''}`} />
                  {projectParticipantsSyncing ? 'Fetching and saving sheets...' : 'Sync sheets now'}
                </button>
              </div>
            </div>
            {projectParticipantsSyncMessage && (
              <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                {projectParticipantsSyncMessage}
              </p>
            )}
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="search"
                value={projectParticipantsSearch}
                onChange={(event) => setProjectParticipantsSearch(event.target.value)}
                placeholder="Search participant, uTest ID, project, source, or status..."
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-xs text-slate-900 outline-none focus:border-[#007AFF]"
              />
            </label>
            {projectParticipantsError && (
              <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                Project participant data issue: {projectParticipantsError}
              </div>
            )}
            {projectParticipantsLoading && projectParticipants.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-sm text-slate-500">Loading project participants...</div>
            ) : filteredProjectParticipants.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-sm text-slate-500">
                No saved project participants match this search. Configure project sheets under Project Operations → Integrations, then use Sync sheets now.
              </div>
            ) : (
              <div className="max-h-[70vh] overflow-auto rounded-xl border border-slate-200">
                <table className="min-w-full border-collapse text-left text-xs">
                  <thead className="sticky top-0 z-10 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="whitespace-nowrap border-b border-slate-200 px-4 py-3">Participant</th>
                      <th className="whitespace-nowrap border-b border-slate-200 px-4 py-3">uTest ID</th>
                      <th className="whitespace-nowrap border-b border-slate-200 px-4 py-3">Project</th>
                      <th className="whitespace-nowrap border-b border-slate-200 px-4 py-3">Onboarding sources</th>
                      <th className="whitespace-nowrap border-b border-slate-200 px-4 py-3">Status / consent</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredProjectParticipants.map((participant) => (
                      <tr key={participant.key} className="align-top hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-800">{participant.names.join(' / ') || 'Name unavailable'}</p>
                          <p className="mt-1 text-slate-500">{participant.emails.join(' / ') || 'Email unavailable'}</p>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-700">{participant.utestId || 'Not provided — kept separate'}</td>
                        <td className="px-4 py-3 text-slate-700">
                          {participant.projectIds.length
                            ? participant.projectIds.map((id) => projects.find((project) => project.id === id)?.title || 'Project unavailable').join(' / ')
                            : 'Unassigned / legacy source'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {participant.sources.map((source) => <span key={source} className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">{source}</span>)}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {[...participant.statuses, ...participant.consent].join(' · ') || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-[11px] text-slate-400">Email and name are displayed as contact details only; they are not used to merge records. Rows without uTest IDs remain distinct.</p>
          </section>
        ) : activeView === 'utest' ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-[#00A3E0]/30 bg-[#e0f7ff] p-3 text-xs text-[#075985]">
              uTest IDs and emails saved by testers are shown here for project payment processing. Passwords and payment credentials are never stored.
            </div>
            {loading ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-sm text-slate-500">Loading uTest details...</div>
            ) : utestDetails.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-sm text-slate-500">No tester records found.</div>
            ) : (
              <div className="space-y-3">
                {utestDetails.map((details) => {
                  const member = members.find((candidate) => candidate.id === details.tester_id);
                  return (
                    <div key={details.application_id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <h3 className="text-sm font-bold text-slate-900">{details.full_name || member?.name || 'Unnamed tester'}</h3>
                          <p className="mt-1 text-[11px] text-slate-500">{member?.email || 'No Connectfy email'}{details.country ? ` • ${details.country}` : ''}</p>
                        </div>
                        <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[10px] font-bold text-sky-700">Tester</span>
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px]">
                          <span className="block text-slate-500">Name as shown on ID</span>
                          <strong className="text-slate-900">{details.full_name || 'Not provided'}</strong>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px]">
                          <span className="block text-slate-500">Date of birth</span>
                          <strong className="text-slate-900">{details.date_of_birth || 'Not provided'}</strong>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px]">
                          <span className="block text-slate-500">uTest ID</span>
                          <strong className="text-slate-900">{details.utest_id || 'Not provided'}</strong>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px]">
                          <span className="block text-slate-500">uTest payment email</span>
                          <strong className="text-slate-900">{details.utest_email || 'Not provided'}</strong>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px]">
                          <span className="block text-slate-500">Phone number</span>
                          <strong className="text-slate-900">{details.phone_number || 'Not provided'}</strong>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px]">
                          <span className="block text-slate-500">Country / age range</span>
                          <strong className="text-slate-900">{details.country || 'Not provided'}{details.age_range ? ` • ${details.age_range}` : ''}</strong>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px]">
                          <span className="block text-slate-500">Application device</span>
                          <strong className="text-slate-900">{details.smartphone || details.device_confirmation || 'Not provided'}</strong>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <>
        <div className="flex flex-col gap-3 mb-4">
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, email, company, or location..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-900 placeholder-slate-500 focus:outline-none focus:border-[#007AFF]"
              />
            </div>

            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-[#007AFF]"
            >
              <option value="all">All roles</option>
              <option value="tester">Tester</option>
              <option value="client">Client</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div className="flex flex-col md:flex-row md:items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="relative flex-1">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="Invite a user by email as admin"
                className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-900 placeholder-slate-500 focus:outline-none focus:border-[#007AFF]"
              />
            </div>
            <button
              type="button"
              onClick={handleInviteAdmin}
              disabled={inviting}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#007AFF] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#005fce] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <PlusCircle className="w-4 h-4" />
              {inviting ? 'Inviting...' : 'Invite Admin'}
            </button>
          </div>

          {inviteStatus && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">{inviteStatus}</div>}
          {inviteError && <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">{inviteError}</div>}
          {adminDismissStatus && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">{adminDismissStatus}</div>}
          {adminDismissError && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">{adminDismissError}</div>}
        </div>

        {loading ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-sm text-slate-500">Loading member records...</div>
        ) : filteredMembers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-sm text-slate-500">No platform members match the current filters.</div>
        ) : (
          <div className="space-y-3">
            {filteredMembers.map((member) => {
              const roleTag = member.role === 'admin' ? 'Admin' : member.role === 'client' ? 'Client' : 'Tester';
              const avatarSource = member.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name || member.email || 'User')}&background=random`;

              return (
                <div key={member.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <img src={avatarSource} alt={member.name || 'Member'} className="h-11 w-11 rounded-full object-cover border border-slate-200 bg-white" referrerPolicy="no-referrer" />
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-bold text-slate-900">{member.name || 'Unnamed member'}</h3>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-white text-slate-700 border-slate-200">{roleTag}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                          <span className="inline-flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{member.email || 'No email'}</span>
                          {(member.country || member.city) && (
                            <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{[member.city, member.country].filter(Boolean).join(', ')}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                      <button
                        type="button"
                        onClick={() => setSelectedMember(member)}
                        className="inline-flex items-center gap-1 rounded-lg bg-[#007AFF] px-3 py-2 text-[11px] font-bold text-white transition hover:bg-[#005fce]"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Full user record
                      </button>
                      {member.company ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-slate-200 bg-white text-slate-700">
                          <Briefcase className="w-3.5 h-3.5" />
                          {member.company}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-slate-200 bg-white text-slate-500">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          No company profile
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-500 border-t border-slate-200 pt-3">
                    <div className="rounded-lg bg-white border border-slate-200 px-2.5 py-2">
                      <span className="block text-slate-500">Joined</span>
                      <strong className="text-slate-800">{member.created_at ? new Date(member.created_at).toLocaleDateString() : 'Unknown'}</strong>
                    </div>
                    <div className="rounded-lg bg-white border border-slate-200 px-2.5 py-2">
                      <span className="block text-slate-500">Member ID</span>
                      <strong className="text-slate-800">{member.id.slice(0, 8)}</strong>
                    </div>
                    {member.role === 'admin' && (
                      <div className="col-span-full mt-3 flex justify-end">
                        <button
                          type="button"
                          onClick={() => void handleDismissAdmin(member)}
                          disabled={dismissingAdminId !== null}
                          className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-white px-3 py-2 text-[11px] font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <XCircle className="h-4 w-4" />
                          {dismissingAdminId === member.id ? 'Removing access...' : 'Remove admin access'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
          </>
        )}
      </div>
    </div>
      {selectedMember && (
        <AdminUserDetailsDialog
          member={selectedMember}
          onClose={() => setSelectedMember(null)}
          onSaved={loadMembers}
        />
      )}
    </>
  );
};
