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
  if (!supabase) {
    console.warn('Supabase is not configured; project email was not sent.');
    return false;
  }

  try {
    const safePayload = {
      ...payload,
      type: formatProjectEmailType(payload.type)
    };

    const { error } = await supabase.functions.invoke('project-email', {
      body: safePayload
    });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Failed to send project email through Supabase Edge Function:', error);
    return false;
  }
}
