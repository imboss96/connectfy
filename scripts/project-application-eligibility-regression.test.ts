import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  getBlockingProjectApplication,
  getProjectApplicationLockMessage
} from '../src/lib/projectApplicationEligibility';
import { ProjectApplication, SubmissionStatus } from '../src/types';

const migration = fs.readFileSync(
  new URL('../supabase/migrations/202610220001_require_project_completion_before_next_application.sql', import.meta.url),
  'utf8'
);

const application = (
  projectId: string,
  overrides: Partial<ProjectApplication> = {}
): ProjectApplication => ({
  id: `application-${projectId}`,
  projectId,
  testerId: 'tester-1',
  testerName: 'Tester',
  testerEmail: 'tester@example.com',
  testerRating: 0,
  testerTier: 'Unrated',
  appliedDate: '2026-10-22',
  selectedDevices: [],
  experienceNote: '',
  status: 'pending',
  ...overrides
});

const submission = (
  projectId: string,
  status: SubmissionStatus,
  testerId = 'tester-1',
  id = `${projectId}-${status}`,
  resubmissionOfId?: string
) => ({
  id,
  projectId,
  testerId,
  status,
  resubmissionOfId
});

const firstApplication = application('project-1');

assert.deepEqual(
  getBlockingProjectApplication([firstApplication], [], 'tester-1', 'project-2'),
  { projectId: 'project-1', totalSubmissions: 0, approvedSubmissions: 0 },
  'an application with no submissions blocks applying to another project'
);

assert.equal(
  getBlockingProjectApplication(
    [firstApplication],
    [submission('project-1', 'approved')],
    'tester-1',
    'project-2'
  ),
  null,
  'all-approved submissions unlock applications to another project'
);

assert.deepEqual(
  getBlockingProjectApplication(
    [firstApplication],
    [
      submission('project-1', 'rejected', 'tester-1', 'old-submission'),
      submission('project-1', 'submitted', 'tester-1', 'replacement-submission', 'old-submission')
    ],
    'tester-1',
    'project-2'
  ),
  { projectId: 'project-1', totalSubmissions: 1, approvedSubmissions: 0 },
  'a pending resubmission supersedes its rejected parent but keeps the application lock active'
);

assert.equal(
  getBlockingProjectApplication(
    [firstApplication],
    [
      submission('project-1', 'rejected', 'tester-1', 'old-submission'),
      submission('project-1', 'approved', 'tester-1', 'replacement-submission', 'old-submission')
    ],
    'tester-1',
    'project-2'
  ),
  null,
  'an approved latest resubmission unlocks applications to another project'
);

for (const status of ['draft', 'submitted', 'under_review', 'changes_requested', 'rejected'] as const) {
  assert.notEqual(
    getBlockingProjectApplication(
      [firstApplication],
      [submission('project-1', 'approved'), submission('project-1', status)],
      'tester-1',
      'project-2'
    ),
    null,
    `${status} submissions keep the application lock active`
  );
}

assert.equal(
  getBlockingProjectApplication([firstApplication], [], 'tester-1', 'project-1'),
  null,
  'an existing application can be updated for the same project'
);

assert.equal(
  getBlockingProjectApplication(
    [application('project-rejected', { status: 'rejected' }), firstApplication],
    [],
    'tester-1',
    'project-2'
  )?.projectId,
  'project-1',
  'a rejected application does not block, but a later active application does'
);

assert.equal(
  getBlockingProjectApplication(
    [application('project-declined', { status: 'approved', inviteStatus: 'declined' })],
    [],
    'tester-1',
    'project-2'
  ),
  null,
  'declined invitations do not block new applications'
);

const blocked = getBlockingProjectApplication([firstApplication], [], 'tester-1', 'project-2');
assert.ok(blocked);
assert.match(
  getProjectApplicationLockMessage(blocked, 'First project'),
  /Submit at least one deliverable/
);

assert.match(migration, /before insert on public\.applications/i);
assert.match(migration, /before update of project_id, tester_id on public\.applications/i);
assert.match(migration, /not exists\s*\([\s\S]*?from public\.submissions/i);
assert.match(migration, /resubmission_of uuid references public\.submissions\(id\)/i);
assert.match(migration, /create unique index if not exists submissions_single_resubmission_idx/i);
assert.match(migration, /original_submission\.status not in \('rejected', 'changes_requested'\)/i);
assert.match(migration, /submission\.status <> 'approved'/i);
assert.match(migration, /new\.status = 'rejected'/i);

console.log('project application eligibility regression checks passed');
