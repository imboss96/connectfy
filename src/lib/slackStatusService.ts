import { supabase } from './supabase';

export type SlackStatusDmResult = {
  sent: number;
  notFound: number;
  missingEmail: number;
  failed: number;
};

const getBackendUrl = () => {
  const configuredUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_EMAIL_BACKEND_URL)
    || 'http://localhost:3002/api/project-email';
  const url = new URL(configuredUrl);
  url.pathname = '/';
  url.search = '';
  url.hash = '';
  return url;
};

export async function sendProjectStatusSlackDms(projectId: string): Promise<SlackStatusDmResult> {
  if (!supabase) throw new Error('Slack status updates are unavailable until Supabase is configured.');
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  let accessToken = data.session?.access_token;
  if (!accessToken) throw new Error('Sign in as an administrator before sending Slack status updates.');

  const request = () => fetch(new URL('/api/admin/applause-status-slack-dms', getBackendUrl()), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify({ projectId })
  });

  let response = await request();
  if (response.status === 401) {
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) throw refreshError;
    accessToken = refreshed.session?.access_token;
    if (!accessToken) throw new Error('Your session has expired. Sign in again before sending Slack updates.');
    response = await request();
  }

  const text = await response.text();
  let result: SlackStatusDmResult & { message?: string } = {
    sent: 0,
    notFound: 0,
    missingEmail: 0,
    failed: 0
  };
  if (text) {
    try {
      result = { ...result, ...JSON.parse(text) };
    } catch {
      throw new Error(`Slack status endpoint returned a non-JSON response (HTTP ${response.status}).`);
    }
  }
  if (!response.ok) throw new Error(result.message || `Slack status updates failed (HTTP ${response.status}).`);
  return result;
}
