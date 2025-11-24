-- =====================================================
-- RUN_ALL_LOCALLY.sql
-- =====================================================
-- Script maître pour exécuter tous les fichiers de refonte
-- Idempotent : exécutable plusieurs fois
-- 
-- USAGE :
-- 1. Local (psql) : \i RUN_ALL_LOCALLY.sql
-- 2. Supabase SQL Editor : copier/coller chaque bloc
-- =====================================================

-- Avertissement
\echo '========================================'
\echo 'DÉBUT DE LA REFONTE DATABASE CLIPRACE'
\echo '========================================'
\echo ''
\echo 'ATTENTION :'
\echo '- Ce script est idempotent (peut être exécuté plusieurs fois)'
\echo '- Certains fichiers nécessitent le service_role pour INSERT (metrics_daily, webhooks_stripe)'
\echo '- Vérifiez les erreurs à chaque étape'
\echo ''
\echo 'Ordre d''exécution :'
\echo '00 → 01 → 02 → ... → 35 → 36 → 37 (37 fichiers)'
\echo ''
\echo '========================================'
\echo ''

-- =====================================================
-- ÉTAPE 0 : Extensions et enums
-- =====================================================
\echo '📦 Étape 0/12 : Extensions et enums...'
\i db_refonte/00_extensions_enums.sql

-- =====================================================
-- ÉTAPE 1 : Fonctions core
-- =====================================================
\echo '👤 Étape 1/12 : Tables profils...'
\i db_refonte/02_profiles.sql

-- =====================================================
-- ÉTAPE 2 : Profils
-- =====================================================
\echo '🔧 Étape 2/12 : Fonctions core...'
\i db_refonte/01_functions_core.sql

-- =====================================================
-- ÉTAPE 3 : Concours
-- =====================================================
\echo '🏁 Étape 3/12 : Tables concours...'
\i db_refonte/03_contests.sql

-- =====================================================
-- ÉTAPE 4 : Soumissions et métriques
-- =====================================================
\echo '🎬 Étape 4/12 : Tables soumissions et métriques...'
\i db_refonte/04_submissions_metrics.sql

-- =====================================================
-- ÉTAPE 5 : Paiements et cashouts
-- =====================================================
\echo '💳 Étape 5/12 : Tables paiements et cashouts...'
\i db_refonte/05_payments_cashouts.sql

-- =====================================================
-- ÉTAPE 6 : Modération et audit
-- =====================================================
\echo '🔍 Étape 6/12 : Tables modération et audit...'
\i db_refonte/06_moderation_audit.sql

-- =====================================================
-- ÉTAPE 7 : Messagerie et notifications
-- =====================================================
\echo '💬 Étape 7/12 : Tables messagerie et notifications...'
\i db_refonte/07_messaging_notifications.sql

-- =====================================================
-- ÉTAPE 8 : Vues et vues matérialisées
-- =====================================================
\echo '📊 Étape 8/12 : Vues et vues matérialisées...'
\i db_refonte/08_views_materialized.sql

-- =====================================================
-- ÉTAPE 9 : Fonctions métier
-- =====================================================
\echo '⚙️ Étape 9/12 : Fonctions métier...'
\i db_refonte/09_functions_business.sql

-- =====================================================
-- ÉTAPE 10 : Triggers
-- =====================================================
\echo '🎯 Étape 10/12 : Triggers... (déplacé en fin)'
-- \i db_refonte/10_triggers.sql

-- =====================================================
-- ÉTAPE 11 : Politiques RLS
-- =====================================================
\echo '🔒 Étape 11/12 : Politiques RLS... (déplacé en fin)'
-- \i db_refonte/11_rls_policies.sql

-- =====================================================
-- ÉTAPE 12 : Politiques Storage
-- =====================================================
\echo '📁 Étape 12/35 : Politiques Storage...'
\i db_refonte/12_storage_policies.sql

-- =====================================================
-- ÉTAPE 13 : Seed minimal (optionnel, commenté)
-- =====================================================
-- \echo '🌱 Étape 13/24 : Seed minimal (optionnel)...'
-- \i db_refonte/13_seed_minimal.sql

-- =====================================================
-- ÉTAPE 14 : Vérifications de santé
-- =====================================================
\echo '🔍 Étape 14/35 : Vérifications de santé... (exécuté en fin uniquement)'
-- \i db_refonte/14_sanity_checks.sql

-- =====================================================
-- ÉTAPE 15 : Organisations
-- =====================================================
\echo '🏢 Étape 15/24 : Organisations multi-membres...'
\i db_refonte/15_orgs.sql

-- =====================================================
-- ÉTAPE 16 : Connexions plateformes & OAuth
-- =====================================================
\echo '🔗 Étape 16/24 : Connexions plateformes & OAuth...'
\i db_refonte/16_platform_links.sql

-- =====================================================
-- ÉTAPE 17 : Centre de notifications
-- =====================================================
\echo '🔔 Étape 17/24 : Centre de notifications...'
\i db_refonte/17_notification_center.sql

-- =====================================================
-- ÉTAPE 18 : Facturation
-- =====================================================
\echo '💼 Étape 18/24 : Facturation...'
\i db_refonte/18_invoices_billing.sql

-- =====================================================
-- ÉTAPE 19 : KYC & Risque
-- =====================================================
\echo '🛡️ Étape 19/24 : KYC & Risque...'
\i db_refonte/19_kyc_risk.sql

