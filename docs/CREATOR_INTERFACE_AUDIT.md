# ClipRace – Audit de l’interface créateur (v1.0) 🧩🎬

Ce document résume l’état actuel de l’espace **créateur** de ClipRace côté front (Next.js) et son alignement avec la refonte Supabase (`db_refonte`). Il sert de référence technique et produit d’audit (sécurité, UX, connexion à la base).

---

## 1. Périmètre et architecture

### 1.1. Périmètre

Espace concerné : toutes les pages sous `src/app/app/creator` et les composants partagés utilisés par ces pages.

Pages principales (toutes enveloppées par `CreatorLayout`) :

- `src/app/app/creator/layout.tsx` – Shell créateur (sidebar, topbar, bottom nav mobile)
- `dashboard/page.tsx` – Dashboard créateur
- `discover/page.tsx` – Page “Découvrir les concours” (listing)
- `contests/[id]/page.tsx` – Détail concours côté créateur
- `contests/[id]/participate/page.tsx` – Participation à un concours
- `contests/[id]/leaderboard/page.tsx` – Classement créateur (leaderboard)
- `submissions/page.tsx` – Liste des soumissions du créateur
- `wallet/page.tsx` – Portefeuille / gains créateur
- `notifications/page.tsx` – Centre de notifications créateur
- `messages/page.tsx` – Discussions (threads brand–creator)
- `settings/*` – Paramètres / profil créateur (non détaillé ici mais inclus dans le shell)
- `faq/page.tsx` – FAQ créateur

Composants transverses notables :

- Navigation : `CreatorNav`, `CreatorBreadcrumbs`
- Thème & notifications : `ThemeToggle`, `NotificationsDropdown`
- UI générique : `Button`, `Card`, `Badge`, `Input`, `Skeleton`, etc.
- Contests : `DiscoverPageClient`, `DiscoverFilters`, `ContestCard` & co.
- Submissions : `SubmissionForm`, `SubmissionsTable`
- Wallet : `WalletBalance`
- Empty states : `EmptyState`
- Analytics : `TrackOnView`
- Formatage : `src/lib/formatters.ts`

Back-end / Supabase :

- Auth & profils : `db_refonte/02_profiles.sql`, `src/lib/auth.ts`
- Concours : `db_refonte/03_contests.sql`
- Soumissions & métriques : `db_refonte/04_submissions_metrics.sql`
- Paiements & cashouts : `db_refonte/05_payments_cashouts.sql`
- Messagerie & notifications : `db_refonte/07_messaging_notifications.sql`
- Gains : `db_refonte/25_contest_prizes_winnings.sql`
- Fonctions métier : `db_refonte/09_functions_business.sql`
- RLS globales : `db_refonte/11_rls_policies.sql`
- Client Supabase SSR : `src/lib/supabase/ssr.ts`

---

## 2. Auth, sécurité et RLS

### 2.1. Auth côté Next.js

**Fonctions clés :** `src/lib/auth.ts`

- `getSession()` :
  - Utilise `getSupabaseSSR()` (client Supabase SSR basé sur les cookies).
  - Appelle `supabase.auth.getUser()` pour récupérer l’utilisateur courant.
  - Si JWT invalide/expiré → `supabase.auth.signOut()` pour nettoyer la session.
  - Charge le profil dans `profiles` via RLS (client anon).
  - Si RLS bloque ou profil manquant → fallback `getSupabaseAdmin()` (service role).
  - Vérifie `is_active` et `onboarding_complete`.
  - Retourne un `SessionUser` typé (id, email, role, display_name, avatar_url, is_active, onboarding_complete).

- `getUserRole(userId)` :
  - Lit `profiles(role)` via SSR anon, puis fallback service role si besoin.
  - Utilisé dans `CreatorLayout` pour valider le rôle.

- `requireRole(required)` :
  - Helper pour API/routes sensibles (non utilisé dans tous les handlers, mais disponible).

