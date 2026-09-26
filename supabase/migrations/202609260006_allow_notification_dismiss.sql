create policy "users dismiss their notifications" on public.notifications
  for delete to authenticated
  using (user_id = auth.uid());
