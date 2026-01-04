-- Admin Ops Data permissions (RBAC extension)
-- Adds permissions for tasks/notes/playbooks/campaigns + UI prefs read/write.

begin;

insert into public.admin_permissions (key, description)
values
  ('tasks.read', 'Voir la file admin_tasks'),
  ('tasks.write', 'Gérer admin_tasks (assigner, changer statut, commenter)'),
  ('notes.read', 'Voir les notes internes admin_notes'),
  ('notes.write', 'Créer/éditer des notes internes admin_notes'),
  ('playbooks.read', 'Voir les playbooks admin_playbooks'),
  ('playbooks.write', 'Créer/éditer les playbooks admin_playbooks'),
  ('ui_prefs.read', 'Lire les préférences UI admin'),
  ('ui_prefs.write', 'Modifier les préférences UI admin'),
  ('campaigns.read', 'Voir les campagnes marketing'),
  ('campaigns.write', 'Créer/éditer les campagnes marketing')
on conflict (key) do nothing;

-- super_admin: all
insert into public.admin_role_permissions (role_id, permission_key)
select r.id, p.key
from public.admin_roles r
join public.admin_permissions p on p.key in (
  'tasks.read','tasks.write',
  'notes.read','notes.write',
  'playbooks.read','playbooks.write',
  'ui_prefs.read','ui_prefs.write',
  'campaigns.read','campaigns.write'
)
where r.key = 'super_admin'
on conflict do nothing;

-- ops: tasks + notes + playbooks
insert into public.admin_role_permissions (role_id, permission_key)
select r.id, p.key
from public.admin_roles r
join public.admin_permissions p on p.key in (
  'tasks.read','tasks.write',
  'notes.read','notes.write',
  'playbooks.read',
  'ui_prefs.read','ui_prefs.write'
)
where r.key = 'ops'
on conflict do nothing;

-- finance: tasks + notes + playbooks read
insert into public.admin_role_permissions (role_id, permission_key)
select r.id, p.key
from public.admin_roles r
join public.admin_permissions p on p.key in (
  'tasks.read','tasks.write',
  'notes.read','notes.write',
  'playbooks.read',
  'ui_prefs.read','ui_prefs.write'
)
where r.key = 'finance'
on conflict do nothing;

-- marketing: tasks + notes + campaigns
insert into public.admin_role_permissions (role_id, permission_key)
select r.id, p.key
from public.admin_roles r
join public.admin_permissions p on p.key in (
  'tasks.read','tasks.write',
  'notes.read','notes.write',
  'campaigns.read','campaigns.write',
  'playbooks.read',
  'ui_prefs.read','ui_prefs.write'
)
where r.key = 'marketing'
on conflict do nothing;

-- support: tasks + notes + playbooks read
insert into public.admin_role_permissions (role_id, permission_key)
select r.id, p.key
from public.admin_roles r
join public.admin_permissions p on p.key in (
  'tasks.read','tasks.write',
  'notes.read','notes.write',
  'playbooks.read',
  'ui_prefs.read','ui_prefs.write'
)
where r.key = 'support'
on conflict do nothing;

-- read_only: read perms only
insert into public.admin_role_permissions (role_id, permission_key)
select r.id, p.key
from public.admin_roles r
join public.admin_permissions p on p.key in (
  'tasks.read',
  'notes.read',
  'playbooks.read',
  'ui_prefs.read',
  'campaigns.read'
)
where r.key = 'read_only'
on conflict do nothing;

commit;

