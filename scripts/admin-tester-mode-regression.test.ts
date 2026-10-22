import assert from 'node:assert/strict';
import fs from 'node:fs';

const appContext = fs.readFileSync(new URL('../src/context/AppContext.tsx', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const navbar = fs.readFileSync(new URL('../src/components/Navbar.tsx', import.meta.url), 'utf8');
const migration = fs.readFileSync(
  new URL('../supabase/migrations/202610220007_admin_tester_mode.sql', import.meta.url),
  'utf8'
);
const emailBackend = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8');

assert.match(appContext, /accountRole: UserRole/);
assert.match(appContext, /const toggleAdminTesterMode = \(\) => \{[\s\S]*?if \(accountRole !== 'admin'\) return;[\s\S]*?role === 'admin' \? 'tester' : 'admin'/);
assert.match(appContext, /localStorage\.setItem\(STORAGE_PREFIX \+ 'accountRole', newRole\)/);
assert.match(appContext, /setActiveTab\(workspaceRole === 'tester' \? 'projects' : getDefaultAdminTab\(adminAccessLevel\)\)/);
assert.match(appContext, /accountRole !== 'admin'[\s\S]*adminAccessLevel === 'project_manager'[\s\S]*adminAccessLevel === 'reviewer'/);
assert.match(navbar, /accountRole === 'admin'[\s\S]*toggleAdminTesterMode[\s\S]*Tester mode[\s\S]*Admin mode/);
assert.match(app, /utest_crowdqa_accountRole/);
assert.match(migration, /if tester_role not in \('tester', 'admin'\)/);
assert.match(migration, /auth\.role\(\) is distinct from 'service_role'/);
assert.match(emailBackend, /\['tester', 'admin'\]\.includes\(tester\.role\)/);

console.log('Admin/tester workspace regression checks passed');