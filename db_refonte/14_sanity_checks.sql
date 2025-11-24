-- =====================================================
-- 14_sanity_checks.sql
-- =====================================================
-- Vérifications de santé de la base de données
-- À exécuter après la refonte complète
-- =====================================================

-- =====================================================
-- 1. Vérifier que RLS est activé sur toutes les tables
-- =====================================================
DO $$
DECLARE
  v_tables_without_rls TEXT;
BEGIN
  SELECT string_agg(relname, ', ')
  INTO v_tables_without_rls
  FROM pg_class
  WHERE relkind = 'r'
    AND relnamespace = 'public'::regnamespace
    AND relrowsecurity = false
    AND relname NOT LIKE 'pg_%'
    AND relname NOT LIKE '_realtime%'
    AND relname != 'schema_migrations';
  
  IF v_tables_without_rls IS NOT NULL THEN
    RAISE WARNING '⚠️ Tables sans RLS activé: %', v_tables_without_rls;
  ELSE
    RAISE NOTICE '✅ RLS activé sur toutes les tables';
  END IF;
END $$;

-- =====================================================
-- 2. Vérifier les contraintes de clés étrangères
-- =====================================================
DO $$
DECLARE
  v_orphan_count INTEGER;
BEGIN
  -- Vérifier profiles -> auth.users
  SELECT COUNT(*) INTO v_orphan_count
  FROM public.profiles p
  WHERE NOT EXISTS (
    SELECT 1 FROM auth.users u WHERE u.id = p.id
  );
  
  IF v_orphan_count > 0 THEN
    RAISE WARNING '⚠️ Profiles orphelins (sans auth.users): %', v_orphan_count;
  ELSE
    RAISE NOTICE '✅ Tous les profiles ont un auth.users correspondant';
  END IF;
  
  -- Vérifier contests -> profiles
  SELECT COUNT(*) INTO v_orphan_count
  FROM public.contests c
  WHERE NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = c.brand_id
  );
  
  IF v_orphan_count > 0 THEN
    RAISE WARNING '⚠️ Contests avec brand_id invalide: %', v_orphan_count;
  ELSE
    RAISE NOTICE '✅ Tous les contests ont un brand_id valide';
  END IF;
  
  -- Vérifier submissions -> contests + profiles
  SELECT COUNT(*) INTO v_orphan_count
  FROM public.submissions s
  WHERE NOT EXISTS (
    SELECT 1 FROM public.contests c WHERE c.id = s.contest_id
  ) OR NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = s.creator_id
  );
  
  IF v_orphan_count > 0 THEN
    RAISE WARNING '⚠️ Submissions avec FK invalides: %', v_orphan_count;
  ELSE
    RAISE NOTICE '✅ Toutes les submissions ont des FK valides';
  END IF;
END $$;

-- =====================================================
-- 3. Vérifier les fonctions core
-- =====================================================
DO $$
BEGIN
  -- Test now_utc()
  IF public.now_utc() IS NULL THEN
    RAISE WARNING '⚠️ Fonction now_utc() retourne NULL';
  ELSE
    RAISE NOTICE '✅ Fonction now_utc() fonctionne';
  END IF;
  
  -- Test is_admin() (avec NULL pour éviter l'erreur si pas de user)
  BEGIN
    PERFORM public.is_admin(NULL::uuid);
    RAISE NOTICE '✅ Fonction is_admin() existe';
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING '⚠️ Fonction is_admin() a une erreur: %', SQLERRM;
  END;
END $$;

-- =====================================================
-- 4. Vérifier les triggers
-- =====================================================
DO $$
DECLARE
  v_trigger_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_trigger_count
  FROM pg_trigger t
  INNER JOIN pg_class c ON c.oid = t.tgrelid
  WHERE c.relnamespace = 'public'::regnamespace
    AND t.tgname LIKE 'update_%_updated_at';
  
  IF v_trigger_count = 0 THEN
    RAISE WARNING '⚠️ Aucun trigger update_updated_at trouvé';
  ELSE
    RAISE NOTICE '✅ % trigger(s) update_updated_at trouvé(s)', v_trigger_count;
  END IF;
END $$;

-- =====================================================
-- 5. Vérifier les index critiques
-- =====================================================
DO $$
DECLARE
  v_missing_indexes TEXT;
BEGIN
  WITH required_indexes AS (
    SELECT tablename, indexname
    FROM (
      VALUES
        ('profiles', 'idx_profiles_role'),
        ('profiles', 'idx_profiles_is_active'),
        ('contests', 'idx_contests_brand_id'),
        ('contests', 'idx_contests_status'),
        ('submissions', 'idx_submissions_contest_id'),
        ('submissions', 'idx_submissions_creator_id'),
        ('submissions', 'idx_submissions_status'),
        ('metrics_daily', 'idx_metrics_daily_submission_id'),
        ('metrics_daily', 'idx_metrics_daily_date'),
        ('payments_brand', 'idx_payments_brand_brand_id'),
        ('cashouts', 'idx_cashouts_creator_id')
    ) AS req(tablename, indexname)
  )
  SELECT string_agg(format('%s.%s', tablename, indexname), ', ')
  INTO v_missing_indexes
  FROM required_indexes ri
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = ri.tablename
      AND indexname = ri.indexname
  );
  
  IF v_missing_indexes IS NOT NULL THEN
    RAISE WARNING '⚠️ Index manquants: %', v_missing_indexes;
  ELSE
    RAISE NOTICE '✅ Tous les index critiques sont présents';
  END IF;
