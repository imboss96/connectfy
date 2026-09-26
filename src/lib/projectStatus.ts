export type ProjectAvailabilityStatus = 'active' | 'upcoming' | 'paused' | 'closed' | 'ended' | 'hidden';

export function normalizeProjectStatus(status?: string | null): ProjectAvailabilityStatus {
  const value = (status || '').toLowerCase();

  switch (value) {
    case 'paused':
    case 'inactive':
      return 'paused';
    case 'hidden':
      return 'hidden';
    case 'upcoming':
      return 'upcoming';
    case 'ended':
      return 'ended';
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

export function isProjectVisibleToTesters(project?: Partial<{ status?: string | null }> | null): boolean {
  return normalizeProjectStatus(project?.status) !== 'hidden';
}

export function getProjectAvailabilityLabel(status?: string | null, startsAt?: string | null): string {
  const normalizedStatus = normalizeProjectStatus(status);
  if (normalizedStatus === 'active') return 'Open';
  if (normalizedStatus === 'upcoming') {
    if (!startsAt) return 'Coming soon';
    const parsedDate = new Date(`${startsAt}T00:00:00`);
    const formattedDate = Number.isNaN(parsedDate.getTime())
      ? startsAt
      : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(parsedDate);
    return `Starts at ${formattedDate}`;
  }
  return 'Closed';
}
