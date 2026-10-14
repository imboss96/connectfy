import React, { useEffect, useState } from 'react';
import { Activity, RefreshCw } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';

type ActivityRow = {
  id: string;
  action: string;
  project_title: string;
  target_name: string;
  actor_name: string;
  actor_access_level: string;
  details: Record<string, unknown>;
  created_at: string;
};

const actionLabels: Record<string, string> = {
  application_approved: 'Approved application',
  application_rejected: 'Rejected application',
  application_utest_account_requested: 'Requested a new uTest account',
  submission_approved: 'Approved a submission',
  submission_rejected: 'Rejected a submission',
  submission_changes_requested: 'Requested submission changes',
  applause_settings_video_requested: 'Requested settings video',
  applause_project_completion_reminded: 'Sent project completion reminder',
  applause_consent_signature_requested: 'Requested signed consent',
  applause_consent_reminder_queued: 'Queued consent reminder'
};

export const ProjectManagerActivity: React.FC = () => {
  const { adminAccessLevel } = useApp();
  const isSuperAdmin = adminAccessLevel === 'super_admin';
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasOlderRows, setHasOlderRows] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    if (!supabase) {
      setError('Connectfy activity tracking is not configured.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: queryError } = await supabase
      .from('project_manager_activity')
      .select('id,action,project_title,target_name,actor_name,actor_access_level,details,created_at')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(100);
    if (queryError) {
      console.error('Unable to load project manager activity:', queryError);
      setError(queryError.message);
    } else {
      setRows((data || []) as ActivityRow[]);
      setHasOlderRows(data?.length === 100);
    }
    setLoading(false);
  };

  const loadOlder = async () => {
    if (!supabase || loadingOlder) return;
    setLoadingOlder(true);
    const { data, error: queryError } = await supabase
      .from('project_manager_activity')
      .select('id,action,project_title,target_name,actor_name,actor_access_level,details,created_at')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(rows.length, rows.length + 99);
    if (queryError) {
      console.error('Unable to load older project manager activity:', queryError);
      setError(queryError.message);
    } else {
      setRows((current) => [...current, ...((data || []) as ActivityRow[])]);
      setHasOlderRows(data?.length === 100);
    }
    setLoadingOlder(false);
  };

  useEffect(() => {
    void refresh();
    const refreshAfterAction = () => void refresh();
    window.addEventListener('project-manager-activity-updated', refreshAfterAction);
    return () => window.removeEventListener('project-manager-activity-updated', refreshAfterAction);
  }, []);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-[#007AFF]" />
            <h2 className="text-sm font-bold text-slate-900">{isSuperAdmin ? 'Team Activity' : 'My Tasks'}</h2>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {isSuperAdmin
              ? 'Review application decisions, submission reviews, and Applause follow-ups across the team.'
              : 'Your completed application reviews, approvals, rejections, account requests, and Applause follow-ups appear here.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          aria-label="Refresh project team activity"
          className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && <p role="alert" className="mt-3 text-xs text-rose-700">{error}</p>}
      {!error && loading && rows.length === 0 && <p className="mt-3 text-xs text-slate-500">Loading activity…</p>}
      {!error && !loading && rows.length === 0 && <p className="mt-3 text-xs text-slate-500">No project team activity has been recorded yet.</p>}
      {rows.length > 0 && (
        <ol className="mt-4 divide-y divide-slate-100">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-col gap-1 py-3 first:pt-0 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-800">
                  {actionLabels[row.action] || row.action.replaceAll('_', ' ')}
                  <span className="font-normal text-slate-500"> · {row.target_name || 'Project participant'}</span>
                </p>
                <p className="mt-0.5 truncate text-[11px] text-slate-500">
                  {row.project_title || 'Project'} · {row.actor_name} ({row.actor_access_level.replaceAll('_', ' ')})
                </p>
              </div>
              <time className="shrink-0 text-[10px] text-slate-400" dateTime={row.created_at}>
                {new Date(row.created_at).toLocaleString()}
              </time>
            </li>
          ))}
        </ol>
      )}
      {hasOlderRows && (
        <button
          type="button"
          onClick={() => void loadOlder()}
          disabled={loadingOlder}
          className="mt-3 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          {loadingOlder ? 'Loading…' : 'Load older activity'}
        </button>
      )}
    </section>
  );
};
