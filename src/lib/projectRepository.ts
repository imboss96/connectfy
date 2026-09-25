import { Project, ProjectResource } from '../types';
import { normalizeProjectStatus } from './projectStatus';
import { supabase } from './supabase';

type ProjectRow = {
  id: string;
  title: string;
  company: string;
  short_description: string;
  full_overview: string;
  category: Project['category'];
  project_track: Project['projectTrack'] | null;
  payment_model: Project['paymentModel'] | null;
  status: Project['status'];
  deadline: string | null;
  slots_total: number;
  slots_filled: number;
  total_budget: number;
  budget_disbursed: number;
  project_data: Partial<Project>;
};

export async function fetchProjectsFromSupabase(): Promise<Project[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('projects')
    .select('id,title,company,short_description,full_overview,category,project_track,payment_model,status,deadline,slots_total,slots_filled,total_budget,budget_disbursed,project_data')
    .order('created_at', { ascending: false });

  if (error) throw error;

  const projectIds = (data || []).map((row) => row.id);
  const { data: resourceRows, error: resourceError } = projectIds.length > 0
    ? await supabase.from('project_resources').select('project_id,label,url,sort_order').in('project_id', projectIds).order('sort_order', { ascending: true })
    : { data: [], error: null };

  const resourcesByProject = new Map<string, ProjectResource[]>();
  if (!resourceError) {
    (resourceRows || []).forEach((resource) => {
      const existing = resourcesByProject.get(resource.project_id) || [];
      existing.push({ label: resource.label, url: resource.url });
      resourcesByProject.set(resource.project_id, existing);
    });
  }

  return ((data || []) as ProjectRow[]).map(row => ({
    ...(row.project_data || {}),
    id: row.id,
    title: row.title,
    company: row.company,
    shortDescription: row.short_description,
    fullOverview: row.full_overview,
    category: row.category,
    projectTrack: row.project_track || undefined,
    paymentModel: row.payment_model || undefined,
    status: normalizeProjectStatus(row.status),
    deadline: row.deadline || '',
    slotsTotal: row.slots_total,
    slotsFilled: row.slots_filled,
    totalBudget: Number(row.total_budget),
    budgetDisbursed: Number(row.budget_disbursed),
    resources: resourcesByProject.get(row.id) || (Array.isArray(row.project_data?.resources) ? row.project_data.resources : [])
  })) as Project[];
}

async function replaceProjectResources(projectId: string, resources: ProjectResource[] = []) {
  if (!supabase) return;

  const { error: deleteError } = await supabase.from('project_resources').delete().eq('project_id', projectId);
  if (deleteError) throw deleteError;
  if (resources.length === 0) return;

  const { error: insertError } = await supabase.from('project_resources').insert(
    resources.map((resource, sortOrder) => ({
      project_id: projectId,
      label: resource.label,
      url: resource.url,
      sort_order: sortOrder
    }))
  );
  if (insertError) throw insertError;
}

export function normalizeProjectForPersistence(project: Partial<Project>) {
  const normalizedStatus = normalizeProjectStatus(project.status);

  return {
    ...(project.title !== undefined && { title: project.title }),
    ...(project.company !== undefined && { company: project.company }),
    ...(project.shortDescription !== undefined && { shortDescription: project.shortDescription }),
    ...(project.fullOverview !== undefined && { fullOverview: project.fullOverview }),
    ...(project.resources !== undefined && { resources: project.resources }),
    ...(project.category !== undefined && { category: project.category }),
    ...(project.projectTrack !== undefined && { projectTrack: project.projectTrack }),
    ...(project.paymentModel !== undefined && { paymentModel: project.paymentModel }),
    ...(project.taskUnitName !== undefined && { taskUnitName: project.taskUnitName }),
    ...(project.taskRate !== undefined && { taskRate: project.taskRate }),
    ...(project.deliverablesGuide !== undefined && { deliverablesGuide: project.deliverablesGuide }),
    ...(project.companyLogo !== undefined && { companyLogo: project.companyLogo }),
    ...(project.inScope !== undefined && { inScope: project.inScope }),
    ...(project.outOfScope !== undefined && { outOfScope: project.outOfScope }),
    ...(project.requiredDevices !== undefined && { requiredDevices: project.requiredDevices }),
    ...(project.supportedCountries !== undefined && { supportedCountries: project.supportedCountries }),
    ...(project.slotsTotal !== undefined && { slotsTotal: project.slotsTotal }),
    ...(project.slotsFilled !== undefined && { slotsFilled: project.slotsFilled }),
    ...(project.deadline !== undefined && { deadline: project.deadline }),
    ...(project.status !== undefined && { status: normalizedStatus }),
    ...(project.bountyStructure !== undefined && { bountyStructure: project.bountyStructure }),
    ...(project.totalBudget !== undefined && { totalBudget: project.totalBudget }),
    ...(project.budgetDisbursed !== undefined && { budgetDisbursed: project.budgetDisbursed }),
    ...(project.clientId !== undefined && { clientId: project.clientId }),
    ...(project.createdAt !== undefined && { createdAt: project.createdAt })
  };
}

