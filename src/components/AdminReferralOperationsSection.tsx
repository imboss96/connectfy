import React, { useEffect, useMemo, useState } from 'react';
import { Gift, RefreshCw, Search, Users, UserRound, CircleDollarSign } from 'lucide-react';
import { supabase } from '../lib/supabase';

type ReferralRow = {
  id: string;
  ambassador_id: string;
  referred_tester_id: string;
  referred_tester_name: string;
  referral_code: string;
  created_at: string;
};

type ProfileRow = {
  id: string;
  name: string | null;
  email: string | null;
  role: string | null;
  referral_code: string | null;
};

type RewardRow = {
  ambassador_id: string;
  referred_tester_id: string;
  submission_id: string;
  amount: number;
  created_at: string;
};

type SubmissionRow = {
  id: string;
  tester_id: string;
  status: string;
  submitted_at: string;
};

type ReferralActivity = {
  id: string;
  name: string;
  email: string;
  joinedAt: string;
  submitted: number;
  approved: number;
  inReview: number;
  rewards: number;
  earned: number;
  lastActivity: string | null;
};

type AmbassadorGroup = {
  id: string;
  name: string;
  email: string;
  referralCode: string;
  referrals: ReferralActivity[];
  rewardCount: number;
  earnings: number;
  approvedSubmissions: number;
};

const PAGE_SIZE = 500;
const ID_BATCH_SIZE = 100;

async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => Promise<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const rows: T[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const page = data || [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

function splitIntoBatches<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
}

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
}

