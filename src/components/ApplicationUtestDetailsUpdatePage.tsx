import React, { FormEvent, useEffect, useState } from 'react';
import { CheckCircle2, LoaderCircle, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';

type ApplicationRecord = {
  id: string;
  project_id: string;
  status: string;
  project?: { title?: string } | null;
  application_utest_details?: { utest_id?: string; utest_email?: string }[] | { utest_id?: string; utest_email?: string } | null;
};

export const ApplicationUtestDetailsUpdatePage: React.FC<{ applicationId: string }> = ({ applicationId }) => {
  const [application, setApplication] = useState<ApplicationRecord | null>(null);
  const [utestId, setUtestId] = useState('');
  const [utestEmail, setUtestEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!supabase) {
        setError('Application updates are not configured. Please contact Connectfy support.');
        setLoading(false);
        return;
      }
      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        if (!userData.user) throw new Error('Sign in to the Connectfy account that received this email to update the application.');

        const { data, error: applicationError } = await supabase
          .from('applications')
          .select('id,project_id,status,project:project_id(title),application_utest_details(utest_id,utest_email)')
          .eq('id', applicationId)
          .eq('tester_id', userData.user.id)
          .maybeSingle();
        if (applicationError) throw applicationError;
        if (!data) throw new Error('This link belongs to a different Connectfy account. Sign in with the account that received the email.');

        const details = Array.isArray(data.application_utest_details)
          ? data.application_utest_details[0]
          : data.application_utest_details;
        if (active) {
          setApplication(data as ApplicationRecord);
          setUtestId(details?.utest_id || '');
          setUtestEmail(details?.utest_email || '');
        }
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load this project application.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [applicationId]);

  const saveDetails = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase || !application || !utestId.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const { error: saveError } = await supabase.rpc('complete_application_utest_details_request', {
        p_application_id: application.id,
        p_utest_id: utestId.trim(),
        p_utest_email: utestEmail.trim()
      });
      if (saveError) throw saveError;
      setSaved(true);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save your uTest details. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
        {saved ? <CheckCircle2 className="h-6 w-6" /> : <ShieldCheck className="h-6 w-6" />}
      </div>
      <h1 className="text-xl font-bold text-slate-900">Add your uTest details</h1>
      {loading ? (
        <p className="mt-3 text-sm text-slate-500">Loading your project application…</p>
      ) : saved ? (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          Your uTest details have been saved to {application?.project?.title || 'the project'} application. You can close this page.
        </div>
      ) : application ? (
        <>
          <p className="mt-2 text-sm text-slate-600">
            Add the uTest account details for <strong>{application.project?.title || 'this project'}</strong>. Your application will return to its previous status after you save.
          </p>
          <form onSubmit={(event) => void saveDetails(event)} className="mt-6 space-y-4">
            <label className="block text-sm font-semibold text-slate-700">
              uTest ID
              <input
                required
                maxLength={120}
                value={utestId}
                onChange={(event) => setUtestId(event.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-normal outline-none focus:border-[#007AFF]"
                placeholder="Enter your uTest ID"
              />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              uTest email <span className="font-normal text-slate-400">(optional)</span>
              <input
                type="email"
                value={utestEmail}
                onChange={(event) => setUtestEmail(event.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-normal outline-none focus:border-[#007AFF]"
                placeholder="Email used for your uTest account"
              />
            </label>
            {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
            <button
              type="submit"
              disabled={saving || !utestId.trim()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#007AFF] px-4 py-3 text-sm font-bold text-white hover:bg-[#0066EE] disabled:cursor-wait disabled:opacity-60"
            >
              {saving && <LoaderCircle className="h-4 w-4 animate-spin" />}
              {saving ? 'Saving details…' : 'Save uTest details'}
            </button>
          </form>
        </>
      ) : (
        <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error || 'Unable to open this project application.'}
        </p>
      )}
    </section>
  );
};
