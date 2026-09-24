import { supabase } from './supabase';
import { ProjectResource } from '../types';

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
  projectResources?: ProjectResource[];
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
      let message = text || 'Email backend request failed';
      try {
        const parsed = JSON.parse(text);
        message = parsed.message || message;
      } catch {
        // Keep the raw response when the backend did not return JSON.
      }
      throw new Error(message);
    }

    return true;
  } catch (error) {
    console.error('Failed to send project email through local backend:', error);
    throw error instanceof Error ? error : new Error('Email backend request failed');
  }
}
