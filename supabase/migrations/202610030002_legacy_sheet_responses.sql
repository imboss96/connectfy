create table public.legacy_sheet_responses (
  source_key text primary key,
  source_timestamp text not null default '',
  consent text not null default '',
  full_name text not null default '',
  date_of_birth text not null default '',
  gender text not null default '',
  email text not null,
  terms_agreed text not null default '',
  utest_id text not null default '',
  matched_profile_id uuid references public.profiles(id) on delete set null,
  match_status text not null default 'unmatched'
    check (match_status in ('matched', 'unmatched', 'ambiguous')),
  synced_at timestamptz not null default now(),
  constraint legacy_sheet_response_match_consistent check (
    (match_status = 'matched' and matched_profile_id is not null)
    or (match_status in ('unmatched', 'ambiguous') and matched_profile_id is null)
  )
);

create index legacy_sheet_responses_email_idx
  on public.legacy_sheet_responses (lower(email));
create index legacy_sheet_responses_matched_profile_idx
  on public.legacy_sheet_responses (matched_profile_id);

alter table public.legacy_sheet_responses enable row level security;

grant select, insert, update on public.legacy_sheet_responses to authenticated;

create policy "admins view legacy sheet responses"
  on public.legacy_sheet_responses for select to authenticated
  using (public.is_admin());

create policy "admins sync legacy sheet responses"
  on public.legacy_sheet_responses for insert to authenticated
  with check (public.is_admin());

create policy "admins update legacy sheet responses"
  on public.legacy_sheet_responses for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());
