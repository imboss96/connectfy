import { supabase } from './supabase';

export type ProjectEmailType = 'application' | 'invite' | 'accepted' | 'rejected' | 'declined';

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
}

export async function sendProjectEmail(payload: ProjectEmailPayload): Promise<boolean> {
  try {
    const safePayload = {
      ...payload,
      type: formatProjectEmailType(payload.type)
    };

    const backendUrl = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_EMAIL_BACKEND_URL)
      || 'http://localhost:3002/api/project-email';

    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(safePayload)
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || 'Email backend request failed');
    }

    return true;
  } catch (error) {
    console.error('Failed to send project email through local backend:', error);
    return false;
  }
}
