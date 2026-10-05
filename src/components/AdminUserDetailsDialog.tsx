import React, { useEffect, useState } from 'react';
import { AlertCircle, Briefcase, Clock, CreditCard, FileText, Loader2, Save, UserRound, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

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
};

type UserSnapshot = {
  profile: PlatformMember;
  profileData: Record<string, unknown>;
  applications: Record<string, unknown>[];
  clientProjects: Record<string, unknown>[];
  submissions: Record<string, unknown>[];
  payouts: Record<string, unknown>[];
};

type EditableProfile = {
  name: string;
  email: string;
  company: string;
  country: string;
  city: string;
  avatar_url: string;
};

const objectJson = (value: unknown) => JSON.stringify(value && typeof value === 'object' && !Array.isArray(value) ? value : {}, null, 2);

const readableDate = (value: unknown) => {
  if (typeof value !== 'string' || !value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const readableDateOnly = (value: unknown) => {
  if (typeof value !== 'string' || !value) return 'Not provided';
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return readableDate(value);
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).toLocaleDateString();
};

const displayValue = (value: unknown) => {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const inputClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-blue-100';
const panelClass = 'rounded-xl border border-slate-200 bg-white p-4';

export const AdminUserDetailsDialog: React.FC<{
  member: PlatformMember;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}> = ({ member, onClose, onSaved }) => {
  const [snapshot, setSnapshot] = useState<UserSnapshot | null>(null);
  const [profile, setProfile] = useState<EditableProfile>({
    name: member.name || '',
    email: member.email || '',
    company: member.company || '',
    country: member.country || '',
    city: member.city || '',
    avatar_url: member.avatar_url || ''
  });
  const [profileDataText, setProfileDataText] = useState('{}');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!supabase) {
        setError('Supabase is not configured.');
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      try {
        const [profileResult, applicationsResult, projectsResult, submissionsResult, payoutsResult] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', member.id).single(),
          supabase
            .from('applications')
            .select('id,status,invite_status,invite_history,selected_devices,experience_note,applied_at,updated_at,accepted_invite_at,last_invite_sent_at,project:projects(id,title,company,status,deadline),application_utest_details(*)')
            .eq('tester_id', member.id)
            .order('applied_at', { ascending: false }),
          supabase
            .from('projects')
            .select('id,title,company,status,deadline,slots_total,slots_filled,created_at,short_description,full_overview,category,project_track,payment_model,total_budget,budget_disbursed,project_data')
            .eq('client_id', member.id)
            .order('created_at', { ascending: false }),
          supabase
            .from('submissions')
            .select('id,project_id,kind,title,details,status,bounty_earned,client_feedback,client_rating,payload,submitted_at,reviewed_at,project:projects(id,title,company),attachments(*)')
            .eq('tester_id', member.id)
            .order('submitted_at', { ascending: false }),
          supabase
            .from('payout_requests')
            .select('*')
            .eq('tester_id', member.id)
            .order('requested_at', { ascending: false })
        ]);

        const failedResult = [profileResult, applicationsResult, projectsResult, submissionsResult, payoutsResult].find((result) => result.error);
        if (failedResult?.error) throw failedResult.error;
        if (!active || !profileResult.data) return;

        const loadedProfile = profileResult.data as PlatformMember & { profile_data?: Record<string, unknown> | null };
        const profileData = loadedProfile.profile_data || {};
        setSnapshot({
          profile: loadedProfile,
          profileData,
          applications: applicationsResult.data || [],
          clientProjects: projectsResult.data || [],
          submissions: submissionsResult.data || [],
          payouts: payoutsResult.data || []
        });
        setProfile({
          name: loadedProfile.name || '',
          email: loadedProfile.email || '',
          company: loadedProfile.company || '',
          country: loadedProfile.country || '',
          city: loadedProfile.city || '',
          avatar_url: loadedProfile.avatar_url || ''
        });
        setProfileDataText(objectJson(profileData));
      } catch (loadError) {
        console.error('Unable to load complete admin user record:', loadError);
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load the complete user record.');
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => { active = false; };
  }, [member.id]);

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setNotice('');
    if (!supabase || !snapshot) return;

    let profileData: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(profileDataText);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Profile data must be a JSON object.');
      }
      profileData = parsed as Record<string, unknown>;
    } catch (parseError) {
      setError(parseError instanceof Error ? `Profile data JSON is invalid: ${parseError.message}` : 'Profile data JSON is invalid.');
      return;
    }

    setSaving(true);
    try {
      const { data, error: updateError } = await supabase
        .from('profiles')
        .update({
          name: profile.name.trim(),
          email: profile.email.trim(),
          company: profile.company.trim(),
          country: profile.country.trim(),
          city: profile.city.trim(),
          avatar_url: profile.avatar_url.trim() || null,
          profile_data: profileData,
          updated_at: new Date().toISOString()
        })
        .eq('id', member.id)
        .select('id')
        .maybeSingle();
      if (updateError) throw updateError;
      if (!data) throw new Error('The profile was not updated. Check administrator access and database policies.');

      setSnapshot({ ...snapshot, profileData });
      setNotice('User profile saved.');
      await onSaved();
    } catch (saveError) {
      console.error('Unable to save admin-edited user profile:', saveError);
      setError(saveError instanceof Error ? saveError.message : 'Unable to save this user profile.');
    } finally {
      setSaving(false);
    }
  };

  const applications = snapshot?.applications || [];
  const projects = snapshot?.clientProjects || [];
  const submissions = snapshot?.submissions || [];
  const payouts = snapshot?.payouts || [];

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-2 backdrop-blur-sm sm:p-5">
      <section role="dialog" aria-modal="true" aria-labelledby="admin-user-details-title" className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><UserRound className="h-5 w-5" /></div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-blue-700">Administrator · Full user record</p>
              <h2 id="admin-user-details-title" className="truncate text-lg font-bold text-slate-950">{member.name || 'Unnamed user'}</h2>
              <p className="truncate text-xs text-slate-500">{member.email || 'No email'} · {member.role || 'Unknown role'} · ID {member.id}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close user details" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"><X className="h-5 w-5" /></button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto p-3 sm:p-5">
          {error && <div role="alert" className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}
          {notice && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</div>}
          {loading ? (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white p-12 text-sm text-slate-600"><Loader2 className="h-4 w-4 animate-spin" /> Loading user profile, projects, applications, work, and payout records…</div>
          ) : snapshot ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  ['Account role', member.role || 'Unknown'],
                  ['Member since', readableDate(snapshot.profile.created_at)],
                  ['Project applications', String(applications.length)],
                  ['Submissions', String(submissions.length)]
                ].map(([label, value]) => (
                  <div key={label} className={`${panelClass} py-3`}>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                    <p className="mt-1 truncate text-sm font-bold text-slate-900">{value}</p>
                  </div>
                ))}
              </div>

              {applications.length > 0 && (
                <section className={`${panelClass} border-blue-200 bg-blue-50/50`}>
                  <div className="mb-3">
                    <h3 className="text-sm font-bold text-slate-950">Tester information</h3>
                    <p className="mt-1 text-xs text-slate-600">Date of birth and phone number are collected with project applications, not in the general profile fields.</p>
                  </div>
                  <div className="space-y-3">
                    {applications.map((application) => {
                      const project = application.project as Record<string, unknown> | null;
                      const rawDetails = application.application_utest_details;
                      const details = (Array.isArray(rawDetails) ? rawDetails[0] : rawDetails) as Record<string, unknown> | null;
                      return (
                        <div key={String(application.id)} className="rounded-lg border border-slate-200 bg-white p-3">
                          <p className="mb-2 text-xs font-bold text-slate-900">{displayValue(project?.title)}</p>
                          {details ? (
                            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                              {[
                                ['Date of birth', readableDateOnly(details.date_of_birth)],
                                ['Phone number', displayValue(details.phone_number)],
                                ['Legal name', displayValue(details.full_name)],
                                ['Country', displayValue(details.country)],
                                ['Age range', displayValue(details.age_range)],
                                ['Smartphone', displayValue(details.smartphone)],
                                ['uTest ID', displayValue(details.utest_id)],
                                ['uTest email', displayValue(details.utest_email)]
                              ].map(([label, value]) => (
                                <div key={label} className="rounded-md bg-slate-50 px-2.5 py-2">
                                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                                  <p className="mt-1 break-words text-xs font-semibold text-slate-900">{value}</p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-slate-600">No tester details were saved for this application.</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              <form onSubmit={(event) => void saveProfile(event)} className="space-y-4">
                <section className={panelClass}>
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-slate-950">Editable account profile</h3>
                      <p className="mt-1 text-xs text-slate-500">Updates the Connectfy profile record only. It does not change the Supabase Auth login email, password, or account role.</p>
                    </div>
                    <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-[#007AFF] px-4 py-2 text-xs font-bold text-white hover:bg-[#005fce] disabled:cursor-wait disabled:opacity-60">
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      {saving ? 'Saving…' : 'Save profile'}
                    </button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {([
                      ['name', 'Full name'],
                      ['email', 'Connectfy contact email'],
                      ['company', 'Company / organization'],
                      ['country', 'Country'],
                      ['city', 'City'],
                      ['avatar_url', 'Avatar URL']
                    ] as const).map(([field, label]) => (
                      <label key={field} className="space-y-1 text-xs font-semibold text-slate-700">
                        {label}
                        <input
                          type={field === 'email' ? 'email' : 'text'}
                          value={profile[field]}
                          onChange={(event) => setProfile((current) => ({ ...current, [field]: event.target.value }))}
                          className={inputClass}
                        />
                      </label>
                    ))}
                  </div>
                  <div className="mt-4">
                    <details className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <summary className="cursor-pointer text-xs font-semibold text-slate-700">Advanced: general profile data (JSON)</summary>
                      <p className="mb-2 mt-2 text-[11px] text-slate-600">This is separate from project application details such as date of birth and phone number. Those are displayed above. An empty object means no extra general profile data has been saved.</p>
                      <textarea
                        id="admin-user-profile-data"
                        value={profileDataText}
                        onChange={(event) => setProfileDataText(event.target.value)}
                        spellCheck={false}
                        rows={10}
                        className="w-full rounded-lg border border-slate-300 bg-slate-950 px-3 py-3 font-mono text-xs leading-5 text-emerald-100 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      />
                    </details>
                  </div>
                </section>
              </form>

              <section className={panelClass}>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-950"><Briefcase className="h-4 w-4 text-blue-700" />Current projects and applications</h3>
                {projects.length > 0 && (
                  <div className="mb-4">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">Projects owned by this client</p>
                    <div className="space-y-2">
                      {projects.map((project) => (
                        <details key={String(project.id)} className="rounded-lg bg-slate-50 px-3 py-2 text-xs">
                          <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2">
                            <span><span className="font-semibold text-slate-900">{displayValue(project.title)}</span><span className="ml-2 text-slate-500">{displayValue(project.company)} · Deadline {displayValue(project.deadline)}</span></span>
                            <span className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-slate-600">{displayValue(project.status)} · {displayValue(project.slots_filled)}/{displayValue(project.slots_total)} slots</span>
                          </summary>
                          <div className="mt-3 space-y-1 border-t border-slate-200 pt-3 text-slate-600">
                            <p>{displayValue(project.category)} · {displayValue(project.project_track)} · {displayValue(project.payment_model)}</p>
                            <p>Budget: ${displayValue(project.total_budget)} · Disbursed: ${displayValue(project.budget_disbursed)}</p>
                            <p>{displayValue(project.short_description)}</p>
                            <p className="whitespace-pre-wrap">{displayValue(project.full_overview)}</p>
                            <pre className="overflow-x-auto rounded bg-white p-2 text-[10px]">{displayValue(project.project_data)}</pre>
                          </div>
                        </details>
                      ))}
                    </div>
                  </div>
                )}
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">Tester applications</p>
                {applications.length === 0 ? <p className="text-xs text-slate-500">No project applications.</p> : (
                  <div className="space-y-2">
                    {applications.map((application) => {
                      const project = application.project as Record<string, unknown> | null;
                      const rawDetails = application.application_utest_details;
                      const details = (Array.isArray(rawDetails) ? rawDetails[0] : rawDetails) as Record<string, unknown> | null;
                      return (
                        <div key={String(application.id)} className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div><p className="font-semibold text-slate-900">{displayValue(project?.title)}</p><p className="mt-0.5 text-slate-500">{displayValue(project?.company)} · Applied {readableDate(application.applied_at)}</p></div>
                            <span className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-slate-700">{displayValue(application.status)}{application.invite_status ? ` · ${displayValue(application.invite_status)}` : ''}</span>
                          </div>
                          <p className="mt-2 text-slate-600">Devices: {displayValue(application.selected_devices)} · uTest ID: {displayValue(details?.utest_id)} · uTest email: {displayValue(details?.utest_email)} · Phone: {displayValue(details?.phone_number)}</p>
                          <details className="mt-2 text-slate-600">
                            <summary className="cursor-pointer font-semibold text-blue-700">View complete application and uTest details</summary>
                            <pre className="mt-2 max-h-64 overflow-auto rounded bg-white p-2 text-[10px]">{JSON.stringify({ application: { ...application, project: undefined, application_utest_details: undefined }, utestDetails: details }, null, 2)}</pre>
                          </details>
                          {Boolean(application.invite_history) && (
                            <p className="mt-2 text-slate-500">Invite history: {displayValue(application.invite_history)}</p>
                          )}
                          {typeof details?.utest_account_screenshot_url === 'string' && details.utest_account_screenshot_url && (
                            <a href={details.utest_account_screenshot_url} target="_blank" rel="noreferrer" className="mt-2 inline-block font-semibold text-blue-700 underline">View uTest verification screenshot</a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              <section className={panelClass}>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-950"><FileText className="h-4 w-4 text-blue-700" />Submission and work history</h3>
                {submissions.length === 0 ? <p className="text-xs text-slate-500">No bug or task submissions.</p> : (
                  <div className="max-h-80 space-y-2 overflow-y-auto">
                    {submissions.map((submission) => {
                      const project = submission.project as Record<string, unknown> | null;
                      return (
                        <details key={String(submission.id)} className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs">
                          <summary className="cursor-pointer list-none">
                            <span className="font-semibold text-slate-900">{displayValue(submission.title)}</span>
                            <span className="ml-2 rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-slate-600">{displayValue(submission.kind)} · {displayValue(submission.status)}</span>
                            <span className="ml-2 text-slate-500">{displayValue(project?.title)} · ${Number(submission.bounty_earned || 0).toFixed(2)}</span>
                          </summary>
                          <div className="mt-3 space-y-2 border-t border-slate-200 pt-3 text-slate-600">
                            <p>Submitted {readableDate(submission.submitted_at)} · Reviewed {readableDate(submission.reviewed_at)}</p>
                            <p className="whitespace-pre-wrap">{displayValue(submission.details)}</p>
                            <p>Client feedback: {displayValue(submission.client_feedback)} · Rating: {displayValue(submission.client_rating)}</p>
                            <pre className="overflow-x-auto rounded bg-white p-2 text-[10px]">{displayValue(submission.payload)}</pre>
                            {Array.isArray(submission.attachments) && submission.attachments.map((attachment) => {
                              const item = attachment as Record<string, unknown>;
                              return (
                                <a key={String(item.id)} href={String(item.secure_url || '#')} target="_blank" rel="noreferrer" className="block font-semibold text-blue-700 underline">
                                  {displayValue(item.name)} ({displayValue(item.mime_type)})
                                </a>
                              );
                            })}
                          </div>
                        </details>
                      );
                    })}
                  </div>
                )}
              </section>

              <section className={panelClass}>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-950"><CreditCard className="h-4 w-4 text-blue-700" />Payout history</h3>
                {payouts.length === 0 ? <p className="text-xs text-slate-500">No payout requests.</p> : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-xs">
                      <thead className="text-[10px] uppercase tracking-wide text-slate-500"><tr><th className="px-2 py-2">Requested</th><th className="px-2 py-2">Method / destination</th><th className="px-2 py-2">Amount</th><th className="px-2 py-2">Status</th><th className="px-2 py-2">Reference / failure</th></tr></thead>
                      <tbody className="divide-y divide-slate-100">
                        {payouts.map((payout) => (
                          <tr key={String(payout.id)} className="align-top">
                            <td className="whitespace-nowrap px-2 py-2">{readableDate(payout.requested_at)}</td>
                            <td className="px-2 py-2">{displayValue(payout.method)}<br /><span className="break-all text-slate-500">{displayValue(payout.destination_account)}</span></td>
                            <td className="whitespace-nowrap px-2 py-2">${Number(payout.amount || 0).toFixed(2)}{payout.kes_amount ? <><br />KES {Number(payout.approved_kes_amount || payout.kes_amount).toLocaleString()}</> : null}</td>
                            <td className="px-2 py-2">{displayValue(payout.status)}</td>
                            <td className="max-w-xs break-all px-2 py-2 text-slate-500">{displayValue(payout.transaction_ref)}{payout.failure_reason ? <p className="mt-1 text-rose-700">{displayValue(payout.failure_reason)}</p> : null}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <p className="flex items-center gap-2 px-1 text-[11px] text-slate-500"><Clock className="h-3.5 w-3.5" />Account created {readableDate(snapshot.profile.created_at)}. Authentication email and credentials are managed separately in Supabase Auth.</p>
            </>
          ) : null}
        </div>

        <footer className="flex justify-end border-t border-slate-200 bg-white px-4 py-3 sm:px-6">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Close record</button>
        </footer>
      </section>
    </div>
  );
};
