-- Requires 202610140001_tiered_admin_access.sql.
drop policy if exists "project managers view Applause statuses" on public.project_applause_status;
create policy "project managers view Applause statuses" on public.project_applause_status
  for select to authenticated
  using (public.can_manage_projects());

drop policy if exists "project managers view legacy sheet responses" on public.legacy_sheet_responses;
create policy "project managers view legacy sheet responses" on public.legacy_sheet_responses
  for select to authenticated
  using (public.can_manage_projects());

drop policy if exists "project managers view legacy email logs" on public.legacy_sheet_email_log;
create policy "project managers view legacy email logs" on public.legacy_sheet_email_log
  for select to authenticated
  using (public.can_manage_projects());
