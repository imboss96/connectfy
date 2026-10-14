import { AdminAccessLevel } from '../types';

export type AdminTab =
  | 'admin_manager'
  | 'mass_invites'
  | 'crm'
  | 'project_operations'
  | 'client_submissions'
  | 'profile_settings'
  | 'payments'
  | 'approval_emails'
  | 'payout_operations'
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
    'payments',
    'approval_emails',
    'payout_operations',
    'arbeitnow_jobs',
    'service_listings',
    'client_applicants',
    'client_cycles'
  ]),
  project_manager: new Set([
    'mass_invites',
    'crm',
    'client_submissions',
    'profile_settings',
    'arbeitnow_jobs',
    'service_listings',
    'client_applicants',
    'client_cycles'
  ]),
  reviewer: new Set(['client_submissions', 'profile_settings', 'arbeitnow_jobs'])
};

export const canAccessAdminTab = (level: AdminAccessLevel, tab: string): tab is AdminTab =>
  adminTabs[level].has(tab as AdminTab);

export const getDefaultAdminTab = (level: AdminAccessLevel): AdminTab =>
  level === 'super_admin' ? 'admin_manager' : level === 'project_manager' ? 'service_listings' : 'client_submissions';
