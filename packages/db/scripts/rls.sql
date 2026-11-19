-- Idempotent security setup, applied after every migration.
do $$ begin
  create role rentevent_app nologin;
exception when duplicate_object then null; end $$;

do $$ begin
  execute format('grant rentevent_app to %I', current_user);
exception when others then null; end $$;

grant usage on schema public to rentevent_app;
grant select, insert, update, delete on all tables in schema public to rentevent_app;
grant usage, select on all sequences in schema public to rentevent_app;

-- System-only tables
revoke all on table jobs, verification, account, session, two_factor, invitation, outbox_emails, blobs from rentevent_app;
-- Users: only public profile columns
revoke all on table "user" from rentevent_app;
grant select (id, name, email, image) on table "user" to rentevent_app;

-- RLS on every table in public (also protects against Supabase's anon/authenticated API roles)
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' and tablename not like '__drizzle%' loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;

  for t in
    select c.table_name from information_schema.columns c
    join pg_tables p on p.tablename = c.table_name and p.schemaname = 'public'
    where c.table_schema = 'public' and c.column_name = 'tenant_id' and c.table_name <> 'jobs'
  loop
    execute format('drop policy if exists tenant_isolation on public.%I', t.table_name);
    execute format(
      'create policy tenant_isolation on public.%I to rentevent_app using (tenant_id = current_setting(''app.tenant_id'', true)) with check (tenant_id = current_setting(''app.tenant_id'', true))',
      t.table_name);
  end loop;
end $$;

drop policy if exists tenant_isolation on public.organization;
create policy tenant_isolation on public.organization to rentevent_app
  using (id = current_setting('app.tenant_id', true));
drop policy if exists tenant_isolation on public.member;
create policy tenant_isolation on public.member to rentevent_app
  using (organization_id = current_setting('app.tenant_id', true))
  with check (organization_id = current_setting('app.tenant_id', true));
drop policy if exists members_only on public."user";
create policy members_only on public."user" to rentevent_app
  using (exists (select 1 from public.member m where m.user_id = "user".id and m.organization_id = current_setting('app.tenant_id', true)));

-- Supabase API roles must never reach application tables
do $$ begin
  execute 'revoke all on all tables in schema public from anon, authenticated';
exception when undefined_object then null; end $$;
