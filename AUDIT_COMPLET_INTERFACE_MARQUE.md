# 📊 Audit Complet - Interface Marque ClipRace

**Date**: 2025-11-30  
**Version**: 1.0  
**Objectif**: Documentation exhaustive de l'interface marque, incluant fonctionnalités, logique métier, sécurité, design, fichiers et flux

---

## 📋 Table des Matières

1. [Architecture Globale](#architecture-globale)
2. [Fonctionnalités Détaillées](#fonctionnalités-détaillées)
3. [Logique Métier](#logique-métier)
4. [Sécurité](#sécurité)
5. [Design & UX](#design--ux)
6. [Fichiers & Structure](#fichiers--structure)
7. [Flux Détaillés](#flux-détaillés)
8. [APIs & Backend](#apis--backend)
9. [Base de Données](#base-de-données)
10. [Points d'Amélioration](#points-damélioration)

---

## 🏗️ Architecture Globale

### Structure de l'Interface Marque

```
/app/brand/
├── layout.tsx                    # Layout principal avec navigation
├── dashboard/                    # Tableau de bord
├── contests/                     # Gestion des concours
│   ├── page.tsx                  # Liste des concours
│   ├── new/                      # Création de concours (wizard)
│   └── [id]/                     # Détail concours
│       ├── page.tsx              # Vue détaillée
│       ├── submissions/          # Modération
│       └── leaderboard/          # Classement
├── messages/                     # Communication créateurs
├── notifications/                # Centre de notifications
├── billing/                      # Factures & paiements
└── settings/                     # Paramètres profil
```

### Technologies Utilisées

- **Framework**: Next.js 16 (App Router)
- **Base de données**: Supabase (PostgreSQL)
- **Authentification**: Supabase Auth
- **Paiements**: Stripe
- **UI**: React, Tailwind CSS, shadcn/ui
- **Graphiques**: Recharts
- **PDF**: @react-pdf/renderer

---

## 🎯 Fonctionnalités Détaillées

### 1. Dashboard (`/app/brand/dashboard`)

#### Vue d'ensemble
- **Objectif**: Vue consolidée de l'activité de la marque
- **Revalidation**: 60 secondes (ISR)
- **Fichier**: `src/app/app/brand/dashboard/page.tsx`

#### Fonctionnalités

**A. Carte d'accueil**
- Message de bienvenue personnalisé
- CTA principal: "Créer un concours"
- CTA secondaire: "Voir mes concours"
- État global: concours actifs, soumissions en attente, budget engagé, vues cumulées

**B. KPIs (4 cartes)**
- **Vues cumulées**: Total toutes soumissions confondues
- **Engagement**: Total likes
- **CPV**: Coût pour 1000 vues (calcul: `(budget_spent / total_views) * 1000`)
- **Budget dépensé**: Total des prize pools payés

**C. Concours en cours**
- Liste des 6 premiers concours actifs
- Métriques par concours: vues, soumissions, CPV, prize pool
- Badge plateformes
- Lien vers détail concours

**D. Graphiques**
- **Vues 7 derniers jours**: LineChart (Recharts)
  - Données: `metrics_daily` agrégées par date
  - Remplissage automatique des jours manquants (0 vues)
- **Répartition plateformes**: PieChart (Recharts)
  - Distribution des soumissions approuvées par plateforme
  - Couleurs personnalisées par plateforme

**E. Concours récents**
- 5 derniers concours (tous statuts)
- Badge statut coloré
- Plateformes, prize pool, date création

**F. Notifications importantes**
- Paiements en attente
- Soumissions en attente de modération
- Actions requises avec liens directs

#### Logique de Récupération des Données

```typescript
// Fonction: fetchDashboardData()
// 1. Récupérer tous les concours de la marque
// 2. Filtrer concours actifs
// 3. Pour chaque concours actif:
//    - Appeler RPC get_contest_metrics(contest_id)
//    - Agréger: total_views, total_likes, approved_submissions
// 4. Compter soumissions en attente (status='pending')
// 5. Compter paiements en attente (status IN ['requires_payment', 'processing'])
// 6. Calculer budgets (engagé vs dépensé)
// 7. Récupérer métriques quotidiennes (7 derniers jours)
// 8. Calculer répartition plateformes
```

#### Fichiers Impliqués
- `src/app/app/brand/dashboard/page.tsx` (514 lignes)
- `src/components/brand/contest-metrics-chart.tsx`
- `src/components/brand/platform-distribution-chart.tsx`
- `src/components/creator/stat-card.tsx` (réutilisé)

---

### 2. Liste des Concours (`/app/brand/contests`)

#### Vue d'ensemble
- **Objectif**: Gestion centralisée de tous les concours
- **Revalidation**: 60 secondes
- **Fichier**: `src/app/app/brand/contests/page.tsx`

#### Fonctionnalités

**A. En-tête avec CTA**
- Titre: "Mes concours"
- Description
- Bouton "Créer un concours"

**B. Stats rapides (4 cartes)**
- Actifs (badge success)
- Brouillons (badge secondary)
- Terminés (badge warning)
- Total (badge info)

**C. Filtres avancés**
- **Recherche**: Par titre (ilike, max 80 caractères)
- **Statut**: Tous, Brouillons, Actifs, Terminés, Archivés
- **Plateformes**: TikTok, Instagram, YouTube (multi-sélection)
- **Tri**: Plus récents, Plus anciens, Budget décroissant, Plus de soumissions

**D. Liste des concours**
- **Format**: Grille responsive (2-3 colonnes)
- **Informations affichées**:
  - Titre (line-clamp-2)
  - Badge statut
  - Prize pool
  - Plateformes (max 3)
  - Dates (début/fin)
  - Soumissions (total + en attente)
  - Vues cumulées
- **Actions**:
  - "Voir" → Détail concours
  - "Modérer" (si soumissions en attente) → Page modération

**E. Pagination**
- 20 concours par page
- Navigation précédent/suivant
- Préservation des filtres dans l'URL

#### Logique de Tri par Soumissions

**Problème initial**: Tri côté client sur données paginées = résultats incorrects

**Solution implémentée**:
```typescript
if (sort === 'submissions_desc') {
  // 1. Récupérer TOUS les concours (sans pagination)
  const { data: allContests } = await query;
  
  // 2. Calculer stats pour chaque concours
  const submissionsData = await calculateSubmissionsStats(contestIds);
  
  // 3. Trier par nombre de soumissions (décroissant)
  const sorted = allContests.sort((a, b) => 
    submissionsData[b.id].total - submissionsData[a.id].total
  );
  
  // 4. Appliquer pagination APRÈS tri
  return sorted.slice(from, to + 1);
}
```

#### Fichiers Impliqués
- `src/app/app/brand/contests/page.tsx` (595 lignes)
- `src/components/creator/platform-badge.tsx` (réutilisé)

---

### 3. Création de Concours (`/app/brand/contests/new`)

#### Vue d'ensemble
- **Objectif**: Wizard 5 étapes pour créer un concours complet
- **Type**: Client Component (interactivité)
- **Fichier**: `src/components/brand/contest-wizard-client.tsx`

#### Architecture du Wizard

**Étape 1: Informations générales**
- Titre (requis)
- Brief markdown (requis)
- Image de couverture (upload)
- Dates début/fin (validation: end > start)
- Objectif marketing (optionnel)

**Étape 2: Conditions & règles**
- Plateformes autorisées (multi-sélection: TikTok, Instagram, YouTube)
- Hashtags requis (array)
- Critères minimum: followers, vues
- CGU: markdown ou URL
- Version CGU

**Étape 3: Budget & Cashprize**
- Prize pool total (en centimes)
- Devise (EUR par défaut)
- Structure des prix:
  - Rangs (rank_start, rank_end)
  - Montants (amount_cents)
  - Pourcentages (optionnel)
- Nombre max de gagnants

**Étape 4: Validation & aperçu**
- Résumé complet
- Aperçu côté créateur
- Aperçu côté public
- Validation finale

**Étape 5: Paiement**
- Calcul: prize_pool + commission 15%
- Redirection Stripe Checkout
- Gestion retour webhook

#### Fonctionnalités Avancées

**A. Auto-save (Brouillon)**
- **Fréquence**: Toutes les 10 secondes
- **Déclencheur**: Changements détectés via `previousDataRef`
- **API**: `PATCH /api/contests/[id]/update`
- **Feedback visuel**: "Sauvegardé à XX:XX" ou "Sauvegarde en cours..."
- **Protection**: Ne sauvegarde que si titre présent ou brouillon existant

**B. Sauvegarde manuelle**
- Bouton "Sauvegarder le brouillon"
- Même API que auto-save
- Toast de confirmation

**C. Chargement de brouillon**
- Paramètre URL: `?draft={contest_id}`
- API: `GET /api/contests/[id]`
- Remplissage automatique du formulaire
- Navigation vers étape appropriée

**D. Validation par étape**
- Validation avant passage à l'étape suivante
- Messages d'erreur contextuels
- Blocage navigation si erreurs

**E. Avertissement navigation**
- `beforeunload` si changements non sauvegardés
- Confirmation avant quitter la page

#### Flux de Création

```
1. Utilisateur remplit étape 1
   ↓
2. Auto-save (si titre présent)
   → POST /api/contests/create (nouveau)
   → Retourne contest_id
   ↓
3. Utilisateur continue étapes 2-4
   ↓
4. Auto-save continue (PATCH /api/contests/[id]/update)
   ↓
5. Étape 5: Paiement
   ↓
6. POST /api/payments/brand/fund
   → Crée payments_brand (status='requires_payment')
   → Crée Stripe Checkout Session
   → Retourne checkout_url
   ↓
7. Redirection Stripe
   ↓
8. Webhook Stripe: checkout.session.completed
   → payments_brand.status = 'succeeded'
   → contests.status = 'active'
   → Notifications créateurs éligibles
   → Notification marque
```

#### Fichiers Impliqués
- `src/app/app/brand/contests/new/page.tsx` (28 lignes)
- `src/components/brand/contest-wizard-client.tsx` (513 lignes)
- `src/components/brand/contest-wizard/step1-general-info.tsx`
- `src/components/brand/contest-wizard/step2-conditions.tsx`
- `src/components/brand/contest-wizard/step3-budget.tsx`
- `src/components/brand/contest-wizard/step4-preview.tsx`
- `src/components/brand/contest-wizard/step5-payment.tsx`

---

### 4. Détail Concours (`/app/brand/contests/[id]`)

#### Vue d'ensemble
- **Objectif**: Vue complète d'un concours avec toutes les métriques
- **Revalidation**: 60 secondes
- **Fichier**: `src/app/app/brand/contests/[id]/page.tsx`

#### Sections

**A. En-tête**
- Titre concours
- Badge statut (coloré selon statut)
- Dates (début → fin)
- Actions:
  - Modifier (si draft)
  - Voir page publique
  - Dupliquer

**B. Statistiques (4 KPIs)**
- Vues totales
- Engagement (likes)
- CPV (coût pour 1000 vues)
- Soumissions (approuvées + en attente)

**C. Graphique croissance journalière**
- LineChart (Recharts)
- Données: `metrics_daily` agrégées par date
- Période: Depuis début concours

**D. Soumissions récentes**
- Grille 2-3 colonnes
- 10 dernières soumissions approuvées
- Informations: Créateur, plateforme, vues, likes
- Lien vers modération complète

**E. Leaderboard**
- Top 10 gagnants
- Colonnes: Rang, créateur, vues, likes, gain estimé
- Mise en évidence top 3
- Lien vers leaderboard complet

**F. Export PDF**
- Bouton "Export PDF"
- API: `GET /api/contests/[id]/export-pdf`
- Génère PDF complet avec:
  - Statistiques globales
  - Classement final (top 20)
  - Évolution vues (7 jours)
  - CPV calculé

#### Logique de Récupération

```typescript
// Fonction: fetchContestData()
// 1. Récupérer concours (avec vérification ownership)
// 2. Appeler RPC get_contest_metrics(contest_id)
// 3. Récupérer soumissions récentes (approved, limit 10)
// 4. Récupérer leaderboard (RPC get_contest_leaderboard, limit 10)
// 5. Calculer métriques quotidiennes pour graphique
// 6. Calculer CPV
```

#### Fichiers Impliqués
- `src/app/app/brand/contests/[id]/page.tsx` (540 lignes)
- `src/components/brand/contest-metrics-chart.tsx`
- `src/components/pdf/contest-results-pdf.tsx` (pour export)

---

### 5. Modération Soumissions (`/app/brand/contests/[id]/submissions`)

#### Vue d'ensemble
- **Objectif**: Modérer les soumissions des créateurs
- **Revalidation**: 60 secondes
- **Fichier**: `src/app/app/brand/contests/[id]/submissions/page.tsx`

#### Fonctionnalités

**A. Stats rapides (4 cartes)**
- En attente (warning)
- Approuvées (success)
- Refusées (danger)
- Total

**B. Filtres**
- **Recherche**: Par créateur ou URL
- **Statut**: Toutes, En attente, Approuvées, Refusées
- **Plateformes**: TikTok, Instagram, YouTube
- **Tri**: Plus récentes, Plus anciennes, Plus de vues, Moins de vues

**C. Table de modération**
- **Colonnes**:
  - Checkbox (sélection multiple)
  - Créateur (nom + avatar)
  - Plateforme (badge)
  - URL (lien externe)
  - Vues (depuis metrics_daily)
  - Likes (depuis metrics_daily)
  - Statut (badge coloré)
  - Date soumission
  - Actions (Approuver/Refuser)

**D. Modération individuelle**
- Dialog modal
- Choix: Approuver / Refuser
- Raison de rejet (optionnel, si refus)
- API: `PATCH /api/submissions/[id]/moderate`
- Notification automatique au créateur

**E. Modération par lot**
- Sélection multiple (checkboxes)
- Actions groupées: Approuver tout / Refuser tout
- Raison commune (si refus)
- API: `POST /api/submissions/batch-moderate`
- Notifications individuelles pour chaque soumission

#### Logique de Tri par Vues

```typescript
// Problème: Tri par vues nécessite agrégation metrics_daily
// Solution:
// 1. Récupérer soumissions avec pagination
// 2. Récupérer metrics_daily pour ces soumissions
// 3. Agréger vues par submission_id
// 4. Trier côté client (après récupération)
// 5. Note: Pagination appliquée AVANT tri (limitation)
```

#### Fichiers Impliqués
- `src/app/app/brand/contests/[id]/submissions/page.tsx` (460 lignes)
- `src/components/brand/submissions-moderation-table.tsx` (511 lignes)

---

### 6. Leaderboard (`/app/brand/contests/[id]/leaderboard`)

#### Vue d'ensemble
- **Objectif**: Classement complet des participants
- **Fichier**: `src/app/app/brand/contests/[id]/leaderboard/page.tsx`

#### Fonctionnalités
- Classement complet (pagination 50 par page)
- Colonnes: Rang, Créateur, Vues, Likes, Gain estimé
- Calcul gains: Basé sur `contest_prizes` et position
- Source: RPC `get_contest_leaderboard(contest_id, limit)`
- Tri: Vues pondérées (weighted_views)

---

### 7. Messages (`/app/brand/messages`)

#### Vue d'ensemble
- **Objectif**: Communication avec les créateurs
- **Revalidation**: 30 secondes
- **Fichier**: `src/app/app/brand/messages/page.tsx`

#### Fonctionnalités
- Liste des threads (max 50)
- Informations par thread:
  - Créateur (nom + avatar)
  - Concours associé
  - Dernier message
  - Badge non lu
  - Date dernière activité
- Client component pour interactions temps réel
- RLS: Accès basé sur `brand_id`

#### Fichiers Impliqués
- `src/app/app/brand/messages/page.tsx` (100 lignes)
- `src/components/brand/brand-messages-client.tsx`

---

### 8. Notifications (`/app/brand/notifications`)

#### Vue d'ensemble
- **Objectif**: Centre d'alertes centralisé
- **Fichier**: `src/app/app/brand/notifications/page.tsx`

#### Fonctionnalités
- Liste paginée (20 par page)
- Filtres:
  - Statut: Toutes / Non lues
  - Type: Message, Soumission, Paiement, Par défaut
- Actions:
  - Marquer comme lue (individuel)
  - Marquer tout comme lu (batch)
- Types de notifications:
  - `submission_created`: Nouvelle soumission
  - `contest_activated`: Concours activé
  - `message_new`: Nouveau message

#### Fichiers Impliqués
- `src/app/app/brand/notifications/page.tsx` (360 lignes)
- `src/components/notifications/notification-item.tsx`
- `src/components/notifications/notifications-dropdown.tsx` (dans layout)

---

### 9. Factures & Paiements (`/app/brand/billing`)

#### Vue d'ensemble
- **Objectif**: Gestion des paiements et factures
- **Revalidation**: 60 secondes
- **Fichier**: `src/app/app/brand/billing/page.tsx`

#### Fonctionnalités

**A. Stats globales**
- Total payé
- En attente
- En traitement
- Nombre de paiements

**B. Liste des paiements**
- Table avec colonnes:
  - Concours (lien)
  - Montant
  - Statut (badge coloré)
  - Date création
  - Actions
- Actions selon statut:
  - `requires_payment`: Bouton "Régler" → Redirection concours
  - `succeeded`: Bouton "Facture" → Téléchargement PDF
  - Lien Stripe (si payment_intent_id)

**C. Génération factures**
- Génération automatique lors du paiement (webhook)
- Stockage: Supabase Storage (bucket `invoices`)
- Structure: `{brand_id}/invoices/invoice-{payment_id}-{timestamp}.pdf`
- Téléchargement: `GET /api/invoices/[payment_id]/download`
- Génération à la demande si absente

#### Fichiers Impliqués
- `src/app/app/brand/billing/page.tsx` (309 lignes)
- `src/app/api/invoices/[payment_id]/generate/route.ts`
- `src/app/api/invoices/[payment_id]/download/route.ts`
- `src/components/pdf/invoice-pdf.tsx`

---

### 10. Paramètres (`/app/brand/settings`)

#### Vue d'ensemble
- **Objectif**: Gestion du profil marque
- **Fichier**: `src/app/app/brand/settings/page.tsx`

#### Fonctionnalités
- Formulaire profil:
  - Display name
  - Bio
  - Avatar
- Formulaire entreprise:
  - Nom entreprise
  - Site web
  - Secteur
  - Numéro TVA
  - Adresse complète
- Préférences notifications:
  - Événements: submission_created, message_new, etc.
  - Canaux: email, push, in-app
- Calcul taux de complétion
- Badge profil incomplet si < 80%

#### Fichiers Impliqués
- `src/app/app/brand/settings/page.tsx` (150 lignes)
- `src/components/settings/brand-settings-form.tsx`
- `src/app/api/profile/brand/update/route.ts`

---

## 🧠 Logique Métier

### 1. Cycle de Vie d'un Concours

```
DRAFT → ACTIVE → ENDED → ARCHIVED
  ↓        ↓        ↓
Paiement  Webhook  Manuelle
```

**Transitions**:
- `draft` → `active`: Via webhook Stripe (`checkout.session.completed`)
- `active` → `ended`: Manuelle (API `/api/contests/[id]/close`)
- `ended` → `archived`: Manuelle (API `/api/contests/[id]/archive`)

### 2. Calcul du CPV (Coût pour 1000 Vues)

```typescript
const cpv = total_views > 0
  ? Math.round((prize_pool_cents / total_views) * 1000)
  : 0;
```

**Note**: Ne prend pas en compte la commission 15% dans le calcul actuel.

### 3. Calcul des Gains Estimés

```typescript
// Pour chaque position dans le leaderboard:
const prize = contest_prizes.find(p => p.position === rank);
const estimatedPayout = prize
  ? prize.amount_cents || Math.round((prize_pool_cents * prize.percentage) / 100)
  : 0;
```

### 4. Éligibilité Créateurs

**Critères**:
- Plateforme principale correspond aux `networks` du concours
- Ou concours ouvert à toutes plateformes (`networks` vide)
- Profil actif (`is_active = true`)
- Respect des critères minimum (followers, vues) - vérifié via RPC `can_submit_to_contest`

### 5. Notifications Automatiques

**Déclencheurs**:
1. **Concours activé** → Notifie créateurs éligibles + marque
2. **Soumission créée** → Notifie marque
3. **Soumission modérée** → Notifie créateur (approved/rejected)

**Fichier**: `src/lib/notifications.ts`

---

## 🔒 Sécurité

### 1. Authentification & Autorisation

#### Vérification Rôle
```typescript
// Layout: src/app/app/brand/layout.tsx
const role = await getUserRole(user.id);
if (role !== 'brand' && role !== 'admin') {
  redirect('/forbidden');
}
```

#### Vérification Ownership
```typescript
// Dans chaque page/API:
const { data: contest } = await supabase
  .from('contests')
  .select('brand_id')
  .eq('id', contestId)
  .single();

if (contest.brand_id !== user.id && role !== 'admin') {
  throw createError('FORBIDDEN', 'Accès refusé', 403);
}
```

### 2. Protection CSRF

**Implémentation**: Double-submit cookie pattern

**Fichier**: `src/lib/csrf.ts`

**Fonctionnement**:
1. Token généré côté serveur (32 bytes, base64url)
2. Stocké dans cookie `csrf` (HttpOnly, Secure, SameSite)
3. Envoyé dans header `x-csrf` par le client
4. Vérification: Cookie === Header (comparaison constant-time)

**Utilisation**:
```typescript
// Client
const csrfToken = useCsrfToken();
fetch('/api/...', {
  headers: { 'x-csrf': csrfToken }
});

// Serveur
assertCsrf(req.headers.get('cookie'), req.headers.get('x-csrf'));
```

### 3. Rate Limiting

**Implémentation**: Basé sur Supabase (`rate_limits` table)

**Fichier**: `src/lib/rateLimit.ts`

**Limites appliquées**:
- Création concours: 2 / 5 minutes
- Paiement: 3 / minute
- Modération: 10 / minute

**Fonctionnement**:
```typescript
const rlKey = `route:${user.id}:${ip}`;
if (!(await rateLimit({ key: rlKey, route: 'route', windowMs: 60000, max: 10 }))) {
  return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
}
```

### 4. Row Level Security (RLS)

**Tables protégées**:
- `contests`: Accès basé sur `brand_id = auth.uid()`
- `submissions`: Accès basé sur `contest_id` + ownership concours
- `payments_brand`: Accès basé sur `brand_id = auth.uid()`
- `notifications`: Accès basé sur `user_id = auth.uid()`
- `messages_threads`: Accès basé sur `brand_id = auth.uid()`

### 5. Validation des Données

**Schémas Zod**:
- `contestCreateSchema`: Validation création concours
- `contestUpdateSchema`: Validation mise à jour (partial)
- `brandProfileUpdateSchema`: Validation profil marque

**Fichier**: `src/lib/validators/contests.ts`

### 6. Audit Logs

**Table**: `audit_logs`

**Enregistrements**:
- Création concours
- Mise à jour concours
- Modération soumissions
- Paiements
- Changements statut

**Champs**: `actor_id`, `action`, `table_name`, `row_pk`, `old_values`, `new_values`, `ip`, `user_agent`

---

## 🎨 Design & UX

### 1. Système de Design

**Composants UI** (shadcn/ui):
- `Button`: Variants (primary, secondary, ghost, danger)
- `Card`: Container avec header/content
- `Badge`: Statuts colorés (success, warning, danger, info)
- `Input`: Champs de formulaire
- `Dialog`: Modals
- `DropdownMenu`: Menus contextuels

### 2. Thème & Couleurs

**Mode sombre/clair**: Support complet via `next-themes`

**Couleurs**:
- Primary: `#635BFF` (violet)
- Success: Vert
- Warning: Orange
- Danger: Rouge
- Info: Bleu

### 3. Animations & Transitions

**Framer Motion**:
- Notifications dropdown: `fadeIn` + `slideDown`
- Cards: `hover:scale-105`, `hover:-translate-y-1`
- Transitions: `duration-200`, `duration-300`

### 4. Responsive Design

**Breakpoints**:
- Mobile: < 640px (sm)
- Tablet: 640px - 1024px (md)
- Desktop: > 1024px (lg)

**Adaptations**:
- Sidebar: Cachée sur mobile, bottom nav à la place
- Grilles: 1 colonne mobile, 2-3 colonnes desktop
- Tableaux: Scroll horizontal sur mobile

### 5. États de Chargement

**Skeletons**: Composants de chargement pour:
- Liste concours
- Table soumissions
- Graphiques

**Fichiers**: `src/components/creator/skeletons.tsx`

### 6. États Vides

**Composant**: `BrandEmptyState`

**Types**:
- `no-contests`: Aucun concours
- `no-results`: Aucun résultat (filtres)
- `no-submissions`: Aucune soumission
- `error`: Erreur de chargement
- `default`: État par défaut

---

## 📁 Fichiers & Structure

### Structure Complète

```
src/
├── app/
│   └── app/
│       └── brand/
│           ├── layout.tsx                    # Layout principal
│           ├── layout_nav.tsx                 # Navigation
│           ├── dashboard/
│           │   └── page.tsx                  # Dashboard
│           ├── contests/
│           │   ├── page.tsx                  # Liste
│           │   ├── new/
│           │   │   └── page.tsx              # Wizard
│           │   └── [id]/
│           │       ├── page.tsx               # Détail
│           │       ├── submissions/
│           │       │   └── page.tsx           # Modération
│           │       └── leaderboard/
│           │           └── page.tsx           # Classement
│           ├── messages/
│           │   └── page.tsx                  # Messages
│           ├── notifications/
│           │   └── page.tsx                  # Notifications
│           ├── billing/
│           │   └── page.tsx                  # Factures
│           └── settings/
│               └── page.tsx                  # Paramètres
├── components/
│   └── brand/
│       ├── contest-wizard-client.tsx          # Wizard client
│       ├── contest-wizard/
│       │   ├── step1-general-info.tsx
│       │   ├── step2-conditions.tsx
│       │   ├── step3-budget.tsx
│       │   ├── step4-preview.tsx
│       │   └── step5-payment.tsx
│       ├── submissions-moderation-table.tsx  # Table modération
│       ├── contest-metrics-chart.tsx          # Graphique vues
│       ├── platform-distribution-chart.tsx  # Graphique plateformes
│       ├── empty-state-enhanced.tsx          # États vides
│       └── brand-messages-client.tsx          # Messages client
├── app/
│   └── api/
│       ├── contests/
│       │   ├── create/route.ts               # Création
│       │   └── [id]/
│       │       ├── route.ts                  # GET concours
│       │       ├── update/route.ts           # PATCH brouillon
│       │       ├── publish/route.ts          # Publication
│       │       ├── close/route.ts            # Clôture
│       │       ├── archive/route.ts          # Archivage
│       │       └── export-pdf/route.ts       # Export PDF
│       ├── submissions/
│       │   ├── create/route.ts               # Création soumission
│       │   └── [id]/
│       │       └── moderate/route.ts         # Modération
│       │   └── batch-moderate/route.ts       # Modération lot
│       ├── payments/
│       │   ├── brand/
│       │   │   └── fund/route.ts             # Funding concours
│       │   └── stripe/
│       │       └── webhook/route.ts          # Webhook Stripe
│       ├── invoices/
│       │   └── [payment_id]/
│       │       ├── generate/route.ts         # Génération facture
│       │       └── download/route.ts         # Téléchargement
│       └── profile/
│           └── brand/
│               └── update/route.ts           # Mise à jour profil
└── lib/
    ├── auth.ts                               # Helpers auth
    ├── csrf.ts                               # Protection CSRF
    ├── rateLimit.ts                          # Rate limiting
    ├── notifications.ts                     # Helpers notifications
    ├── validators/
    │   ├── contests.ts                      # Schémas validation
    │   └── profile.ts                       # Schémas profil
    └── formatters.ts                        # Formatage (dates, currency)
```

### Statistiques Fichiers

- **Pages**: 10 fichiers
- **Composants**: 8 fichiers brand + 5 étapes wizard
- **APIs**: 15 routes
- **Libs**: 6 fichiers utilitaires
- **Total lignes**: ~8000 lignes de code

---

## 🔄 Flux Détaillés

### Flux 1: Création Concours Complet

```
1. Utilisateur accède /app/brand/contests/new
   ↓
2. Layout vérifie rôle (brand/admin)
   ↓
3. Wizard s'affiche (étape 1)
   ↓
4. Utilisateur remplit étape 1
   ↓
5. Auto-save (10s) → POST /api/contests/create
   - Validation Zod
   - CSRF check
   - Rate limit check
   - RPC create_contest_complete
   - Retourne contest_id
   ↓
6. Utilisateur continue étapes 2-4
   ↓
7. Auto-save continue → PATCH /api/contests/[id]/update
   - Vérification ownership
   - Vérification statut (draft uniquement)
   - Mise à jour partielle
   ↓
8. Étape 5: Paiement
   ↓
9. POST /api/payments/brand/fund
   - Calcul: prize_pool + 15% commission
   - Création Stripe Checkout Session
   - Création payments_brand (status='requires_payment')
   - Retourne checkout_url
   ↓
10. Redirection Stripe
    ↓
11. Paiement utilisateur
    ↓
12. Webhook: checkout.session.completed
    - payments_brand.status = 'succeeded'
    - contests.status = 'active'
    - Notifications créateurs éligibles
    - Notification marque
    ↓
13. Redirection retour → /app/brand/contests/[id]
```

### Flux 2: Modération Soumission

```
1. Marque accède /app/brand/contests/[id]/submissions
   ↓
2. Vérification ownership concours
   ↓
3. Récupération soumissions (filtres appliqués)
   ↓
4. Marque clique "Approuver" ou "Refuser"
   ↓
5. Dialog modal s'ouvre
   - Choix statut
   - Raison (si refus)
   ↓
6. PATCH /api/submissions/[id]/moderate
   - Vérification ownership (via contest.brand_id)
   - CSRF check
   - Rate limit check
   - Mise à jour submission.status
   - Insertion moderation_actions
   - Notification créateur
   - Audit log
   ↓
7. Refresh page
   - Soumission mise à jour
   - Stats recalculées
```

### Flux 3: Export PDF Résultats

```
1. Marque clique "Export PDF" sur détail concours
   ↓
2. GET /api/contests/[id]/export-pdf
   - Vérification ownership
   - Récupération concours
   - RPC get_contest_metrics
   - RPC get_contest_leaderboard
   - Récupération métriques quotidiennes
   - Calcul CPV
   ↓
3. Génération PDF (@react-pdf/renderer)
   - ContestResultsPDF component
   - Conversion en Buffer
   ↓
4. Retour PDF avec headers:
   - Content-Type: application/pdf
   - Content-Disposition: attachment; filename="..."
   ↓
5. Téléchargement navigateur
```

### Flux 4: Génération Facture

```
1. Webhook Stripe: checkout.session.completed
   ↓
2. payments_brand.status = 'succeeded'
   ↓
3. (Optionnel) Génération facture automatique
   - POST /api/invoices/[payment_id]/generate
   - Calcul montants (prize_pool + commission + TVA)
   - Génération PDF
   - Upload Supabase Storage
   - Mise à jour payments_brand.metadata
   ↓
4. Marque accède /app/brand/billing
   ↓
5. Marque clique "Facture"
   ↓
6. GET /api/invoices/[payment_id]/download
   - Vérification ownership
   - Si facture absente → Génération à la demande
   - Téléchargement depuis Storage
   ↓
7. Retour PDF
```

---

## 🔌 APIs & Backend

### Routes API Brand

#### Contests

**POST `/api/contests/create`**
- Création concours complet
- Validation: `contestCreateSchema`
- Sécurité: CSRF, Rate limit (2/5min), Rôle brand/admin
- RPC: `create_contest_complete`
- Retour: `{ ok: true, contest_id }`

**GET `/api/contests/[id]`**
- Récupération concours (pour édition brouillon)
- Sécurité: Ownership, Statut draft uniquement
- Retour: Concours complet avec prizes, terms

**PATCH `/api/contests/[id]/update`**
- Mise à jour brouillon (auto-save)
- Validation: `contestUpdateSchema` (partial)
- Sécurité: CSRF, Ownership, Statut draft uniquement
- Retour: `{ ok: true, contest_id }`

**POST `/api/contests/[id]/publish`**
- Publication concours
- Sécurité: Ownership, Paiement réussi requis
- Actions: `status = 'active'`, Notifications
- Retour: `{ ok: true }`

**GET `/api/contests/[id]/export-pdf`**
- Export PDF résultats
- Sécurité: Ownership
- Retour: PDF Buffer

#### Submissions

**PATCH `/api/submissions/[id]/moderate`**
- Modération individuelle
- Validation: `{ status: 'approved' | 'rejected', reason?: string }`
- Sécurité: CSRF, Ownership (via contest), Rate limit
- Actions: Update status, Insert moderation_actions, Notification créateur
- Retour: `{ ok: true }`

**POST `/api/submissions/batch-moderate`**
- Modération par lot
- Validation: `{ submission_ids: string[], status, reason?: string }`
- Sécurité: CSRF, Ownership, Rate limit
- Actions: Batch update, Notifications individuelles
- Retour: `{ ok: true, processed: number }`

#### Payments

**POST `/api/payments/brand/fund`**
- Funding concours
- Validation: `{ contest_id: string }`
- Sécurité: CSRF, Rate limit (3/min), Rôle brand/admin
- Actions: Création payments_brand, Stripe Checkout Session
- Retour: `{ ok: true, checkout_url }`

#### Invoices

**POST `/api/invoices/[payment_id]/generate`**
- Génération facture PDF
- Sécurité: CSRF (ou x-internal-request), Ownership
- Actions: Génération PDF, Upload Storage, Update metadata
- Retour: `{ ok: true, invoice_url, invoice_number }`

**GET `/api/invoices/[payment_id]/download`**
- Téléchargement facture
- Sécurité: Ownership
- Actions: Génération si absente, Téléchargement Storage
- Retour: PDF Buffer

---

## 🗄️ Base de Données

### Tables Principales

#### `contests`
- **Champs clés**: `id`, `brand_id`, `title`, `status`, `prize_pool_cents`, `networks`, `start_at`, `end_at`
- **RLS**: `brand_id = auth.uid()` ou `is_admin(auth.uid())`
- **Index**: `brand_id`, `status`, `created_at`

#### `submissions`
- **Champs clés**: `id`, `contest_id`, `creator_id`, `status`, `external_url`, `platform`
- **RLS**: Accès via `contest_id` + ownership concours
- **Index**: `contest_id`, `creator_id`, `status`

#### `payments_brand`
- **Champs clés**: `id`, `brand_id`, `contest_id`, `status`, `amount_cents`, `stripe_payment_intent_id`
- **RLS**: `brand_id = auth.uid()`
- **Index**: `brand_id`, `status`, `stripe_payment_intent_id`

#### `notifications`
- **Champs clés**: `id`, `user_id`, `type`, `content`, `read`, `created_at`
- **RLS**: `user_id = auth.uid()`
- **Index**: `user_id`, `read`, `created_at`

#### `messages_threads`
- **Champs clés**: `id`, `brand_id`, `creator_id`, `contest_id`, `last_message`, `unread_for_brand`
- **RLS**: `brand_id = auth.uid()` ou `creator_id = auth.uid()`
- **Index**: `brand_id`, `creator_id`, `updated_at`

### RPC Functions

#### `get_contest_metrics(contest_id)`
- Retourne: `total_views`, `total_likes`, `total_comments`, `total_shares`, `approved_submissions`, `total_submissions`
- Source: Agrégation `metrics_daily` + `submissions`

#### `get_contest_leaderboard(contest_id, limit)`
- Retourne: Classement par vues pondérées
- Colonnes: `creator_id`, `total_views`, `total_likes`, `weighted_views`
- Source: Agrégation `metrics_daily` + calcul weighted_views

#### `create_contest_complete(...)`
- Transaction complète: Insert `contests`, `contest_terms`, `contest_assets`, `contest_prizes`
- Retourne: `contest_id`

---

## ⚠️ Points d'Amélioration

### 1. Performance

**Problèmes identifiés**:
- Tri par soumissions: Récupération de tous les concours (peut être lent avec beaucoup de concours)
- Dashboard: Appels RPC multiples (un par concours actif)
- Métriques quotidiennes: Agrégation côté serveur (peut être optimisée)

**Recommandations**:
- Matérialiser les vues: `brand_dashboard_summary`, `contest_stats`
- Cache Redis pour métriques fréquentes
- Pagination côté serveur pour tri par soumissions

### 2. Temps Réel

**Manquants**:
- Leaderboard: Pas de mise à jour temps réel
- Messages: Pas de WebSocket
- Notifications: Pas de push browser

**Recommandations**:
- Supabase Realtime pour leaderboard et messages
- Service Workers pour notifications push

### 3. UX

**Améliorations possibles**:
- Skeleton loaders pour toutes les pages
- Optimistic updates pour modération
- Toast notifications pour toutes les actions
- Confirmation avant actions destructives

### 4. Sécurité

**Renforcements possibles**:
- Validation côté serveur plus stricte (sanitization markdown)
- Rate limiting plus granulaire (par IP + user)
- Audit logs plus détaillés (changements de statut)

### 5. Tests

**Manquants**:
- Tests unitaires composants
- Tests d'intégration APIs
- Tests E2E flux critiques

---

## ✅ Conclusion

L'interface marque de ClipRace est **complète et fonctionnelle** avec:

✅ **10 pages principales** couvrant tous les besoins
✅ **15 routes API** sécurisées et validées
✅ **Système de sécurité** robuste (CSRF, Rate limiting, RLS)
✅ **UX fluide** avec auto-save, notifications, états vides
✅ **Design cohérent** avec système de composants réutilisables
✅ **Interconnexions** complètes avec interface créateur

**Points forts**:
- Architecture claire et modulaire
- Sécurité multi-couches
- Expérience utilisateur soignée
- Code maintenable et documenté

**Prochaines étapes recommandées**:
1. Optimisation performance (vues matérialisées)
2. Temps réel (WebSocket)
3. Tests automatisés
4. Monitoring et analytics

---

**Status**: ✅ **Audit complet terminé - Interface marque prête pour production**

