# Audit Approfondi – Espace Créateur ClipRace (Février 2026)

**Objectif :** Transformer l’espace Créateur en référence UX/UI niveau Uber (fluidité) × Revolut (fintech, premium).  
**Périmètre :** `src/app/app/creator` + composants associés (`src/components/creator`, `contest`, `submission`, `wallet`).  
**Livrable :** État actuel, points de friction, vision cible par page, composants techniques manquants.

---

## 1. Structure globale

### 1.1 `layout.tsx` (Shell créateur)

| Critère | État | Détail |
|--------|------|--------|
| **Note /10** | **7** | Solide côté garde d’accès et données layout ; header/barre peu “premium”. |
| Garde d’accès | ✅ | `getSession()` + `getUserRole()` ; redirect `/forbidden` si rôle ≠ creator/admin. |
| Données layout | ✅ | Solde (winnings/cashouts), unread notifications, `profileIncomplete` pour banner. |
| Effets visuels | Partiel | Sidebar : `bg-card/60 backdrop-blur-xl`, header : `bg-background/80 backdrop-blur-xl`, bottom nav : `bg-card/95 backdrop-blur-xl`. Pas de gradient hero ni bento. |
| Navigation | ⚠️ | Liens `<Link>` standards : pas de View Transitions API, rechargement full page entre routes. |
| Responsive | ✅ | Sidebar desktop, bottom nav mobile (6 colonnes), safe-area. |

**Points de friction :**
- Pas de transition partagée entre pages (pas de “morph” header/sidebar).
- Header minimal (breadcrumbs + theme + notifications + avatar) : peu de hiérarchie visuelle type “app”.
- Données sensibles (balance, cashouts) chargées en layout à chaque navigation : coût serveur et pas de cache client pour feeling “instantané”.

**Vision cible :**
- Shell “app native” : header avec gradient discret, possible sous-navigation par section (ex. Concours → Découvrir / Mes participations).
- View Transitions (Next.js ou `view-transitions`) sur changement de page pour éviter flash blanc.
- Données “résumé wallet” optionnel en client (SWR/React Query) après hydratation pour affichage immédiat des badges.

---

### 1.2 Navigation : `layout_nav.tsx` (pas de `Header.tsx` dédié)

| Critère | État | Détail |
|--------|------|--------|
| **Note /10** | **6,5** | Fonctionnel et lisible ; peu de micro-interactions. |
| Rôle | ✅ | Sidebar + bottom nav avec `CreatorNav`, états actif/hover. |
| Animations | Partiel | `transition-colors duration-200`, `scale-110` / `scale-105` sur icônes, `motion-safe:will-change-transform`. Pas de framer-motion. |
| Badges | ✅ | `badgeCount` (solde, notifications), tooltips sidebar. |

**Points de friction :**
- Changement d’onglet = rechargement complet de la page ; pas de préchargement ou de transition.
- Bottom nav 6 items peut être chargé sur mobile ; pas de “active state” animé type indicateur sliding.
- Pas de composant “Header” réutilisable documenté : le header est inline dans le layout.

**Vision cible :**
- Indicateur actif animé (trait ou fond) avec `framer-motion` ou CSS (transform + transition).
- Préchargement des routes principales au hover/focus (Next.js prefetch déjà actif, à garder).
- Option : réduire à 5 items en bottom nav + “Plus” pour Profil/Paramètres.

---

## 2. Pages clés

### 2.1 Discover (`discover/page.tsx` + `DiscoverPageClient`)

| Critère | État | Détail |
|--------|------|--------|
| **Note /10** | **7,5** | Meilleure page côté data (Server Components + filtres) et rendu cartes. |
| Data loading | ✅ | Server Component : `fetchContests()` dans la page ; pas de waterfall inutile. |
| Filtres | ✅ | `DiscoverPageClient` : URL sync (search, platforms, status, sort, page), `useTransition` pour navigation sans scroll reset. |
| Liste vs cartes | ✅ | Grille de `ContestCard` (cover, badge, prize, CTA), pas de simple tableau. |
| Animations | ✅ | `framer-motion` : entrée liste, AnimatePresence loading/empty/grid, stagger sur cartes. |
| SEO / revalidate | ✅ | `revalidate = 60`, contenu server-rendu. |

**Points de friction :**
- Filtres en barre sticky : pas de transition de contenu (ex. slide) quand on change de filtre ; `isPending` affiche des skeletons mais remplace toute la grille.
- Pas d’Optimistic UI sur “Participer” : le CTA mène à la page concours, pas d’action directe “Join” depuis la carte.
- Hero “Découvre les concours” : bloc unique `cliprace-surface` ; pas de bento ou de mise en avant “concours du jour”.
- Pagination : boutons Précédent/Suivant uniquement ; pas de scroll infini ni de transition de page.

