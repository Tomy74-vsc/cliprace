# 🔍 Analyse de Complétude - Base de Données ClipRace

**Date**: 2025-01-20  
**Version**: 2.0.0 (00-24)  
**Objectif**: Identifier les éléments manquants pour une production réelle

---

## ❌ Éléments Critiques Manquants

### 1. Système de Prix Fixes par Position (`contest_prizes`)
**Problème**: La table `contest_prizes` n'existe pas dans la refonte.  
**Impact**: Impossible de définir des prix fixes par position (ex: 1er = 50%, 2e = 30%, 3e = 20%).  
**Solution nécessaire**:
```sql
-- Table contest_prizes manquante
CREATE TABLE public.contest_prizes (
  id uuid PRIMARY KEY,
  contest_id uuid REFERENCES contests(id),
  position integer NOT NULL,
  percentage numeric(5,2) CHECK (percentage >= 0 AND percentage <= 100),
  amount_cents integer CHECK (amount_cents >= 0),
  UNIQUE(contest_id, position)
);
```

### 2. Table de Gains Réels (`contest_winnings`)
**Problème**: Les gains calculés par `compute_payouts()` ne sont pas persistés.  
**Impact**: Impossible de tracer les gains réels, générer des factures, ou créer des cashouts.  
**Solution nécessaire**:
```sql
-- Table pour stocker les gains réels par créateur/concours
CREATE TABLE public.contest_winnings (
  id uuid PRIMARY KEY,
  contest_id uuid REFERENCES contests(id),
  creator_id uuid REFERENCES profiles(id),
  rank integer NOT NULL,
  payout_cents integer NOT NULL,
  payout_percentage numeric(5,2),
  calculated_at timestamptz DEFAULT NOW(),
  paid_at timestamptz,
  cashout_id uuid REFERENCES cashouts(id),
  UNIQUE(contest_id, creator_id)
);
```

### 3. Lien Contest → Contest Terms
**Problème**: Pas de FK entre `contests` et `contest_terms`.  
**Impact**: Impossible de savoir quelle version des CGU a été acceptée pour un concours.  
**Solution nécessaire**:
```sql
-- Ajouter contest_terms_id à contests
ALTER TABLE contests ADD COLUMN contest_terms_id uuid REFERENCES contest_terms(id);
```

### 4. Table d'Acceptation des CGU
**Problème**: Pas de traçabilité de qui a accepté les CGU et quand.  
**Impact**: Conformité légale impossible, pas de preuve d'acceptation.  
**Solution nécessaire**:
```sql
-- Table pour tracker les acceptations de CGU
CREATE TABLE public.contest_terms_acceptances (
  id uuid PRIMARY KEY,
  contest_id uuid REFERENCES contests(id),
  user_id uuid REFERENCES profiles(id),
  contest_terms_id uuid REFERENCES contest_terms(id),
  accepted_at timestamptz DEFAULT NOW(),
  ip_address inet,
  user_agent text,
  UNIQUE(contest_id, user_id)
);
```

### 5. Champ `calculated_at` pour les Métriques
**Problème**: Pas de timestamp indiquant quand les métriques ont été calculées.  
**Impact**: Impossible de savoir si les métriques sont à jour ou obsolètes.  
**Solution nécessaire**:
```sql
-- Ajouter calculated_at à metrics_daily
ALTER TABLE metrics_daily ADD COLUMN calculated_at timestamptz;
```

### 6. Système de Calcul Automatique des Payouts
**Problème**: Pas de trigger pour calculer automatiquement les payouts à la fin d'un concours.  
**Impact**: Les gains ne sont jamais calculés sans intervention manuelle.  
**Solution nécessaire**:
```sql
-- Fonction pour finaliser un concours et calculer les gains
CREATE OR REPLACE FUNCTION finalize_contest(p_contest_id uuid)
RETURNS void AS $$
BEGIN
  -- Marquer le concours comme terminé
  UPDATE contests SET status = 'ended' WHERE id = p_contest_id;
  
  -- Calculer et stocker les gains
  INSERT INTO contest_winnings (contest_id, creator_id, rank, payout_cents, payout_percentage)
  SELECT contest_id, creator_id, rank, payout_cents, payout_percentage
  FROM compute_payouts(p_contest_id);
END;
$$ LANGUAGE plpgsql;
```

### 7. Relation Cashout → Gains
**Problème**: Pas de lien entre `cashouts` et `contest_winnings`.  
**Impact**: Impossible de savoir quel cashout correspond à quel gain.  
**Solution nécessaire**:
```sql
-- Ajouter contest_winning_id à cashouts (ou utiliser contest_winnings.cashout_id déjà prévu)
-- Déjà dans contest_winnings : cashout_id uuid REFERENCES cashouts(id)
```

---

## ⚠️ Éléments Importants à Ajouter

