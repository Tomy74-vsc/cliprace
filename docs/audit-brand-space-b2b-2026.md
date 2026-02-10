# Audit Approfondi — Espace Marque (B2B / Enterprise Grade)

**Date :** 9 février 2026  
**Contexte :** L'espace Créateur a été refondu (design Netflix/Revolut). Objectif : élever l'espace Marque au même niveau technique, avec une philosophie B2B — Productivité, Clarté des données (ROI), Rapidité d'exécution.  
**Livrable :** Rapport critique avec note /10 et Vision Cible 2026 par zone. Aucun code généré.

---

## Synthèse exécutive

| Zone | Note /10 | Verdict court |
|------|----------|----------------|
| 1. Shell (layout + BrandNav) | **5,5/10** | Solide mais sans "Command Center", pas de switch concours rapide, pas de transitions |
| 2. Dashboard | **6,5/10** | Bonne base ROI (CPV, vues, graphiques) mais pas encore un vrai hub décisionnel |
| 3. Mission Control (contests/[id]) | **5/10** | Données présentes, UX datée, pas de temps réel, CTA promos/messages désactivés |
| 4. Modération (submissions) | **5,5/10** | Filtres + vue simple/table + batch OK, mais pas de player intégré ni raccourcis clavier |
| 5. Billing / Paiements | **5/10** | Billing utile (table + stats), Payments en TODO ; pas niveau Stripe Invoicing |

**Stack constatée :** Next.js (App Router), RSC pour la data, Client Components pour nav/modération, Shadcn/ui, Recharts (graphiques), pas de TanStack Table, pas de View Transitions côté marque.

---

## 1. Le Shell — `layout.tsx` + `layout_nav.tsx` (BrandNav)

### État des lieux

- **Layout :** Sidebar fixe (desktop), topbar avec breadcrumbs, bottom nav mobile (grid 6 colonnes). Banners (profil incomplet, soumissions en attente). Pas de wrapper de transition de page.
- **BrandNav :** Liens statiques (Dashboard, Concours, Messages, Factures, Notifications, Paramètres). Badges (paiements en attente, notifications non lues). Actif = `pathname.startsWith(href)`. Pas de sous-menu "Concours" ni de switcher concours.
- **BrandBreadcrumbs :** Fil d'Ariane dérivé du pathname (segments), pas de nom de concours dans le breadcrumb sur `/contests/[id]` (segment UUID non résolu en titre).

### Réponses aux questions

- **La navigation permet-elle de passer d'un concours à l'autre rapidement ?**  
  **Non.** On passe par "Concours" → liste → clic sur un concours. Aucun dropdown "Concours actifs" ou "Derniers concours consultés" dans la sidebar/topbar pour aller directement sur un concours donné.
- **Y a-t-il des transitions fluides (View Transitions) ?**  
  **Non.** Aucun équivalent à `CreatorPageTransition` (Framer Motion) dans le layout marque. Les changements de page sont des rechargements classiques.

### Points forts

- Structure claire (sidebar + header + main).
- Badges utiles (pending payments, notifications).
- Breadcrumbs présents (avec limite : pas de libellé concours sur détail).

### Points faibles

- Pas de "switcher concours" type Linear/Vercel (projet actif).
- Pas de transitions de page.
- Breadcrumbs ne résolvent pas le nom du concours pour `/contests/[id]` et sous-routes.
- `layout_nav` : lien "Concours" générique, pas de raccourcis par concours.

### Note : **5,5/10**

### Vision Cible 2026

- **Switcher concours (Command Center) :** Dans la topbar ou la sidebar, un sélecteur (combobox / dropdown) listant les concours actifs + "récemment consultés", avec recherche par nom, permettant d’ouvrir directement `/app/brand/contests/[id]`.
- **Transitions de page :** Introduire un wrapper type `BrandPageTransition` (Framer Motion ou View Transitions API) autour du `main` pour des transitions légères (fade/slide) à chaque changement de route, aligné sur l’espace Créateur.
- **Breadcrumbs enrichis :** Sur `/contests/[id]` et sous-routes, résoudre le titre du concours (RSC ou store) et l’afficher dans le fil d’Ariane (ex. "Concours > [Titre du concours] > Soumissions").
- **Navigation secondaire par concours :** Sur la page détail d’un concours, onglets ou sous-nav locaux : Vue d’ensemble | Soumissions | Classement | Paramètres, sans repasser par la liste.

