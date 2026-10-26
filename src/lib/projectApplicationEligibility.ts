import { ProjectApplication, SubmissionStatus } from '../types';
import { supabase } from './supabase';

export interface ProjectSubmissionStatus {
  id?: string;
  projectId: string;
  testerId: string;
  status: SubmissionStatus;
  resubmissionOfId?: string;
}

export interface ProjectApplicationLock {
  projectId: string;
  totalSubmissions: number;
  approvedSubmissions: number;
}

export async function fetchProjectApplicationRestrictionEnabled(): Promise<boolean> {
  if (!supabase) throw new Error('Supabase is not configured.');

  const { data, error } = await supabase.rpc('get_project_application_restriction');
  if (error) {
    throw new Error(`Unable to load the project application restriction: ${error.message}`);
  }
  if (typeof data !== 'boolean') {
    throw new Error('The project application restriction returned an invalid setting.');
  }
  return data;
}

export async function saveProjectApplicationRestriction(enabled: boolean): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured.');

  const { error } = await supabase.rpc('set_project_application_restriction', {
    p_enabled: enabled
  });
  if (error) {
    throw new Error(`Unable to update the project application restriction: ${error.message}`);
  }
}

export function getBlockingProjectApplication(
  applications: ProjectApplication[],
  submissions: ProjectSubmissionStatus[],
  testerId: string,
  targetProjectId?: string
): ProjectApplicationLock | null {
  const blockingApplication = applications.find((application) => {
    if (application.testerId !== testerId
      || application.projectId === targetProjectId
      || application.status === 'rejected'
      || application.inviteStatus === 'declined') {
      return false;
    }

    const projectSubmissions = submissions.filter((submission) =>
      submission.testerId === testerId && submission.projectId === application.projectId
    );
    const resubmittedIds = new Set(projectSubmissions
      .map((submission) => submission.resubmissionOfId)
      .filter((id): id is string => Boolean(id)));
    const currentSubmissions = projectSubmissions.filter((submission) =>
      !submission.id || !resubmittedIds.has(submission.id)
    );
    return currentSubmissions.length === 0
      || currentSubmissions.some((submission) => submission.status !== 'approved');
  });

  if (!blockingApplication) return null;

  const projectSubmissions = submissions.filter((submission) =>
    submission.testerId === testerId && submission.projectId === blockingApplication.projectId
  );
  const resubmittedIds = new Set(projectSubmissions
    .map((submission) => submission.resubmissionOfId)
    .filter((id): id is string => Boolean(id)));
  const currentSubmissions = projectSubmissions.filter((submission) =>
    !submission.id || !resubmittedIds.has(submission.id)
  );

  return {
    projectId: blockingApplication.projectId,
    totalSubmissions: currentSubmissions.length,
    approvedSubmissions: currentSubmissions.filter((submission) => submission.status === 'approved').length
  };
}

export function getProjectApplicationLockMessage(lock: ProjectApplicationLock, projectTitle: string): string {
  if (lock.totalSubmissions === 0) {
    return `Submit at least one deliverable for "${projectTitle}" and have it approved before applying to another project.`;
  }

  return `Every current submission for "${projectTitle}" must be approved before you can apply to another project (${lock.approvedSubmissions}/${lock.totalSubmissions} approved).`;
}
