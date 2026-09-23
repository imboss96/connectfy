-- Promote the real owner/admin account by email so it works outside any hardcoded UUID.
update public.profiles
set role = 'admin', updated_at = now()
where email = 'admin@connectfy.tech';

-- Fallback for any earlier seeded project owner or alias account that may already exist.
update public.profiles
set role = 'admin', updated_at = now()
where lower(email) like '%@connectfy.tech';

-- Confirm the admin account(s) that can manage projects and applicant queues.
select id, email, role
from public.profiles
where role = 'admin' and lower(email) like '%@connectfy.tech';