---

## 2. Le Dashboard — `dashboard/page.tsx`

### État des lieux

- **Contenu :** Phrase d’accroche ROI (vues 7j, budget, CPV/1000 vues), CTA "Créer un concours" + carte "État global" (concours actifs, pending submissions, budget engagé, vues cumulées). KPIs en grille (Vues cumulées, Engagement, CPV, Budget dépensé). Section "Concours en cours" (cartes avec vues, soumissions, CPV, lien vers détail). Graphiques : "Vues des 7 derniers jours" (Recharts), "Répartition par plateforme". Liste "Concours récents". Carte "Actions requises" (paiements en attente, soumissions à modérer). Empty state si aucun concours.
- **Data :** Tout en RSC, `fetchDashboardData` (contests, métriques RPC, metrics_daily, platform distribution). `revalidate = 60`.

### Réponses aux questions

- **Est-ce juste une liste de concours ?**  
  **Non.** Il y a une vraie vue synthétique : KPIs globaux (vues, CPV, budget), graphiques 7j et par plateforme, concours en cours avec métriques, actions requises.
- **Ou une vue synthétique du ROI global (Vues totales, CPA, Budget dépensé) ?**  
  **Oui, partiellement.** CPV, budget dépensé, vues cumulées sont présents. En revanche : pas de tendance "ROI sur la période" (ex. évolution CPV semaine vs semaine), pas de comparaison multi-période, pas de objectif vs réalisé. Le "budget dépensé" côté data est encore en TODO (commentaire dans le code).

### Points forts

- KPIs orientés ROI (CPV, vues, budget).
- Graphiques Recharts (ligne 7j, répartition plateformes).
- CTA clair et section "Actions requises".
- Empty states et messages utiles.

### Points faibles

- Budget réellement dépensé non calculé (TODO dans `fetchDashboardData`).
- Pas de vue "objectif vs réalisé" ni de tendances multi-périodes.
- Pas de tableau récapitulatif type "Tous les concours avec ROI" (export ou vue dense).
- Pas de rafraîchissement temps réel ou intervalle court (revalidate 60 uniquement).

### Note : **6,5/10**

### Vision Cible 2026

- **Dashboard = Command Center décisionnel :** En haut : "Cette semaine / Ce mois" avec KPIs comparés (vs semaine/mois précédent). Bloc "ROI global" : objectif CPV vs CPV réel, budget engagé vs dépensé, avec indicateur vert/orange/rouge.
- **Données fiables :** Implémenter le calcul du budget réellement dépensé (prizes payés / paiements succeeded) et l’exposer dans les stats et la phrase d’accroche.
- **Tableau synthèse concours :** Section optionnelle "Tous les concours" avec tableau (TanStack Table si volume) : Nom, Statut, Vues, CPV, Budget, Pending, Lien détail — tri/filtre côté client ou URL.
- **Rafraîchissement :** Soit `revalidate` plus court pour les pages critiques, soit composant client avec polling léger pour les KPIs "live" (optionnel, selon besoin métier).

---

## 3. Mission Control — `contests/[id]/page.tsx`

### État des lieux

