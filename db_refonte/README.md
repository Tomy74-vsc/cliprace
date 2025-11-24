# 🧩 Refonte Base de Données ClipRace

Refonte complète de la base de données ClipRace pour Supabase/PostgreSQL 15+.

## 📁 Structure des Fichiers

Les fichiers sont numérotés et doivent être exécutés dans l'ordre :

```
db_refonte/
├── 00_extensions_enums.sql      # Extensions PostgreSQL et types énumérés
├── 01_functions_core.sql         # Fonctions utilitaires core (now_utc, is_admin, etc.)
├── 02_profiles.sql               # Tables profiles, profile_brands, profile_creators
├── 03_contests.sql               # Tables contests, contest_terms, contest_assets
├── 04_submissions_metrics.sql   # Tables submissions et metrics_daily
├── 05_payments_cashouts.sql      # Tables payments_brand, cashouts, webhooks_stripe
├── 06_moderation_audit.sql      # Tables moderation_queue, moderation_rules, audit_logs
├── 07_messaging_notifications.sql # Tables messages_threads, messages, notifications
├── 08_views_materialized.sql    # Vues leaderboard, contest_stats (et matérialisée)
├── 09_functions_business.sql    # Fonctions métier (compute_payouts, etc.)
├── 10_triggers.sql              # Triggers (update_updated_at, audit_logs_insert, etc.)
├── 11_rls_policies.sql          # Politiques RLS pour toutes les tables
├── 12_storage_policies.sql      # Politiques Storage pour les buckets
├── 13_seed_minimal.sql          # Seed minimal (optionnel, commenté)
├── 14_sanity_checks.sql         # Vérifications de santé
├── 15_orgs.sql                  # Organisations multi-membres
├── 16_platform_links.sql        # Connexions plateformes & OAuth
├── 17_notification_center.sql  # Préférences & push tokens
├── 18_invoices_billing.sql      # Facturation
├── 19_kyc_risk.sql              # KYC & vérifications risque
├── 20_assets.sql                # Métadonnées fichiers
├── 21_moderation_history.sql    # Historique modération
├── 22_messaging.sql             # Messagerie (complément)
├── 23_webhooks_outbound.sql     # Webhooks sortants
├── 24_event_log.sql             # Journal événements
├── 25_contest_prizes_winnings.sql # Prix fixes et gains persistés
├── 26_contest_terms_acceptances.sql # Traçabilité CGU
├── 27_follows_favorites.sql     # Système social (Follow/Favoris)
├── 28_tags_categories.sql      # Tags/Catégories
├── 29_status_history.sql       # Historique statuts
├── 30_submission_comments.sql  # Commentaires soumissions
├── 31_notification_templates.sql # Templates notifications
├── 32_automation_functions.sql # Fonctions automatisation (cron)
├── 33_analytics_materialized.sql # Vues matérialisées analytics
├── 34_submission_limits.sql    # Limitations et améliorations
├── 35_weighted_views_calculation.sql # Calcul score pondéré
├── RUN_ALL_LOCALLY.sql          # Script maître (local avec psql)
└── README.md                     # Ce fichier
```

## 🚀 Exécution sur Supabase

### Méthode 1 : Supabase SQL Editor (recommandé)

1. **Ouvrir le SQL Editor** dans le dashboard Supabase
2. **Exécuter les fichiers dans l'ordre** (00 → 35) :
   - Copier/coller le contenu de chaque fichier
   - Exécuter un par un
   - Vérifier qu'il n'y a pas d'erreurs avant de passer au suivant

### Méthode 2 : Local avec psql

```bash
# Se connecter à Supabase
psql "postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres"

# Exécuter le script maître
\i db_refonte/RUN_ALL_LOCALLY.sql
```

### Méthode 3 : Supabase CLI (migrations)

```bash
# Copier les fichiers dans supabase/migrations/
cp db_refonte/*.sql supabase/migrations/

# Appliquer les migrations
supabase db push
```

## 🔒 Rôles et Permissions

### Service Role

Certaines opérations nécessitent le **service_role** (secret JWT) :

- **`metrics_daily`** : INSERT/UPDATE réservés au service_role (Edge Functions, cron jobs)
- **`webhooks_stripe`** : INSERT réservé au service_role (webhooks Stripe)
- **`platform_oauth_tokens`** : INSERT/UPDATE réservés au service_role (OAuth refresh)
- **`ingestion_jobs`** : INSERT/UPDATE réservés au service_role (cron jobs)
- **`webhook_deliveries`** : INSERT réservé au service_role (délivrance webhooks)
- **`event_log`** : INSERT réservé au service_role (tracking événements)

### Authentifié (auth.uid())

Les utilisateurs authentifiés peuvent :
- CRUD sur leurs propres données (profiles, submissions, cashouts, messages)
- Lire les concours actifs
- Lire leurs métriques

### Admin

Les admins (via `is_admin(auth.uid())`) peuvent :
- Accès complet à toutes les tables
- Gérer la modération
- Consulter les audit_logs

### Public (non authentifié)

L'accès public est très restreint :
- Lecture des concours actifs (`status = 'active'`)
- Lecture des `contest_terms`
- Lecture des profils créateurs actifs

## 🗄️ Storage Buckets

Les buckets suivants doivent être créés via le dashboard Supabase :