### 2.2. Garde d’accès de l’espace créateur

**Fichier :** `src/app/app/creator/layout.tsx`

- Appelle `getSession()` :
  - Si `error` ou `user` nul → `redirect('/auth/login')`.
- Puis `getUserRole(user.id)` :
  - Si `role` n’est pas `creator` ni `admin` → `redirect('/forbidden')`.

Conséquence : **toutes** les pages sous `/app/creator/*` sont protégées côté serveur (App Router), même si une page était appelée directement sans check local.

### 2.3. RLS & schéma Supabase (extraits pertinents)

**Profils :** `db_refonte/02_profiles.sql` + `11_rls_policies.sql`

- Tables : `profiles`, `profile_creators`, `profile_brands`
- Policies :
  - `profiles_*_own` / `profile_creators_*_own` / `profile_brands_*_own` :
    - `auth.uid() = id` ou `user_id` (CRUD limité à soi-même).
  - `*_admin_all` : accès complet pour `public.is_admin(auth.uid())`.
  - `profile_creators_public_read` : lecture publique des profils créateurs (sans email).
  - `profiles_public_read_active` est volontairement commentée pour éviter d’exposer les emails.

**Concours :** `db_refonte/03_contests.sql` + `11_rls_policies.sql`

- Table `contests` : `status`, `start_at`, `end_at`, `networks platform[]`, `prize_pool_cents`, `contest_terms_id`, etc.
- Policies :
  - Brand : `contests_brand_manage_own` (CRUD limité à ses concours).
  - Admin : `contests_admin_all`.
  - Public : `contests_public_read_active` (status `active` + fenêtre de dates).
  - Creator : `contests_creator_read_for_participation` (lecture `active`/`ended`, `start_at <= now_utc()`).

**Submissions :** `db_refonte/04_submissions_metrics.sql` + `11_rls_policies.sql`

- Policies :
  - `submissions_creator_manage_own` : `auth.uid() = creator_id` (CRUD complet mais limité à soi).
  - `submissions_creator_insert_requires_terms` : impose que le créateur ait accepté la bonne version des CGU (`contest_terms`) avant `INSERT` si le concours y est lié.
  - `submissions_brand_read_own_contests` : lecture en fonction du `brand_id` du concours.
  - `submissions_admin_all` : accès admin complet.

**Notifications & messages :** `db_refonte/07_messaging_notifications.sql` + `11_rls_policies.sql`

- Tables : `messages_threads`, `messages`, `notifications` avec RLS activée.
- Policies :
  - Threads : accès basé sur `brand_id` et `creator_id` (via `auth.uid()`).
  - Messages : `sender_id` + inclusion dans un thread autorisé.
  - Notifications : `user_id = auth.uid()`.

**Gains & cashouts :** `db_refonte/25_contest_prizes_winnings.sql`, `05_payments_cashouts.sql`

- `contest_winnings` RLS : accès créateur restreint aux lignes où `creator_id = auth.uid()` (et policies supplémentaires pour les marques/admins).
- `cashouts` : accès basé sur `creator_id`.

### 2.4. Fonctions métier (RPC) utilisées côté créateur

**Fichier :** `db_refonte/09_functions_business.sql`

- `public.is_contest_active(p_contest_id uuid)`
  - Check sur `status = 'active'`, `start_at <= now_utc()`, `end_at >= now_utc()`.
  - Utilisée dans `contests/[id]/participate/page.tsx` pour déterminer si le concours est actif côté serveur (et non juste par heuristique client).

- `public.can_submit_to_contest(...)` (définie dans les fichiers RPC liés aux submissions)
  - Vérifie que le créateur peut participer (RLS, double soumission, éligibilité, CGU).
  - Utilisée dans `ParticipatePage` via `supabase.rpc('can_submit_to_contest', { p_contest_id, p_user_id })`.

D’autres fonctions (compute_payouts, get_contest_leaderboard, get_contest_metrics) servent surtout au leaderboard et à la partie marque, mais garantissent un calcul cohérent des gains et scores.

