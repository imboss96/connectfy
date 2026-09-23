import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { initialProjects } from '../src/mockData';

config({ path: '.env.local' });
config({ path: 'local.env' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !serviceKey) {
  throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before seeding.');
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const configuredClientId = process.env.SUPABASE_SEED_CLIENT_ID;
let seedClientId = configuredClientId;

if (!seedClientId) {
  const { data: clientProfile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'admin')
    .limit(1)
    .maybeSingle();

  if (profileError) throw profileError;
  seedClientId = clientProfile?.id;
}

if (!seedClientId) {
  throw new Error('No admin profile found. Set the single project owner profile role to admin, or set SUPABASE_SEED_CLIENT_ID to its UUID.');
}

const { data: ownerProfile, error: ownerError } = await supabase
  .from('profiles')
  .select('role')
  .eq('id', seedClientId)
  .maybeSingle();

if (ownerError) throw ownerError;
if (ownerProfile?.role !== 'admin') {
  throw new Error(`Seed owner ${seedClientId} must have role=admin.`);
}

const rows = initialProjects.map(project => ({
  client_id: seedClientId,
  title: project.title,
  company: project.company,
  short_description: project.shortDescription,
  full_overview: project.fullOverview,
  category: project.category,
  project_track: project.projectTrack || null,
  payment_model: project.paymentModel || null,
  status: project.status,
  deadline: project.deadline,
  slots_total: project.slotsTotal,
  slots_filled: project.slotsFilled,
  total_budget: project.totalBudget,
  budget_disbursed: project.budgetDisbursed,
  project_data: project
}));

const { error } = await supabase.from('projects').upsert(rows, {
  onConflict: 'title,client_id'
});

if (error) throw error;
console.log(`Seeded ${rows.length} projects into Supabase.`);
