-- Admin Inbox permission (RBAC extension)
-- Adds `inbox.read` and grants it to default admin roles.

begin;

insert into public.admin_permissions (key, description)
values ('inbox.read', 'Voir inbox admin (à traiter)')
on conflict (key) do nothing;

-- Default grant: most roles can see inbox (read-only)
insert into public.admin_role_permissions (role_id, permission_key)
select r.id, 'inbox.read'
from public.admin_roles r
where r.key in ('super_admin', 'read_only', 'ops', 'support', 'marketing', 'finance')
on conflict do nothing;

commit;