-- =====================================================
-- ÉTAPE 20 : Métadonnées fichiers
-- =====================================================
\echo '📦 Étape 20/24 : Métadonnées fichiers...'
\i db_refonte/20_assets.sql

-- =====================================================
-- ÉTAPE 21 : Historique modération
-- =====================================================
\echo '📋 Étape 21/24 : Historique modération...'
\i db_refonte/21_moderation_history.sql

-- =====================================================
-- ÉTAPE 22 : Messagerie (complément)
-- =====================================================
\echo '💬 Étape 22/24 : Messagerie (complément)...'
\i db_refonte/22_messaging.sql

-- =====================================================
-- ÉTAPE 23 : Webhooks sortants
-- =====================================================
\echo '🌐 Étape 23/24 : Webhooks sortants...'
\i db_refonte/23_webhooks_outbound.sql

-- =====================================================
-- ÉTAPE 24 : Journal événements
-- =====================================================
\echo '📊 Étape 24/35 : Journal événements...'
\i db_refonte/24_event_log.sql

-- =====================================================
-- ÉTAPE 25 : Prix fixes et gains persistés
-- =====================================================
\echo '💰 Étape 25/35 : Prix fixes et gains persistés...'
\i db_refonte/25_contest_prizes_winnings.sql

-- =====================================================
-- ÉTAPE 26 : Traçabilité CGU
-- =====================================================
\echo '📋 Étape 26/35 : Traçabilité CGU...'
\i db_refonte/26_contest_terms_acceptances.sql

-- =====================================================
-- ÉTAPE 27 : Système social (Follow/Favoris)
-- =====================================================
\echo '👥 Étape 27/35 : Système social (Follow/Favoris)...'
\i db_refonte/27_follows_favorites.sql

-- =====================================================
-- ÉTAPE 28 : Tags/Catégories
-- =====================================================
\echo '🏷️ Étape 28/35 : Tags/Catégories...'
\i db_refonte/28_tags_categories.sql

-- =====================================================
-- ÉTAPE 29 : Historique statuts
-- =====================================================
\echo '📜 Étape 29/35 : Historique statuts...'
\i db_refonte/29_status_history.sql

-- =====================================================
-- ÉTAPE 30 : Commentaires soumissions
-- =====================================================
\echo '💬 Étape 30/35 : Commentaires soumissions...'
\i db_refonte/30_submission_comments.sql

-- =====================================================
-- ÉTAPE 31 : Templates notifications
-- =====================================================
\echo '📧 Étape 31/35 : Templates notifications...'
\i db_refonte/31_notification_templates.sql

-- =====================================================
-- ÉTAPE 32 : Fonctions automatisation
-- =====================================================
\echo '⚙️ Étape 32/35 : Fonctions automatisation...'
\i db_refonte/32_automation_functions.sql

-- =====================================================
-- ÉTAPE 33 : Vues matérialisées analytics
-- =====================================================
\echo '📊 Étape 33/35 : Vues matérialisées analytics...'
\i db_refonte/33_analytics_materialized.sql

-- =====================================================
-- ÉTAPE 34 : Limitations et améliorations
-- =====================================================
\echo '🔒 Étape 34/35 : Limitations et améliorations...'
\i db_refonte/34_submission_limits.sql

-- =====================================================
-- ÉTAPE 35 : Calcul score pondéré
-- =====================================================
\echo '📈 Étape 35/35 : Calcul score pondéré...'
\i db_refonte/35_weighted_views_calculation.sql

-- =====================================================
-- ÉTAPE 36 : Pièces jointes messages
-- =====================================================
\echo '📎 Étape 36/37 : Pièces jointes messages...'
\i db_refonte/36_messages_attachments.sql

-- =====================================================
-- ÉTAPE 37 : Fonction création concours complet
-- =====================================================
\echo '🏗️ Étape 37/37 : Fonction création concours complet...'
\i db_refonte/37_create_contest_complete.sql

-- =====================================================
-- ÉTAPE 38 : Politiques RLS (déféré)
-- =====================================================
\echo '🔒 Étape 38/38 : Politiques RLS (déféré)...'
\i db_refonte/11_rls_policies.sql

-- =====================================================
-- ÉTAPE 39 : Triggers (déféré)
-- =====================================================
\echo '🎯 Étape 39/39 : Triggers (déféré)...'
\i db_refonte/10_triggers.sql

-- =====================================================
-- VÉRIFICATIONS FINALES
-- =====================================================
\echo ''
\echo '========================================'
\echo 'VÉRIFICATIONS FINALES...'
\echo '========================================'
\i db_refonte/14_sanity_checks.sql

-- =====================================================
-- FIN
-- =====================================================
\echo ''
\echo '========================================'
\echo '✅ REFONTE COMPLÈTE TERMINÉE (37 fichiers)'
\echo '========================================'
\echo ''
\echo 'Prochaines étapes :'
\echo '1. Vérifiez les résultats des sanity_checks'
\echo '2. (Optionnel) Exécutez 13_seed_minimal.sql en développement'
\echo '3. Testez les politiques RLS avec différents rôles'
\echo '4. Vérifiez que les buckets Storage sont créés'
\echo '5. Configurez les webhooks sortants et OAuth'
\echo '6. Configurez les cron jobs pour automatisations (finalize_contest, archive_ended_contests, etc.)'
\echo '7. Configurez les Edge Functions pour compute_daily_metrics'
\echo ''

-- Note : Pour Supabase SQL Editor, exécutez chaque \i séparément
-- ou copiez/collez le contenu de chaque fichier dans l'ordre
