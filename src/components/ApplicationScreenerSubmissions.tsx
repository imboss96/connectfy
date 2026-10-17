import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, RefreshCw, Search, Send } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import { hasValidUtestIdAndScreenshot } from '../lib/applicationScreener';

interface ScreenerSubmission {
  application_id: string;
  tester_id: string;
  full_name: string;
  utest_id: string;
  utest_email: string;
  date_of_birth: string | null;
  country: string;
  gmail_email: string;
  gender: string;
  fluent_languages: string[];
  screener_device_type: string;
  screener_os_version: string;
  screener_consent: boolean;
  screener_consent_at: string | null;
  screener_submission_status: 'not_started' | 'queued' | 'pending' | 'submitted' | 'failed';
  screener_submission_error: string | null;
  screener_submitted_at: string | null;
  utest_account_screenshot_url: string;
  phone_number: string;
  has_valid_id: boolean;
  recording_space_available: boolean | null;
  gender_other: string;
  language_other: string;
  screener_device_other: string;
}

const formatDateTime = (value: string | null) => {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};

export const ApplicationScreenerSubmissions: React.FC = () => {
  const { projects, applications } = useApp();
  const [submissions, setSubmissions] = useState<ScreenerSubmission[]>([]);
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const loadSubmissions = useCallback(async (showLoading = true) => {
    if (!supabase) {
      setError('Connectfy database is not configured.');
      if (showLoading) setIsLoading(false);
      return;
    }

    if (showLoading) setIsLoading(true);
    setError('');
    const { data, error: queryError } = await supabase
      .from('application_utest_details')
      .select('application_id,tester_id,full_name,utest_id,utest_email,date_of_birth,phone_number,country,gmail_email,gender,gender_other,fluent_languages,language_other,has_valid_id,recording_space_available,screener_device_type,screener_device_other,screener_os_version,screener_consent,screener_consent_at,screener_submission_status,screener_submission_error,screener_submitted_at,utest_account_screenshot_url')
      .order('updated_at', { ascending: false });

    if (queryError) {
      console.error('Unable to query successful Applause screener submissions:', queryError);
      setError(queryError.message.includes('screener_submission_status')
        || queryError.message.includes('column')
        ? 'Apply the application screener database migrations before querying submission status.'
        : 'Unable to load application screener submissions. Check your admin access and try again.');
      if (showLoading) setIsLoading(false);
      return;
    }

    setSubmissions((data || []) as ScreenerSubmission[]);
    setLastUpdated(new Date().toISOString());
    if (showLoading) setIsLoading(false);
  }, []);

  useEffect(() => {
    void loadSubmissions();
    const refreshInterval = setInterval(() => void loadSubmissions(false), 10000);
    return () => clearInterval(refreshInterval);
  }, [loadSubmissions]);

  const filteredSubmissions = useMemo(() => {
    const query = search.trim().toLowerCase();
    return submissions.filter((submission) => submission.screener_submission_status === 'submitted').filter((submission) => {
      const projectId = applications.find((application) => application.id === submission.application_id)?.projectId || '';
      const project = projects.find((item) => item.id === projectId);
      const matchesProject = projectFilter === 'all' || projectId === projectFilter;
      const searchable = [
        submission.full_name,
        submission.utest_id,
        submission.utest_email,
        submission.gmail_email,
        submission.country,
        submission.gender,
        ...(submission.fluent_languages || []),
        project?.title || ''
      ].join(' ').toLowerCase();
      return matchesProject && (!query || searchable.includes(query));
    });
  }, [applications, projectFilter, projects, search, submissions]);

  const pendingApplications = useMemo(() => {
    const query = search.trim().toLowerCase();
    return submissions.flatMap((submission) => {
      const application = applications.find((item) => item.id === submission.application_id);
      if (!application || application.status !== 'pending' || submission.screener_submission_status === 'submitted') return [];
      const project = projects.find((item) => item.id === application.projectId);
      const matchesProject = projectFilter === 'all' || application.projectId === projectFilter;
      const searchable = [
        application.testerName,
        application.testerEmail,
        submission.full_name,
        submission.utest_id,
        submission.utest_email,
        submission.gmail_email,
        project?.title || ''
      ].join(' ').toLowerCase();
      return matchesProject && (!query || searchable.includes(query))
        ? [{ application, submission, project }]
        : [];
    });
  }, [applications, projectFilter, projects, search, submissions]);

  return (
    <div className="space-y-5 text-slate-800">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-700">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900">Applause Screener Management</h1>
              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-600">
                Review eligible screeners processed under the organization&apos;s hiring authorization and confirm submission outcomes.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void loadSubmissions()}
            disabled={isLoading}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh submissions
          </button>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-emerald-700">Google-confirmed submissions</span>
            <span className="mt-1 block text-2xl font-black text-emerald-800">{submissions.filter((submission) => submission.screener_submission_status === 'submitted').length}</span>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Last queried</span>
            <span className="mt-1 block text-sm font-bold text-slate-800">{formatDateTime(lastUpdated)}</span>
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-sky-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sky-700">
            <Send className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900">Pending applicant screeners</h2>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-600">
              The backend automatically queues eligible pending applications under the organization&apos;s hiring authorization. Successful submissions are approved and an invitation email is queued. This list refreshes as the worker reports outcomes.
            </p>
          </div>
        </div>

        {error ? (
          <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</div>
        ) : isLoading ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">Querying pending applicant screeners…</div>
        ) : pendingApplications.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
            No pending applications with saved screener answers.
          </div>
        ) : (
          <div className="space-y-3">
            {pendingApplications.map(({ application, submission, project }) => {
              const validId = /^30\d+$/.test(submission.utest_id.trim());
              const validAccount = hasValidUtestIdAndScreenshot(submission.utest_id, submission.utest_account_screenshot_url);
              const completeConsent = submission.screener_consent && Boolean(submission.screener_consent_at);
              const ready = validId
                && validAccount
                && completeConsent
                && !['queued', 'pending'].includes(submission.screener_submission_status)
                && submission.full_name.trim() !== ''
                && submission.utest_email.trim() !== ''
                && submission.phone_number.trim() !== ''
                && submission.gmail_email.trim() !== ''
                && Boolean(submission.date_of_birth)
                && submission.country.trim() !== ''
                && submission.gender.trim() !== ''
                && (submission.gender !== 'Other' || submission.gender_other.trim() !== '')
                && submission.fluent_languages.length > 0
                && (!submission.fluent_languages.includes('Other') || submission.language_other.trim() !== '')
                && typeof submission.has_valid_id === 'boolean'
                && typeof submission.recording_space_available === 'boolean'
                && submission.screener_device_type.trim() !== ''
                && (submission.screener_device_type !== 'Other' || submission.screener_device_other.trim() !== '')
                && submission.screener_os_version.trim() !== '';
              const statusMessage = submission.screener_submission_status === 'queued'
                ? 'Queued for automatic submission.'
                : submission.screener_submission_status === 'pending'
                ? submission.screener_submission_error
                  ? 'External submission outcome is uncertain; reconcile it before retrying.'
                  : 'Submission is in progress.'
                : submission.screener_submission_status === 'failed'
                  ? submission.screener_submission_error || 'Submission was blocked; review the saved answers.'
                : !validId
                  ? 'Not eligible: uTest ID must start with 30 and contain digits only.'
                  : !validAccount
                    ? 'Not eligible: a valid uTest account screenshot is required.'
                    : !completeConsent
                    ? 'Not eligible: organization hiring authorization is not recorded.'
                      : !ready
                        ? 'Saved screener answers are incomplete.'
                        : 'Consent recorded; waiting for the backend queue.';
              return (
                <article key={application.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900">{submission.full_name || application.testerName}</p>
                      <p className="mt-1 text-xs text-slate-600">{project?.title || application.projectId}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        uTest ID: {submission.utest_id || 'Missing'} · {submission.utest_email || 'No uTest email'}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Profile Gmail: {submission.gmail_email || 'Missing'} · Consent: {completeConsent ? formatDateTime(submission.screener_consent_at) : 'Not recorded'}
                      </p>
                      <p className={`mt-2 text-xs font-semibold ${submission.screener_submission_status === 'submitted' ? 'text-emerald-700' : submission.screener_submission_status === 'failed' ? 'text-rose-700' : ready ? 'text-emerald-700' : 'text-amber-700'}`}>{statusMessage}</p>
                      {submission.screener_submission_error && submission.screener_submission_status !== 'failed' && (
                        <p role="alert" className="mt-1 text-xs text-rose-700">{submission.screener_submission_error}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      {submission.utest_account_screenshot_url && (
                        <a
                          href={submission.utest_account_screenshot_url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Review uTest screenshot
                        </a>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="relative flex-1">
            <span className="sr-only">Search successful submissions</span>
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, uTest ID/email, Gmail, country, or language"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-xs text-slate-800 outline-none focus:border-[#007AFF]"
            />
          </label>
          <select
            value={projectFilter}
            onChange={(event) => setProjectFilter(event.target.value)}
            aria-label="Filter successful submissions by project"
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-800 outline-none focus:border-[#007AFF]"
          >
            <option value="all">All projects</option>
            {projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
          </select>
        </div>

        {error ? (
          <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</div>
        ) : isLoading ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">Querying confirmed form submissions…</div>
        ) : filteredSubmissions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
            <p className="text-sm font-semibold text-slate-700">
              {submissions.length === 0 ? 'No successful submissions found yet.' : 'No submissions match your search.'}
            </p>
            {submissions.length === 0 && <p className="mt-1 text-xs text-slate-500">Only submissions confirmed by the external form appear here.</p>}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[1200px] border-collapse text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-bold">Applicant</th>
                  <th className="px-4 py-3 font-bold">uTest details</th>
                  <th className="px-4 py-3 font-bold">Profile Gmail</th>
                  <th className="px-4 py-3 font-bold">Project</th>
                  <th className="px-4 py-3 font-bold">Country / DOB</th>
                  <th className="px-4 py-3 font-bold">Screener details</th>
                  <th className="px-4 py-3 font-bold">Outcome</th>
                  <th className="px-4 py-3 font-bold">Submitted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSubmissions.map((submission) => {
                  const projectId = applications.find((application) => application.id === submission.application_id)?.projectId || '';
                  const project = projects.find((item) => item.id === projectId);
                  return (
                    <tr key={submission.application_id} className="align-top hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <p className="font-bold text-slate-900">{submission.full_name}</p>
                        <p className="mt-1 text-[10px] text-slate-500">Application {submission.application_id.slice(0, 8)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-800">{submission.utest_id}</p>
                        <p className="mt-1 text-slate-500">{submission.utest_email}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{submission.gmail_email}</td>
                      <td className="px-4 py-3 text-slate-700">{project?.title || projectId || 'Unknown project'}</td>
                      <td className="px-4 py-3 text-slate-700">
                        <p>{submission.country}</p>
                        <p className="mt-1 text-slate-500">{submission.date_of_birth || 'DOB not recorded'}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        <p>{submission.gender}</p>
                        <p className="mt-1">{(submission.fluent_languages || []).join(', ') || 'No languages recorded'}</p>
                        <p className="mt-1 text-slate-500">{submission.screener_device_type} · {submission.screener_os_version}</p>
                      </td>
                      <td className={`px-4 py-3 font-semibold ${submission.screener_submission_error ? 'text-amber-700' : 'text-emerald-700'}`}>
                        {submission.screener_submission_error || 'Google confirmed; application approved and invitation queued.'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-700">{formatDateTime(submission.screener_submitted_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
