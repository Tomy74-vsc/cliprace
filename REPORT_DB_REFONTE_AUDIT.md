# Audit DB Refonte ClipRace — PostgreSQL 15 / Supabase

Date: 2025-11-03

Statut: Des corrections sont nécessaires avant exécution sur une instance Supabase fraîche.

---

## 1. Erreurs bloquantes

- Ordre d’exécution invalide entre fonctions et tables
  - `01_functions_core.sql` crée des fonctions (`public.is_admin`, `public.get_user_role`, etc.) qui lisent `public.profiles` avant sa création par `02_profiles.sql`. Les fonctions SQL sont validées à la création et échoueront si la table n’existe pas.
  - `RUN_ALL_LOCALLY.sql` exécute `01_functions_core.sql` avant `02_profiles.sql`.

- Politiques RLS appliquées sur des tables non créées
  - `11_rls_policies.sql` définit des policies pour de nombreuses tables créées ensuite (15–31). L’exécution échouera dès la première table manquante.
  - `RUN_ALL_LOCALLY.sql` lance `11_rls_policies.sql` trop tôt.

- Trigger `updated_at` attaché à une table sans colonne `updated_at`
  - `10_triggers.sql` inclut `contest_terms` dans la liste des tables alors que `contest_terms` ne possède pas de colonne `updated_at`. Le trigger `public.update_updated_at()` assigne `NEW.updated_at`, ce qui fera échouer toute mise à jour de `contest_terms`.

- Triggers créés avant la création des tables cibles
  - `10_triggers.sql` tente d’attacher des triggers à des tables créées après (15–28). Les triggers ne seront pas installés pour ces tables si le fichier 10 est exécuté trop tôt.

- Sanity checks lancés trop tôt
  - `RUN_ALL_LOCALLY.sql` exécute `14_sanity_checks.sql` avant la création de l’ensemble des objets (15–35), provoquant de faux positifs.

- Idempotence cassée pour un index unique dans `assets`
  - `20_assets.sql` vérifie l’existence de l’index `assets_bucket_path_unique` via `pg_constraint` (qui ne contient pas les index), puis exécute `CREATE UNIQUE INDEX assets_bucket_path_unique ...` sans `IF NOT EXISTS`. Un second passage plantera avec « duplicate index ».

---

## 2. Incohérences / oublis

- Policies RLS incomplètes (absence de WITH CHECK)
  - Plusieurs policies « FOR ALL USING (...) » ne définissent pas de `WITH CHECK (...)`. En PostgreSQL, `WITH CHECK` borne INSERT/UPDATE. Sans `WITH CHECK`, un INSERT peut accepter des valeurs hors périmètre de la condition business (selon la sémantique effective des policies). Il est recommandé d’ajouter `WITH CHECK` explicite et identique à `USING` lorsque pertinent.
  - Cibles prioritaires (exemples) à rendre explicites: `submissions_creator_manage_own`, `messages_threads_participants_manage`, `messages_participants_manage`, `notifications_user_manage_own`, `orgs_members_manage`, `org_members_owner_manage`, `platform_accounts_owner_manage`, `notification_preferences_owner_manage`, `push_tokens_owner_manage`, `invoices_org_members_manage`, `assets_owner_manage`, `assets_org_members_manage`, `contest_prizes_brand_manage`, `contest_tag_links_brand_manage`.

- Couverture incomplète des triggers d’audit et `updated_at`
  - Les triggers d’audit/`updated_at` ne seront pas attachés aux tables créées après le fichier 10 si celui-ci n’est pas rejoué en fin, ou s’il n’auto‑détecte pas les tables cibles.

- Fonction `archive_ended_contests()` fragile
  - Dans `32_automation_functions.sql`, l’INSERT dans `status_history` filtre sur `updated_at = public.now_utc()`, mais `now_utc()` est évalué à un instant différent de l’UPDATE précédent, risquant 0 ligne insérée. Capturer un `v_now` et l’utiliser pour l’UPDATE et l’INSERT.

- Exécution service_role requise (à confirmer en déploiement)
  - Écritures dans `metrics_daily`, `platform_oauth_tokens`, `webhooks_stripe`/`webhook_deliveries` sont correctement réservées au service role (pas de policies INSERT/UPDATE publiques). À garder documenté côté ops.

---

## 3. Améliorations recommandées

### A. Corriger l’ordre d’exécution

- Dans `RUN_ALL_LOCALLY.sql`:
  1) Exécuter `02_profiles.sql` avant `01_functions_core.sql`.
  2) Déplacer `11_rls_policies.sql` après la création de toutes les tables concernées (après 31, ou juste avant 33/34/35), puis le relancer en fin si besoin.
  3) Déplacer `10_triggers.sql` tout à la fin (après 35) pour assurer l’attachement sur toutes les tables.
  4) Ne garder `14_sanity_checks.sql` qu’en fin d’exécution.

