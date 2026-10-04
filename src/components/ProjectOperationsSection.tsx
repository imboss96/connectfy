import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  FileSpreadsheet,
  Mail,
  RefreshCw,
  Settings2,
  Users
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import { ApplauseStatusSection } from './ApplauseStatusSection';
import { EmailHistorySection } from './EmailHistorySection';
import { LegacyOnboardingSection } from './LegacyOnboardingSection';
import { ProjectParticipantsSection } from './ProjectParticipantsSection';

type ProjectSettings = {
  project_id: string;
  applause_sheet_url: string;
  eligibility_sheet_url: string;
  payroll_amount: number;
  payroll_scheduled_date: string | null;
  updated_at: string;
};

type PayrollScheduleRow = {
  project_id: string;
  source_key: string;
  tester_id: string;
  tester_email: string;
  amount: number;
  scheduled_date: string;
  status: 'scheduled' | 'paid' | 'cancelled';
  updated_at: string;
};

type OperationsTab = 'overview' | 'participants' | 'completion' | 'onboarding' | 'emails' | 'payroll' | 'integrations';

const OPERATIONS_TABS: { id: OperationsTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'overview', label: 'Overview', icon: Briefcase },
  { id: 'participants', label: 'Participants & eligibility', icon: Users },
  { id: 'completion', label: 'Completion & issues', icon: BadgeCheck },
  { id: 'onboarding', label: 'Onboarding', icon: ClipboardCheck },
  { id: 'emails', label: 'Emails', icon: Mail },
  { id: 'payroll', label: 'Payroll', icon: CalendarDays },
  { id: 'integrations', label: 'Integrations', icon: Settings2 }
];

const emptySettings = (projectId: string): ProjectSettings => ({
  project_id: projectId,
  applause_sheet_url: '',
  eligibility_sheet_url: '',
  payroll_amount: 0,
  payroll_scheduled_date: null,
  updated_at: ''
});

const toCsvUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^https:\/\/docs\.google\.com\/spreadsheets\/d\/[^/]+\/export\?/.test(trimmed)) return trimmed;
  const match = trimmed.match(/docs\.google\.com\/spreadsheets\/d\/([^/]+)/);
  if (match) return `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv`;
  if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) return `https://docs.google.com/spreadsheets/d/${trimmed}/export?format=csv`;
  return '';
};

const toSheetLink = (value: string) => {
  const match = value.match(/docs\.google\.com\/spreadsheets\/d\/([^/]+)/);
  return match ? `https://docs.google.com/spreadsheets/d/${match[1]}/edit` : value;
};

const errorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return 'Unable to complete the project operation.';
};

