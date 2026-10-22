create or replace function public.link_google_signup_referral(p_referral_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_profile public.profiles%rowtype;
  referrer public.profiles%rowtype;
begin
  if current_user_id is null then
    raise exception 'Sign in before linking a referral';
  end if;

  select * into current_profile
  from public.profiles
  where id = current_user_id;

  if not found
     or current_profile.role <> 'tester'
     or current_profile.created_at < now() - interval '1 hour' then
    return false;
  end if;

  select * into referrer
  from public.profiles
  where referral_code = upper(trim(coalesce(p_referral_code, '')))
    and role = 'tester'
    and id <> current_user_id;

  if not found then
    return false;
  end if;

  insert into public.ambassador_referrals (
    ambassador_id,
    referred_tester_id,
    referred_tester_name,
    referral_code
  )
  values (
    referrer.id,
    current_user_id,
    coalesce(nullif(trim(current_profile.name), ''), ''),
    referrer.referral_code
  )
  on conflict (referred_tester_id) do nothing;

  return found;
end;
$$;

revoke all on function public.link_google_signup_referral(text) from public, anon;
grant execute on function public.link_google_signup_referral(text) to authenticated;
