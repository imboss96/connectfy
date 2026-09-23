import { supabase } from './supabase';

export type ProjectEmailType = 'application' | 'invite';

export interface ProjectEmailPayload {
  type: ProjectEmailType;
  toEmail: string;
  toName: string;
  projectTitle: string;
  projectCompany: string;
  projectDescription: string;
  projectDeadline?: string;
  projectCategory?: string;
  actionUrl: string;
  projectLink?: string;
}

export async function sendProjectEmail(payload: ProjectEmailPayload): Promise<boolean> {
  if (!supabase) {
    console.warn('Supabase is not configured; project email was not sent.');
    return false;
  }

  try {
    const { error } = await supabase.functions.invoke('project-email', {
      body: payload
    });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Failed to send project email through Supabase Edge Function:', error);
    return false;
  }
}
