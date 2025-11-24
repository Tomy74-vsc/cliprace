# 🧩 Refonte complète de la base de données – ClipRace
_Généré le 2025-11-02 17:31_

## 🎯 Objectif global

Refondre entièrement la base de données du projet **ClipRace** (Supabase / PostgreSQL 15+) pour qu’elle soit :
- **Robuste**, sécurisée, scalable et claire.
- Totalement **connectée à Supabase Auth**, Stripe (paiements & cashouts), et l’interface web Next.js 14.
- Compatible avec **les rôles : marque, créateur, admin**.
- 100 % fonctionnelle pour toutes les pages du produit (auth, concours, UGC, paiements, classement, messagerie, modération, etc.).

---

## 📁 Stack ciblée

- **Base de données** : PostgreSQL (hébergée via Supabase)
- **Auth** : Supabase Auth (JWT + RLS)
- **Paiements** : Stripe Checkout & Stripe Connect
- **Langage SQL** : PostgreSQL 15 syntax
- **Sécurité** : RLS obligatoire sur toutes les tables
- **Extensions** : `pgcrypto`, `citext`, `uuid-ossp`
- **Storage buckets** : `avatars`, `contest_assets`, `ugc_videos`, `invoices`

---

## ⚙️ Étapes de construction (ordre impératif)

### 🧱 1. Préparation du schéma global

- Créer les **enums** :
  - `user_role` → `('admin','brand','creator')`
  - `contest_status` → `('draft','active','paused','ended','archived')`
  - `submission_status` → `('pending','approved','rejected','removed')`
  - `payment_status` → `('requires_payment','processing','succeeded','failed','refunded')`
  - `cashout_status` → `('requested','processing','paid','failed','canceled')`
  - `platform` → `('tiktok','instagram','youtube','x')`

- Créer la fonction utilitaire :
  ```sql
  create or replace function public.now_utc()
  returns timestamptz language sql stable as $$
    select timezone('utc', now());
  $$;
  ```

---

### 👤 2. Authentification et profils

#### Tables à créer
1. `profiles`  
   - clé primaire : `id uuid references auth.users(id)`  
   - champs : `role`, `email`, `display_name`, `avatar_url`, `bio`, `country`, `is_active`, `created_at`, `updated_at`  
   - index : `(role)`, `(is_active)`  
   - trigger : `update_updated_at`

2. `profile_brands`  
   - détails marque : `company_name`, `website`, `industry`, `vat_number`, `address_*`

3. `profile_creators`  
   - détails créateur : `first_name`, `last_name`, `handle`, `primary_platform`, `followers`, `avg_views`

#### RLS attendue
- Chaque utilisateur → accès uniquement à son profil
- Admin → accès complet

---

### 🏁 3. Concours (Espace marque)

#### Tables
1. `contest_terms` : versions des CGU (version + markdown + URL)
2. `contests` :
   - FK : `brand_id → profiles.id`
   - champs : `title`, `slug`, `brief_md`, `cover_url`, `status`, `budget_cents`, `prize_pool_cents`, `currency`, `start_at`, `end_at`, `networks[]`, `max_winners`
   - triggers : `update_updated_at`
   - check constraints : `budget_cents >= 0`, `end_at > start_at`
3. `payments_brand` :
   - FK : `brand_id`, `contest_id`
   - Stripe fields : `stripe_customer_id`, `stripe_checkout_session_id`, `stripe_payment_intent_id`
   - `status` (enum `payment_status`)
4. `contest_assets` :
   - FK : `contest_id`
   - champs : `url`, `type ('image','video','pdf')`

#### RLS attendue
- Lecture publique sur concours `status = 'active'`
- Écriture : `brand_id = auth.uid()` ou admin

---

### 🎬 4. Soumissions (Espace créateur)

#### Tables
1. `submissions` :
   - FK : `contest_id`, `creator_id`
   - champs : `platform`, `external_url`, `external_post_id`, `thumbnail_url`, `title`, `status`, `rejection_reason`, `submitted_at`, `approved_at`
   - unique : `(contest_id, creator_id, external_url)`
2. `metrics_daily` :
   - FK : `submission_id`
   - champs : `metric_date`, `views`, `likes`, `comments`, `shares`, `weighted_views`
   - vue matérialisée `leaderboard`
3. `leaderboard` :
   - vue agrégée par `contest_id, creator_id`
   - somme des `weighted_views` et des stats totales

#### RLS attendue
- Créateur → CRUD sur ses propres soumissions
- Marque → lecture des soumissions liées à ses concours
- Admin → tout

---

### 📈 5. Métriques & Classements

#### Fonctions
1. `compute_payouts(contest_id)` → calcule la répartition des gains selon les poids.
2. `contest_stats` (vue) → agrégat par concours (`views`, `likes`, `comments`, `shares`, `score_weighted`).

#### Attente interface
- Dashboard marque : voir toutes les stats de ses concours
- Classement créateur : score visible en temps réel

---

### 💳 6. Paiements & Cashouts

#### Tables
1. `payments_brand`
   - déjà créée pour l’activation concours
2. `cashouts`
   - FK : `creator_id`
   - champs : `amount_cents`, `currency`, `stripe_account_id`, `stripe_transfer_id`, `status`, `metadata`, `requested_at`, `processed_at`
3. `webhooks_stripe`
   - stocke les événements bruts (champ `payload jsonb`)
   - `processed boolean`

