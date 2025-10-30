-- Audit logs table and RLS
create table if not exists public.audit_logs (
  id bigserial primary key,
  user_id uuid null references auth.users(id) on delete set null,
  action text not null,
  ip text null,
  timestamp timestamptz not null default now()
);

alter table public.audit_logs enable row level security;

-- Only service role can insert
create policy audit_logs_insert_service_role on public.audit_logs
  for insert to authenticated using (auth.role() = 'service_role') with check (true);

-- Allow service role to select (optional, for admin tooling); deny others by default
create policy audit_logs_select_service_role on public.audit_logs
  for select to authenticated using (auth.role() = 'service_role');

-- Seed example
insert into public.audit_logs (user_id, action, ip)
values (null, 'seed_audit_log', '127.0.0.1');


