import React, { useEffect, useMemo, useState } from 'react';
import { Check, Copy, Gift, Link2, Users } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';

interface ReferralRecord {
  referred_tester_id: string;
  referred_tester_name: string;
  created_at: string;
}

interface ReferralReward {
  referred_tester_id: string;
  amount: number;
  created_at: string;
}

export const AmbassadorDashboard: React.FC = () => {
  const { testerProfile } = useApp();
  const [referralCode, setReferralCode] = useState('');
  const [referrals, setReferrals] = useState<ReferralRecord[]>([]);
  const [rewards, setRewards] = useState<ReferralReward[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [copyMessage, setCopyMessage] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let isCurrent = true;

    const loadAmbassadorData = async () => {
      setIsLoading(true);
      setErrorMessage('');
      if (!supabase || !testerProfile.id) {
        setErrorMessage('Ambassador referrals are unavailable until you are signed in with a Connectfy account.');
        setIsLoading(false);
        return;
      }

      try {
        const [profileResult, referralsResult, rewardsResult] = await Promise.all([
          supabase
            .from('profiles')
            .select('referral_code')
            .eq('id', testerProfile.id)
            .single(),
          supabase
            .from('ambassador_referrals')
            .select('referred_tester_id,referred_tester_name,created_at')
            .eq('ambassador_id', testerProfile.id)
            .order('created_at', { ascending: false }),
          supabase
            .from('ambassador_rewards')
            .select('referred_tester_id,amount,created_at')
            .eq('ambassador_id', testerProfile.id)
            .order('created_at', { ascending: false })
        ]);

        if (profileResult.error) throw profileResult.error;
        if (referralsResult.error) throw referralsResult.error;
        if (rewardsResult.error) throw rewardsResult.error;

        const referralRows = (referralsResult.data || []) as ReferralRecord[];
        const rewardRows = (rewardsResult.data || []) as ReferralReward[];

        if (!isCurrent) return;
        setReferralCode(profileResult.data.referral_code);
        setReferrals(referralRows);
        setRewards(rewardRows);
      } catch (error) {
        if (!isCurrent) return;
        setErrorMessage(error instanceof Error ? error.message : 'Unable to load your ambassador referrals.');
      } finally {
        if (isCurrent) setIsLoading(false);
      }
    };

    void loadAmbassadorData();
    return () => {
      isCurrent = false;
    };
  }, [testerProfile.id, reloadKey]);

  const referralUrl = useMemo(() => {
    if (!referralCode) return '';
    const url = new URL(window.location.pathname, window.location.origin);
    url.searchParams.set('ref', referralCode);
    return url.toString();
  }, [referralCode]);

  const rewardsByTester = useMemo(() => {
    return rewards.reduce<Record<string, { count: number; total: number }>>((totals, reward) => {
      const current = totals[reward.referred_tester_id] || { count: 0, total: 0 };
      current.count += 1;
      current.total += Number(reward.amount || 0);
      totals[reward.referred_tester_id] = current;
      return totals;
    }, {});
  }, [rewards]);

  const totalEarned = rewards.reduce((total, reward) => total + Number(reward.amount || 0), 0);

  const copyReferralLink = async () => {
    if (!referralUrl) return;
    try {
      await navigator.clipboard.writeText(referralUrl);
      setCopyMessage('Referral link copied.');
    } catch {
      setCopyMessage('Copy was blocked by your browser. Select and copy the link below.');
    }
  };

  return (
    <section className="mx-auto max-w-5xl space-y-6">
      <header className="rounded-2xl bg-gradient-to-br from-[#071a38] to-[#0b5570] p-6 text-white shadow-lg sm:p-8">
        <div className="flex items-center gap-3">
          <span className="rounded-xl bg-white/10 p-3"><Gift className="h-6 w-6" /></span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">Connectfy Ambassadors</p>
            <h1 className="mt-1 text-2xl font-black sm:text-3xl">Invite testers. Earn together.</h1>
          </div>
        </div>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-200">
          Share your personal link with new testers. You earn <strong className="text-white">$5</strong> whenever a tester you referred gets a task or bug submission approved.
          Each approved submission earns a separate reward, credited to your Connectfy wallet.
        </p>
      </header>

      {errorMessage && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <span>{errorMessage}</span>
          <button type="button" onClick={() => setReloadKey((current) => current + 1)} className="font-bold underline">Try again</button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-500"><Users className="h-4 w-4" /> Referred testers</div>
          <p className="mt-3 text-3xl font-black text-slate-900">{isLoading ? '—' : referrals.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-500"><Check className="h-4 w-4" /> Approved submissions</div>
          <p className="mt-3 text-3xl font-black text-slate-900">{isLoading ? '—' : rewards.length}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700"><Gift className="h-4 w-4" /> Ambassador earnings</div>
          <p className="mt-3 text-3xl font-black text-emerald-800">{isLoading ? '—' : `$${totalEarned.toFixed(2)}`}</p>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-2">
          <Link2 className="h-5 w-5 text-[#007AFF]" />
          <h2 className="text-lg font-black text-slate-900">Your referral link</h2>
        </div>
        <p className="mt-1 text-sm text-slate-500">New testers who sign up through this link will be connected to your ambassador account.</p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            aria-label="Your unique referral link"
            readOnly
            value={isLoading ? 'Loading your referral link…' : referralUrl}
            className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-700"
          />
          <button
            type="button"
            onClick={() => void copyReferralLink()}
            disabled={isLoading || !referralUrl}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#007AFF] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#0066EE] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Copy className="h-4 w-4" /> Copy link
          </button>
        </div>
        {copyMessage && <p role="status" className="mt-2 text-xs font-medium text-slate-600">{copyMessage}</p>}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
          <h2 className="text-lg font-black text-slate-900">Your referrals</h2>
          <p className="mt-1 text-sm text-slate-500">Rewards are added automatically when a referred tester’s work is approved.</p>
        </div>
        {isLoading ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">Loading your referrals…</p>
        ) : referrals.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">No referrals yet. Share your link to get started.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {referrals.map((referral) => {
              const earned = rewardsByTester[referral.referred_tester_id] || { count: 0, total: 0 };
              return (
                <div key={referral.referred_tester_id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6">
                  <div>
                    <p className="font-bold text-slate-900">{referral.referred_tester_name || 'Connectfy tester'}</p>
                    <p className="mt-1 text-xs text-slate-500">Joined {new Date(referral.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-800">{earned.count} approved {earned.count === 1 ? 'submission' : 'submissions'}</p>
                    <p className="mt-1 text-xs font-semibold text-emerald-700">${earned.total.toFixed(2)} earned</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </section>
  );
};