Proposition (extrait d’ordre):

```sql
\i db_refonte/00_extensions_enums.sql
\i db_refonte/02_profiles.sql
\i db_refonte/01_functions_core.sql
\i db_refonte/03_contests.sql
\i db_refonte/04_submissions_metrics.sql
\i db_refonte/05_payments_cashouts.sql
\i db_refonte/06_moderation_audit.sql
\i db_refonte/07_messaging_notifications.sql
\i db_refonte/08_views_materialized.sql
\i db_refonte/09_functions_business.sql
-- ... 15 → 31 (toutes les nouvelles tables)
\i db_refonte/11_rls_policies.sql
\i db_refonte/33_analytics_materialized.sql
\i db_refonte/34_submission_limits.sql
\i db_refonte/35_weighted_views_calculation.sql
\i db_refonte/10_triggers.sql
\i db_refonte/14_sanity_checks.sql
```

### B. Sécuriser les policies RLS avec `WITH CHECK`

- Exemple 1 — `submissions`:

```sql
DROP POLICY IF EXISTS "submissions_creator_manage_own" ON public.submissions;
CREATE POLICY "submissions_creator_manage_own" ON public.submissions
  FOR ALL
  USING (auth.uid() = creator_id)
  WITH CHECK (auth.uid() = creator_id);
```

- Exemple 2 — `messages_threads`:

```sql
DROP POLICY IF EXISTS "messages_threads_participants_manage" ON public.messages_threads;
CREATE POLICY "messages_threads_participants_manage" ON public.messages_threads
  FOR ALL
  USING (auth.uid() = brand_id OR auth.uid() = creator_id)
  WITH CHECK (auth.uid() = brand_id OR auth.uid() = creator_id);
```

- Rejouer le même principe sur les tables listées en 2/.

### C. Rendre le trigger `updated_at` robuste

- Option 1 (recommandée): n’attacher le trigger que sur les tables qui possèdent la colonne `updated_at`.

```sql
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT table_schema, table_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND column_name = 'updated_at'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS update_%1$s_updated_at ON %2$I.%1$I', r.table_name, r.table_schema);
    EXECUTE format(
      'CREATE TRIGGER update_%1$s_updated_at BEFORE UPDATE ON %2$I.%1$I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at()',
      r.table_name, r.table_schema
    );
  END LOOP;
END $$;
```

- Option 2: ajouter `updated_at timestamptz` à `contest_terms` si utile; sinon retirer `contest_terms` de la liste statique.

### D. Fix idempotence index `assets`

Remplacer le bloc de `20_assets.sql` par un `CREATE UNIQUE INDEX IF NOT EXISTS` :

```sql
CREATE UNIQUE INDEX IF NOT EXISTS assets_bucket_path_unique
  ON public.assets(bucket, path)
  WHERE bucket IS NOT NULL AND path IS NOT NULL;
```

### E. Corriger `archive_ended_contests()`

Capturer un timestamp unique et l’utiliser pour l’UPDATE et l’INSERT dans `status_history`:

```sql
CREATE OR REPLACE FUNCTION public.archive_ended_contests()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE archived_count integer; v_now timestamptz := public.now_utc();
BEGIN
  UPDATE public.contests
  SET status = 'archived', updated_at = v_now
  WHERE status = 'ended' AND end_at < v_now - INTERVAL '30 days';

  GET DIAGNOSTICS archived_count = ROW_COUNT;

  INSERT INTO public.status_history (table_name, row_id, old_status, new_status, created_at)
  SELECT 'contests', id, 'ended', 'archived', v_now
  FROM public.contests
  WHERE status = 'archived' AND updated_at = v_now;

  RETURN archived_count;
END; $$;
```

### F. Rejouer `10_triggers.sql` en fin

- Après création de toutes les tables et policies, rejouer `10_triggers.sql` (déplacé en fin) pour attacher les triggers à l’ensemble du schéma.

---

## 4. Conclusion

- Verdict: Des corrections sont nécessaires avant exécution sur Supabase.
- Points bloquants à corriger en priorité:
  1) Ordre d’exécution (`02` avant `01`; `11` et `10` déplacés en fin; `14` seulement à la fin).
  2) Trigger `updated_at` — éviter `contest_terms` sans colonne `updated_at` (ou auto‑détection des tables).
  3) Idempotence de l’index unique `assets_bucket_path_unique`.
  4) Ajouter `WITH CHECK` aux policies “FOR ALL USING” qui doivent contraindre INSERT/UPDATE.
  5) Corriger `archive_ended_contests()` pour utiliser un timestamp commun.

Une fois ces points appliqués, la refonte sera exploitable sur une instance Supabase fraîche. Pensez à exécuter les sanity checks en fin et à utiliser le service_role pour les écritures réservées (`metrics_daily`, `platform_oauth_tokens`, webhooks).

