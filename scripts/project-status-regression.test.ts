import assert from 'node:assert/strict';
import { getProjectAvailabilityLabel, isProjectOpenForApplications, isProjectVisibleToTesters, normalizeProjectStatus } from '../src/lib/projectStatus';

assert.equal(normalizeProjectStatus('active'), 'active');
assert.equal(normalizeProjectStatus('completed'), 'closed');
assert.equal(normalizeProjectStatus('paused'), 'paused');
assert.equal(normalizeProjectStatus('close'), 'closed');
assert.equal(normalizeProjectStatus('ended'), 'ended');
assert.equal(normalizeProjectStatus('hidden'), 'hidden');

assert.equal(isProjectOpenForApplications({ status: 'active' } as any), true);
assert.equal(isProjectOpenForApplications({ status: 'paused' } as any), false);
assert.equal(isProjectOpenForApplications({ status: 'closed' } as any), false);
assert.equal(isProjectOpenForApplications({ status: 'completed' } as any), false);
assert.equal(isProjectVisibleToTesters({ status: 'hidden' }), false);
assert.equal(isProjectVisibleToTesters({ status: 'closed' }), true);
assert.equal(getProjectAvailabilityLabel('active'), 'Open');
assert.equal(getProjectAvailabilityLabel('closed'), 'Closed');
assert.equal(getProjectAvailabilityLabel('upcoming', '2030-01-15'), 'Starts at Jan 15, 2030');

console.log('project status regression checks passed');
