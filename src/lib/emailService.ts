import { supabase } from './supabase';
import { ProjectResource } from '../types';
import { LEGACY_SHEET_EMAIL_SUBJECT } from './legacySheetEmail.js';

export type ProjectEmailType = 'application' | 'invite' | 'accepted' | 'rejected' | 'declined' | 'utest_update_required' | 'legacy_sheet_reapply' | 'submission_approved' | 'application_utest_details_request';

const ADMIN_EMAIL_TYPES: ProjectEmailType[] = ['invite', 'rejected', 'utest_update_required', 'legacy_sheet_reapply', 'submission_approved', 'application_utest_details_request'];

export function requiresAdminSession(type: ProjectEmailType): boolean {
  return ADMIN_EMAIL_TYPES.includes(type);
}

export class EmailTemplateMismatchError extends Error {
  constructor() {
    super('The email service accepted this message but did not confirm the expected template. It may have sent an older email version; do not retry until the email service is updated.');
    this.name = 'EmailTemplateMismatchError';
  }
}

export function formatProjectEmailType(type?: string | null): ProjectEmailType {
  switch (type) {
    case 'invite':
      return 'invite';
    case 'accepted':
      return 'accepted';
    case 'rejected':
      return 'rejected';
    case 'declined':
      return 'declined';
    case 'utest_update_required':
      return 'utest_update_required';
    case 'legacy_sheet_reapply':
      return 'legacy_sheet_reapply';
    case 'submission_approved':
      return 'submission_approved';
    case 'application_utest_details_request':
      return 'application_utest_details_request';
    case 'application':
    default:
      return 'application';
  }
}

export interface ProjectEmailPayload {
  type: ProjectEmailType;
  toEmail: string;
  toName: string;
  projectTitle: string;
  projectCompany: string;
  projectDescription: string;
  projectDeadline?: string;
  projectCategory?: string;
  reason?: string;
  actionUrl: string;
  projectLink?: string;
  projectResources?: ProjectResource[];
  applicantCountry?: string;
  applicantDevice?: string;
  uTestId?: string;
  uTestEmail?: string;
  applicantFullName?: string;
  applicantDateOfBirth?: string;
  applicantAgeRange?: string;
  applicantSmartphone?: string;
  applicantHasValidId?: boolean;
  applicantWillingVoiceRecording?: boolean;
  applicationReference?: string;
  submittedAt?: string;
  supportEmail?: string;
  submissionId?: string;
  projectId?: string;
  testerId?: string;
  submissionTitle?: string;
  approvedAmount?: number;
}

export async function sendProjectEmail(payload: ProjectEmailPayload): Promise<boolean> {
  try {
    const safePayload = {
      ...payload,
      type: formatProjectEmailType(payload.type)
    };

    const backendUrl = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_EMAIL_BACKEND_URL)
      || 'http://localhost:3002/api/project-email';

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    const requiresAdmin = requiresAdminSession(safePayload.type);
    if (requiresAdmin) {
      if (!supabase) throw new Error('Sign in to your account before sending this email.');
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      if (!data.session?.access_token) throw new Error('Sign in to your account before sending this email.');
      headers.Authorization = `Bearer ${data.session.access_token}`;
    }

    const requestOptions: RequestInit = {
      method: 'POST',
      headers,
      body: JSON.stringify(safePayload)
    };

    let response = await fetch(backendUrl, requestOptions);
    if (response.status === 401 && requiresAdmin && supabase) {
      const { data, error } = await supabase.auth.refreshSession();
      if (error) throw error;
      if (!data.session?.access_token) {
        throw new Error('Your session has expired. Please sign in again before sending emails.');
      }

      headers.Authorization = `Bearer ${data.session.access_token}`;
      response = await fetch(backendUrl, requestOptions);
    }

    if (!response.ok) {
      const text = await response.text();
      let message = text || 'Email backend request failed';
      try {
        const parsed = JSON.parse(text);
        message = parsed.message || message;
      } catch {
        // Keep the raw response when the backend did not return JSON.
      }
      throw new Error(message);
    }

    if (safePayload.type === 'legacy_sheet_reapply') {
      let result: { emailType?: string; subject?: string };
      try {
        result = await response.json();
      } catch {
        throw new EmailTemplateMismatchError();
      }
      if (result.emailType !== safePayload.type || result.subject !== LEGACY_SHEET_EMAIL_SUBJECT) {
        throw new EmailTemplateMismatchError();
      }
    }

    return true;
  } catch (error) {
    console.error('Failed to send project email through local backend:', error);
    throw error instanceof Error ? error : new Error('Email backend request failed');
  }
}
