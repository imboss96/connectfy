import { AdminAccessLevel } from '../types';

export const getHrJobTitleAdminAccess = (jobTitle: string): AdminAccessLevel | null => {
  const normalizedTitle = jobTitle.trim().toLowerCase();
  if (normalizedTitle === 'super admin') return 'super_admin';
  if (normalizedTitle === 'project manager') return 'project_manager';
  if (normalizedTitle === 'reviewer' || normalizedTitle === 'project reviewer') return 'reviewer';
  return null;
};
