import { AttachmentFile } from '../types';
import { isSupabaseConfigured, supabase } from './supabase';

export type ProjectStepId = 'slack' | 'consent' | 'languageSettings' | 'recordings';
export type ProjectStepStatus = 'pending' | 'submitted' | 'done' | 'failed' | 'skipped';
export type ProjectStepStatuses = Record<ProjectStepId, ProjectStepStatus>;
export type ProjectStepRequirements = Record<ProjectStepId, boolean>;
export type ProjectStepReviewNotes = Partial<Record<ProjectStepId, string>>;

export const projectStepIds: ProjectStepId[] = ['slack', 'consent', 'languageSettings', 'recordings'];
export const defaultProjectStepRequirements: ProjectStepRequirements = {
  slack: true,
  consent: true,
  languageSettings: true,
  recordings: true
};

export interface ProjectStepProgress {
  statuses: ProjectStepStatuses;
  attachments: AttachmentFile[];
  reviewNotes: ProjectStepReviewNotes;
}

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export const usesRemoteProjectStepProgress = (projectId: string) =>
  isSupabaseConfigured && Boolean(supabase) && isUuid(projectId);

export async function fetchProjectStepRequirements(projectId: string): Promise<ProjectStepRequirements> {
  if (!supabase) throw new Error('Supabase is not configured.');

  const { data, error } = await supabase.rpc('get_project_step_requirements', {
    p_project_id: projectId
  });
  if (error) {
    throw new Error(`Unable to load project step requirements: ${error.message}`);
  }

  const requirements = { ...defaultProjectStepRequirements };
  const rows = data as Array<{ step_id: string; is_required: boolean }> | null;
  if (!Array.isArray(rows) || rows.length !== projectStepIds.length) {
    throw new Error('Project step requirements have an invalid format.');
  }

  const foundSteps = new Set<ProjectStepId>();
  for (const row of rows) {
    if (!projectStepIds.includes(row.step_id as ProjectStepId)
      || foundSteps.has(row.step_id as ProjectStepId)
      || typeof row.is_required !== 'boolean') {
      throw new Error('Project step requirements have an invalid format.');
    }
    const stepId = row.step_id as ProjectStepId;
    foundSteps.add(stepId);
    requirements[stepId] = row.is_required;
  }

  return requirements;
}

export async function saveProjectStepRequirements(
  projectId: string,
  requirements: ProjectStepRequirements
): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured.');

  const { error } = await supabase.rpc('set_project_step_requirements', {
    p_project_id: projectId,
    p_requirements: requirements
  });
  if (error) {
    throw new Error(`Unable to save project step requirements: ${error.message}`);
  }
}

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
  if (!statuses || !projectStepIds.every((stepId) =>
    statuses[stepId] === 'pending'
      || statuses[stepId] === 'submitted'
      || statuses[stepId] === 'done'
      || statuses[stepId] === 'failed'
      || statuses[stepId] === 'skipped'
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

  const { data: reviewRows, error: reviewError } = await supabase
    .from('project_step_review_history')
    .select('step_id,note')
    .eq('project_id', projectId)
    .eq('tester_id', testerId)
    .order('created_at', { ascending: false });
  if (reviewError) {
    throw new Error(`Unable to load project step review feedback: ${reviewError.message}`);
  }

  const reviewNotes: ProjectStepReviewNotes = {};
  for (const review of reviewRows || []) {
    const stepId = review.step_id as ProjectStepId;
    if (reviewNotes[stepId] === undefined && review.note) reviewNotes[stepId] = review.note;
  }

  return {
    statuses: statuses as ProjectStepStatuses,
    attachments: data.evidence as AttachmentFile[],
    reviewNotes
  };
}

export async function saveProjectStepProgress(projectId: string, progress: ProjectStepProgress): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured.');

  await getAuthenticatedTesterId();
  const { error } = await supabase.rpc('submit_project_step_progress', {
    p_project_id: projectId,
    p_statuses: progress.statuses,
    p_evidence: progress.attachments
  });

  if (error) {
    throw new Error(`Unable to save project checklist progress: ${error.message}`);
  }
}