---

## 3. Connexion Supabase & alignement `db_refonte`

### 3.1. Client Supabase SSR

**Fichier :** `src/lib/supabase/ssr.ts`

- `getSupabaseSSR()` :
  - Utilise `createServerClient` de `@supabase/ssr` avec les cookies Next.
  - Ne modifie pas les cookies (lecture uniquement) → adapté aux server components.

- `getSupabaseSSRWithResponse(req, res)` :
  - Variante pour les routes qui doivent écrire/effacer les cookies (auth sign-in/up/out).

Tous les accès créateur aux données (dashboard, discover, submissions, wallet, notifications page, etc.) passent par `getSupabaseSSR()`, ce qui garantit :

- Respect des RLS (session utilisateur)’
- Pas d’exposition de la service key côté client.

### 3.2. Tables réellement utilisées par l’espace créateur

- `profiles` / `profile_creators` : rôle, email, display_name, `primary_platform`, followers, avg_views…
  - Utilisé dans `getSession`, `CreatorLayout`, `SubmissionsPage`, onboarding, etc.

- `contests` : title, slug, brief_md, cover_url, status, start_at, end_at, networks, prize_pool_cents, contest_terms_id…
  - Utilisé dans : `discover/page.tsx`, `contests/[id]/page.tsx`, `contests/[id]/participate/page.tsx`, leaderboard, API eligibility.

- `submissions` + métriques : listes et details des participations créateur (via `SubmissionsTable` et RPC).

- `contest_winnings` et `contest_prizes` : calculs et affichage des gains (wallet + nav).

- `cashouts` : retraits du créateur (wallet + calcul du solde disponible affiché dans le layout et la page wallet).

- `notifications` : compte non lues (layout) + listing complet (page notifications) + dropdown topbar.

Alignement : aucun champ “fantôme”, et les requêtes côté front respectent la structure définie dans `db_refonte/*.sql`.

---

## 4. UX & flows principaux

### 4.1. Layout global créateur (`CreatorLayout`)

- Sidebar desktop (`CreatorNav`) + bottom nav mobile (`CreatorNav` en mode `variant="bottom"`).
- Topbar sticky avec :
  - `CreatorBreadcrumbs` (chemin dans l’app),
  - `ThemeToggle` (dark/light) et `NotificationsDropdown`,
  - bouton profil (icone `User` agrandie) menant aux settings.
- Bandeau onboarding : `Banner` affiché si `profileIncomplete` (absence de `primary_platform` dans `profile_creators`).
- Comptage des notifications non lues (`unreadCount`) et du solde disponible (en centimes) calculé à partir de `contest_winnings` et `cashouts`.
- **Nettoyage récent :** le bandeau de statuts “Actif / À faire / Alertes” a été entièrement supprimé du code (plus de `statusSegments`).

### 4.2. Dashboard créateur

- Accroche : “Bienvenue, {firstName}” avec CTA “Découvrir les concours” et “Mes soumissions”.
- Carte “Prochaine échéance” :
  - Affiche le prochain concours `next_contest` avec date de fin formatée (`formatDate`), statut, CTA participer/voir, et message d’éligibilité si non éligible.
- Carrousel concours actifs : `ActiveContestsCarousel` (Suspense + skeleton).
- Stat cards : participations, en compétition, vues cumulées, gains cumulés (`formatCurrency`).
- To-do list : construit dynamiquement en fonction de `profileIncomplete`, `submissions_count`, `unread_notifications`, `total_earnings_cents`.
- Réseau de notifications et conseils (tips) pour guider l’usage.

### 4.3. Page Discover / Concours

- Server component : `discover/page.tsx` :
  - Paramètres de recherche et filtres récupérés depuis `searchParams` (status, sort, query, plateformes…).
  - Fetch via Supabase des concours correspondants (avec pagination, filtrage par plateformes et tri).
  - Envoie `contests`, `total`, `profileIncomplete` à `DiscoverPageClient`.

