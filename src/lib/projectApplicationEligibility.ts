import { ProjectApplication, SubmissionStatus } from '../types';

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
