import assert from 'node:assert/strict';
import { isProjectOpenForApplications, normalizeProjectStatus } from '../src/lib/projectStatus';

assert.equal(normalizeProjectStatus('active'), 'active');
assert.equal(normalizeProjectStatus('completed'), 'closed');
assert.equal(normalizeProjectStatus('paused'), 'paused');
assert.equal(normalizeProjectStatus('close'), 'closed');

assert.equal(isProjectOpenForApplications({ status: 'active' } as any), true);
assert.equal(isProjectOpenForApplications({ status: 'paused' } as any), false);
assert.equal(isProjectOpenForApplications({ status: 'closed' } as any), false);
assert.equal(isProjectOpenForApplications({ status: 'completed' } as any), false);

console.log('project status regression checks passed');
