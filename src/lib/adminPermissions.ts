import { AdminAccessLevel } from '../types';

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
  | 'application_screener_submissions'
  | 'arbeitnow_jobs'
  | 'service_listings'
  | 'client_applicants'
  | 'client_cycles';

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
    'arbeitnow_jobs',
    'service_listings',
    'client_applicants',
    'client_cycles',
    'application_screener_submissions'
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
    'application_screener_submissions'
  ]),
  reviewer: new Set(['client_submissions', 'profile_settings', 'project_tasks', 'arbeitnow_jobs'])
};

export const canAccessAdminTab = (level: AdminAccessLevel, tab: string): tab is AdminTab =>
  adminTabs[level].has(tab as AdminTab);

export const getDefaultAdminTab = (level: AdminAccessLevel): AdminTab =>
  level === 'super_admin' || level === 'project_manager' ? 'admin_manager' : 'client_submissions';