END $$;

-- =====================================================
-- 6. Vérifier les politiques RLS
-- =====================================================
DO $$
DECLARE
  v_policy_count INTEGER;
  v_min_policies INTEGER := 30; -- Minimum attendu de politiques RLS
BEGIN
  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE schemaname = 'public';
  
  IF v_policy_count < v_min_policies THEN
    RAISE WARNING '⚠️ Seulement % politiques RLS trouvées (minimum attendu: %)', v_policy_count, v_min_policies;
  ELSE
    RAISE NOTICE '✅ % politiques RLS trouvées', v_policy_count;
  END IF;
END $$;

-- =====================================================
-- 7. Vérifier les types énumérés
-- =====================================================
DO $$
DECLARE
  v_missing_types TEXT;
BEGIN
  WITH required_types AS (
    SELECT unnest(ARRAY[
      'user_role', 'contest_status', 'submission_status',
      'payment_status', 'cashout_status', 'platform'
    ]) AS type_name
  )
  SELECT string_agg(type_name, ', ')
  INTO v_missing_types
  FROM required_types rt
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_type
    WHERE typname = rt.type_name
  );
  
  IF v_missing_types IS NOT NULL THEN
    RAISE WARNING '⚠️ Types énumérés manquants: %', v_missing_types;
  ELSE
    RAISE NOTICE '✅ Tous les types énumérés sont présents';
  END IF;
END $$;

-- =====================================================
-- 8. Vérifier les nouvelles tables (15-24)
-- =====================================================
DO $$
DECLARE
  v_missing_tables TEXT;
BEGIN
  WITH required_tables AS (
    SELECT unnest(ARRAY[
      'orgs', 'org_members',
      'platform_accounts', 'platform_oauth_tokens', 'ingestion_jobs', 'ingestion_errors',
      'notification_preferences', 'push_tokens',
      'invoices', 'tax_evidence',
      'kyc_checks', 'risk_flags',
      'assets',
      'moderation_actions',
      'webhook_endpoints', 'webhook_deliveries',
      'event_log'
    ]) AS table_name
  )
  SELECT string_agg(table_name, ', ')
  INTO v_missing_tables
  FROM required_tables rt
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename = rt.table_name
  );
  
  IF v_missing_tables IS NOT NULL THEN
    RAISE WARNING '⚠️ Tables manquantes (15-24): %', v_missing_tables;
  ELSE
    RAISE NOTICE '✅ Toutes les nouvelles tables (15-24) sont présentes';
  END IF;
END $$;

-- =====================================================
-- 9. Vérifier les politiques RLS pour les nouvelles tables
-- =====================================================
DO $$
DECLARE
  v_tables_without_policies TEXT;
BEGIN
  WITH new_tables AS (
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename IN (
        'orgs', 'org_members',
        'platform_accounts', 'platform_oauth_tokens',
        'notification_preferences', 'push_tokens',
        'invoices', 'tax_evidence',
        'kyc_checks', 'risk_flags',
        'assets',
        'moderation_actions',
        'webhook_endpoints', 'webhook_deliveries',
        'event_log'
      )
  )
  SELECT string_agg(nt.tablename, ', ')
  INTO v_tables_without_policies
  FROM new_tables nt
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = nt.tablename
  );
  
  IF v_tables_without_policies IS NOT NULL THEN
    RAISE WARNING '⚠️ Nouvelles tables sans politiques RLS: %', v_tables_without_policies;
  ELSE
    RAISE NOTICE '✅ Toutes les nouvelles tables ont des politiques RLS';
  END IF;
