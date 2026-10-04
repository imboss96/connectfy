create or replace function public.dismiss_admin(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  remaining_admin_count integer;
begin
  if not public.is_admin() then
    raise exception 'Only admins can remove admin access';
  end if;

  if p_user_id is null then
    raise exception 'A user ID is required';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'You cannot remove your own admin access';
  end if;

  perform profile.id
  from public.profiles as profile
  where profile.role = 'admin'
  order by profile.id
  for update;

  if not exists (
    select 1
    from public.profiles
    where id = p_user_id and role = 'admin'
  ) then
    raise exception 'The selected user is not an admin';
  end if;

  select count(*)
  into remaining_admin_count
  from public.profiles
  where role = 'admin' and id <> p_user_id;

  if remaining_admin_count = 0 then
    raise exception 'The last admin cannot be removed';
  end if;

  update public.profiles
  set role = 'tester',
      updated_at = now()
  where id = p_user_id;
end;
$$;

grant execute on function public.dismiss_admin(uuid) to authenticated;

notify pgrst, 'reload schema';
