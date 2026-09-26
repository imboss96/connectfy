alter table public.application_utest_details
  add column if not exists utest_account_screenshot_url text not null default '';