END $$;

-- =====================================================
-- 10. Vérifier que platform_oauth_tokens refuse les écritures sans service_role
-- =====================================================
DO $$
BEGIN
  -- Vérifier qu'il n'y a pas de politique INSERT publique
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'platform_oauth_tokens'
      AND cmd = 'INSERT'
      AND qual != ''
  ) THEN
    RAISE WARNING '⚠️ platform_oauth_tokens a une politique INSERT publique (devrait être service_role uniquement)';
  ELSE
    RAISE NOTICE '✅ platform_oauth_tokens n''a pas de politique INSERT publique (correct)';
  END IF;
END $$;

-- =====================================================
-- 11. Vérifier que assets en visibility='public' sont accessibles sans auth
-- =====================================================
DO $$
BEGIN
  -- Vérifier qu'il existe une politique publique pour assets visibility='public'
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'assets'
      AND policyname = 'assets_public_read_public'
  ) THEN
    RAISE NOTICE '✅ Politique publique pour assets visibility=''public'' présente';
  ELSE
    RAISE WARNING '⚠️ Politique publique pour assets visibility=''public'' manquante';
  END IF;
END $$;

-- =====================================================
-- 12. Vérifier les nouvelles tables (25-35)
-- =====================================================
DO $$
DECLARE
  v_missing_tables TEXT;
BEGIN
  WITH required_tables AS (
    SELECT unnest(ARRAY[
      'contest_prizes', 'contest_winnings',
      'contest_terms_acceptances',
      'follows', 'contest_favorites',
      'contest_tags', 'contest_tag_links',
      'status_history',
      'submission_comments',
      'notification_templates'
    ]) AS table_name
  )
  SELECT string_agg(table_name, ', ')
  INTO v_missing_tables
  FROM required_tables rt
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename = rt.table_name
  );
  
  IF v_missing_tables IS NOT NULL THEN
    RAISE WARNING '⚠️ Tables manquantes (25-35): %', v_missing_tables;
  ELSE
    RAISE NOTICE '✅ Toutes les nouvelles tables (25-35) sont présentes';
  END IF;
END $$;

-- =====================================================
-- 13. Vérifier les fonctions d'automatisation
-- =====================================================
DO $$
DECLARE
  v_missing_functions TEXT;
BEGIN
  WITH required_functions AS (
    SELECT unnest(ARRAY[
      'finalize_contest',
      'archive_ended_contests',
      'compute_daily_metrics',
      'refresh_analytics_views',
      'cleanup_old_data',
      'calculate_weighted_views',
      'can_creator_submit'
    ]) AS function_name
  )
  SELECT string_agg(function_name, ', ')
  INTO v_missing_functions
  FROM required_functions rf
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = rf.function_name
    AND pronamespace = 'public'::regnamespace
  );
  
  IF v_missing_functions IS NOT NULL THEN
    RAISE WARNING '⚠️ Fonctions manquantes: %', v_missing_functions;
  ELSE
    RAISE NOTICE '✅ Toutes les fonctions d''automatisation sont présentes';
  END IF;
END $$;

-- =====================================================
-- 14. Vérifier les vues matérialisées
-- =====================================================
DO $$
DECLARE
  v_missing_views TEXT;
BEGIN
  WITH required_views AS (
    SELECT unnest(ARRAY[
      'leaderboard_materialized',
      'brand_dashboard_summary',
      'creator_dashboard_summary',
      'platform_stats_summary'
    ]) AS view_name
  )
  SELECT string_agg(view_name, ', ')
  INTO v_missing_views
  FROM required_views rv
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_matviews
    WHERE schemaname = 'public'
      AND matviewname = rv.view_name
  );
  
  IF v_missing_views IS NOT NULL THEN
    RAISE WARNING '⚠️ Vues matérialisées manquantes: %', v_missing_views;
  ELSE
    RAISE NOTICE '✅ Toutes les vues matérialisées sont présentes';
  END IF;
END $$;

-- =====================================================
-- 15. Résumé final
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Vérifications de santé terminées';
  RAISE NOTICE 'Consultez les messages ci-dessus pour les détails';
  RAISE NOTICE '========================================';
END $$;
