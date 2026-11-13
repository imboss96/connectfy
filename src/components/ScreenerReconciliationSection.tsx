import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, RefreshCw, Search, Send, ShieldCheck, Users } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { fetchApplicationTesterIdsFromSupabase, fetchRegisteredTestersFromSupabase, RegisteredTester } from '../lib/projectRepository';
import { isProjectOpenForApplications } from '../lib/projectStatus';
import { supabase } from '../lib/supabase';

const languageOptions = ['English', 'Bengali', 'Hindi', 'Bahasa', 'Portuguese', 'Spanish (MX)', 'None of the above', 'Other'];
const deviceOptions = [
  'Android (mobile) — camera & mic functional',
  'iOS (mobile) — camera & mic functional',
  'No functional camera/microphone',
  'Other'
];
const genderOptions = ['Male', 'Female', 'Non-Binary', 'Prefer not to say', 'Other'];

type ScreenerAnswers = {
  full_name: string;
  utest_id: string;
  utest_email: string;
  date_of_birth: string;
  phone_number: string;
  country: string;
  gmail_email: string;
  gender: string;
  gender_other: string;
  fluent_languages: string[];
  language_other: string;
  has_valid_id: boolean | null;
  willing_voice_recording: boolean | null;
  recording_space_available: boolean | null;
  smartphone: string;
  device_type: string;
  device_other: string;
  os_version: string;
  utest_account_screenshot_url: string;
};

const emptyAnswers: ScreenerAnswers = {
  full_name: '',
  utest_id: '',
  utest_email: '',
  date_of_birth: '',
  phone_number: '',
  country: '',
  gmail_email: '',
  gender: '',
  gender_other: '',
  fluent_languages: [],
  language_other: '',
  has_valid_id: null,
  willing_voice_recording: null,
  recording_space_available: null,
  smartphone: '',
  device_type: '',
  device_other: '',
  os_version: '',
  utest_account_screenshot_url: ''
};

const inputClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-sky-600';

