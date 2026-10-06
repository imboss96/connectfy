-- Authenticated users may edit profile details, but role changes must go
-- through the admin-only security-definer functions.
revoke update on public.profiles from public, anon, authenticated;

grant update (
  name,
  email,
  avatar_url,
  country,
  city,
  company,
  profile_data,
  updated_at
) on public.profiles to authenticated;

notify pgrst, 'reload schema';