**Vision cible :**
- Bento Discover : bandeau “À la une” (1–2 concours mis en avant) + grille “Tous les concours” avec filtres en chips animés.
- Transition douce du contenu au changement de filtre (crossfade ou slide) sans tout remplacer par des skeletons.
- Option : “Rejoindre” / “Participer” depuis la carte avec modal ou drawer (eligibility check + redirection) pour feeling “one tap”.
- Composant manquant : `DiscoverBento`, `ContestSpotlightCard`, transition de liste (layout animation).

---

### 2.2 Wallet (`wallet/page.tsx` + `WalletBalance`)

| Critère | État | Détail |
|--------|------|--------|
| **Note /10** | **6,5** | Données claires, graphique Recharts ; mise en page encore “dashboard classique”. |
| Data loading | ✅ | Server Component `getWalletData(user.id)` ; erreur et empty state gérés. |
| Affichage | ✅ | 3 cartes (En attente, Solde disponible, Déjà retiré) + carte “Solde disponible” avec CTA retrait + graphique 30j + listes gains/cashouts. |
| Animations | Partiel | Animation au montage des montants (balance, withdrawn) en `useEffect` (steps 60fps) ; pas de framer-motion. |
| Graphique | ✅ | Recharts AreaChart (30 derniers jours) ; Tooltip, CartesianGrid. |
| Cashout | ✅ | Dialog confirmation, `router.refresh()` après succès ; pas d’Optimistic UI (solde se met à jour après refresh). |

**Points de friction :**
- Double affichage “Solde disponible” (petite carte + grosse carte) : redondant.
- Pas de slider “Montant à retirer” (Revolut-style) : uniquement “tout le solde” en un clic.
- Liste gains/cashouts : lignes avec bordures, pas de cartes ou de timeline visuelle.
- Cashout : après succès, full `router.refresh()` → rechargement serveur ; pas de mise à jour optimiste du solde.
- Référence `useCsrfToken` dans le client : à aligner avec la stratégie CSRF du projet (voir branche remove-csrf).

**Vision cible :**
- Vue “Revolut” : une grande carte “Solde” en hero (chiffre mis en avant, gradient discret) + slider ou sélecteur de montant pour le retrait (pas seulement “tout”).
- Timeline ou cartes par événement (gain X, retrait Y) avec icônes et dates, au lieu d’un tableau de lignes.
- Graphique : option période (7j / 30j / 90j) et courbe cumulative possible.
- Optimistic UI : au clic “Demander un retrait”, décrémenter tout de suite le solde affiché et afficher une entrée “En cours” dans la liste ; rollback en cas d’erreur.
- Composants manquants : `WalletHeroCard`, `CashoutAmountSlider`, `WalletTimeline`, `BalanceChart` (avec sélecteur de période), logique optimistic dans un hook `useCashout`.

---

### 2.3 Participate (`contests/[id]/participate/page.tsx`)

| Critère | État | Détail |
|--------|------|--------|
| **Note /10** | **5,5** | Flow clair (éligibilité → rappel → formulaire) ; peu de “wow” et pas d’optimistic submit. |
| Vérifications | ✅ | `getSession()`, `is_contest_active`, `can_submit_to_contest`, affichage des raisons d’éligibilité. |
| Formulaire | ✅ | `SubmissionForm` (react-hook-form, zod, plateforme, URL, règles) avec barre de progression et validation URL. |
| Feedback | Partiel | Dialog succès puis redirection ; pas d’animation de succès type confetti ou check animé. |
| Responsive | ✅ | Grille 2fr/1fr ; colonne “Rappel concours” à droite. |

**Points de friction :**
- Pas d’Optimistic UI : après submit, l’utilisateur attend la réponse puis voit le dialog ; pas d’affichage immédiat “Participation enregistrée” avec mise à jour locale.
- Étapes “1–2–3” en liste statique (Badge + texte) ; pas de stepper visuel animé.
- Page entièrement server-rendue : pas de skeleton ciblé sur le formulaire pendant les checks d’éligibilité.
- Lien “Retour aux concours” / “Voir les concours” : navigation full page.

**Vision cible :**
- Stepper horizontal animé (étapes 1 → 2 → 3) avec état actuel/complété, type onboarding premium.
- À la soumission : Optimistic UI (message “Participation envoyée” + désactivation du formulaire) puis confirmation serveur ; en cas d’erreur, réafficher le formulaire avec message.
- Micro-animation de succès (check + court confetti ou halo) avant redirection.
- Composants manquants : `ParticipationStepper`, `SubmissionSuccessCelebration`, logique optimistic dans `SubmissionForm` (état “submitted” local + sync serveur).