### 8. Système de Follow/Abonnements
**Utilité**: Permettre aux créateurs de suivre les marques et vice-versa.  
**Solution**:
```sql
CREATE TABLE public.follows (
  follower_id uuid REFERENCES profiles(id),
  followee_id uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT NOW(),
  PRIMARY KEY (follower_id, followee_id),
  CHECK (follower_id != followee_id)
);
```

### 9. Système de Favoris/Watchlist
**Utilité**: Permettre aux créateurs de sauvegarder des concours intéressants.  
**Solution**:
```sql
CREATE TABLE public.contest_favorites (
  user_id uuid REFERENCES profiles(id),
  contest_id uuid REFERENCES contests(id),
  created_at timestamptz DEFAULT NOW(),
  PRIMARY KEY (user_id, contest_id)
);
```

### 10. Système de Tags/Catégories
**Utilité**: Organiser et rechercher les concours par catégories.  
**Solution**:
```sql
CREATE TABLE public.contest_tags (
  id uuid PRIMARY KEY,
  name text UNIQUE NOT NULL,
  slug text UNIQUE NOT NULL,
  color text,
  created_at timestamptz DEFAULT NOW()
);

CREATE TABLE public.contest_tag_links (
  contest_id uuid REFERENCES contests(id),
  tag_id uuid REFERENCES contest_tags(id),
  PRIMARY KEY (contest_id, tag_id)
);
```

### 11. Historique des Changements de Statut
**Utilité**: Traçabilité complète des changements de statut (concours, soumissions).  
**Solution**:
```sql
CREATE TABLE public.status_history (
  id bigserial PRIMARY KEY,
  table_name text NOT NULL,
  row_id uuid NOT NULL,
  old_status text,
  new_status text NOT NULL,
  changed_by uuid REFERENCES profiles(id),
  reason text,
  created_at timestamptz DEFAULT NOW()
);
```

### 12. Système de Commentaires sur Soumissions
**Utilité**: Permettre aux marques de commenter les soumissions.  
**Solution**:
```sql
CREATE TABLE public.submission_comments (
  id uuid PRIMARY KEY,
  submission_id uuid REFERENCES submissions(id),
  author_id uuid REFERENCES profiles(id),
  body text NOT NULL,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);
```

### 13. Templates de Notifications
**Utilité**: Centraliser les templates d'emails/notifications.  
**Solution**:
```sql
CREATE TABLE public.notification_templates (
  id uuid PRIMARY KEY,
  event_type text UNIQUE NOT NULL,
  subject text,
  body_html text,
  body_text text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT NOW()
);
```

### 14. Fonctions d'Automatisation (Cron)
**Utilité**: Automatiser les tâches récurrentes (archiver concours, calculer métriques).  
**Solutions nécessaires**:
```sql
-- Fonction pour archiver les concours terminés
CREATE OR REPLACE FUNCTION archive_ended_contests()
RETURNS integer AS $$
DECLARE
  archived_count integer;
BEGIN
  UPDATE contests
  SET status = 'archived'
  WHERE status = 'ended'
  AND end_at < NOW() - INTERVAL '30 days';
  
  GET DIAGNOSTICS archived_count = ROW_COUNT;
  RETURN archived_count;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour calculer les métriques quotidiennes (à appeler via cron)
CREATE OR REPLACE FUNCTION compute_daily_metrics()
RETURNS void AS $$
BEGIN
  -- Logique d'ingestion des métriques depuis les APIs plateformes
  -- À implémenter selon les besoins
END;
$$ LANGUAGE plpgsql;
```

### 15. Vues Matérialisées pour Analytics
**Utilité**: Optimiser les requêtes de dashboards.  
**Solutions**:
```sql
-- Vue matérialisée pour le dashboard marque
CREATE MATERIALIZED VIEW brand_dashboard_summary AS
SELECT
  brand_id,
  COUNT(*) FILTER (WHERE status = 'active') as active_contests,
  COUNT(*) FILTER (WHERE status = 'ended') as ended_contests,
  SUM(prize_pool_cents) as total_prize_pool,
  SUM(budget_cents) as total_spent
FROM contests
GROUP BY brand_id;

-- Vue matérialisée pour le dashboard créateur
CREATE MATERIALIZED VIEW creator_dashboard_summary AS
SELECT
  creator_id,
  COUNT(DISTINCT contest_id) as contests_participated,
  COUNT(*) FILTER (WHERE status = 'approved') as approved_submissions,
  SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as total_submissions,
  COALESCE(SUM(views), 0) as total_views
FROM submissions
GROUP BY creator_id;
```

### 16. Système de Limitations de Soumission
**Utilité**: Limiter le nombre de soumissions par créateur/concours.  
**Solution**:
```sql
-- Ajouter max_submissions_per_creator à contests
ALTER TABLE contests ADD COLUMN max_submissions_per_creator integer DEFAULT 1;
```