#### Attentes interface
- Stripe Checkout → update `payments_brand.status = 'succeeded'`
- Stripe Connect → création d’un `cashout`
- Historique visible pour chaque utilisateur

---

### 🧰 7. Modération & Audit

#### Tables
1. `moderation_queue`
   - FK : `submission_id`
   - champs : `reason`, `status`, `reviewed_by`, `reviewed_at`
2. `moderation_rules`
   - définit les critères d’auto-modération
3. `audit_logs`
   - FK : `actor_id`
   - champs : `action`, `table_name`, `row_pk`, `old_values`, `new_values`, `ip`, `user_agent`, `created_at`

#### Triggers
- `audit_logs_insert()` : s’exécute sur toutes les actions sensibles

#### RLS
- Admin only

---

### 💬 8. Messagerie & Notifications

#### Tables
1. `messages_threads`
   - FK : `contest_id`
   - champs : `brand_id`, `creator_id`, `last_message`, `unread_for_brand`, `unread_for_creator`, `updated_at`
2. `messages`
   - FK : `thread_id`
   - champs : `sender_id`, `body`, `read`, `created_at`
3. `notifications`
   - FK : `user_id`
   - champs : `type`, `content`, `read`, `created_at`

#### Triggers
- `update_message_thread` :
  - met à jour `last_message`, `updated_at`, `unread_for_*` selon `NEW.sender_id`

#### RLS
- Lecture/écriture réservée aux participants du thread
- Admin lecture globale

---

### 🔒 9. RLS (Row Level Security)

#### Politique à implémenter partout

| Rôle | Accès | Tables concernées |
|------|--------|-------------------|
| Creator | CRUD sur ses propres données | `profiles`, `profile_creators`, `submissions`, `cashouts`, `messages` |
| Brand | CRUD sur ses concours | `profiles`, `profile_brands`, `contests`, `payments_brand`, `messages_threads` |
| Admin | Accès total | toutes |
| Public | Lecture seulement sur les concours actifs | `contests`, `contest_terms` |

> ⚠️ Utiliser une fonction `is_admin(uid)` stable et non récursive :
> ```sql
> create or replace function public.is_admin(uid uuid)
> returns boolean language sql stable as $$
>   select exists (select 1 from public.profiles where id = uid and role = 'admin');
> $$;
> ```

---

### 🧮 10. Fonctions & automatisations

| Fonction | Rôle | Type |
|-----------|------|------|
| `update_updated_at()` | met à jour automatiquement le champ `updated_at` | trigger |
| `compute_payouts()` | calcul du classement et répartition des gains | SQL stable |
| `contest_stats` | vue agrégée pour dashboard marque | vue |
| `audit_logs_insert()` | log des actions sensibles | trigger |
| `now_utc()` | uniformise le temps | SQL stable |

#### Edge Functions (cron jobs)
- `update_metrics_daily` (toutes les 6h)
- `refresh_leaderboard` (quotidien)
- `archive_ended_contests` (quotidien)

---

### ⚙️ 11. Index & contraintes

| Table | Index / contraintes |
|--------|--------------------|
| `profiles` | `(role)`, `(is_active)` |
| `contests` | `(brand_id, status, start_at)` |
| `submissions` | `(contest_id, creator_id, status)` |
| `metrics_daily` | `(submission_id, metric_date)` |
| `cashouts` | `(creator_id, status)` |

> Supprimer toute duplication inutile et préférer les vues agrégées pour la performance.

---

### 🧾 12. Tests & validation

À exécuter une fois la refonte finie :
1. Vérifier que RLS est **activé sur toutes les tables** :
   ```sql
   select relname, relrowsecurity from pg_class where relkind='r' and relrowsecurity=false;
   ```
2. Vérifier les **triggers** :
   - `update_updated_at` fonctionne sur `UPDATE`.
   - `audit_logs_insert` s’exécute sur `INSERT/UPDATE/DELETE`.
3. Créer un jeu de **seed réaliste** :
   - 5 marques, 30 créateurs, 3 concours, ~120 soumissions.
4. Exécuter les fonctions :
   - `compute_payouts()` retourne bien un top 30.
   - `contest_stats` donne des agrégats corrects.

---

### ✅ 13. Livraison attendue

- Fichier final : `schema_cliplrace_refonte.sql`
- Compatible Supabase (copier/coller dans SQL Editor)
- Inclure :
  - tous les `CREATE TABLE`, `CREATE POLICY`, `CREATE FUNCTION`, `CREATE TRIGGER`, `CREATE VIEW`
  - commentaires explicatifs sur chaque bloc
- Pas de seed d’exemple (juste structure)
- Validation automatique après exécution (`no errors`)

---

## 💬 Notes au développeur Cursor

- Sois **rigoureux sur les contraintes et RLS** : c’est la base de la sécurité.
- Documente chaque table et fonction avec un commentaire clair (`comment on table ... is '...'`).
- Les vues (`leaderboard`, `contest_stats`) doivent être **materialized** si possible pour la performance.
- L’ensemble doit être **idempotent** : chaque `CREATE` doit être encapsulé dans un `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$;`
- Garde la cohérence des timestamps (`timestamptz` avec UTC).
- Tout le schéma doit être prêt à déployer sur Supabase **sans aucune dépendance externe**.

---

## 🚀 Fin du cahier des charges
Une fois cette refonte terminée, la base ClipRace sera :
- plus rapide,
- totalement sécurisée,
- et parfaitement alignée avec l’interface Next.js + Supabase.
