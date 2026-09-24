export type ProjectAvailabilityStatus = 'active' | 'upcoming' | 'paused' | 'closed';

export function normalizeProjectStatus(status?: string | null): ProjectAvailabilityStatus {
  const value = (status || '').toLowerCase();

  switch (value) {
    case 'paused':
    case 'inactive':
      return 'paused';
    case 'upcoming':
      return 'upcoming';
    case 'close':
    case 'closed':
    case 'completed':
    case 'finished':
      return 'closed';
    case 'active':
    default:
      return 'active';
  }
}

export function isProjectOpenForApplications(project?: Partial<{ status?: string | null }> | null): boolean {
  return normalizeProjectStatus(project?.status) === 'active';
}
