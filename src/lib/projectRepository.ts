import { Project } from '../types';
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
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (error) throw error;

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
    status: row.status,
    deadline: row.deadline || '',
    slotsTotal: row.slots_total,
    slotsFilled: row.slots_filled,
    totalBudget: Number(row.total_budget),
    budgetDisbursed: Number(row.budget_disbursed)
  })) as Project[];
}

function toProjectRow(project: Project, clientId: string) {
  return {
    client_id: clientId,
    title: project.title,
    company: project.company,
    short_description: project.shortDescription,
    full_overview: project.fullOverview,
    category: project.category,
    project_track: project.projectTrack || null,
    payment_model: project.paymentModel || null,
    status: project.status,
    deadline: project.deadline || null,
    slots_total: project.slotsTotal,
    slots_filled: project.slotsFilled,
    total_budget: project.totalBudget,
    budget_disbursed: project.budgetDisbursed,
    project_data: project
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
  const { error } = await supabase.from('projects').insert(toProjectRow(project, clientId));
  if (error) throw error;
}

export async function updateProjectInSupabase(projectId: string, updates: Partial<Project>) {
  if (!supabase) return;
  const { error } = await supabase.from('projects').update({
    ...(updates.title !== undefined && { title: updates.title }),
    ...(updates.company !== undefined && { company: updates.company }),
    ...(updates.shortDescription !== undefined && { short_description: updates.shortDescription }),
    ...(updates.fullOverview !== undefined && { full_overview: updates.fullOverview }),
    ...(updates.category !== undefined && { category: updates.category }),
    ...(updates.projectTrack !== undefined && { project_track: updates.projectTrack }),
    ...(updates.paymentModel !== undefined && { payment_model: updates.paymentModel }),
    ...(updates.status !== undefined && { status: updates.status }),
    ...(updates.deadline !== undefined && { deadline: updates.deadline }),
    ...(updates.slotsTotal !== undefined && { slots_total: updates.slotsTotal }),
    ...(updates.slotsFilled !== undefined && { slots_filled: updates.slotsFilled }),
    ...(updates.totalBudget !== undefined && { total_budget: updates.totalBudget }),
    ...(updates.budgetDisbursed !== undefined && { budget_disbursed: updates.budgetDisbursed }),
    updated_at: new Date().toISOString()
  }).eq('id', projectId);
  if (error) throw error;
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
      id,
      project_id,
      tester_id,
      status,
      invite_status,
      selected_devices,
      experience_note,
      applied_at,
      last_invite_sent_at,
      invite_history,
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

export async function updateApplicationInSupabase(appId: string, updates: { status?: string; invite_status?: string | null; last_invite_sent_at?: string | null; invite_history?: any[]; updated_at?: string }) {
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
