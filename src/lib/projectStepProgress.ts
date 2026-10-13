import { AttachmentFile } from '../types';
import { isSupabaseConfigured, supabase } from './supabase';

export type ProjectStepId = 'slack' | 'consent' | 'languageSettings' | 'recordings';
export type ProjectStepStatus = 'pending' | 'done' | 'failed';
export type ProjectStepStatuses = Record<ProjectStepId, ProjectStepStatus>;

export interface ProjectStepProgress {
  statuses: ProjectStepStatuses;
  attachments: AttachmentFile[];
}

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export const usesRemoteProjectStepProgress = (projectId: string) =>
  isSupabaseConfigured && Boolean(supabase) && isUuid(projectId);

const getAuthenticatedTesterId = async (): Promise<string> => {
  if (!supabase) throw new Error('Supabase is not configured.');

  const { data, error } = await supabase.auth.getUser();
  if (error) throw new Error(`Unable to verify your account before saving project progress: ${error.message}`);
  if (!data.user) throw new Error('Sign in to sync project checklist progress across devices.');
  return data.user.id;
};

export async function fetchProjectStepProgress(projectId: string): Promise<ProjectStepProgress | null> {
  if (!supabase) throw new Error('Supabase is not configured.');

  const testerId = await getAuthenticatedTesterId();
  const { data, error } = await supabase
    .from('project_step_progress')
    .select('statuses,evidence')
    .eq('project_id', projectId)
    .eq('tester_id', testerId)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to load saved project checklist progress: ${error.message}`);
  }
  if (!data) return null;

  const statuses = data.statuses as Partial<ProjectStepStatuses> | null;
  const stepIds: ProjectStepId[] = ['slack', 'consent', 'languageSettings', 'recordings'];
  if (!statuses || !stepIds.every((stepId) =>
    statuses[stepId] === 'pending' || statuses[stepId] === 'done' || statuses[stepId] === 'failed'
  )) {
    throw new Error('Saved project checklist progress has an invalid status format.');
  }

  if (!Array.isArray(data.evidence) || !data.evidence.every((item: unknown) => {
    if (!item || typeof item !== 'object') return false;
    const attachment = item as Partial<AttachmentFile>;
    return typeof attachment.id === 'string'
      && typeof attachment.name === 'string'
      && typeof attachment.type === 'string'
      && typeof attachment.url === 'string';
  })) {
    throw new Error('Saved project checklist evidence has an invalid format.');
  }

  return {
    statuses: statuses as ProjectStepStatuses,
    attachments: data.evidence as AttachmentFile[]
  };
}

export async function saveProjectStepProgress(projectId: string, progress: ProjectStepProgress): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured.');

  const testerId = await getAuthenticatedTesterId();
  const { error } = await supabase
    .from('project_step_progress')
    .upsert({
      project_id: projectId,
      tester_id: testerId,
      statuses: progress.statuses,
      evidence: progress.attachments,
      updated_at: new Date().toISOString()
    }, { onConflict: 'project_id,tester_id' });

  if (error) {
    throw new Error(`Unable to save project checklist progress: ${error.message}`);
  }
}