- **Contenu :** En-tête (titre, badge statut, dates), actions (Modifier si draft, Voir page publique, Dupliquer). 4 StatCards (Vues totales, Engagement, CPV, Soumissions avec hint "X en attente"). Carte "Croissance journalière" (ContestMetricsChart). Section Soumissions (texte + bouton "Voir toutes les soumissions", grille de 6 SubmissionCards). Section Classement (top 10, lien classement complet, export PDF). 2 cartes CTA : "Promouvoir le concours" (bouton désactivé), "Contacter les participants" (bouton désactivé).
- **Data :** RSC, `fetchContestData` (contest, get_contest_metrics, metrics_daily, submissions récentes, leaderboard, prizes). Encodage caractères défaillant dans l’UI (â†', Ã©, etc.).

### Réponses aux questions

- **C’est la page la plus importante pour gérer la campagne.**  
  Oui, c’est bien le hub du concours, mais l’UX reste "page de détail" classique, pas "Mission Control".
- **Manque-t-il des graphiques temps réel ?**  
  **Oui.** Un seul graphique (croissance journalière), basé sur des données revalidées (pas de polling/SSE). Pas de courbe "vues en direct" ou "dernières 24h" avec mise à jour fréquente. Pas de graphique par plateforme ou par créateur sur cette page.
- **La liste des soumissions est-elle ergonomique pour la modération ?**  
  **Partiellement.** On affiche 6 soumissions récentes avec lien "Modérer" / "Voir détails" vers la page dédiée. Pour modérer en volume, il faut aller sur la page Soumissions ; sur la page détail, la modération n’est pas optimisée (pas de preview vidéo, pas d’actions rapides en ligne).

### Points forts

- Métriques et graphique croissance déjà présents.
- Leaderboard top 10 + export PDF.
- Liens clairs vers soumissions et classement complet.

### Points faibles

- Pas de graphiques temps réel ni de indicateurs "live".
- CTA "Générer le lien de partage" et "Envoyer un message" désactivés (fonctionnalités manquantes).
- Erreurs d’encodage (caractères accentués / flèches).
- Lien "Modifier" pointe vers `/contests/${id}/edit` (vérifier existence de la route).
- Pas de résumé "X soumissions en attente" cliquable pour ouvrir directement la vue modération (filtre pending).

### Note : **5/10**

### Vision Cible 2026

- **Mission Control = une seule page de pilotage :** Onglets ou sections clairement séparés : Vue d’ensemble | Soumissions (avec mini-table ou liste + actions rapides) | Classement | Promo / Messages. Réduire les allers-retours entre "détail concours" et "submissions".
- **Graphiques avancés :** Conserver la courbe 7j ; ajouter "Dernières 24h" (ou 48h) avec option "rafraîchir" ou polling léger. Optionnel : graphique par plateforme (part des vues), top 5 créateurs (barres).
- **Modération depuis la page détail :** Soit un bloc "Soumissions en attente" avec liste compacte (ligne par soumission : créateur, plateforme, lien, boutons Approuver/Refuser) avec optimistic UI, soit un lien "Modérer (X)" qui ouvre la page soumissions avec `?status=pending` pré-rempli.
- **Activer les CTA :** Implémenter "Générer le lien de partage" (copie lien + optional UTM) et "Contacter les participants" (lien vers messages pré-filtrés ou modal).
- **Corrections :** Corriger l’encodage (UTF-8 partout, vérifier les chaînes en dur). Vérifier/créer la route `contests/[id]/edit` si nécessaire.

---

## 4. La Modération — `contests/[id]/submissions/page.tsx` + `SubmissionsReviewView` + `SubmissionsModerationTable`

### État des lieux

- **Page :** RSC qui charge le concours (ownership), applique filtres (status, plateformes, tri, recherche, page). Stats en cartes (En attente, Approuvées, Refusées, Total). Filtres en Card (recherche, boutons statut/plateforme/tri). Onglets "Vue simple" (SubmissionsReviewView) et "Vue tableau avancé" (SubmissionsModerationTable). Pagination liens.
- **SubmissionsReviewView :** Vue "une soumission à la fois" : barre de progression (vidéo #X / total pending), carte avec créateur, plateforme, vues/likes, lien externe vidéo, boutons Accepter / Refuser. Refus → dialog avec raisons prédéfinies + "Autre" (textarea). Après modération, passage à la suivante + `router.refresh()`. Pas de lecteur vidéo intégré : seul un lien cliquable vers `external_url`.
- **SubmissionsModerationTable :** Table HTML (pas TanStack Table) : checkbox pour sélection, créateur, plateforme, lien vidéo, métriques, statut, date, actions (Approuver/Refuser). Sélection multiple → barre d’actions "Approuver (N)" / "Refuser (N)" avec dialogs (raisons pour refus). API `PATCH /api/submissions/[id]/moderate` et `POST /api/submissions/batch-moderate`. Pas de raccourcis clavier documentés. Pas de player vidéo inline.

### Réponses aux questions

- **Est-ce optimisé pour valider 50 vidéos à la suite ?**  
  **Partiellement.** La vue simple permet d’enchaîner (Accepter → suivant) sans rouvrir de page ; la vue tableau permet la sélection multiple et le batch. En revanche : pas de raccourcis clavier (ex. A = accepter, R = refuser, flèche suivant), pas de lecture vidéo dans l’app (obligation d’ouvrir TikTok/IG/YouTube dans un autre onglet), et chaque modération déclenche un `router.refresh()` (rechargement des données de la page). Pas d’optimistic UI : la ligne/carte ne disparaît qu’après refresh.

### Points forts

- Deux modes (simple + tableau) adaptés à différents usages.
- Raisons de refus prédéfinies + "Autre".
- Modération en lot (batch) avec API dédiée.
- Filtres et pagination côté serveur.

### Points faibles

- Aucun raccourci clavier (A/R/Space pour next, etc.).
- Pas de player vidéo intégré (iframe ou embed) : la marque doit ouvrir le lien externe.
- Pas d’optimistic UI : après Approuver/Refuser, la liste se met à jour après refresh.
- Table en `<table>` native, pas TanStack Table (tri/filtre avancé côté client limité).
- Vue simple : si on est sur "pending", on ne voit que les pending ; pas de mode "toutes avec focus sur la première pending".

### Note : **5,5/10**

### Vision Cible 2026

- **Raccourcis clavier :** En vue simple : A = Accepter, R = Refuser (avec confirmation si refus), Flèche droite / Espace = Soumission suivante. En vue tableau : focus sur la ligne sélectionnée, mêmes raccourcis sur la ligne focus. Afficher une légende courte (ex. "A Accepter | R Refuser | → Suivant") en bas ou dans un tooltip.
- **Player vidéo rapide :** Intégrer un lecteur (iframe sécurisé ou embed officiel TikTok/IG/YouTube selon `platform`) à côté ou au-dessus de la carte soumission en vue simple, pour regarder sans quitter la page. Fallback "Ouvrir dans un nouvel onglet" si embed non disponible.
- **Optimistic UI :** À l’action Approuver/Refuser (individuelle ou batch), mettre à jour immédiatement l’état local (retirer la ligne ou passer au suivant, badge "En cours" puis "Approuvée/Refusée") et envoyer la requête en arrière-plan. En cas d’erreur, rollback + toast erreur.
- **Table avancée (optionnel) :** Si le volume de soumissions augmente (100+), envisager TanStack Table avec tri/filtre côté client sur la page courante, virtualisation si besoin. Garder la pagination serveur pour la data.
- **Focus "pending" :** En vue simple, par défaut afficher uniquement les pending ; option "Afficher toutes" pour revoir approuvées/refusées. Compteur "X restantes" bien visible.

---

## 5. Les Paiements — `billing/page.tsx` et `payments/page.tsx`

### État des lieux

- **Billing :** RSC, `fetchPayments` (payments_brand avec contest title, stats : total_paid, pending, processing, total_views). En-tête "Factures & Paiements". Carte "Résumé de tes dépenses" (total payé, vues totales, CPV, message "pas d’abonnement caché"). 4 StatCards (Total payé, En attente, En traitement, Total transactions). Table HTML : Campagne (lien vers concours), Montant payé (TTC), Statut, Date, Facture PDF / Régler / Voir sur Stripe. Carte "Informations" (Stripe, factures, lien FAQ).
- **Payments :** Page placeholder : "Paiements Marque" + "TODO: Funding, factures et historique paiements." — doublon fonctionnel avec billing ou page prévue pour un autre flux (ex. funding wallet).

### Réponses aux questions

- **Est-ce que cela inspire confiance (design type Stripe Invoicing) ?**  
  **Partiellement.** Billing est propre (résumé, stats, tableau, liens Stripe et facture). Mais : pas de vue "facture détaillée" type PDF preview ou détail ligne par ligne (description, TVA, etc.) ; pas de design "invoice list" avec statut visuel fort (badges, couleurs) ni période (ce mois / ce trimestre). La page Payments en TODO peut semer le doute (deux entrées "paiements" possibles).

### Points forts

- Résumé dépenses + CPV.
- Table des paiements avec statuts et actions (Régler, Voir Stripe, Facture).
- Texte de confiance (paiement sécurisé, pas d’abonnement caché).

### Points faibles

- Pas de vue "liste de factures" dédiée avec numéro de facture, date d’échéance, statut payé/en attente (style Stripe Invoicing).
- Pas de détail d’une facture (lignes, TVA, PDF inline ou preview).
- Page "Payments" en TODO : à fusionner avec Billing ou documenter (redirection, ou renommage "Funding" si usage différent).
- Design "table" basique ; pas de cartes par facture ni de filtres par statut/période.

### Note : **5/10** (billing seul ~6/10, mais Payments en TODO tire vers le bas)

### Vision Cible 2026

- **Unifier Factures & Paiements :** Une seule entrée "Facturation" ou "Factures & Paiements" dans la nav, une seule page principale (billing). Si "Payments" = funding wallet marque, la renommer ("Financement") et la distinguer clairement.
- **Design type Stripe Invoicing :** Liste de factures/paiements sous forme de cartes ou de lignes avec : Numéro (ou id court), Campagne, Montant TTC, Statut (badge coloré), Date, Actions (Télécharger PDF, Voir sur Stripe). Filtres : Statut (Payé / En attente / Échoué), Période (Ce mois / Ce trimestre / Cette année). Section "Résumé" conservée en haut.
- **Détail facture :** Page ou drawer "Détail de la facture" : en-tête (numéro, date, statut), tableau des lignes (description, montant, TVA si applicable), total, bouton "Télécharger PDF". Optionnel : preview PDF inline.
- **Confiance :** Conserver et renforcer les courts blocs "Paiement sécurisé Stripe", "Pas d’abonnement caché", lien support/FAQ.

---

## Critères d’excellence — Écart constaté

| Critère | Attendu | Constat |
|--------|---------|--------|
| Stack | Next.js 16, RSC data, Client pour interactivité | RSC + Client OK ; pas de ref explicite à Next 16. |
| UI | Shadcn/ui, Recharts, TanStack Table si gros volume | Shadcn + Recharts OK ; pas de TanStack Table (tables HTML). |
| UX "Zero Latency" | Tout semble instantané | Pas de transitions ; modération avec refresh complet, pas d’optimistic UI. |
| Optimistic UI sur modération | Oui | Non : refresh après chaque action. |

---

## Plan de montée en gamme recommandé (ordre stratégique)

1. **Shell :** Breadcrumbs enrichis (nom concours) + BrandPageTransition (aligné Créateur). Puis switcher concours dans la topbar.
2. **Modération :** Optimistic UI + raccourcis clavier (A/R/Suivant) + player vidéo intégré (embed) en vue simple.
3. **Mission Control :** Corriger encodage, activer ou retirer les CTA (partage / message), ajouter bloc "Soumissions en attente" avec actions rapides ou lien vers submissions?status=pending.
4. **Dashboard :** Implémenter le calcul du budget dépensé réel ; ajouter tendance "vs période précédente" et optionnel tableau synthèse concours.
5. **Billing :** Unifier avec Payments (ou clarifier), design liste type Stripe (filtres, détail facture / PDF).
6. **Optionnel :** TanStack Table sur liste concours (dashboard ou liste concours) et sur soumissions si volume > 50 ; graphiques "temps réel" ou revalidate court sur Mission Control.

---

*Rapport d’audit — Espace Marque ClipRace — Vision Cible 2026 (Command Center B2B).*
