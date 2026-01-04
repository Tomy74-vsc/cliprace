-- Moderation Rules lifecycle + versioning
-- - Adds draft/published status + version counter
-- - Stores snapshots in moderation_rule_versions
-- Idempotent.

begin;

alter table public.moderation_rules
  add column if not exists status text not null default 'published';

alter table public.moderation_rules
  drop constraint if exists moderation_rules_status_check;
alter table public.moderation_rules
  add constraint moderation_rules_status_check check (status in ('draft', 'published'));

alter table public.moderation_rules
  add column if not exists version integer not null default 1;

alter table public.moderation_rules
  add column if not exists published_at timestamptz;

alter table public.moderation_rules
  add column if not exists published_by uuid references public.profiles(id) on delete set null;

-- Safety: a draft rule cannot be active
alter table public.moderation_rules
  drop constraint if exists moderation_rules_draft_inactive;
alter table public.moderation_rules
  add constraint moderation_rules_draft_inactive check (not (status = 'draft' and is_active = true));

create table if not exists public.moderation_rule_versions (
  id bigserial primary key,
  rule_id uuid not null references public.moderation_rules(id) on delete cascade,
  version integer not null,
  snapshot jsonb not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (rule_id, version)
);

create index if not exists idx_moderation_rule_versions_rule_id on public.moderation_rule_versions(rule_id, version desc);

create or replace function public.moderation_rules_versioning()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    if new.version is null or new.version < 1 then
      new.version := 1;
    end if;

    insert into public.moderation_rule_versions(rule_id, version, snapshot, created_by)
    values (new.id, new.version, to_jsonb(new), auth.uid());

    return new;
  end if;

  if (tg_op = 'UPDATE') then
    if (new.name is distinct from old.name)
      or (new.description is distinct from old.description)
      or (new.rule_type is distinct from old.rule_type)
      or (new.config is distinct from old.config)
      or (new.is_active is distinct from old.is_active)
      or (new.status is distinct from old.status) then

      new.version := coalesce(old.version, 1) + 1;

      if old.status = 'draft' and new.status = 'published' and new.published_at is null then
        new.published_at := now();
        new.published_by := auth.uid();
      end if;

      insert into public.moderation_rule_versions(rule_id, version, snapshot, created_by)
      values (new.id, new.version, to_jsonb(new), auth.uid());
    end if;

    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_moderation_rules_versioning on public.moderation_rules;
create trigger trg_moderation_rules_versioning
before insert or update on public.moderation_rules
for each row
execute function public.moderation_rules_versioning();

-- RLS: versions are admin-only
alter table public.moderation_rule_versions enable row level security;

drop policy if exists "moderation_rule_versions_admin_all" on public.moderation_rule_versions;
create policy "moderation_rule_versions_admin_all" on public.moderation_rule_versions
  for all using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

commit;