- Client shell : `DiscoverPageClient` :
  - Gère les filtres et la pagination via `router.replace` et `URLSearchParams` (sans rechargement complet).
  - Utilise `DiscoverFilters` (voir ci-dessous) et affiche :
    - une info “X concours trouvés”,
    - un grid de `ContestCard` avec animations framer-motion,
    - un `EmptyState` différencié selon présence de filtres ou non (avec CTA réinitialisation ou “Compléter mon profil”).  

- Composant `DiscoverFilters` :
  - Filtres gérés :
    - Search (input avec icône Search, placeholder “Rechercher”, croix pour clear).
    - Plateformes (TikTok, Instagram, YouTube) avec boutons stylés.
    - Statut (Actifs, À venir, Terminés).
    - Tri (Fin proche, Prize pool, Nouveaux).
    - Bouton “Effacer” quand des filtres sont actifs.
  - **Nettoyage récent :**
    - Texte `(Ctrl/Cmd + K)` et bloc “Éligibilité estimée / Compléter le profil” supprimés du composant (plus seulement masqués).  

### 4.4. Participation concours

**Fichier :** `contests/[id]/participate/page.tsx`

- États gérés :
  - Concours introuvable → `EmptyState` avec CTA “Retour aux concours”.
  - Concours terminé (`isEnded` ou status `ended/archived`) → `EmptyState` spécifique.
  - Non éligible :
    - Utilise `is_contest_active` + `can_submit_to_contest` pour déterminer `canSubmit`.
    - Affiche les raisons d’inéligibilité (followers min, vues min, statut).
  - Éligible :
    - Stepper (3 étapes “Vérifier mon éligibilité / Coller le lien / Confirmer et envoyer”).
    - Bloc rappel des règles (formats acceptés, 1 soumission max).
    - `SubmissionForm` pour la soumission avec validations.
- Dates :
  - Affichage du “Fin le …” maintenant centralisé via `formatDate(contest.end_at)`.

### 4.5. Soumissions (`submissions/page.tsx`)

- Filtres :
  - Par statut (Tous, En attente, En compétition, Refusées).
  - Par concours (select) + barre de recherche (par titre).
  - Pagination via paramètres `page`.
- Bandeau pédagogique expliquant chaque statut (En attente, En compétition, Refusée, Retirée).
- Stat cards pour chaque statut.
- `SubmissionsTable` pour la liste détaillée, avec empty state et CTA vers concours si aucune participation.

### 4.6. Wallet (`wallet/page.tsx`)

- Fonction `getWalletData(userId)` :
  - Charge `contest_winnings` et `cashouts` pour le créateur.
  - Calcule : `balance_cents`, `total_earnings_cents`, `withdrawn_cents`, `pending_cents`, `average_processing_days`.
  - Transforme les résultats pour `WalletBalance` (incluant le titre de concours via la relation `contest:contest_id (title)`).
- UI :
  - Titre “Mon portefeuille” + sous-texte.
  - Empty state si aucun gain ni cashout.
  - Sinon rendu complet via `WalletBalance` (graphique ou listes, selon implémentation du composant).

### 4.7. Notifications

- Dropdown topbar : `NotificationsDropdown` :
  - Bouton icône `Bell` (taille harmonisée avec les icônes thème/profil).
  - Fetch des dernières notifications via `/api/notifications?limit=5` (cache `no-store`).
  - Permet de marquer toutes les notifications comme lues (POST `/api/notifications/read`).  
  - Affiche titre, message et date (`formatDate(item.created_at)`).

- Page `/app/creator/notifications` :
  - Filtre par statut (toutes / non lues) et type (paiements, soumissions, messages, par défaut) via `searchParams`.
  - Affiche un `Card` par jour contenant un groupe de notifications.
  - Double bouton “Marquer comme lu” (top + dans la barre de filtres).
  - Pagination bas de page.