1. **`avatars`** : Avatars utilisateurs
2. **`contest_assets`** : Assets des concours (images, vidéos, PDFs)
3. **`ugc_videos`** : Vidéos UGC des soumissions
4. **`invoices`** : Factures (générées par le système)

Les politiques Storage sont définies dans `12_storage_policies.sql`.

Les métadonnées des fichiers sont gérées dans la table `assets` (voir `20_assets.sql`).

## ⚙️ Configuration Requise

### Extensions PostgreSQL

- `uuid-ossp` : Génération d'UUID
- `pgcrypto` : Fonctions cryptographiques
- `citext` : Comparaisons de texte insensibles à la casse (optionnel)

### Types Énumérés

- `user_role` : `('admin', 'brand', 'creator')`
- `contest_status` : `('draft', 'active', 'paused', 'ended', 'archived')`
- `submission_status` : `('pending', 'approved', 'rejected', 'removed')`
- `payment_status` : `('requires_payment', 'processing', 'succeeded', 'failed', 'refunded')`
- `cashout_status` : `('requested', 'processing', 'paid', 'failed', 'canceled')`
- `platform` : `('tiktok', 'instagram', 'youtube', 'x')`

## ✅ Vérifications Post-Déploiement

Exécuter `14_sanity_checks.sql` pour vérifier :

- ✅ RLS activé sur toutes les tables
- ✅ Contraintes FK valides
- ✅ Fonctions core fonctionnelles
- ✅ Triggers en place
- ✅ Index critiques présents
- ✅ Politiques RLS suffisantes
- ✅ Types énumérés présents

## 🐛 Dépannage

### Erreur : "function does not exist"

Vérifier que `01_functions_core.sql` a bien été exécuté avant les autres fichiers.

### Erreur : "type does not exist"

Vérifier que `00_extensions_enums.sql` a bien été exécuté.

### Erreur RLS : "permission denied"

Vérifier que :
- L'utilisateur est authentifié (`auth.uid()` n'est pas NULL)
- Les politiques RLS sont correctement définies dans `11_rls_policies.sql`
- La fonction `is_admin()` est stable et non récursive

### Erreur Storage : "bucket does not exist"

Créer les buckets manuellement via le dashboard Supabase :
1. Storage → Buckets → New Bucket
2. Créer : `avatars`, `contest_assets`, `ugc_videos`, `invoices`

### Metrics_daily : "permission denied for INSERT"

Normal ! Les INSERT dans `metrics_daily` sont réservés au service_role.
Utiliser une Edge Function ou un cron job avec le service_role JWT.

## 📝 Notes Importantes

1. **Idempotence** : Tous les fichiers sont idempotents (peuvent être exécutés plusieurs fois)
2. **UTC** : Tous les timestamps utilisent `timestamptz` avec `now_utc()` dans les triggers
3. **RLS partout** : Toutes les tables ont RLS activé
4. **FK explicites** : Toutes les clés étrangères ont `ON DELETE` explicite
5. **Pas de seed auth.users** : Les utilisateurs doivent être créés via Supabase Auth
6. **Organisations** : Support multi-membres pour les marques (voir `15_orgs.sql`)
7. **OAuth** : Tokens OAuth réservés au service_role (voir `16_platform_links.sql`)
8. **KYC** : Vérifications d'identité pour les cashouts (voir `19_kyc_risk.sql`)
9. **Assets** : Métadonnées des fichiers avec visibilité publique/privée (voir `20_assets.sql`)
10. **Webhooks** : Intégrations sortantes pour les organisations (voir `23_webhooks_outbound.sql`)
11. **Prix & Gains** : Système de prix fixes par position et gains persistés (voir `25_contest_prizes_winnings.sql`)
12. **CGU** : Traçabilité complète des acceptations de CGU (voir `26_contest_terms_acceptances.sql`)
13. **Social** : Système de follow/favoris pour améliorer l'engagement (voir `27_follows_favorites.sql`)
14. **Tags** : Catégorisation des concours pour meilleure organisation (voir `28_tags_categories.sql`)
15. **Automatisation** : Fonctions cron pour finaliser concours, archiver, calculer métriques (voir `32_automation_functions.sql`)
16. **Analytics** : Vues matérialisées pour dashboards optimisés (voir `33_analytics_materialized.sql`)

## 🔄 Migration depuis l'Ancienne Base

Si vous migrez depuis une base existante :

1. **Backup** : Sauvegarder l'ancienne base
2. **Export données** : Exporter les données existantes (profiles, contests, etc.)
3. **Exécuter la refonte** : Exécuter les fichiers 00-35
4. **Importer données** : Réimporter les données avec les nouvelles structures
5. **Vérifier** : Exécuter `14_sanity_checks.sql`

## 📚 Références

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL 15 Documentation](https://www.postgresql.org/docs/15/)
- [Supabase Storage Policies](https://supabase.com/docs/guides/storage/security/access-control)

## 🎯 Support

Pour toute question ou problème, vérifier :
1. Les résultats de `14_sanity_checks.sql`
2. Les logs Supabase
3. Les politiques RLS dans le dashboard Supabase

---

**Date de création** : 2025-01-20  
**Version** : 2.0.0 (35 fichiers)  
**Compatibilité** : Supabase, PostgreSQL 15+  
**Total tables** : ~40 tables  
**Total fonctions** : ~25 fonctions  
**Total politiques RLS** : ~100+ politiques
