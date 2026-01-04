-- Admin Guide permission (RBAC extension)
-- Adds `guide.read` and grants it to default admin roles.

begin;

insert into public.admin_permissions (key, description)
values ('guide.read', 'Accéder au guide admin (formation / aide contextuelle)')
on conflict (key) do nothing;

-- Default grant: all roles can read the guide
insert into public.admin_role_permissions (role_id, permission_key)
select r.id, 'guide.read'
from public.admin_roles r
where r.key in ('super_admin', 'read_only', 'ops', 'support', 'marketing', 'finance')
on conflict do nothing;

commit;