export const ProjectOperationsSection: React.FC = () => {
  const { projects, activeAdminProjectId, setActiveAdminProjectId, setActiveTab } = useApp();
  const [activeSection, setActiveSection] = useState<OperationsTab>('overview');
  const [settings, setSettings] = useState<ProjectSettings | null>(null);
  const [applauseSheetInput, setApplauseSheetInput] = useState('');
  const [eligibilitySheetInput, setEligibilitySheetInput] = useState('');
  const [payrollAmountInput, setPayrollAmountInput] = useState('');
  const [payrollDateInput, setPayrollDateInput] = useState('');
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [payrollRows, setPayrollRows] = useState<PayrollScheduleRow[]>([]);
  const [payrollLoading, setPayrollLoading] = useState(false);
  const [payrollError, setPayrollError] = useState<string | null>(null);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === activeAdminProjectId) || null,
    [projects, activeAdminProjectId]
  );
  const applauseCsvUrl = toCsvUrl(settings?.applause_sheet_url || '');
  const eligibilityCsvUrl = toCsvUrl(settings?.eligibility_sheet_url || '');

  const loadSettings = useCallback(async (projectId: string) => {
    if (!supabase) return;
    setSettingsLoading(true);
    setSettingsError(null);
    try {
      const { data, error } = await supabase
        .from('project_operations_settings')
        .select('project_id,applause_sheet_url,eligibility_sheet_url,payroll_amount,payroll_scheduled_date,updated_at')
        .eq('project_id', projectId)
        .maybeSingle();
      if (error) throw error;

      const loaded = (data as ProjectSettings | null) || emptySettings(projectId);
      setSettings(loaded);
      setApplauseSheetInput(loaded.applause_sheet_url);
      setEligibilitySheetInput(loaded.eligibility_sheet_url);
      setPayrollAmountInput(loaded.payroll_amount ? String(loaded.payroll_amount) : '');
      setPayrollDateInput(loaded.payroll_scheduled_date || '');
    } catch (error) {
      console.error('Unable to load project operations settings:', error);
      setSettingsError(errorMessage(error));
      setSettings(emptySettings(projectId));
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  const loadPayroll = useCallback(async (projectId: string) => {
    if (!supabase) return;
    setPayrollLoading(true);
    setPayrollError(null);
    try {
      const { data, error } = await supabase
        .from('project_payroll_schedule')
        .select('project_id,source_key,tester_id,tester_email,amount,scheduled_date,status,updated_at')
        .eq('project_id', projectId)
        .order('scheduled_date', { ascending: true });
      if (error) throw error;
      setPayrollRows((data || []) as PayrollScheduleRow[]);
    } catch (error) {
      console.error('Unable to load project payroll schedule:', error);
      setPayrollError(errorMessage(error));
      setPayrollRows([]);
    } finally {
      setPayrollLoading(false);
    }
  }, []);

  const refreshSelectedPayroll = useCallback(() => {
    if (selectedProject) void loadPayroll(selectedProject.id);
  }, [loadPayroll, selectedProject]);

  useEffect(() => {
    if (!activeAdminProjectId) {
      setSettings(null);
      setPayrollRows([]);
      return;
    }
    void loadSettings(activeAdminProjectId);
    void loadPayroll(activeAdminProjectId);
  }, [activeAdminProjectId, loadPayroll, loadSettings]);

  const saveSettings = async () => {
    if (!supabase || !selectedProject) return;
    setSettingsSaving(true);
    setSettingsError(null);
    setSettingsMessage(null);

    const normalizedApplauseUrl = toCsvUrl(applauseSheetInput);
    const normalizedEligibilityUrl = eligibilitySheetInput.trim() ? toCsvUrl(eligibilitySheetInput) : '';
    if (!normalizedApplauseUrl) {
      setSettingsError('Enter a valid Google Sheets URL or spreadsheet ID for the completion status sheet.');
      setSettingsSaving(false);
      return;
    }
    if (eligibilitySheetInput.trim() && !normalizedEligibilityUrl) {
      setSettingsError('Enter a valid Google Sheets URL or spreadsheet ID for the eligibility sheet.');
      setSettingsSaving(false);
      return;
    }

    const parsedAmount = Number(payrollAmountInput);
    if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
      setSettingsError('Payroll amount must be a valid non-negative number.');
      setSettingsSaving(false);
      return;
    }

    try {
      const nextSettings = {
        project_id: selectedProject.id,
        applause_sheet_url: normalizedApplauseUrl,
        eligibility_sheet_url: normalizedEligibilityUrl,
        payroll_amount: Number(parsedAmount.toFixed(2)),
        payroll_scheduled_date: payrollDateInput || null,
        updated_at: new Date().toISOString()
      };
      const { error } = await supabase
        .from('project_operations_settings')
        .upsert(nextSettings, { onConflict: 'project_id' });
      if (error) throw error;
      setSettings(nextSettings);
      setApplauseSheetInput(normalizedApplauseUrl);
      setEligibilitySheetInput(normalizedEligibilityUrl);
      setSettingsMessage('Project integrations and payroll settings saved.');
      if (activeAdminProjectId) await loadPayroll(activeAdminProjectId);
    } catch (error) {
      console.error('Unable to save project operations settings:', error);
      setSettingsError(errorMessage(error));
    } finally {
      setSettingsSaving(false);
    }
  };

  const scheduledRows = payrollRows.filter((row) => row.status === 'scheduled');
  const scheduledTotal = scheduledRows.reduce((total, row) => total + Number(row.amount), 0);

  if (!selectedProject) {
    return (
      <section className="mx-auto max-w-4xl space-y-5">
        <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#007AFF]">Project workspace</p>
          <h1 className="mt-1 text-xl font-bold text-slate-900">Choose a project</h1>
          <p className="mt-1 text-sm text-slate-500">Project integrations, participant status, email records, and payroll are managed separately for each listing.</p>
        </header>
        <div className="grid gap-3">
          {projects.map((project) => (
            <button
              key={project.id}
              type="button"
              onClick={() => setActiveAdminProjectId(project.id)}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-[#007AFF]/50 hover:bg-slate-50"
            >
              <span>
                <span className="block text-sm font-bold text-slate-900">{project.title}</span>
                <span className="mt-1 block text-xs text-slate-500">{project.company} · {project.category}</span>
              </span>
              <span className="text-xs font-semibold text-[#007AFF]">Open workspace</span>
            </button>
          ))}
          {projects.length === 0 && <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">No project listings are available yet.</p>}
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-5">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#007AFF]">Project workspace</p>
            <h1 className="mt-1 text-xl font-bold text-slate-900">{selectedProject.title}</h1>
            <p className="mt-1 text-sm text-slate-500">{selectedProject.company} · {selectedProject.category}</p>
          </div>
          <label className="text-xs font-semibold text-slate-600">
            Switch project
            <select
              value={selectedProject.id}
              onChange={(event) => setActiveAdminProjectId(event.target.value)}
              className="mt-1 block min-w-56 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800"
            >
              {projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
            </select>
          </label>
        </div>
      </header>

      <nav className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-2" aria-label="Project operations">
        {OPERATIONS_TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveSection(id)}
            className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition ${
              activeSection === id ? 'bg-[#007AFF] text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => { setActiveAdminProjectId(null); setActiveTab('admin_manager'); }}
          className="ml-auto inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100"
        >
          <Briefcase className="h-4 w-4" />
          All projects
        </button>
      </nav>

      {settingsError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{settingsError}</p>}
      {settingsMessage && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{settingsMessage}</p>}

      {activeSection === 'overview' && (
        <div className="grid gap-4 md:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900">Project operations</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{selectedProject.shortDescription || 'Manage this project’s participants, completion status, and payroll.'}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => setActiveSection('completion')} className="rounded-lg bg-[#007AFF] px-3 py-2 text-xs font-semibold text-white">View completion</button>
              <button type="button" onClick={() => setActiveSection('payroll')} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">View payroll</button>
            </div>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900">Payout setup</h2>
            <p className="mt-2 text-sm text-slate-600">
              {settings?.payroll_amount && settings.payroll_scheduled_date
                ? `${settings.payroll_amount.toFixed(2)} per completed participant, scheduled for ${settings.payroll_scheduled_date}.`
                : 'Set this project’s fixed completion amount and payment date in Integrations.'}
            </p>
            <button type="button" onClick={() => setActiveSection('integrations')} className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-[#007AFF]">
              <Settings2 className="h-4 w-4" /> Configure project
            </button>
          </article>
        </div>
      )}

      {activeSection === 'integrations' && (
        <div className="max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-bold text-slate-900">Project integrations & payroll</h2>
          <p className="mt-1 text-sm text-slate-500">These settings belong only to {selectedProject.title}. Paste a Google Sheets link or spreadsheet ID; the sheet must allow link viewing.</p>
          <div className="mt-5 space-y-4">
            <label className="block text-xs font-semibold text-slate-700">
              Applause status sheet
              <input value={applauseSheetInput} onChange={(event) => setApplauseSheetInput(event.target.value)} placeholder="Google Sheets URL or spreadsheet ID" className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-800 outline-none focus:border-[#007AFF]" />
            </label>
            <label className="block text-xs font-semibold text-slate-700">
              Eligibility form responses sheet
              <input value={eligibilitySheetInput} onChange={(event) => setEligibilitySheetInput(event.target.value)} placeholder="Optional Google Sheets URL or spreadsheet ID" className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-800 outline-none focus:border-[#007AFF]" />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-xs font-semibold text-slate-700">
                Fixed payment per completed participant (USD)
                <input type="number" min="0" step="0.01" value={payrollAmountInput} onChange={(event) => setPayrollAmountInput(event.target.value)} placeholder="0.00" className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-800 outline-none focus:border-[#007AFF]" />
              </label>
              <label className="block text-xs font-semibold text-slate-700">
                Scheduled payment date
                <input type="date" value={payrollDateInput} onChange={(event) => setPayrollDateInput(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-800 outline-none focus:border-[#007AFF]" />
              </label>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
              {(applauseCsvUrl || settings?.eligibility_sheet_url) && (
                <div className="flex flex-wrap gap-3 text-xs">
                  {applauseCsvUrl && <a href={toSheetLink(applauseSheetInput || settings?.applause_sheet_url || '')} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#007AFF]"><ExternalLink className="h-3.5 w-3.5" />Open status sheet</a>}
                  {eligibilityCsvUrl && <a href={toSheetLink(eligibilitySheetInput || settings?.eligibility_sheet_url || '')} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#007AFF]"><ExternalLink className="h-3.5 w-3.5" />Open eligibility sheet</a>}
                </div>
              )}
              <button type="button" onClick={() => void saveSettings()} disabled={settingsSaving || settingsLoading} className="ml-auto inline-flex items-center gap-2 rounded-lg bg-[#007AFF] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-60">
                <CheckCircle2 className="h-4 w-4" />{settingsSaving ? 'Saving...' : 'Save project settings'}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeSection === 'participants' && (
        eligibilityCsvUrl
          ? <ProjectParticipantsSection key={selectedProject.id} projectId={selectedProject.id} projectTitle={selectedProject.title} sheetCsvUrl={eligibilityCsvUrl} />
          : <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center"><FileSpreadsheet className="mx-auto h-8 w-8 text-slate-400" /><p className="mt-3 text-sm font-semibold text-slate-800">Eligibility sheet not configured</p><p className="mt-1 text-xs text-slate-500">Add this project’s response sheet under Integrations.</p><button type="button" onClick={() => setActiveSection('integrations')} className="mt-4 rounded-lg bg-[#007AFF] px-3 py-2 text-xs font-semibold text-white">Configure integration</button></div>
      )}

      {activeSection === 'completion' && (
        <ApplauseStatusSection
          projectId={selectedProject.id}
          sheetCsvUrl={applauseCsvUrl}
          sheetUrl={settings?.applause_sheet_url}
          onSynced={refreshSelectedPayroll}
        />
      )}

      {activeSection === 'onboarding' && <LegacyOnboardingSection key={selectedProject.id} projectId={selectedProject.id} />}

      {activeSection === 'emails' && <EmailHistorySection key={selectedProject.id} projectId={selectedProject.id} projectTitle={selectedProject.title} />}

      {activeSection === 'payroll' && (
        <section className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <article className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">Scheduled payments</p><p className="mt-1 text-2xl font-bold text-slate-900">{scheduledRows.length}</p>
            </article>
            <article className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">Scheduled total</p><p className="mt-1 text-2xl font-bold text-emerald-700">${scheduledTotal.toFixed(2)}</p>
            </article>
            <article className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">Per completed participant</p><p className="mt-1 text-2xl font-bold text-slate-900">{settings?.payroll_amount ? `$${Number(settings.payroll_amount).toFixed(2)}` : 'Not set'}</p>
            </article>
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 p-4">
              <div><h2 className="text-sm font-bold text-slate-900">Project payroll schedule</h2><p className="mt-1 text-xs text-slate-500">A scheduled payment is created for each completed participant with an email in the sheet.</p></div>
              <button type="button" onClick={() => void loadPayroll(selectedProject.id)} disabled={payrollLoading} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${payrollLoading ? 'animate-spin' : ''}`} />Refresh</button>
            </div>
            {payrollError && <p role="alert" className="m-4 rounded-lg bg-rose-50 p-3 text-xs text-rose-700">{payrollError}</p>}
            {payrollLoading && payrollRows.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">Loading payroll schedule...</p>
              : payrollRows.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">No payroll entries yet. Configure payout settings, then sync the project completion sheet.</p>
                : <div className="overflow-x-auto"><table className="min-w-full text-left text-xs"><thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Tester ID</th><th className="px-4 py-3">Recipient</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Scheduled date</th><th className="px-4 py-3">Schedule status</th></tr></thead><tbody className="divide-y divide-slate-100">{payrollRows.map((row) => <tr key={row.source_key}><td className="px-4 py-3">{row.tester_id || '—'}</td><td className="px-4 py-3">{row.tester_email}</td><td className="px-4 py-3 font-semibold">${Number(row.amount).toFixed(2)}</td><td className="px-4 py-3">{row.scheduled_date}</td><td className="px-4 py-3 capitalize">{row.status}</td></tr>)}</tbody></table></div>}
          </div>
        </section>
      )}
    </section>
  );
};
