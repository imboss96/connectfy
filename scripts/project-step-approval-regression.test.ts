import assert from 'node:assert/strict';
import fs from 'node:fs';
import { canAccessAdminTab } from '../src/lib/adminPermissions';
import type {
  ProjectStepId,
  ProjectStepStatuses
} from '../src/lib/projectStepProgress';

const migration = fs.readFileSync(
  new URL('../supabase/migrations/202610220003_require_project_step_approval.sql', import.meta.url),
  'utf8'
);
const jsonbFixMigration = fs.readFileSync(
  new URL('../supabase/migrations/202610220006_fix_project_step_jsonb_object_count.sql', import.meta.url),
  'utf8'
);
const requirementsMigration = fs.readFileSync(
  new URL('../supabase/migrations/202610270003_configurable_project_steps.sql', import.meta.url),
  'utf8'
);
const reviewInterface = fs.readFileSync(
  new URL('../src/components/ProjectStepReviews.tsx', import.meta.url),
  'utf8'
);
const guidedInterface = fs.readFileSync(
  new URL('../src/components/GuidedProjectSteps.tsx', import.meta.url),
  'utf8'
);
const settingsInterface = fs.readFileSync(
  new URL('../src/components/ProjectStepSettingsSection.tsx', import.meta.url),
  'utf8'
);
const steps: ProjectStepId[] = ['slack', 'consent', 'languageSettings', 'recordings'];

const initialStatuses: ProjectStepStatuses = {
  slack: 'pending',
  consent: 'pending',
  languageSettings: 'pending',
  recordings: 'pending'
};

assert.deepEqual(steps, Object.keys(initialStatuses));
assert.equal(canAccessAdminTab('super_admin', 'step_reviews'), true);
assert.equal(canAccessAdminTab('project_manager', 'step_reviews'), true);
assert.equal(canAccessAdminTab('reviewer', 'step_reviews'), true);
assert.equal(canAccessAdminTab('project_manager', 'hr'), false);

assert.match(migration, /create or replace function public\.submit_project_step_progress/i);
assert.match(migration, /when entry\.value = '"done"'::jsonb then '"submitted"'/i);
assert.match(migration, /when entry\.value = '"failed"'::jsonb then '"pending"'/i);
assert.match(migration, /old_status not in \('pending', 'failed'\) or new_status <> 'submitted'/i);
assert.match(migration, /previous project step must be approved/i);
assert.match(migration, /changes_count > 1/i);
assert.match(migration, /create or replace function public\.review_project_step/i);
assert.match(migration, /public\.can_review_submissions\(\)/i);
assert.match(migration, /case when p_approved then 'done' else 'failed' end/i);
assert.match(migration, /requesting changes\./i);
assert.match(migration, /drop policy if exists "testers update their project step progress"/i);
assert.match(migration, /revoke insert, update, delete on public\.project_step_progress/i);
assert.match(migration, /project_step_review_history/i);
assert.match(jsonbFixMigration, /create or replace function public\.submit_project_step_progress/i);
assert.match(jsonbFixMigration, /select count\(\*\) into status_key_count[\s\S]*from jsonb_object_keys\(p_statuses\)/i);
assert.match(jsonbFixMigration, /coalesce\(jsonb_typeof\(p_statuses\), ''\) <> 'object'[\s\S]*coalesce\(jsonb_typeof\(p_evidence\), ''\) <> 'array'/i);
assert.doesNotMatch(jsonbFixMigration, /or case/i);
assert.doesNotMatch(jsonbFixMigration, /jsonb_object_length/i);
assert.match(reviewInterface, /Search tester name or Gmail/i);
assert.match(reviewInterface, /review\.tester_name[\s\S]*review\.tester_email/i);
assert.match(reviewInterface, /Filter by project/i);
assert.match(reviewInterface, /groupedReviews\.map/i);
assert.match(reviewInterface, /review\.project_id === projectFilter/i);
assert.match(reviewInterface, /Select all \{filteredReviews\.length\}/i);
assert.match(reviewInterface, /Approve selected \(\$\{visibleSelectedCount\}\)/i);
assert.match(reviewInterface, /for \(const review of selectedReviews\)/i);
assert.match(reviewInterface, /review_project_step/i);
assert.match(requirementsMigration, /create table if not exists public\.project_step_requirements/i);
assert.match(requirementsMigration, /coalesce\(requirement\.is_required, true\)/i);
assert.match(requirementsMigration, /create or replace function public\.set_project_step_requirements/i);
assert.match(requirementsMigration, /latest_note text,\s+is_required boolean/i);
assert.match(requirementsMigration, /new\.title in \('Project Completion Checklist', 'Google Selfies Project Completion'\)/i);
assert.match(requirementsMigration, /all required project steps must be approved/i);
assert.match(requirementsMigration, /'skipped'/i);
assert.match(guidedInterface, /fetchProjectStepRequirements/i);
assert.match(guidedInterface, /requiredStepIds\.every/i);
assert.match(guidedInterface, /Skip optional step/i);
assert.match(settingsInterface, /Required and optional steps/i);
assert.match(settingsInterface, /saveProjectStepRequirements/i);
assert.match(reviewInterface, /review\.is_required === false \? 'Optional' : 'Required'/i);

console.log('project step approval regression checks passed');
