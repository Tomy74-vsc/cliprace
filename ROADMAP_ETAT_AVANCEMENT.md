# Roadmap Interface Admin - État d'Avancement

**Date** : 2024  
**Version** : Post-implémentation Analytics + Conventions

---

## ✅ COMPLÉTÉ

### Analytics Avancés ✅

**Statut** : ✅ **COMPLET**

**Fichiers créés** :
- `src/components/admin/admin-analytics-charts.tsx` : 5 composants graphiques
  - `AdminTimeSeriesChart` : Évolution temporelle (Area chart)
  - `AdminBarChart` : Graphique en barres
  - `AdminPieChart` : Répartition (camembert)
  - `AdminFunnelChart` : Funnel de conversion
  - `AdminCohortChart` : Rétention par cohorte
- `src/app/api/admin/analytics/route.ts` : API analytics avec 4 types
  - `timeSeries` : Évolution vues, engagement, revenus, users
  - `funnel` : Funnel de conversion soumissions
  - `cohorts` : Rétention par cohorte (simplifié)
  - `distribution` : Répartition par plateforme
- `src/components/admin/admin-dashboard-analytics.tsx` : Composant client avec tabs
- Intégration dans `src/app/app/admin/dashboard/page.tsx`

**Fonctionnalités** :
- ✅ Graphiques interactifs avec recharts
- ✅ Filtres par période (7d, 30d, 90d)
- ✅ Tabs pour naviguer entre différents types d'analytics
- ✅ Funnel de conversion
- ✅ Cohortes (rétention)
- ✅ Répartition par catégorie

---

### Conventions API Admin ✅

**Statut** : ✅ **HELPERS CRÉÉS** (à appliquer progressivement)

**Fichiers créés** :
- `src/lib/admin/reason.ts` : Validation reason obligatoire
  - `ReasonSchema` : Zod schema avec reason (min 8 chars) + reason_code optionnel
  - `assertReason()` : Valide reason depuis body
  - `getReason()` : Extrait reason avec fallback
- `src/lib/admin/audit-enhanced.ts` : Audit standardisé
  - `auditAdminAction()` : Écrit dans audit_logs + status_history automatiquement
  - Détecte changements de statut automatiquement
  - Support reason + reason_code + metadata

**Règles définies** :
```
Pour toute route /api/admin/** :
- lecture: requireAdminPermission("<module>.read")
- mutation: requireAdminPermission("<module>.write") 
  + assertCsrf() 
  + enforceAdminRateLimit() 
  + assertReason() 
  + auditAdminAction()
```

**À faire** :
- ⚠️ Appliquer `assertReason()` à toutes les routes mutatives existantes
- ⚠️ Remplacer `logAdminAction()` par `auditAdminAction()` progressivement

---

## 🚧 EN COURS / À FAIRE

### Roadmap - Sprint 1 : Quick Wins

#### [T1] Keyset Pagination ⚠️
**Statut** : ⚠️ **À FAIRE**

**Scope** :
- `/api/admin/audit/logs`
- `/api/admin/events`
- `/api/admin/webhook-deliveries`
- `/api/admin/submissions`

**À implémenter** :
- API contract : `limit`, `cursor` (opaque ou `{created_at, id}`)
- Response : `{ items, nextCursor }`
- Index DB : `(created_at DESC, id)`
- UI : Infinite scroll ou "Load more"

#### [T2] Mutations admin : reason + audit obligatoire ⚠️
**Statut** : ⚠️ **HELPERS CRÉÉS, À APPLIQUER**

**À faire** :
- Appliquer `assertReason()` à toutes les routes mutatives
- Remplacer `logAdminAction()` par `auditAdminAction()`
- Ajouter champ reason dans UI (AdminActionPanel déjà supporte)

#### [T3] Impersonation "pro" ⚠️
**Statut** : ⚠️ **PARTIEL** (composant existe, à durcir)

**À faire** :
- Permission `users.impersonate` dédiée
- TTL token (15 min)
- Bannière UI + badge "Impersonating"
- Audit enrichi (target_user_id, ip, user_agent, reason)

#### [T4] Global Search (⌘K) ⚠️
**Statut** : ⚠️ **À FAIRE**

**À implémenter** :
- Composant `AdminCommandK` ouvrable avec ⌘K/Ctrl+K
- API `GET /api/admin/search?q=...&types=users,contests...`
- Retourne `{groups: {type, items[]}}`
- Navigation clavier
- Clic ouvre drawer

---

### Roadmap - Sprint 2 : Ops Center

#### [T5] Inbox intelligente ⚠️
**Statut** : ⚠️ **À FAIRE**

**À implémenter** :
- DB : `admin_tasks` avec `severity`, `due_at`, `sla_minutes`, `assigned_to`, `status`
- DB : `admin_playbooks` (task_type, steps JSON)
- DB : `admin_task_events` (log transitions)
- UX : Colonnes gravité, SLA, owner, status
- UX : Filtres mine/team/unassigned, severity, type
- UX : Actions rapides (assign-to-me, comment, mark done)
- UX : Tri severity desc + due_at asc
- UX : Playbook visible à droite (drawer)