export const ScreenerReconciliationSection: React.FC = () => {
  const { projects, applications } = useApp();
  const [testers, setTesters] = useState<RegisteredTester[]>([]);
  const [appliedTesterIds, setAppliedTesterIds] = useState<Set<string>>(new Set());
  const [lockedApplicationIds, setLockedApplicationIds] = useState<Set<string>>(new Set());
  const [savedAnswersByApplication, setSavedAnswersByApplication] = useState<Record<string, Partial<ScreenerAnswers>>>({});
  const [selectedTesterId, setSelectedTesterId] = useState('');
  const [selectedApplicationId, setSelectedApplicationId] = useState('');
  const [queueView, setQueueView] = useState<'never_applied' | 'pending'>('never_applied');
  const [projectId, setProjectId] = useState('');
  const [answers, setAnswers] = useState<ScreenerAnswers>(emptyAnswers);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const reload = async () => {
    setIsLoading(true);
    setError('');
    try {
      const [registered, applied, detailResult] = await Promise.all([
        fetchRegisteredTestersFromSupabase(),
        fetchApplicationTesterIdsFromSupabase(),
        supabase?.from('application_utest_details').select('application_id,screener_submission_status,full_name,utest_id,utest_email,date_of_birth,phone_number,country,gmail_email,gender,gender_other,fluent_languages,language_other,has_valid_id,willing_voice_recording,recording_space_available,smartphone,screener_device_type,screener_device_other,screener_os_version,utest_account_screenshot_url')
      ]);
      if (detailResult?.error) throw detailResult.error;
      setTesters(registered);
      setAppliedTesterIds(applied);
      setLockedApplicationIds(new Set((detailResult?.data || [])
        .filter((row) => ['queued', 'pending', 'submitted'].includes(row.screener_submission_status))
        .map((row) => row.application_id)));
      setSavedAnswersByApplication(Object.fromEntries((detailResult?.data || []).map((row) => [row.application_id, {
        full_name: row.full_name,
        utest_id: row.utest_id,
        utest_email: row.utest_email,
        date_of_birth: row.date_of_birth || '',
        phone_number: row.phone_number,
        country: row.country,
        gmail_email: row.gmail_email,
        gender: row.gender,
        gender_other: row.gender_other,
        fluent_languages: row.fluent_languages || [],
        language_other: row.language_other,
        has_valid_id: row.has_valid_id,
        willing_voice_recording: row.willing_voice_recording,
        recording_space_available: row.recording_space_available,
        smartphone: row.smartphone,
        device_type: row.screener_device_type,
        device_other: row.screener_device_other,
        os_version: row.screener_os_version,
        utest_account_screenshot_url: row.utest_account_screenshot_url
      }])));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load testers and application history.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  const neverAppliedTesters = useMemo(() => {
    const query = search.trim().toLowerCase();
    return testers.filter((tester) => !appliedTesterIds.has(tester.id)
      && (!query || `${tester.name} ${tester.email}`.toLowerCase().includes(query)));
  }, [appliedTesterIds, search, testers]);

  const pendingApplications = useMemo(() => {
    const query = search.trim().toLowerCase();
    return applications.filter((application) => application.status === 'pending'
      && (!query || `${application.testerName} ${application.testerEmail} ${application.projectTitle || ''}`.toLowerCase().includes(query))
      && !lockedApplicationIds.has(application.id));
  }, [applications, lockedApplicationIds, search]);

  const openProjects = useMemo(() => projects.filter((project) => isProjectOpenForApplications(project)), [projects]);
  const selectableProjects = useMemo(() => {
    const existingProjectId = applications.find((application) => application.id === selectedApplicationId)?.projectId;
    return projects.filter((project) => isProjectOpenForApplications(project) || project.id === existingProjectId);
  }, [applications, projects, selectedApplicationId]);
  const selectedProject = selectableProjects.find((project) => project.id === projectId);

  const setField = <K extends keyof ScreenerAnswers>(key: K, value: ScreenerAnswers[K]) => {
    setAnswers((current) => ({ ...current, [key]: value }));
  };

  const toggleLanguage = (language: string) => {
    setAnswers((current) => ({
      ...current,
      fluent_languages: current.fluent_languages.includes(language)
        ? current.fluent_languages.filter((item) => item !== language)
        : [...current.fluent_languages, language]
    }));
  };

  const submitVerifiedScreener = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase || !selectedTesterId || !projectId || !confirmed) return;
    setIsSubmitting(true);
    setError('');
    setNotice('');
    try {
      const { data, error: rpcError } = await supabase.rpc('admin_reconcile_application_screener', {
        p_project_id: projectId,
        p_tester_id: selectedTesterId,
        p_answers: answers,
        p_applicant_confirmed: confirmed
      });
      if (rpcError) throw rpcError;
      setAppliedTesterIds((current) => new Set([...current, selectedTesterId]));
      setNotice(`Verified answers saved for ${selectedProject?.title || 'the project'} (application ${String(data).slice(0, 8)}). The Applause screener has been queued automatically.`);
      setSelectedTesterId('');
      setSelectedApplicationId('');
      setAnswers(emptyAnswers);
      setConfirmed(false);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to save and queue this screener.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-5 text-slate-800">
      <header className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg border border-sky-200 bg-sky-50 p-2.5 text-sky-700"><ShieldCheck className="h-5 w-5" /></div>
            <div>
              <h1 className="text-xl font-black text-slate-900">Never Applied · Screener Reconciliation</h1>
              <p className="mt-1 max-w-3xl text-sm text-slate-600">Reconcile missing or failed screener details with answers verified directly from the tester, then queue automatic Applause submission.</p>
            </div>
          </div>
          <button type="button" onClick={() => void reload()} disabled={isLoading} title="Refresh tester list" aria-label="Refresh tester list" className="rounded-lg border border-slate-300 bg-white p-2 text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4 text-xs">
          <span className="font-semibold text-slate-700">Never applied: {isLoading ? '…' : neverAppliedTesters.length}</span>
          <span className="text-slate-400">|</span>
          <span className="text-slate-600">Only open projects with available slots can be selected.</span>
        </div>
      </header>

      {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}
      {notice && <div role="status" className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />{notice}</div>}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(260px,0.72fr)_minmax(0,1.8fr)]">
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 p-3">
            <div className="mb-3 grid grid-cols-2 rounded-lg bg-slate-100 p-1">
              <button type="button" onClick={() => { setQueueView('never_applied'); setSelectedTesterId(''); setSelectedApplicationId(''); }} className={`rounded-md px-2 py-2 text-xs font-bold ${queueView === 'never_applied' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>Never Applied</button>
              <button type="button" onClick={() => { setQueueView('pending'); setSelectedTesterId(''); setSelectedApplicationId(''); }} className={`rounded-md px-2 py-2 text-xs font-bold ${queueView === 'pending' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>Pending / Missing</button>
            </div>
            <label className="relative block">
              <span className="sr-only">Search never-applied testers</span>
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name or email" className={`${inputClass} pl-9`} />
            </label>
          </div>
          <div className="max-h-[70vh] divide-y divide-slate-100 overflow-y-auto">
            {isLoading ? <p className="p-5 text-center text-sm text-slate-500">Loading tester and application records…</p>
              : queueView === 'never_applied'
                ? neverAppliedTesters.length === 0 ? <p className="p-5 text-center text-sm text-slate-500">No never-applied testers match.</p>
                  : neverAppliedTesters.map((tester) => (
                    <button key={tester.id} type="button" onClick={() => { setSelectedTesterId(tester.id); setSelectedApplicationId(''); setAnswers((current) => ({ ...current, ...emptyAnswers, full_name: tester.name })); setNotice(''); }} className={`block w-full px-4 py-3 text-left hover:bg-sky-50 ${selectedTesterId === tester.id && !selectedApplicationId ? 'bg-sky-50 ring-1 ring-inset ring-sky-300' : ''}`}>
                      <span className="block truncate text-sm font-bold text-slate-900">{tester.name}</span>
                      <span className="mt-0.5 block truncate text-xs text-slate-500">{tester.email}</span>
                    </button>
                  ))
                : pendingApplications.length === 0 ? <p className="p-5 text-center text-sm text-slate-500">No pending applications need reconciliation.</p>
                  : pendingApplications.map((application) => (
                    <button key={application.id} type="button" onClick={() => { setSelectedTesterId(application.testerId); setSelectedApplicationId(application.id); setProjectId(application.projectId); setAnswers({ ...emptyAnswers, ...savedAnswersByApplication[application.id], full_name: savedAnswersByApplication[application.id]?.full_name || application.testerName }); setNotice(''); }} className={`block w-full px-4 py-3 text-left hover:bg-sky-50 ${selectedApplicationId === application.id ? 'bg-sky-50 ring-1 ring-inset ring-sky-300' : ''}`}>
                      <span className="block truncate text-sm font-bold text-slate-900">{application.testerName}</span>
                      <span className="mt-0.5 block truncate text-xs text-slate-500">{application.projectTitle || application.projectId} · {application.testerEmail}</span>
                    </button>
                  ))}
          </div>
        </section>

        <form onSubmit={(event) => void submitVerifiedScreener(event)} className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5 text-xs font-semibold text-slate-700">Project
              <select required value={projectId} onChange={(event) => setProjectId(event.target.value)} className={inputClass}>
                <option value="">Choose an open project</option>
                {selectableProjects.map((project) => <option key={project.id} value={project.id}>{project.title}{!isProjectOpenForApplications(project) ? ' · existing application' : ''}</option>)}
              </select>
            </label>
            <label className="space-y-1.5 text-xs font-semibold text-slate-700">Selected tester
              <input readOnly value={testers.find((tester) => tester.id === selectedTesterId)?.email || ''} placeholder="Select from never-applied list" className={`${inputClass} bg-slate-50`} />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="space-y-1.5 text-xs font-semibold text-slate-700">Full legal name<input required maxLength={200} value={answers.full_name} onChange={(event) => setField('full_name', event.target.value)} className={inputClass} /></label>
            <label className="space-y-1.5 text-xs font-semibold text-slate-700">uTest ID<input required inputMode="numeric" value={answers.utest_id} onChange={(event) => setField('utest_id', event.target.value)} placeholder="3000001–4000001" className={inputClass} /></label>
            <label className="space-y-1.5 text-xs font-semibold text-slate-700">uTest email<input required type="email" value={answers.utest_email} onChange={(event) => setField('utest_email', event.target.value)} className={inputClass} /></label>
            <label className="space-y-1.5 text-xs font-semibold text-slate-700">Date of birth<input required type="date" max={new Date().toISOString().slice(0, 10)} value={answers.date_of_birth} onChange={(event) => setField('date_of_birth', event.target.value)} className={inputClass} /></label>
            <label className="space-y-1.5 text-xs font-semibold text-slate-700">Phone number<input required type="tel" value={answers.phone_number} onChange={(event) => setField('phone_number', event.target.value)} className={inputClass} /></label>
            <label className="space-y-1.5 text-xs font-semibold text-slate-700">Country<input required value={answers.country} onChange={(event) => setField('country', event.target.value)} className={inputClass} /></label>
            <label className="space-y-1.5 text-xs font-semibold text-slate-700">Profile Gmail<input required type="email" value={answers.gmail_email} onChange={(event) => setField('gmail_email', event.target.value)} placeholder="name@gmail.com" className={inputClass} /></label>
            <label className="space-y-1.5 text-xs font-semibold text-slate-700">Gender<select required value={answers.gender} onChange={(event) => setField('gender', event.target.value)} className={inputClass}><option value="">Choose</option>{genderOptions.map((option) => <option key={option}>{option}</option>)}</select></label>
            {answers.gender === 'Other' && <label className="space-y-1.5 text-xs font-semibold text-slate-700">Gender details<input required value={answers.gender_other} onChange={(event) => setField('gender_other', event.target.value)} className={inputClass} /></label>}
          </div>

          <fieldset className="rounded-lg border border-slate-200 p-3">
            <legend className="px-1 text-xs font-bold text-slate-700">Fluent languages</legend>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {languageOptions.map((language) => <label key={language} className="flex items-center gap-2 text-xs text-slate-700"><input type="checkbox" checked={answers.fluent_languages.includes(language)} onChange={() => toggleLanguage(language)} className="h-4 w-4 rounded border-slate-300" />{language}</label>)}
            </div>
            {answers.fluent_languages.includes('Other') && <input required aria-label="Other language" value={answers.language_other} onChange={(event) => setField('language_other', event.target.value)} placeholder="Other language" className={`${inputClass} mt-3`} />}
          </fieldset>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5 text-xs font-semibold text-slate-700">Mobile device<select required value={answers.device_type} onChange={(event) => setField('device_type', event.target.value)} className={inputClass}><option value="">Choose</option>{deviceOptions.map((option) => <option key={option}>{option}</option>)}</select></label>
            {answers.device_type === 'Other' && <label className="space-y-1.5 text-xs font-semibold text-slate-700">Device details<input required value={answers.device_other} onChange={(event) => setField('device_other', event.target.value)} className={inputClass} /></label>}
            <label className="space-y-1.5 text-xs font-semibold text-slate-700">Device model<input required value={answers.smartphone} onChange={(event) => setField('smartphone', event.target.value)} placeholder="e.g. Pixel 8" className={inputClass} /></label>
            <label className="space-y-1.5 text-xs font-semibold text-slate-700">OS version<input required value={answers.os_version} onChange={(event) => setField('os_version', event.target.value)} className={inputClass} /></label>
            <label className="space-y-1.5 text-xs font-semibold text-slate-700 sm:col-span-2">uTest account screenshot URL<input required type="url" value={answers.utest_account_screenshot_url} onChange={(event) => setField('utest_account_screenshot_url', event.target.value)} placeholder="https://…" className={inputClass} /></label>
          </div>

          <fieldset className="grid gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-3">
            <legend className="px-1 text-xs font-bold text-slate-700">Applicant confirmations</legend>
            {([
              ['has_valid_id', 'Valid government ID'],
              ['willing_voice_recording', 'Willing to record voice'],
              ['recording_space_available', 'Suitable recording space']
            ] as const).map(([field, label]) => <label key={field} className="space-y-1.5 text-xs font-semibold text-slate-700">{label}<select required value={answers[field] === null ? '' : String(answers[field])} onChange={(event) => setField(field, event.target.value === 'true')} className={inputClass}><option value="">Choose</option><option value="true">Yes</option><option value="false">No</option></select></label>)}
          </fieldset>

          <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950">
            <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 rounded border-amber-400" />
            <span>I personally verified these answers with the selected tester, confirmed their authorization to submit them to Applause, and checked that the screenshot belongs to their uTest account.</span>
          </label>

          <button type="submit" disabled={isSubmitting || !selectedTesterId || !projectId || !confirmed || answers.fluent_languages.length === 0} className="inline-flex items-center gap-2 rounded-lg bg-sky-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-50">
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {isSubmitting ? 'Saving and queuing…' : 'Save verified answers and queue screener'}
          </button>
        </form>
      </div>
    </div>
  );
};
