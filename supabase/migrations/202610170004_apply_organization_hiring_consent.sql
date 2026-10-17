alter table public.application_utest_details
  add column if not exists screener_consent_source text;

create or replace function public.apply_organization_hiring_screener_consent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.applications application
    where application.id = new.application_id
      and application.tester_id = new.tester_id
      and application.status = 'pending'
  ) then
    new.screener_consent := true;
    new.screener_consent_at := coalesce(new.screener_consent_at, now());
    new.screener_consent_source := 'organization_hiring_agreement';
  end if;
  return new;
end;
$$;

comment on function public.apply_organization_hiring_screener_consent() is
  'Records the organization hiring agreement for pending applicants; install only where that agreement explicitly covers sending saved screener details to Applause via Google Forms.';

revoke all on function public.apply_organization_hiring_screener_consent() from public, anon, authenticated;

drop trigger if exists apply_organization_hiring_screener_consent_before_write
  on public.application_utest_details;
create trigger apply_organization_hiring_screener_consent_before_write
  before insert or update on public.application_utest_details
  for each row execute function public.apply_organization_hiring_screener_consent();

update public.application_utest_details details
set screener_consent = true,
    screener_consent_at = coalesce(details.screener_consent_at, now()),
    screener_consent_source = 'organization_hiring_agreement',
    updated_at = now()
from public.applications application
where application.id = details.application_id
  and application.tester_id = details.tester_id
  and application.status = 'pending'
  and (
    details.screener_consent is distinct from true
    or details.screener_consent_at is null
    or details.screener_consent_source is distinct from 'organization_hiring_agreement'
  );
