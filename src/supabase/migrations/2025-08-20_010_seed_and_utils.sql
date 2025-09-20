-- Petit alias pour tester la connexion via /api/health
create or replace function "now"()
returns timestamptz language sql stable as $$ select now() $$;

-- SEED OPTIONNEL --
-- 1) Inscris-toi via l’UI, récupère ton user_id (Dashboard Supabase > Auth > Users)
-- 2) Rends-toi admin en décommentant et remplaçant l’UUID :
-- insert into admins(user_id) values ('00000000-0000-0000-0000-000000000000');