export const AdminReferralOperationsSection: React.FC = () => {
  const [groups, setGroups] = useState<AmbassadorGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [activityFilter, setActivityFilter] = useState<'all' | 'active' | 'no_activity'>('all');
  const [expandedAmbassadorId, setExpandedAmbassadorId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let isCurrent = true;

    const loadReferrals = async () => {
      setIsLoading(true);
      setError('');
      const client = supabase;
      if (!client) {
        setError('Supabase is not configured.');
        setIsLoading(false);
        return;
      }

      try {
        const referralRows = await fetchAllPages<ReferralRow>(async (from, to) => {
          const result = await client
            .from('ambassador_referrals')
            .select('id,ambassador_id,referred_tester_id,referred_tester_name,referral_code,created_at')
            .order('created_at', { ascending: false })
            .order('id', { ascending: true })
            .range(from, to);
          return { data: result.data as ReferralRow[] | null, error: result.error };
        });

        const referralUserIds = [...new Set(referralRows.flatMap((referral) => [
          referral.ambassador_id,
          referral.referred_tester_id
        ]))];
        const profileBatches = splitIntoBatches(referralUserIds, ID_BATCH_SIZE);
        const profileRows = (await Promise.all(profileBatches.map((ids) =>
          fetchAllPages<ProfileRow>(async (from, to) => {
            const result = await client
              .from('profiles')
              .select('id,name,email,role,referral_code')
              .in('id', ids)
              .range(from, to);
            return { data: result.data as ProfileRow[] | null, error: result.error };
          })
        ))).flat();

        const referredUserIds = [...new Set(referralRows.map((referral) => referral.referred_tester_id))];
        const referredIdBatches = splitIntoBatches(referredUserIds, ID_BATCH_SIZE);
        const [rewardRowsByBatch, submissionRowsByBatch] = await Promise.all([
          Promise.all(referredIdBatches.map((ids) =>
            fetchAllPages<RewardRow>(async (from, to) => {
              const result = await client
                .from('ambassador_rewards')
                .select('ambassador_id,referred_tester_id,submission_id,amount,created_at')
                .in('referred_tester_id', ids)
                .order('created_at', { ascending: false })
                .order('submission_id', { ascending: true })
                .range(from, to);
              return { data: result.data as RewardRow[] | null, error: result.error };
            })
          )),
          Promise.all(referredIdBatches.map((ids) =>
            fetchAllPages<SubmissionRow>(async (from, to) => {
              const result = await client
                .from('submissions')
                .select('id,tester_id,status,submitted_at')
                .in('tester_id', ids)
                .order('submitted_at', { ascending: false })
                .order('id', { ascending: true })
                .range(from, to);
              return { data: result.data as SubmissionRow[] | null, error: result.error };
            })
          ))
        ]);

        const profilesById = new Map(profileRows.map((profile) => [profile.id, profile]));
        const rewardsByTester = new Map<string, RewardRow[]>();
        for (const reward of rewardRowsByBatch.flat()) {
          const rows = rewardsByTester.get(reward.referred_tester_id) || [];
          rows.push(reward);
          rewardsByTester.set(reward.referred_tester_id, rows);
        }
        const submissionsByTester = new Map<string, SubmissionRow[]>();
        for (const submission of submissionRowsByBatch.flat()) {
          const rows = submissionsByTester.get(submission.tester_id) || [];
          rows.push(submission);
          submissionsByTester.set(submission.tester_id, rows);
        }

        const groupsByAmbassador = new Map<string, AmbassadorGroup>();
        for (const referral of referralRows) {
          const ambassador = profilesById.get(referral.ambassador_id);
          let group = groupsByAmbassador.get(referral.ambassador_id);
          if (!group) {
            group = {
              id: referral.ambassador_id,
              name: ambassador?.name?.trim() || 'Connectfy tester',
              email: ambassador?.email || '',
              referralCode: ambassador?.referral_code || referral.referral_code,
              referrals: [],
              rewardCount: 0,
              earnings: 0,
              approvedSubmissions: 0
            };
            groupsByAmbassador.set(referral.ambassador_id, group);
          }

          const referredProfile = profilesById.get(referral.referred_tester_id);
          const testerRewards = rewardsByTester.get(referral.referred_tester_id) || [];
          const testerSubmissions = submissionsByTester.get(referral.referred_tester_id) || [];
          const approved = testerSubmissions.filter((submission) => submission.status === 'approved').length;
          const inReview = testerSubmissions.filter((submission) =>
            submission.status === 'submitted' || submission.status === 'under_review'
          ).length;
          const earned = testerRewards.reduce((total, reward) => total + Number(reward.amount || 0), 0);
          const lastActivity = testerSubmissions[0]?.submitted_at || null;

          group.referrals.push({
            id: referral.referred_tester_id,
            name: referredProfile?.name?.trim() || referral.referred_tester_name || 'Connectfy tester',
            email: referredProfile?.email || '',
            joinedAt: referral.created_at,
            submitted: testerSubmissions.length,
            approved,
            inReview,
            rewards: testerRewards.length,
            earned,
            lastActivity
          });
          group.rewardCount += testerRewards.length;
          group.earnings += earned;
          group.approvedSubmissions += approved;
        }

        const loadedGroups = [...groupsByAmbassador.values()].sort((left, right) =>
          right.referrals.length - left.referrals.length || left.name.localeCompare(right.name)
        );
        if (!isCurrent) return;
        setGroups(loadedGroups);
        setExpandedAmbassadorId((current) =>
          current && loadedGroups.some((group) => group.id === current) ? current : null
        );
      } catch (loadError) {
        if (isCurrent) setError(loadError instanceof Error ? loadError.message : 'Unable to load referral activity.');
      } finally {
        if (isCurrent) setIsLoading(false);
      }
    };

    void loadReferrals();
    return () => {
      isCurrent = false;
    };
  }, [reloadKey]);

  const filteredGroups = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    return groups.filter((group) => {
      const matchingSearch = !normalizedSearch || [
        group.name,
        group.email,
        group.referralCode,
        ...group.referrals.flatMap((referral) => [referral.name, referral.email])
      ].some((value) => value.toLocaleLowerCase().includes(normalizedSearch));
      const hasActivity = group.referrals.some((referral) => referral.submitted > 0 || referral.rewards > 0);
      return matchingSearch
        && (activityFilter === 'all' || (activityFilter === 'active' ? hasActivity : !hasActivity));
    });
  }, [activityFilter, groups, search]);

  const totals = useMemo(() => groups.reduce((summary, group) => ({
    referred: summary.referred + group.referrals.length,
    approved: summary.approved + group.approvedSubmissions,
    rewards: summary.rewards + group.rewardCount,
    earnings: summary.earnings + group.earnings
  }), { referred: 0, approved: 0, rewards: 0, earnings: 0 }), [groups]);

  const normalizedSearch = search.trim().toLocaleLowerCase();

  return (
    <section className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-violet-700">Admin operations</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950">Referral monitoring</h1>
          <p className="mt-1 text-sm text-slate-600">Track every ambassador, referred tester, approved submission, and reward credited.</p>
        </div>
        <button
          type="button"
          onClick={() => setReloadKey((current) => current + 1)}
          disabled={isLoading}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </header>

      {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="flex items-center gap-2 text-xs font-semibold text-slate-500"><Users className="h-4 w-4" /> Ambassadors</p>
          <p className="mt-2 text-2xl font-black text-slate-950">{isLoading ? '—' : groups.length}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="flex items-center gap-2 text-xs font-semibold text-slate-500"><UserRound className="h-4 w-4" /> Referred testers</p>
          <p className="mt-2 text-2xl font-black text-slate-950">{isLoading ? '—' : totals.referred}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="flex items-center gap-2 text-xs font-semibold text-slate-500"><Gift className="h-4 w-4" /> Approved submissions</p>
          <p className="mt-2 text-2xl font-black text-slate-950">{isLoading ? '—' : totals.approved}</p>
        </article>
        <article className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
          <p className="flex items-center gap-2 text-xs font-semibold text-emerald-700"><CircleDollarSign className="h-4 w-4" /> Rewards credited</p>
          <p className="mt-2 text-2xl font-black text-emerald-900">{isLoading ? '—' : `$${totals.earnings.toFixed(2)}`}</p>
          {!isLoading && <p className="mt-1 text-xs text-emerald-800">{totals.rewards} reward{totals.rewards === 1 ? '' : 's'}</p>}
        </article>
      </div>

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 md:flex-row">
          <label className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              aria-label="Search ambassadors and referred testers"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, email, or referral code"
              className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <label className="text-xs font-semibold text-slate-600">
            <span className="sr-only">Filter by referred tester activity</span>
            <select
              value={activityFilter}
              onChange={(event) => setActivityFilter(event.target.value as typeof activityFilter)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 md:w-auto"
            >
              <option value="all">All ambassadors</option>
              <option value="active">Has tester activity</option>
              <option value="no_activity">No tester activity</option>
            </select>
          </label>
        </div>

        {isLoading ? (
          <div className="rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500">Loading referral activity…</div>
        ) : filteredGroups.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center">
            <Users className="mx-auto h-7 w-7 text-slate-400" />
            <p className="mt-3 font-semibold text-slate-800">{groups.length ? 'No referrals match these filters' : 'No referrals recorded yet'}</p>
            <p className="mt-1 text-sm text-slate-500">{groups.length ? 'Try changing your search or activity filter.' : 'Ambassador signups will appear here.'}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredGroups.map((group) => {
              const isExpanded = expandedAmbassadorId === group.id;
              const referrals = group.referrals.filter((referral) =>
                activityFilter === 'all'
                  || (activityFilter === 'active' ? referral.submitted > 0 || referral.rewards > 0 : referral.submitted === 0 && referral.rewards === 0)
              ).filter((referral) =>
                !normalizedSearch
                  || [group.name, group.email, group.referralCode, referral.name, referral.email]
                    .some((value) => value.toLocaleLowerCase().includes(normalizedSearch))
              );

              return (
                <article key={group.id} className="overflow-hidden rounded-xl border border-slate-200">
                  <button
                    type="button"
                    aria-expanded={isExpanded}
                    onClick={() => setExpandedAmbassadorId(isExpanded ? null : group.id)}
                    className="grid w-full gap-4 p-4 text-left hover:bg-slate-50 sm:grid-cols-[minmax(0,1fr)_repeat(4,minmax(6rem,auto))] sm:items-center"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-bold text-slate-950">{group.name}</span>
                      <span className="mt-1 block truncate text-xs text-slate-500">{group.email || 'No profile email'}</span>
                      <span className="mt-1 block font-mono text-[11px] text-violet-700">Code: {group.referralCode}</span>
                    </span>
                    <span><span className="block text-lg font-bold text-slate-900">{group.referrals.length}</span><span className="text-[11px] text-slate-500">referred testers</span></span>
                    <span><span className="block text-lg font-bold text-slate-900">{group.approvedSubmissions}</span><span className="text-[11px] text-slate-500">approved</span></span>
                    <span><span className="block text-lg font-bold text-slate-900">{group.rewardCount}</span><span className="text-[11px] text-slate-500">rewards</span></span>
                    <span className="text-left sm:text-right"><span className="block text-lg font-bold text-emerald-700">${group.earnings.toFixed(2)}</span><span className="text-[11px] text-slate-500">{isExpanded ? 'Hide details' : 'View details'}</span></span>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-slate-200 bg-slate-50/70">
                      {referrals.length === 0 ? (
                        <p className="p-5 text-center text-sm text-slate-500">No referred testers match these filters.</p>
                      ) : (
                        <>
                          <div className="hidden grid-cols-[minmax(0,1.5fr)_repeat(5,minmax(6rem,1fr))] gap-3 px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-500 md:grid">
                            <span>Referred tester</span><span>Joined</span><span>Submissions</span><span>Approved</span><span>Last activity</span><span>Reward earned</span>
                          </div>
                          <div className="divide-y divide-slate-200">
                            {referrals.map((referral) => (
                              <div key={referral.id} className="grid gap-2 px-4 py-3 md:grid-cols-[minmax(0,1.5fr)_repeat(5,minmax(6rem,1fr))] md:items-center md:gap-3">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-slate-900">{referral.name}</p>
                                  <p className="truncate text-xs text-slate-500">{referral.email || 'No profile email'}</p>
                                </div>
                                <p className="text-xs text-slate-600 md:text-sm">{formatDate(referral.joinedAt)}</p>
                                <p className="text-xs text-slate-600 md:text-sm">
                                  {referral.submitted} total
                                  {referral.inReview > 0 && <span className="ml-1 text-amber-700">({referral.inReview} in review)</span>}
                                </p>
                                <p className="text-xs text-slate-600 md:text-sm">{referral.approved}</p>
                                <p className="text-xs text-slate-600 md:text-sm">{formatDateTime(referral.lastActivity)}</p>
                                <p className="text-xs font-semibold text-emerald-700 md:text-sm">${referral.earned.toFixed(2)} · {referral.rewards} reward{referral.rewards === 1 ? '' : 's'}</p>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </section>
  );
};
