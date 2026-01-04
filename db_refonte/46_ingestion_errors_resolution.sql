-- Ingestion errors resolution (admin workflow)
-- Adds resolved state + who/when.
-- Idempotent.

begin;

alter table public.ingestion_errors
  add column if not exists is_resolved boolean not null default false;

alter table public.ingestion_errors
  add column if not exists resolved_at timestamptz;

alter table public.ingestion_errors
  add column if not exists resolved_by uuid references public.profiles(id) on delete set null;

create index if not exists idx_ingestion_errors_is_resolved on public.ingestion_errors(is_resolved);
create index if not exists idx_ingestion_errors_created_resolved on public.ingestion_errors(created_at desc, is_resolved);

commit;