---

### 2.4 Submissions (`submissions/page.tsx` + `SubmissionsTable`)

| Critère | État | Détail |
|--------|------|--------|
| **Note /10** | **5,5** | Données et filtres corrects ; liste très “table/dashboard”. |
| Data loading | ✅ | Server Component `getSubmissions()`, pagination, filtres status/contest/search. |
| Présentation | ⚠️ | Desktop : tableau HTML (`<table>`). Mobile : cartes (timeline). Pas de vue unifiée “cards” premium. |
| Filtres | ✅ | Chips status + recherche + select concours ; tout en GET, sticky. |
| Animations | Faible | `animate-fadeUpSoft` sur `<main>` (classe utilisée : à vérifier si `.animate-fadeUpSoft` existe en plus de `.fade-up-soft`). Pas de framer-motion sur la liste. |

**Points de friction :**
- Tableau desktop : look “admin” ; pas de cartes avec vignette, pas de graphique mini (vues/likes).
- Changement de filtre = rechargement de la page (GET) : pas de transition de liste (layout animation).
- StatCards (Total, En attente, etc.) : basiques ; pas de tendance (ex. +2 cette semaine).
- Bloc “Comprendre les statuts” : utile mais visuellement lourd (Card border-dashed).

**Vision cible :**
- Vue unique “cards” (desktop + mobile) : une carte par soumission avec miniature/vignette si disponible, barre de statut colorée, mini sparkline vues/likes, actions en overlay ou menu.
- Filtres : mise à jour URL + transition de liste (AnimatePresence + layoutId ou équivalent) pour éviter le saut.
- Stats : indicateurs avec variation (ex. “12 en attente, +3 vs la semaine dernière”) et micro-animations au changement.
- Composants manquants : `SubmissionCard` (vue carte riche), `SubmissionsList` avec layout animation, `SubmissionStats` avec tendance.

---

### 2.5 Profil / Paramètres (`settings/page.tsx`)

*Pas de route `profile/page.tsx` ; le “Profil” dans la nav pointe vers `settings`.*

| Critère | État | Détail |
|--------|------|--------|
| **Note /10** | **5** | Formulaire complet ; page très “formulaire” peu différenciante. |
| Données | ✅ | `profiles` + `profile_creators` + `notification_preferences` ; `CreatorSettingsForm` avec initial values. |
| Sécurité | ✅ | `getSession()`, redirect si pas d’utilisateur ; pas de fuite de données vers un autre rôle (données scoped user). |
| UX | ⚠️ | Résumé profil (avatar, complétion %) dans une Card ; pas de vue “profil public” ou de preview. |
| Animations | Quasi aucune | Pas de transition d’entrée ni de micro-interactions sur les champs. |

**Points de friction :**
- Une seule colonne, formulaire long : pas de navigation par sections (Profil / Notifications / Sécurité) type onglets ou sidebar.
- Indicateur de complétion : barre ou pourcentage uniquement ; pas de checklist visuelle “À compléter”.
- Pas de preview “Comment tu apparais aux marques” (avatar + pseudo + plateforme).

**Vision cible :**
- Paramètres en sections (onglets ou sidebar) : Identité, Plateforme & stats, Notifications, Sécurité.
- Bloc “Aperçu créateur” (carte ou mock) avec avatar, nom, handle, plateforme, pour rassurer sur le rendu côté marque.
- Checklist de complétion avec icônes (coche / à faire) et lien direct vers chaque champ.
- Composants manquants : `SettingsSections` (tabs ou nav), `CreatorPreviewCard`, `CompletionChecklist`.

---

### 2.6 Dashboard (`dashboard/page.tsx`)

| Critère | État | Détail |
|--------|------|--------|
| **Note /10** | **6,5** | Contenu riche (stats, prochaine échéance, carousel, milestones, todo, conseils) ; mise en page dense. |
| Data loading | ✅ | `fetchDashboardData()` (summary, next contest, notifications, recommended) ; `revalidate = 60`. |
| Composants | ✅ | StatCards, ProgressSteps, ActiveContestsCarousel (Suspense), cartes À faire / Notifications / Actions rapides. |
| Effets | Partiel | `cliprace-hero` sur la section bienvenue ; Card “Prochaine échéance” avec `backdrop-blur-xl` ; pas de bento ni de hiérarchie visuelle forte. |
| Animations | Faible | Pas de framer-motion sur les blocs ; carousel à vérifier (skeleton présent). |