---

## 5. Utilitaires & cohérence formatage

**Fichier :** `src/lib/formatters.ts`

- `formatCurrency(amountCents, currency)` :
  - Utilise `Intl.NumberFormat('fr-FR', { style: 'currency', currency, minimumFractionDigits: 0 })`.
  - Convertit des centimes en montants affichables.
  - Utilisé dans dashboard, détail concours, wallet, navigation (badge “Gains”).

- `formatDate(date, options?, locale = 'fr-FR')` :
  - Accepte `string | number | Date | null | undefined`.
  - Retourne `'-'` si date nulle ou invalide.
  - Format par défaut : `jour 2 chiffres + mois abrégé + année` en français.
  - Remplace les `new Date(...).toLocaleDateString('fr-FR')` dans :
    - `dashboard/page.tsx` (prochaine échéance, cartes concours),
    - `contests/[id]/page.tsx` (détail concours),
    - `contests/[id]/participate/page.tsx` (dates de fin),
    - `components/notifications/notifications-dropdown.tsx` (dates de notifications).

- `formatDateTime(date, options?, locale = 'fr-FR')` :
  - Identique à `formatDate` mais avec heure/minute par défaut.
  - Disponibles pour unifier l’affichage des timestamps (notifications/messages) si nécessaire.

Grâce à ces utilitaires, tout affichage de date/monnaie dans l’espace créateur peut être modifié en un seul point.

---

## 6. Changements récents (nettoyage & UI)

Les ajustements suivants ont été faits spécifiquement dans le contexte de cet audit :

1. **Nettoyage du header créateur :**
   - Suppression complète du tableau `statusSegments` et du code d’affichage des badges “Actif / À faire / Alertes” dans `CreatorLayout`.
   - Le header n’affiche plus que les breadcrumbs et les icônes (thème / notifications / profil).

2. **Suppression du bloc “Éligibilité estimée” :**
   - Suppression (pas seulement masquage) du bloc UI « Éligibilité estimée – Compléter le profil pour des recommandations précises » dans `DiscoverFilters`.
   - Nettoyage des imports inutiles (icônes et `Badge`) et de la prop `profileIncomplete` dans ce composant.
   - Conservation de `profileIncomplete` uniquement dans `DiscoverPageClient` pour les empty states (CTA “Compléter mon profil”).

3. **Harmonisation des icônes topbar :**
   - `ThemeToggle` : icônes `Sun` / `Moon` en `h-8 w-8` dans un bouton `h-10 w-10`.
   - `NotificationsDropdown` : icône `Bell` en `h-8 w-8` dans un bouton `h-10 w-10`.
   - Bouton profil dans le layout : `User` en `h-10 w-10` dans un bouton `h-12 w-12`.

4. **Centralisation du formatage de dates :**
   - Ajout de `formatDate` / `formatDateTime` dans `src/lib/formatters.ts`.
   - Remplacement des `toLocaleDateString('fr-FR')` dans les pages créateur et le dropdown de notifications.

---

## 7. Pistes d’amélioration futures

Quelques axes pour aller encore plus loin :

- Ajouter des tests d’intégration ciblés (Playwright ou Testing Library) sur :
  - participation à un concours,
  - navigation discover + filtres,
  - affichage du wallet (avec données simulées),
  - centre de notifications.

- Uniformiser tous les timestamps (notifications, messages) avec `formatDateTime` pour avoir des dates/heures cohérentes.

- Documenter les principaux événements analytics (`TrackOnView`) dans un fichier dédié (ex. `docs/ANALYTICS_EVENTS.md`) pour faciliter l’analyse produit.

- Harmoniser encore davantage les wording d’empty states (ton, longueur, style) dans tout l’espace créateur.

Ce document peut servir de base pour les reviews futures (sécurité, DX, refonte UI) et pour synchroniser le back (db_refonte) avec le front lorsque de nouvelles fonctionnalités créateurs seront ajoutées.