#### [T6] Entity Drawer unifié ⚠️
**Statut** : ⚠️ **À FAIRE**

**À implémenter** :
- Composant `AdminEntityDrawer`
- Support : user, contest, submission, cashout
- Tabs : Overview / Timeline (status_history) / Audit / Actions
- Bouton "Open full page"
- API lookup détaillée par type

#### [T7] Saved Views team vs personal ⚠️
**Statut** : ⚠️ **PARTIEL** (table existe, à améliorer)

**À faire** :
- DB : `admin_saved_views.visibility = 'personal'|'team'`
- DB : `admin_saved_views.is_default`
- UX : Dropdown vues avec switch personal/team
- UX : Bouton "save view"
- UX : Partage possible, default par module

---

### Roadmap - Sprint 3 : Sécurité Avancée

#### [T8] Break-glass (TTL) ⚠️
**Statut** : ⚠️ **À FAIRE**

**À implémenter** :
- DB : `admin_staff.break_glass_until` timestamptz
- DB : `admin_staff.break_glass_reason` text
- Règle : Certaines permissions nécessitent `break_glass_until > now()`
- UX : Bouton "Enable break-glass 30 min"
- UX : Modal reason + warning
- Protéger : `finance.write`, `settings.write`, `users.write`

#### [T9] 4-eyes Finance ⚠️
**Statut** : ⚠️ **À FAIRE**

**À implémenter** :
- DB : `cashouts.review_state = 'pending'|'approved'|'rejected'`
- DB : `cashout_reviews` (cashout_id, admin_id, decision, created_at)
- Règle : 2 approvals distincts → approved
- UX : "Needs 2 approvals" sur cashout
- UX : Affiche reviewers + timeline

#### [T10] Admin read-only mode ⚠️
**Statut** : ⚠️ **À FAIRE**

**À implémenter** :
- DB : `platform_settings.admin_read_only = true/false`
- API : Middleware `assertNotReadOnly()` sur routes mutatives (sauf super-admin)
- UX : Bannière "Maintenance mode: read-only"

---

### Roadmap - Sprint 4 : Data & Perf

#### [T11] Mat views / caches KPI ⚠️
**Statut** : ⚠️ **À FAIRE**

**À implémenter** :
- Tables/views :
  - `admin_kpis_daily`
  - `webhook_deliveries_daily_stats`
  - `moderation_queue_stats`
- Mécanisme : Cron/edge job refresh (best-effort)
- Objectif : Dashboard admin < 300-500ms

#### [T12] Index & search ⚠️
**Statut** : ⚠️ **À FAIRE**

**À implémenter** :
- Index composites sur filtres admin
- Trigram sur `profiles.email`, `profiles.display_name`
- Objectif : Recherche user/contest rapide à volume

#### [T13] Status history + reason_code + risk_score ⚠️
**Statut** : ⚠️ **PARTIEL** (status_history existe, à généraliser)

**À faire** :
- Status history généralisé partout
- Enum `reason_code` normalisé
- `profiles.risk_score` via view/job
- UX : Badges risk, filtres risk_score

---

## 📋 PRIORISATION

### Priorité HAUTE (Sprint 1)
1. ✅ Analytics avancés (TERMINÉ)
2. ⚠️ [T2] Reason obligatoire sur mutations (helpers créés, à appliquer)
3. ⚠️ [T1] Keyset pagination (performance critique)
4. ⚠️ [T4] Global Search ⌘K (UX critique)

### Priorité MOYENNE (Sprint 2)
5. ⚠️ [T6] Entity Drawer unifié
6. ⚠️ [T5] Inbox intelligente
7. ⚠️ [T7] Saved Views team

### Priorité BASSE (Sprint 3-4)
8. ⚠️ [T8] Break-glass
9. ⚠️ [T9] 4-eyes Finance
10. ⚠️ [T10] Read-only mode
11. ⚠️ [T11] Mat views KPI
12. ⚠️ [T12] Index & search
13. ⚠️ [T13] Status history généralisé

---

## 🎯 PROCHAINES ÉTAPES

### Étape 1 : Appliquer conventions API (2-3h)
- Appliquer `assertReason()` à 10-15 routes mutatives prioritaires
- Remplacer `logAdminAction()` par `auditAdminAction()` progressivement
- Tester avec quelques routes

### Étape 2 : Keyset pagination (3-4h)
- Implémenter sur `/api/admin/audit/logs` (priorité)
- Implémenter sur `/api/admin/submissions`
- Mettre à jour UI avec "Load more"
- Ajouter index DB

### Étape 3 : Global Search ⌘K (4-5h)
- Créer composant `AdminCommandK`
- Créer API `/api/admin/search`
- Intégrer dans layout admin
- Tester navigation clavier

---

## 📊 STATISTIQUES

**Complété** : 2/13 tickets (15%)  
**En cours** : 1/13 tickets (8%)  
**À faire** : 10/13 tickets (77%)

**Temps estimé restant** : ~40-50h

---

**Document créé le** : 2024  
**Version** : 1.0

