create or replace function public.invite_user_as_admin(p_email text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  matched_id uuid;
  auth_user_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Only admins can invite another admin';
  end if;

  if p_email is null or trim(p_email) = '' then
    raise exception 'Email is required';
  end if;

  select id into matched_id
  from public.profiles
  where lower(email) = lower(trim(p_email))
  limit 1;

  if matched_id is null then
    select id into auth_user_id
    from auth.users
    where lower(email) = lower(trim(p_email))
    limit 1;

    if auth_user_id is null then
      raise exception 'No user profile found for that email. Ask the user to sign up first.';
    end if;

    insert into public.profiles (id, email, name, avatar_url, role, profile_data)
    values (
      auth_user_id,
      lower(trim(p_email)),
      '',
      null,
      'admin',
      '{}'::jsonb
    )
    on conflict (id) do update
      set email = excluded.email,
          role = 'admin',
          updated_at = now();

    return auth_user_id;
  end if;

  update public.profiles
  set role = 'admin',
      updated_at = now()
  where id = matched_id;

  return matched_id;
end;
$$;
