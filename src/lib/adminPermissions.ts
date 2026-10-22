import { AdminAccessLevel, UserRole } from '../types';

export type AdminTab =
  | 'admin_manager'
  | 'mass_invites'
  | 'crm'
  | 'project_operations'
  | 'client_submissions'
  | 'profile_settings'
  | 'project_tasks'
  | 'payments'
  | 'approval_emails'
  | 'payout_operations'
  | 'referral_operations'
  | 'application_screener_submissions'
  | 'arbeitnow_jobs'
  | 'service_listings'
  | 'client_applicants'
  | 'client_cycles'
  | 'hr'
  | 'step_reviews';

const adminTabs: Record<AdminAccessLevel, ReadonlySet<AdminTab>> = {
  super_admin: new Set([
    'admin_manager',
    'mass_invites',
    'crm',
    'project_operations',
    'client_submissions',
    'profile_settings',
    'project_tasks',
    'payments',
    'approval_emails',
    'payout_operations',
    'referral_operations',
    'arbeitnow_jobs',
    'service_listings',
    'client_applicants',
    'client_cycles',
    'application_screener_submissions',
    'hr',
    'step_reviews'
  ]),
  project_manager: new Set([
    'admin_manager',
    'mass_invites',
    'crm',
    'project_operations',
    'client_submissions',
    'profile_settings',
    'project_tasks',
    'arbeitnow_jobs',
    'service_listings',
    'client_applicants',
    'client_cycles',
    'application_screener_submissions',
    'step_reviews'
  ]),
  reviewer: new Set(['client_submissions', 'profile_settings', 'project_tasks', 'arbeitnow_jobs', 'step_reviews'])
};

export const canAccessAdminTab = (level: AdminAccessLevel, tab: string): tab is AdminTab =>
  adminTabs[level].has(tab as AdminTab);

export const getDefaultAdminTab = (level: AdminAccessLevel): AdminTab =>
  level === 'super_admin' || level === 'project_manager' ? 'admin_manager' : 'client_submissions';

export const getWorkspaceRoleForAuthenticatedAccount = (
  authenticatedRole: UserRole,
  savedAccountRole: string | null,
  savedWorkspaceRole: string | null
): UserRole => {
  if (savedAccountRole !== authenticatedRole) return authenticatedRole;
  if (authenticatedRole === 'admin' && savedWorkspaceRole === 'tester') return 'tester';
  return authenticatedRole;
};