**Points de friction :**
- Beaucoup de sections à la suite : pas de zoning type bento (grille à taille variable) pour guider l’œil.
- “Prochaine échéance” : une seule concours ; pas de “Prochains concours” en liste ou slider.
- Milestones : barre de progression linéaire ; pas d’étapes visuelles type “game progress”.
- Notifications : liste simple ; pas de groupement par type ou de “mark all read” visible.

**Vision cible :**
- Bento dashboard : hero (welcome + next deadline) + 2–3 blocs mis en avant (Concours en ligne, Gains, À faire) + grille secondaire (Notifications, Conseils, Progression).
- Progression : composant type “niveau créateur” avec barre et paliers (ex. Nouveau → Engagé → Régulier → Top).
- Composants manquants : `DashboardBento`, `CreatorLevelProgress`, `NextContestsStrip`.

---

## 3. Sécurité et robustesse

| Zone | État | Commentaire |
|------|------|-------------|
| Layout | ✅ | Session + rôle ; redirect `/forbidden` si non creator/admin. |
| Pages | ✅ | `getSession()` sur toutes les pages analysées ; redirect si pas d’user. |
| Données | ✅ | Requêtes Supabase filtrées par `user.id` ou `creator_id` ; pas d’exposition d’autres utilisateurs. |
| Participate | ✅ | Vérification `can_submit_to_contest` côté serveur ; formulaire avec `contest_id` et user implicite. |
| Wallet | ✅ | `getWalletData(user.id)` ; pas de liste de cashouts d’autres créateurs. |
| Submissions | ✅ | `getSubmissions(user.id, ...)` ; RLS à confirmer côté DB. |
| CSRF | ⚠️ | `WalletBalance` et `SubmissionForm` utilisent `useCsrfToken` / header `x-csrf` ; la branche `chore/remove-csrf` modifie d’autres routes — à aligner (soit retirer CSRF partout, soit le garder de façon cohérente). |

**Recommandations :**
- Vérifier que les API appelées depuis l’espace créateur (cashout, submission create) appliquent bien une vérification de rôle (creator) en plus du session/user.
- Documenter la décision CSRF et supprimer ou généraliser `useCsrfToken` selon le choix.

---

## 4. Synthèse des composants techniques manquants

Pour viser un niveau “Uber/Revolut” :

| Domaine | Composants / capacités à ajouter |
|--------|-----------------------------------|
| **Navigation & shell** | View Transitions (page transitions) ; indicateur d’onglet actif animé ; optional client-side cache pour badges (solde, notifs). |
| **Discover** | Bento hero (“À la une”) ; transition de liste au changement de filtre ; option “Rejoindre” depuis la carte (modal/drawer). |
| **Wallet** | Carte hero solde ; slider/sélecteur de montant de retrait ; timeline ou cartes par événement ; Optimistic UI cashout ; graphique avec sélecteur de période. |
| **Participate** | Stepper animé ; Optimistic UI à la soumission ; micro-animation de succès. |
| **Submissions** | Vue cartes unifiée (SubmissionCard avec vignette, mini stats) ; layout animation sur les filtres ; stats avec tendance. |
| **Settings / Profil** | Sections (tabs/sidebar) ; aperçu “profil créateur” ; checklist de complétion. |
| **Dashboard** | Grille bento ; composant “niveau créateur” avec paliers ; strip “Prochains concours”. |
| **Partagé** | Design tokens ou composants “premium” (glass cards, gradients cohérents) ; cohérence des classes d’animation (ex. `.animate-fadeUpSoft` vs `.fade-up-soft`). |

---

## 5. Grille récapitulative des notes

| Page / zone | Note /10 | Priorité transformation |
|-------------|----------|--------------------------|
| Layout (shell) | 7 | Moyenne (transitions, header) |
| Navigation | 6,5 | Moyenne (indicateur actif, préchargement) |
| Discover | 7,5 | Haute (bento, transitions, CTA) |
| Wallet | 6,5 | Haute (Revolut-like, optimistic, slider) |
| Participate | 5,5 | Haute (stepper, optimistic, célébration) |
| Submissions | 5,5 | Haute (cartes, layout animation, stats) |
| Settings (profil) | 5 | Moyenne (sections, preview, checklist) |
| Dashboard | 6,5 | Moyenne (bento, niveau créateur) |

---

*Rapport généré pour la mission d’audit Espace Créateur – Février 2026. Pas de code généré ; analyse de l’existant et plan de transformation uniquement.*
