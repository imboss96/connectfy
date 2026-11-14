create or replace function public.admin_preview_duplicate_email_accounts()
returns table (
  normalized_email text,
  account_id uuid,
  account_name text,
  account_email text,
  account_role public.user_role,
  account_created_at timestamptz,
  duplicate_count bigint,
  suggested_survivor_id uuid
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not coalesce(public.is_admin(), false) then
    raise exception using
      errcode = '42501',
      message = 'Only Super Admins can preview duplicate-email accounts';
  end if;

  return query
  with normalized_profiles as (
    select
      profile.id,
      profile.name,
      profile.email,
      profile.role,
      profile.created_at,
      lower(trim(profile.email)) as normalized_email
    from public.profiles as profile
    where nullif(trim(profile.email), '') is not null
  ),
  ranked_profiles as (
    select
      normalized_profiles.*,
      count(*) over (partition by normalized_profiles.normalized_email) as duplicate_count,
      first_value(normalized_profiles.id) over (
        partition by normalized_profiles.normalized_email
        order by normalized_profiles.created_at asc, normalized_profiles.id asc
      ) as suggested_survivor_id
    from normalized_profiles
  )
  select
    ranked_profiles.normalized_email,
    ranked_profiles.id,
    ranked_profiles.name,
    ranked_profiles.email,
    ranked_profiles.role,
    ranked_profiles.created_at,
    ranked_profiles.duplicate_count,
    ranked_profiles.suggested_survivor_id
  from ranked_profiles
  where ranked_profiles.duplicate_count > 1
  order by ranked_profiles.normalized_email, ranked_profiles.created_at, ranked_profiles.id;
end;
$$;

revoke all on function public.admin_preview_duplicate_email_accounts() from public, anon;
grant execute on function public.admin_preview_duplicate_email_accounts() to authenticated;

notify pgrst, 'reload schema';
