create table public.legacy_sheet_email_log (
  id uuid primary key default uuid_generate_v4(),
  recipient_email text not null,
  recipient_name text not null default '',
  email_type text not null default 'legacy_sheet_reapply'
    check (email_type = 'legacy_sheet_reapply'),
  subject text not null,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'failed', 'unverified')),
  error_message text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index legacy_sheet_email_log_created_at_idx
  on public.legacy_sheet_email_log (created_at desc);
create index legacy_sheet_email_log_recipient_email_idx
  on public.legacy_sheet_email_log (lower(recipient_email));

alter table public.legacy_sheet_email_log enable row level security;

grant select, insert, update on public.legacy_sheet_email_log to authenticated;

create policy "admins view legacy sheet email logs"
  on public.legacy_sheet_email_log for select to authenticated
  using (public.is_admin());

create policy "admins create legacy sheet email logs"
  on public.legacy_sheet_email_log for insert to authenticated
  with check (public.is_admin() and created_by = auth.uid());

create policy "admins update legacy sheet email logs"
  on public.legacy_sheet_email_log for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());
