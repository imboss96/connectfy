import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, CircleHelp, RefreshCw, Search, UserRoundPlus, UserRoundCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';

type LegacyResponse = {
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

type AccountProfile = {
  id: string;
  name: string;
  email: string;
  profile_data: Record<string, unknown> | null;
};

type OnboardingStatus = {
  label: string;
  details: string;
  className: string;
  icon: React.ComponentType<{ className?: string }>;
};

export const LegacyOnboardingSection: React.FC<{ projectId?: string }> = ({ projectId }) => {
  const [responses, setResponses] = useState<LegacyResponse[]>([]);
  const [profiles, setProfiles] = useState<AccountProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const loadResponses = useCallback(async () => {
    if (!supabase) {
      setError('Supabase is not configured.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      let responseQuery = supabase
          .from('legacy_sheet_responses')
          .select('source_key,source_timestamp,consent,full_name,date_of_birth,gender,email,terms_agreed,utest_id,matched_profile_id,match_status,synced_at')
          .order('source_timestamp', { ascending: false });
      if (projectId) responseQuery = responseQuery.eq('project_id', projectId);
      const [responseResult, profileResult] = await Promise.all([
        responseQuery,
        supabase
          .from('profiles')
          .select('id,name,email,profile_data')
      ]);
      if (responseResult.error) throw responseResult.error;
      if (profileResult.error) throw profileResult.error;
      setResponses((responseResult.data || []) as LegacyResponse[]);
      setProfiles((profileResult.data || []) as AccountProfile[]);
    } catch (loadError) {
      console.error('Unable to load legacy project onboarding records:', loadError);
      setError(loadError instanceof Error ? loadError.message : 'Unable to load onboarding records.');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadResponses();
  }, [loadResponses]);

  const profilesById = useMemo(() => new Map(profiles.map((profile) => [profile.id, profile])), [profiles]);
  const searchTerm = search.trim().toLowerCase();
  const filteredResponses = responses.filter((response) => (
    !searchTerm
    || response.full_name.toLowerCase().includes(searchTerm)
    || response.email.toLowerCase().includes(searchTerm)
    || response.utest_id.toLowerCase().includes(searchTerm)
    || response.match_status.includes(searchTerm)
  ));

  const statusFor = (response: LegacyResponse): OnboardingStatus => {
    if (response.match_status === 'ambiguous') {
      return {
        label: 'Needs account review',
        details: 'More than one Connectfy account matched this email. Review the account match manually.',
        className: 'border-amber-200 bg-amber-50 text-amber-800',
        icon: CircleHelp
      };
    }
    const isAffirmative = (answer: string) => /^(yes|i\s+agree|agree|i\s+consent|consent)\b/i.test(answer.trim());
    const missingConsents = [
      !isAffirmative(response.consent) ? 'information consent' : '',
      !isAffirmative(response.terms_agreed) ? 'terms agreement' : ''
    ].filter(Boolean);
    if (missingConsents.length > 0) {
      return {
        label: 'Consent needs review',
        details: `The sheet does not show an affirmative ${missingConsents.join(' and ')}. Review consent before proceeding.`,
        className: 'border-amber-200 bg-amber-50 text-amber-800',
        icon: AlertCircle
      };
    }
    if (!response.matched_profile_id) {
      return {
        label: 'Connectfy account needed',
        details: 'No account was found for this email. Ask the person to register using this email, then sync the sheet again.',
        className: 'border-sky-200 bg-sky-50 text-sky-800',
        icon: UserRoundPlus
      };
    }

    const account = profilesById.get(response.matched_profile_id);
    const testerProfile = account?.profile_data?.testerProfile as Record<string, unknown> | undefined;
    const profileUtestId = String(testerProfile?.uTestId || '').trim();
    const profileUtestEmail = String(testerProfile?.uTestEmail || '').trim();
    const sourceId = response.utest_id.trim();
    if (!profileUtestId || !profileUtestEmail) {
      return {
        label: 'Tester details need confirmation',
        details: 'The account is matched, but its uTest ID or uTest email is missing. Ask the tester to review Profile & Fleet before applying.',
        className: 'border-amber-200 bg-amber-50 text-amber-800',
        icon: AlertCircle
      };
    }
    if (sourceId && profileUtestId.toLowerCase() !== sourceId.toLowerCase()) {
      return {
        label: 'uTest ID needs review',
        details: 'The uTest ID in the sheet differs from the Connectfy profile. Ask the tester to confirm the current ID; no profile data was overwritten.',
        className: 'border-amber-200 bg-amber-50 text-amber-800',
        icon: AlertCircle
      };
    }
    return {
      label: 'Account and uTest details found',
      details: 'The account is matched by email and has uTest details. Confirm the current account is valid for this project before proceeding.',
      className: 'border-emerald-200 bg-emerald-50 text-emerald-800',
      icon: CheckCircle2
    };
  };

  const matchedCount = responses.filter((response) => response.match_status === 'matched').length;
  const unmatchedCount = responses.filter((response) => response.match_status === 'unmatched').length;
  const reviewCount = responses.filter((response) => response.match_status === 'ambiguous').length;

  return (
    <section className="space-y-5 animate-fade-in">
      <header className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-xl border border-[#007AFF]/20 bg-[#007AFF]/10 p-3 text-[#007AFF]">
            <UserRoundCheck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900">Legacy Project Onboarding</h1>
            <p className="mt-1 max-w-2xl text-xs text-slate-600">Review sheet respondents against Connectfy accounts and identify missing or inconsistent tester details. Matches use email; sheet values never overwrite profiles.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void loadResponses()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Matched accounts</p><p className="mt-1 text-2xl font-black text-emerald-700">{matchedCount}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Account not found</p><p className="mt-1 text-2xl font-black text-sky-700">{unmatchedCount}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Manual review</p><p className="mt-1 text-2xl font-black text-amber-700">{reviewCount}</p></div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="text-sm font-bold text-slate-900">Imported sheet responses</h2><p className="mt-1 text-[11px] text-slate-500">Sync responses from the Google Sheet tab to refresh exact-email account matches.</p></div>
          <label className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email, uTest ID" className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-xs outline-none focus:border-[#007AFF]" />
          </label>
        </div>
        {error ? (
          <div role="alert" className="m-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><p className="font-semibold">Could not load onboarding records.</p><p className="mt-1 text-xs">{error}</p></div>
        ) : loading ? (
          <div className="p-10 text-center text-sm text-slate-500">Loading onboarding records...</div>
        ) : filteredResponses.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">{responses.length ? 'No records match your search.' : 'No sheet records have been synced yet. Open Google Sheet and choose “Sync responses to Connectfy”.'}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] border-collapse text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                <tr><th className="px-4 py-3">Respondent</th><th className="px-4 py-3">Matched Connectfy account</th><th className="px-4 py-3">uTest ID on sheet</th><th className="px-4 py-3">Onboarding status</th><th className="px-4 py-3">Last synced</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredResponses.map((response) => {
                  const account = response.matched_profile_id ? profilesById.get(response.matched_profile_id) : null;
                  const status = statusFor(response);
                  const StatusIcon = status.icon;
                  return (
                    <tr key={response.source_key} className="align-top hover:bg-slate-50/70">
                      <td className="px-4 py-3"><p className="font-semibold text-slate-900">{response.full_name || 'Name not provided'}</p><p className="mt-0.5 text-slate-500">{response.email}</p><p className="mt-1 text-[10px] text-slate-400">DOB: {response.date_of_birth || 'Not provided'} · Gender: {response.gender || 'Not provided'}</p></td>
                      <td className="px-4 py-3">{account ? <><p className="font-semibold text-slate-900">{account.name || 'Name not set'}</p><p className="mt-0.5 text-slate-500">{account.email}</p></> : <span className="text-slate-400">No exact email match</span>}</td>
                      <td className="px-4 py-3 font-mono text-slate-700">{response.utest_id || 'Not provided'}</td>
                      <td className="px-4 py-3"><span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-bold ${status.className}`}><StatusIcon className="h-3 w-3" />{status.label}</span><p className="mt-1 max-w-sm text-[10px] leading-4 text-slate-500">{status.details}</p></td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-500">{new Date(response.synced_at).toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
};