### 17. Champs de Modération Manquants
**Problème**: `submissions` n'a pas de `moderated_by` ou `moderation_notes`.  
**Solution**:
```sql
ALTER TABLE submissions ADD COLUMN moderated_by uuid REFERENCES profiles(id);
ALTER TABLE submissions ADD COLUMN moderation_notes text;
```

### 18. Index Composite Manquants
**Problème**: Certaines requêtes fréquentes manquent d'index optimisés.  
**Solutions**:
```sql
-- Index pour recherche de concours actifs par réseau
CREATE INDEX idx_contests_active_network 
  ON contests USING gin(networks) 
  WHERE status = 'active';

-- Index pour recherche de soumissions approuvées par concours
CREATE INDEX idx_submissions_contest_approved 
  ON submissions(contest_id, created_at DESC) 
  WHERE status = 'approved';

-- Index pour leaderboard queries
CREATE INDEX idx_metrics_daily_contest_approved 
  ON metrics_daily(submission_id, metric_date DESC);
```

### 19. Système de Calcul du Score Pondéré
**Problème**: La colonne `weighted_views` dans `metrics_daily` n'a pas de formule définie.  
**Solution**: Ajouter une fonction pour calculer le score :
```sql
CREATE OR REPLACE FUNCTION calculate_weighted_views(
  p_views integer,
  p_likes integer,
  p_comments integer,
  p_shares integer
) RETURNS numeric AS $$
BEGIN
  -- Formule : views + (likes * 2) + (comments * 3) + (shares * 5)
  RETURN p_views + (p_likes * 2) + (p_comments * 3) + (p_shares * 5);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger pour calculer automatiquement weighted_views
CREATE OR REPLACE FUNCTION update_weighted_views()
RETURNS trigger AS $$
BEGIN
  NEW.weighted_views := calculate_weighted_views(NEW.views, NEW.likes, NEW.comments, NEW.shares);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 20. Système de Logs d'Erreurs Application
**Utilité**: Logger les erreurs applicatives pour debugging.  
**Solution**:
```sql
CREATE TABLE public.app_errors (
  id bigserial PRIMARY KEY,
  error_code text,
  message text NOT NULL,
  stack_trace text,
  user_id uuid REFERENCES profiles(id),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT NOW()
);
```

---

## 💡 Optionnels / Améliorations

### 21. Système de Badges/Achievements
**Utilité**: Gamification de la plateforme.  
**Solution**:
```sql
CREATE TABLE public.badges (
  id uuid PRIMARY KEY,
  name text UNIQUE NOT NULL,
  description text,
  icon_url text,
  criteria jsonb -- ex: {"min_contests_won": 5}
);

