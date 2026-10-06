create or replace function public.queue_applause_completion_approval_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  matched_profile public.profiles%rowtype;
begin
  if lower(trim(new.status)) <> 'claimed complete'
    or (
      tg_op = 'UPDATE'
      and lower(trim(old.status)) = 'claimed complete'
    ) then
    return new;
  end if;

  select profile.*
    into matched_profile
    from public.profiles as profile
    where profile.role = 'tester'
      and nullif(trim(profile.email), '') is not null
      and (
        nullif(lower(trim(profile.email)), '') in (
          nullif(lower(trim(new.tester_email)), ''),
          nullif(lower(trim(new.google_email)), '')
        )
        or nullif(lower(trim(profile.profile_data #>> '{testerProfile,uTestId}')), '') in (
          nullif(lower(trim(new.tester_id)), ''),
          nullif(lower(trim(new.utest_id)), '')
        )
      )
    order by case
      when nullif(lower(trim(profile.email)), '') = nullif(lower(trim(new.tester_email)), '') then 0
      when nullif(lower(trim(profile.email)), '') = nullif(lower(trim(new.google_email)), '') then 1
      else 2
    end, profile.id
    limit 1;

  if matched_profile.id is null then
    return new;
  end if;

  insert into public.project_applause_approval_email_outbox (
    project_id,
    profile_id,
    source_key,
    recipient_email,
    recipient_name,
    project_title,
    project_company,
    project_description,
    project_deadline
  )
  select
    new.project_id,
    matched_profile.id,
    new.source_key,
    matched_profile.email,
    coalesce(nullif(trim(matched_profile.name), ''), split_part(matched_profile.email, '@', 1)),
    project.title,
    project.company,
    project.short_description,
    coalesce(project.deadline::text, '')
  from public.projects as project
  where project.id = new.project_id
  on conflict (project_id, profile_id) do nothing;

  return new;
end;
$$;

notify pgrst, 'reload schema';
