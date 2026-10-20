update public.ambassador_referrals as referral
set referred_tester_name = coalesce(nullif(trim(profile.name), ''), '')
from public.profiles as profile
where profile.id = referral.referred_tester_id
  and referral.referred_tester_name is distinct from coalesce(nullif(trim(profile.name), ''), '');

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referrer_id uuid;
  v_referral_code text;
  v_referred_tester_name text;
begin
  insert into public.profiles (id, email, name, avatar_url)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update
  set email = excluded.email,
      updated_at = now();

  v_referred_tester_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    (select nullif(trim(profile.name), '') from public.profiles as profile where profile.id = new.id),
    ''
  );
  v_referral_code := upper(trim(coalesce(new.raw_user_meta_data->>'referral_code', '')));

  if v_referral_code <> '' then
    select profile.id
      into v_referrer_id
      from public.profiles as profile
      where profile.referral_code = v_referral_code
        and profile.role = 'tester'
        and profile.id <> new.id;

    if v_referrer_id is not null then
      insert into public.ambassador_referrals (
        ambassador_id,
        referred_tester_id,
        referred_tester_name,
        referral_code
      )
      values (v_referrer_id, new.id, v_referred_tester_name, v_referral_code)
      on conflict (referred_tester_id) do nothing;
    end if;
  end if;

  return new;
end;
$$;

notify pgrst, 'reload schema';