CREATE TABLE public.user_badges (
  user_id uuid REFERENCES profiles(id),
  badge_id uuid REFERENCES badges(id),
  earned_at timestamptz DEFAULT NOW(),
  PRIMARY KEY (user_id, badge_id)
);
```

### 22. Système de Reviews/Ratings
**Utilité**: Permettre aux créateurs de noter les marques et vice-versa.  
**Solution**:
```sql
CREATE TABLE public.reviews (
  id uuid PRIMARY KEY,
  reviewer_id uuid REFERENCES profiles(id),
  reviewee_id uuid REFERENCES profiles(id),
  rating integer CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamptz DEFAULT NOW(),
  UNIQUE(reviewer_id, reviewee_id)
);
```

### 23. Système de Filtres Avancés pour Recherche
**Utilité**: Améliorer la recherche de concours/créateurs.  
**Solution**: Ajouter des colonnes calculées indexées (ex: `search_vector tsvector`).

### 24. Système de Statistiques Agregées Quotidiennes
**Utilité**: Pré-calculer les stats pour performance.  
**Solution**:
```sql
CREATE TABLE public.daily_stats (
  stat_date date PRIMARY KEY,
  total_users integer,
  total_contests integer,
  total_submissions integer,
  total_revenue_cents bigint,
  created_at timestamptz DEFAULT NOW()
);
```

### 25. Système de Backup/Restore de Métriques
**Utilité**: Historique complet des métriques (audit).  
**Solution**:
```sql
CREATE TABLE public.metrics_archive (
  LIKE metrics_daily INCLUDING ALL,
  archived_at timestamptz DEFAULT NOW()
);
```

### 26. Système de Modération Collaborative
**Utilité**: Permettre aux marques de modérer leurs propres soumissions.  
**Solution**: Ajouter un champ `moderation_required_by_brand boolean` à `submissions`.

### 27. Système de Templates de Concours
**Utilité**: Permettre aux marques de réutiliser des templates de concours.  
**Solution**:
```sql
CREATE TABLE public.contest_templates (
  id uuid PRIMARY KEY,
  brand_id uuid REFERENCES profiles(id),
  name text NOT NULL,
  config jsonb NOT NULL, -- title, brief_md, networks, etc.
  created_at timestamptz DEFAULT NOW()
);
```

---

## 🔧 Suggestions d'Amélioration Structurelle

### 28. Regrouper `profiles`, `profile_brands`, `profile_creators`
**Justification**: Réduire la complexité des requêtes, simplifier les RLS.  
**Proposition**: Conserver uniquement `profiles` avec toutes les colonnes (déjà fait partiellement).  
**Impact**: Moins de JOIN, requêtes plus rapides.

### 29. Normaliser les Statuts
**Justification**: Uniformiser les statuts entre tables.  
**Proposition**: Créer une table `status_definitions` centralisée :
```sql
CREATE TABLE public.status_definitions (
  id uuid PRIMARY KEY,
  entity_type text NOT NULL, -- 'contest', 'submission', 'payment'
  status_code text NOT NULL,
  label text NOT NULL,
  order_index integer,
  UNIQUE(entity_type, status_code)
);
```

### 30. Table Unique pour Toutes les Relations Org
**Justification**: Simplifier la gestion des membres d'org.  
**Proposition**: Évoluer `org_members` pour supporter d'autres types de relations (invitations, rôles dynamiques).

### 31. Système de Soft Delete
**Justification**: Éviter la perte de données, faciliter la restauration.  
**Proposition**: Ajouter `deleted_at timestamptz` à toutes les tables critiques au lieu de `ON DELETE CASCADE`.

### 32. Partitioning pour Tables à Forte Croissance
**Justification**: Améliorer les performances sur `metrics_daily`, `event_log`, `audit_logs`.  
**Proposition**: Partitionner par mois ou trimestre :
```sql
-- Exemple pour metrics_daily
CREATE TABLE metrics_daily_2025_01 PARTITION OF metrics_daily
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
```

### 33. Système de Cache de Résultats Coûteux
**Justification**: Éviter de recalculer les classements à chaque requête.  
**Proposition**: Table `leaderboard_cache` avec `expires_at` :
```sql
CREATE TABLE public.leaderboard_cache (
  contest_id uuid PRIMARY KEY,
  data jsonb NOT NULL,
  computed_at timestamptz DEFAULT NOW(),
  expires_at timestamptz NOT NULL
);
```

### 34. Unification des Systèmes de Notifications
**Justification**: `notifications` et `notification_preferences` sont séparés.  
**Proposition**: Intégrer les préférences directement dans la table `notifications` (JSONB).

### 35. Système de Versioning pour Contest Terms
**Justification**: Historique complet des CGU.  
**Proposition**: Ajouter `version` et `superseded_by` à `contest_terms`.

---

## 📊 Résumé par Priorité

### 🔴 Bloquant (à implémenter avant production)
1. `contest_prizes` - Système de prix fixes
2. `contest_winnings` - Table de gains persistés
3. Lien `contests.contest_terms_id`
4. `contest_terms_acceptances` - Traçabilité CGU
5. Fonction `finalize_contest()` - Automatisation fin concours

### 🟠 Important (nécessaire pour production complète)
6. `follows` - Système de follow
7. `contest_favorites` - Watchlist
8. `contest_tags` - Catégorisation
9. `status_history` - Historique statuts
10. `submission_comments` - Commentaires
11. Fonctions d'automatisation (cron)
12. Vues matérialisées analytics
13. `max_submissions_per_creator` - Limitations
14. Champs modération manquants
15. Index composites optimisés
16. Fonction `calculate_weighted_views()` - Formule score

### 🟡 Optionnel (nice-to-have)
17. `badges` - Gamification
18. `reviews` - Système de notation
19. Filtres avancés recherche
20. `daily_stats` - Stats agrégées
21. `metrics_archive` - Historique complet
22. Modération collaborative
23. `contest_templates` - Réutilisation

---

## ✅ Validation Finale

Avant mise en production, vérifier :

- [ ] Toutes les tables critiques sont présentes
- [ ] Toutes les FK sont définies avec `ON DELETE` approprié
- [ ] Tous les index critiques sont créés
- [ ] RLS activé sur 100% des tables
- [ ] Triggers `update_updated_at` sur toutes les tables concernées
- [ ] Fonctions de calcul automatique (payouts, scores)
- [ ] Système de logging/audit complet
- [ ] Tests de charge sur les requêtes fréquentes
- [ ] Documentation complète des fonctions métier
- [ ] Scripts de migration/rollback documentés

---

**Conclusion**: La base est solide mais nécessite les éléments **critiques** (1-5) pour être fonctionnelle en production. Les éléments **importants** (6-16) améliorent significativement l'expérience utilisateur et la maintenabilité.
