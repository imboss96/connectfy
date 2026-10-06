import { supabase } from './supabase';

export type ApprovalEmailStatus = 'pending' | 'processing' | 'sent' | 'failed';

export type ApprovalEmailLog = {
  id: string;
  project_id: string;
  profile_id: string;
  source_key: string;
  recipient_email: string;
  recipient_name: string;
  project_title: string;
  project_company: string;
  status: ApprovalEmailStatus;
  attempt_count: number;
  provider_message_id: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  sent_at: string | null;
};

export type ApprovalEmailLogPage = {
  emails: ApprovalEmailLog[];
  hasMore: boolean;
};

export type ConsentReminderEmailLog = {
  id: string;
  project_id: string;
  profile_id: string;
  queued_by: string | null;
  recipient_email: string;
  recipient_name: string;
  project_title: string;
  status: ApprovalEmailStatus;
  attempt_count: number;
  provider_message_id: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  sent_at: string | null;
};

const backendUrl = () => {
  const configuredUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_EMAIL_BACKEND_URL)
    || 'http://localhost:3002/api/project-email';
  const url = new URL(configuredUrl);
  url.pathname = '/';
  url.search = '';
  url.hash = '';
  return url;
};

export async function fetchApprovalEmailLogPage(offset = 0, limit = 100): Promise<ApprovalEmailLogPage> {
  if (!supabase) throw new Error('Email history is unavailable until Supabase is configured.');
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error('Your session has expired. Sign in again to view email history.');

  const response = await fetch(new URL(
    `/api/admin/applause-approval-emails?limit=${encodeURIComponent(limit)}&offset=${encodeURIComponent(offset)}`,
    backendUrl()
  ), {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const responseText = await response.text();
  let result: { message?: string; emails?: ApprovalEmailLog[]; hasMore?: boolean } = {};
  if (responseText) {
    try {
      result = JSON.parse(responseText) as typeof result;
    } catch {
      const contentType = response.headers.get('content-type') || 'unknown content type';
      throw new Error(
        `Email history endpoint returned a non-JSON response (HTTP ${response.status}, ${contentType}). Restart or redeploy the backend so the approval email log endpoint is available.`
      );
    }
  }
  if (!response.ok) {
    throw new Error(result.message || 'Unable to load approval email history.');
  }
  if (!Array.isArray(result.emails) || typeof result.hasMore !== 'boolean') {
    throw new Error('Email history service returned an incomplete response.');
  }
  return { emails: result.emails, hasMore: result.hasMore };
}

export async function fetchConsentReminderEmailLog(projectId: string): Promise<ConsentReminderEmailLog[]> {
  if (!supabase) throw new Error('Email history is unavailable until Supabase is configured.');
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error('Your session has expired. Sign in again to view email history.');

  const response = await fetch(new URL(
    `/api/admin/applause-consent-reminder-emails?projectId=${encodeURIComponent(projectId)}`,
    backendUrl()
  ), {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const responseText = await response.text();
  let result: { message?: string; emails?: ConsentReminderEmailLog[] } = {};
  if (responseText) {
    try {
      result = JSON.parse(responseText) as typeof result;
    } catch {
      throw new Error(`Consent reminder history endpoint returned a non-JSON response (HTTP ${response.status}). Restart or redeploy the backend with the latest email history route.`);
    }
  }
  if (!response.ok) throw new Error(result.message || 'Unable to load consent reminder email history.');
  if (!Array.isArray(result.emails)) throw new Error('Consent reminder history service returned an incomplete response.');
  return result.emails;
}