function toProjectRow(project: Project, clientId: string) {
  return {
    ...(project.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(project.id) && { id: project.id }),
    client_id: clientId,
    title: project.title,
    company: project.company,
    short_description: project.shortDescription,
    full_overview: project.fullOverview,
    category: project.category,
    project_track: project.projectTrack || null,
    payment_model: project.paymentModel || null,
    status: normalizeProjectStatus(project.status),
    deadline: project.deadline || null,
    slots_total: project.slotsTotal,
    slots_filled: project.slotsFilled,
    total_budget: project.totalBudget,
    budget_disbursed: project.budgetDisbursed,
    project_data: normalizeProjectForPersistence(project)
  };
}

async function requireUserId() {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user?.id || null;
}

export async function createProjectInSupabase(project: Project) {
  if (!supabase) return;
  const clientId = await requireUserId();
  if (!clientId) throw new Error('You must be signed in to create a project.');
  const { data, error } = await supabase.from('projects').insert(toProjectRow(project, clientId)).select('id').single();
  if (error) throw error;
  await replaceProjectResources(data.id, project.resources);
}

export async function updateProjectInSupabase(projectId: string, updates: Partial<Project>) {
  if (!supabase) return;

  const projectPayload = normalizeProjectForPersistence(updates);

  const { error } = await supabase.from('projects').update({
    ...(updates.title !== undefined && { title: updates.title }),
    ...(updates.company !== undefined && { company: updates.company }),
    ...(updates.shortDescription !== undefined && { short_description: updates.shortDescription }),
    ...(updates.fullOverview !== undefined && { full_overview: updates.fullOverview }),
    ...(updates.category !== undefined && { category: updates.category }),
    ...(updates.projectTrack !== undefined && { project_track: updates.projectTrack }),
    ...(updates.paymentModel !== undefined && { payment_model: updates.paymentModel }),
    ...(updates.status !== undefined && { status: normalizeProjectStatus(updates.status) }),
    ...(updates.deadline !== undefined && { deadline: updates.deadline }),
    ...(updates.slotsTotal !== undefined && { slots_total: updates.slotsTotal }),
    ...(updates.slotsFilled !== undefined && { slots_filled: updates.slotsFilled }),
    ...(updates.totalBudget !== undefined && { total_budget: updates.totalBudget }),
    ...(updates.budgetDisbursed !== undefined && { budget_disbursed: updates.budgetDisbursed }),
    project_data: projectPayload,
    updated_at: new Date().toISOString()
  }).eq('id', projectId);
  if (error) throw error;
  if (updates.resources !== undefined) await replaceProjectResources(projectId, updates.resources);
}

export async function deleteProjectFromSupabase(projectId: string) {
  if (!supabase) return;
  const { error } = await supabase.from('projects').delete().eq('id', projectId);
  if (error) throw error;
}

export async function fetchApplicationsFromSupabase() {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('applications')
    .select(`
      *,
      project:project_id (
        id,
        title,
        company
      ),
      profiles:tester_id (
        id,
        name,
        email,
        profile_data
      )
    `)
    .order('applied_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function upsertApplicationInSupabase(app: {
  id: string;
  project_id: string;
  tester_id: string;
  status: string;
  invite_status?: string | null;
  selected_devices: string[];
  experience_note: string;
  applied_at: string;
  last_invite_sent_at?: string | null;
  invite_history?: any[];
}) {
  if (!supabase) return;

  const { error } = await supabase
    .from('applications')
    .upsert({
      id: app.id,
      project_id: app.project_id,
      tester_id: app.tester_id,
      status: app.status,
      invite_status: app.invite_status || null,
      selected_devices: app.selected_devices,
      experience_note: app.experience_note,
      applied_at: app.applied_at,
      last_invite_sent_at: app.last_invite_sent_at || null,
      invite_history: app.invite_history || [],
      updated_at: new Date().toISOString()
    }, { onConflict: 'project_id,tester_id' });

  if (error) throw error;
}

export async function fetchApplicationDraftFromSupabase(projectId: string) {
  if (!supabase) return null;

  const userId = await requireUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from('application_drafts')
    .select('draft_data')
    .eq('project_id', projectId)
    .eq('tester_id', userId)
    .maybeSingle();

  if (error) throw error;
  return (data?.draft_data || null) as Record<string, unknown> | null;
}

export async function upsertApplicationDraftInSupabase(projectId: string, draftData: Record<string, unknown>) {
  if (!supabase) return;

  const userId = await requireUserId();
  if (!userId) throw new Error('You must be signed in to save an application draft.');

  const { error } = await supabase
    .from('application_drafts')
    .upsert({
      project_id: projectId,
      tester_id: userId,
      draft_data: draftData,
      updated_at: new Date().toISOString()
    }, { onConflict: 'project_id,tester_id' });

  if (error) throw error;
}

export async function deleteApplicationDraftFromSupabase(projectId: string) {
  if (!supabase) return;

  const userId = await requireUserId();
  if (!userId) return;

  const { error } = await supabase
    .from('application_drafts')
    .delete()
    .eq('project_id', projectId)
    .eq('tester_id', userId);

  if (error) throw error;
}

export async function updateApplicationInSupabase(appId: string, updates: { status?: string; invite_status?: string | null; accepted_invite_at?: string | null; last_invite_sent_at?: string | null; invite_history?: any[]; updated_at?: string }) {
  if (!supabase) return;

  const { error } = await supabase
    .from('applications')
    .update({
      ...updates,
      updated_at: updates.updated_at || new Date().toISOString()
    })
    .eq('id', appId);

  if (error) throw error;
}
