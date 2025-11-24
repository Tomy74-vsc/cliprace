ClipRace – Spécification Interface Créateur

Version 1.0 – Guide pour refonte UI/UX (Next.js 14 + Tailwind + shadcn/ui + Supabase)

0. Contexte & objectifs

Cette spec décrit toute l’interface Créateur de ClipRace, en partant de la logique déjà existante :

Stack : Next.js 14 App Router, TypeScript, Tailwind, shadcn/ui, framer-motion, lucide-react.

Backend : Supabase (auth, Postgres, storage, RLS).

DB : tables profiles, profiles_creator, contests, submissions, leaderboards, cashouts, etc.

Ce document NE change pas la logique métier (RLS, fonctions SQL, structures de données).
Il décrit uniquement la refonte visuelle + UX de l’espace Créateur, pour atteindre un niveau Stripe / Notion / Shopify :

Simple à comprendre en 3 secondes

Ultra lisible

Fluide, dynamique, rassurant

Qui donne envie de :

explorer les concours,

participer,

suivre ses résultats,

retirer ses gains.

1. Principes de design globaux
1.1. Typographie

Le projet utilise déjà Plus Jakarta Sans comme font principale via --font-sans.

Police globale : font-sans (alias de var(--font-sans)).

Poids utilisés :

300 / 400 pour les textes,

500 / 600 pour les titres et boutons.

Tailles typiques :

text-xs (labels, badges)

text-sm (texte secondaire)

text-base (texte principal)

text-lg (titres de sections)

text-2xl (hero page / titre principal)

Règle UX :
Jamais de texte < text-sm pour du contenu important. Toujours garder un bon contraste (WCAG AA).

1.2. Palette de couleurs (design system)

On s’appuie sur le système de tokens Tailwind/shadcn :
bg-background, text-foreground, bg-card, border-border, bg-primary, etc.

Proposition de palette (à mapper dans ton thème Tailwind/shadcn) :

Background principal : bg-background → #050816 (dark) / #F5F5F7 (light)

Surface cartes : bg-card → #0B1020 (dark) / #FFFFFF (light)

Texte principal : text-foreground → #F8FAFC (dark) / #020617 (light)

Texte secondaire : text-muted-foreground → #94A3B8

Primaire : bg-primary → #6366F1 (indigo)

Primaire hover : hover:bg-primary/90

Accent : bg-accent → #0EA5E9 (cyan)

Success : bg-emerald-500, text-emerald-50

Warning : bg-amber-500, text-amber-50

Danger : bg-rose-500, text-rose-50

Bordures : border-border → #1E293B (dark) / #E2E8F0 (light)

Règle UX :

Un seul primary global pour tous les CTA majeurs.

Pas plus de 2 couleurs saturées par écran (primary + accent).

1.3. Espacement, radius, ombres

Radius global : rounded-2xl pour les grosses cartes, rounded-lg pour les petits éléments.

Espacement :

Layout : px-6 lg:px-8, py-6

Sections : space-y-6 ou space-y-8

Cartes internes : p-4 / p-6

Ombres :

cartes : shadow-sm shadow-black/20 (dark) ou shadow-md/10 (light)

sur hover : translation Y légère -translate-y-[2px] + shadow-lg

1.4. Animations & motion

Utiliser les animations déclarées dans tailwind.config.js :

animate-floatCard

animate-fadeUpSoft

animate-orbFloat

animate-floaty

Guidelines :

Entrée de section : animate-fadeUpSoft (blur + montée douce).

Cartes importantes (concours, stats) :

idle : transition-transform transition-shadow duration-300

hover : -translate-y-[2px] shadow-lg animate-none (pas d’animation flottante + hover pour éviter le too much).

Fonds décoratifs (orbes, particles) : animate-orbFloat, opacité faible (opacity-20 max).

Pas d’animations agressives ou trop rapides. Durées 200–400ms.

1.5. Tokens thème verrouillés (Tailwind/CSS vars)

- Light : background #F5F5F7, card #FFFFFF, border/input #E2E8F0, foreground #020617, muted-foreground #94A3B8.
- Dark : background #050816, card #0B1020, border/input #1E293B, foreground #F8FAFC, muted-foreground #94A3B8.
- Couleurs actions : primary #6366F1 (ring par défaut), accent #0EA5E9, destructive #F43F5E (texte clair), success #10B981, warning #F59E0B.
- Radius root : 1rem (rounded-2xl sur les grosses cartes, sous-niveaux calculés dans Tailwind).
- Ombres utilitaires : shadow-card et shadow-card-hover définies dans tailwind.config.js pour les cartes/hover; conserver hover léger sur desktop, pas de translate en mobile.

2. Architecture de navigation Créateur

L’interface créateur est structurée comme un shell d’application :

2.1. Routes principales

Sous un layout type /app/(creator)/layout.tsx :

/creator → Dashboard (Accueil créateur)

/creator/contests → Liste des concours

/creator/contests/[id] → Détail d’un concours

/creator/contests/[id]/participate → Flow/écran de participation (ou modal)

/creator/submissions → Mes participations

/creator/wallet → Mes gains & paiements

/creator/profile → Profil créateur

Ces routes exploitent les tables Supabase :

contests (concours)

submissions (participations)

leaderboards

cashouts

profiles, profiles_creator

2.2. RBAC / sécurité

Le layout Créateur ne doit être accessible que si :

auth.uid() existe

get_user_role() = 'creator' (fonction SQL déjà fournie).

Pattern Next.js :

Loader server-side / middleware :

Récupère le profil via select sur profiles (role).

Si role !== 'creator' → redirect vers /onboarding ou /switch-role.

Les RLS Supabase garantissent ensuite que :

un créateur ne voit que ses submissions, cashouts, etc.

3. Layout global créateur (Shell)
3.1. Structure visuelle

Layout desktop :

Sidebar gauche (width ~ 260px)

Topbar en haut du contenu

Zone de contenu principale centrée, max-width max-w-6xl

---------------------------------------------------
| Sidebar |           Topbar                      |
|         |---------------------------------------|
|         |              Contenu                  |
|         |                                       |
---------------------------------------------------


Layout mobile :

Topbar en haut (logo + avatar)

Contenu

Bottom navigation fixe (5 icônes max).

3.2. Sidebar (desktop)

Contenu :

Logo ClipRace (compact)

Nav principale avec icônes lucide-react :

Accueil

Concours

Mes participations

Mes gains

Profil

En bas :

Lien “Support / FAQ”

Version / secondaire.

Style :

bg-card/60 backdrop-blur-xl border-r border-border

Navigation :

Items = flex items-center gap-3 px-3 py-2 rounded-lg

État actif :

bg-primary/10 text-primary border border-primary/30

petit indicateur à gauche (barre verticale).

État hover :

bg-muted/40

3.3. Topbar

À droite du logo et nav secondaire :

Titre de la page

À droite :

Icône de notifications (cloche)

Toggle dark/light (next-themes)

Avatar créateur (menu dropdown : Profil, Paramètres, Déconnexion)

Background :

bg-background/80 backdrop-blur-xl border-b border-border

4. Page /creator – Dashboard créateur
4.1. Objectif UX

En un écran, le créateur comprend :

Où il en est (stats globales)

Quoi faire ensuite (CTA vers concours)

Que ClipRace est sérieux & pro (look & feel)

4.2. Structure

Sections, dans l’ordre :

Hero perso

3 stats principales

Concours recommandés

Progression / milestones

(optionnel) Conseils / tips

4.3. Hero

Titre : “Salut {firstName || handle} 👋”

Sous-titre : “Voici un résumé de ton activité sur ClipRace.”

CTA principal : “Découvrir les concours” → /creator/contests

Layout :

flex flex-col gap-4 md:flex-row md:items-center md:justify-between

À droite : petite carte avec :

prochain concours qui se termine bientôt

bouton “Participer avant la fin”.

4.4. Stats principales

3 cards horizontales (mobile = stack, desktop = grid 3 cols) :

Participations totales

Vues cumulées (somme submissions.views approvées)

Gains cumulés (via fonction SQL creator_dashboard_metrics ou équivalent).

Style cards :

bg-card border border-border rounded-2xl p-4 shadow-sm

Titre : text-xs uppercase text-muted-foreground tracking-wide

Valeur : text-2xl font-semibold

Petit sous-texte : text-xs text-muted-foreground

Sur hover :
-translate-y-[2px] shadow-md transition-all duration-200

4.5. Concours recommandés

Titre : “Concours faits pour toi”
Sous-titre : “Basé sur ton réseau principal et ton niveau de vues.”

Logic côté data (server) :

contests:

status = 'active'

visibility = 'public'

min_followers <= followers_total du créateur

Tri par :

date de fin la plus proche,

puis prize_pool_cents desc.

Affichage :

grid md:grid-cols-3 gap-4 de cartes “concours” (cf. section 5.3).

Lien “Voir tous les concours” en haut à droite → /creator/contests.

4.6. Progression (milestones)

Bloc timeline simple :

Étapes :

Onboarding terminé

Première participation

Première vidéo approuvée

Premier gain

Chaque étape :

icône (check, play, trophy)

état : complété (vert), en cours (gris), futur (muted).

Layout :

bg-card border rounded-2xl p-4 flex flex-col gap-4

Progres bar horizontale possible avec w-full h-1 rounded-full bg-muted + bg-primary w-[x%].

5. Page /creator/contests – Découvrir les concours
5.1. Objectif UX

Permettre de parcourir les concours comme un marketplace.

Filtres simples, cartes lisibles, CTA clair : “Voir” puis “Participer”.

5.2. Header

Titre : “Tous les concours”

Sous-titre : "Choisis un concours, poste une vidéo, gagne des récompenses."

Sur la droite :

champ de recherche simple (par titre / marque)

compteur : "{n} concours actifs".

5.3. Filtres

Bandeau au-dessus de la grid :

Réseau : chips (All, TikTok, Instagram, YouTube)

Statut : (En cours, Bientôt, Terminés)

Tri : (Pertinence, Fin proche, Prize pool)

UI :

Chips = Button variant “outline” / “secondary”, avec état actif en variant="default" ou bg-primary/10 text-primary.

Les filtres mettent à jour l’URL via query params, les données sont fetch côté serveur avec ces filtres vers Supabase.

5.4. Cartes concours (card design)

Chaque contest devient une card réutilisable, dans components/creator/contest-card.tsx.

Contenu :

Cover (optionnel) + logo de la marque (avatar).

Titre du concours.

Nom de la marque.

Badges :

"{prize_pool_cents / 100} €" total

"Se termine dans X jours" (calcul ends_at - now())

Mini description (max 2 lignes).

Profil requis :

min followers

min views 30j (si > 0)

CTA : “Voir le concours” (Button, full width en mobile, aligné à droite en desktop).

Style :

bg-card rounded-2xl border border-border p-4 flex flex-col gap-3

Hover :

-translate-y-[3px] shadow-lg border-primary/40

transition-all duration-300

6. Page /creator/contests/[id] – Détail d’un concours
6.1. Objectifs UX

En quelques secondes :

Comprendre la marque

Comprendre le principe du concours

Voir les récompenses

Voir que d’autres participent

Être rassuré → cliquer “Participer”

6.2. Layout

En desktop : 2 colonnes

Colonne gauche = info principale

Colonne droite = encart sticky “Participer”

En mobile : stack vertical.

6.3. En-tête (hero)

Contient :

Cover du concours (ou gradient si pas d’image)

Badge marque (logo + nom)

Titre du concours

Badges :

Prize pool total

Date de fin / “Fini dans X jours”

Réseaux acceptés (icônes)

CTA principal :
Button large : “Participer maintenant” → scroll vers section participation ou route /participate.

6.4. Bloc “Pourquoi participer ?”

3 bullet points max avec icône (visibility, money, brand).

Format : grid md:grid-cols-3 gap-3, cards petites.

6.5. Bloc “Comment ça marche ?”

Checklist visuelle, étape par étape :

Crée ta vidéo sur [réseau].

Ajoute les hashtags : #ClipRace + hashtag de marque.

Publie la vidéo sur ton compte.

Colle le lien de la vidéo dans ClipRace.

UI :

Liste verticale avec icône en cercle (1,2,3,4).

border-l border-border + points sur la colonne pour effet timeline.

6.6. Bloc “Récompenses”

Données depuis contest_prizes (si renseigné).

Tableau ou simple liste :

1er : montant

2e : montant

3e : montant

4–30 : montant

UI :

Card bg-card border rounded-2xl p-4

Utiliser Table shadcn si besoin ou div custom.

6.7. Bloc “Exemples de vidéos (soumissions)”

Requêtes sur submissions :

contest_id = current

status = 'approved'

tri par views DESC ou engagement_rate.

Grid de 3–6 cards :

Thumbnail de la vidéo (ou preview)

Handle du créateur

Views + like

Clique → Dialog avec embed ou simple lien externe.

6.8. Leaderboard (résumé)

Utilisation de leaderboards / get_contest_leaderboard.

Afficher un top 5 :

Rang

Handle créateur

Views

Prize estimé

Bouton “Voir le classement complet” → modal ou scroll.

7. Flow de participation /creator/contests/[id]/participate
7.1. Objectifs UX

Flow aussi clean que Stripe Checkout

3 étapes max, visibles, rassurantes

Validation en temps réel du lien vidéo

7.2. Layout

Card centrale max-w-xl mx-auto

Titre : “Participer au concours {titre}”

Steps progress (1/3, 2/3, 3/3) en haut.

7.3. Étapes
Étape 1 – Choix du réseau

Boutons large : TikTok / Instagram / YouTube (icônes)

État sélectionné : border-primary bg-primary/10 text-primary

Stocker dans state local (et éventuellement en base si nécessaire plus tard).

Étape 2 – Coller le lien

Champ unique :

Label : “Lien de ta vidéo”

Placeholder clair : “https://www.tiktok.com/@…”

Dès qu’on colle :

Vérifier que le domaine est autorisé (validate_video_domain côté backend ou logique existante).

Vérifier que la vidéo n’a pas déjà été soumise pour ce concours / ce créateur (submissions unicité).

Si KO : message d’erreur rouge lisible en dessous de l’input.

UI feedback :

Si OK : petite ligne verte “Lien valide ✅”

Optionnel : afficher un petit résumé : réseau détecté, ID vidéo.

Étape 3 – Confirmation

Récapitulatif :

Nom du concours

Réseau

Lien vidéo (cliquable)

Checkbox : “Je confirme respecter les règles du concours” (obligatoire)

CTA final : “Envoyer ma participation”

Après submit :

Appel d’une Action Next.js côté serveur qui :

vérifie can_submit_to_contest(p_contest_id, auth.uid()) (fonction SQL existante).

crée une ligne submissions avec status = 'pending' (ou pending_automod selon logique).

En cas de succès :

page “Success” :

“Participation envoyée 🎉”

CTA : “Voir mes participations”

En erreur :

message global, type “toast” + message textuel au-dessus du formulaire.

8. Page /creator/submissions – Mes participations
8.1. Objectifs UX

Donner un tableau de bord de toutes les soumissions du créateur.

Filtrer par statut, date, concours.

8.2. Filtres

Barre de filtres horizontale :

Statut : chips [Toutes, En attente, Acceptées, Refusées]

Concours : dropdown (liste des contests où il a participé)

Optionnel : champ de recherche (titre de concours)

8.3. Liste de participations

Chaque submission du créateur (RLS l’assure) :

Card ou row :

Thumbnail (si géré) / icône réseau.

Nom du concours.

Statut :

pending : badge jaune “En attente de validation”

approved : badge vert “En compétition”

rejected : badge rouge “Refusée” + reason si dispo.

Stats (si approved) :

views

likes

comments

shares

Leaderboard :

si dans leaderboards → “Actuellement #X”

CTA :

“Voir le concours” → page détail.

Lien vers plateforme vidéo.

9. Page /creator/wallet – Mes gains & paiements
9.1. Objectifs UX

Montrer clairement combien le créateur a gagné et peut retirer.

Donner un historique “pro” type Stripe.

9.2. Header

Solde disponible : total_earnings_cents - cashouts.pending - cashouts.completed

CTA : “Retirer mes gains” → flow Stripe Connect / cashout.

9.3. Résumé chiffré

3 cards :

Gains totaux (toutes périodes)

Gains en attente de cashout

Gains déjà retirés

Données via fonctions SQL comme calculate_creator_earnings / creator_dashboard_metrics.

9.4. Graphique

Graph Recharts :

Courbe des gains / vues sur les 30 derniers jours

Simple :

x = date

y = vues totales ou gain journalier

9.5. Historique des cashouts

Liste type Stripe Billing :

Date

Montant

Statut (Pending / Processing / Completed / Failed)

(Optionnel) Référence Stripe

UI :

bg-card border rounded-2xl divide-y divide-border

Chaque ligne : flex items-center justify-between py-3.

10. Page /creator/profile – Profil créateur
10.1. Objectifs UX

Facile à compléter, agréable, rapide.

Rassurant pour la marque qui regardera le profil.

10.2. Sections

Identité

Avatar upload (bucket avatars) même dossier user.

Nom affiché

Handle ClipRace

Réseaux

Réseau principal (primary_network)

Liens TikTok / Insta / YouTube

Followers total (optionnel si pas auto)

Description

Bio courte (max 200–300 caractères)

Thèmes préférés (tags)

Stats ClipRace

Nombre de concours

Nombre gagnés

Gains totaux

UI :

2 colonnes sur desktop :

gauche = avatar + identités + stats

droite = formulaire de détails

Bouton “Enregistrer” sticky bottom en mobile.

Validation côté client via Zod, côté serveur via Supabase.

11. Notifications & interconnexion
11.1. Notifications

Table notifications déjà présente.

Types de notifications :

submission_approved / submission_rejected

contest_ending_soon

cashout_completed

UI :

Icône cloche dans Topbar

Badge avec nombre non lus

Dropdown list :

icône

texte (“Ta participation au concours X a été acceptée”)

timestamp

Click → redirige vers la page concernée (concours, submissions, wallet).

11.2. Liens entre pages

Dashboard :

stats → liens vers Mes participations / Wallet

“Concours recommandés” → détail concours.

Détail concours :

“Participer” → flow participation

Exemples → soumissions.

Mes participations :

concours → Détail concours

vidéo → lien externe

Wallet :

cashout → éventuel détail plus tard

Objectif : on ne doit jamais être bloqué. Toujours un chemin clair vers l’action suivante.

12. Accessibilité & performance
12.1. Accessibilité

Navigable au clavier (tab order cohérent).

aria-label sur :

icônes seules (cloche, avatar, boutons ronds)

carrousels / sliders.

Contrastes respectant WCAG AA :

vérifier couleurs (primary vs background)

Tailwind : utiliser classes sr-only lorsque nécessaire pour les textes non visibles.

12.2. Performance

Images optimisées via next/image (avec patterns Supabase déjà définis).

Lazy-load sur :

leaderboard

carrousels d’exemples vidéo

Supabase :

Requêtes paginées pour les listes (contests, submissions)

select minimal (ne prendre que les champs nécessaires côté UI)

13. Résumé pour Codex / Cursor

Quand tu implémentes cette refonte :

Ne touche pas aux fonctions SQL, RLS, types, etc.

Travaille page par page en suivant la structure :

layout créateur (sidebar + topbar)

/creator

/creator/contests

/creator/contests/[id]

/creator/contests/[id]/participate

/creator/submissions

/creator/wallet

/creator/profile

Utilise :

tailwind.config.js animations (fadeUpSoft, floatCard, etc.)

shadcn/ui pour les composants (Card, Button, Dialog, Tabs, Avatar, Badge…)

lucide-react pour les icônes

next-themes pour dark/light.

Connecte toutes les données à Supabase :

via helpers SSR / RSC déjà existants (client Supabase).

en filtrant toujours sur auth.uid() côté créateur.

But final :
Une interface créateur qui donne immédiatement envie de jouer le jeu :
voir les concours, participer, suivre ses résultats, retirer ses gains —
avec une simplicité et une qualité visuelle au niveau des gros SaaS modernes.

14. États UI (loading / empty / error)

Loading :
- Dashboard/contests/submissions/wallet : skeletons pour cards (stats, contests, rows), shimmer léger, pas de jank.
- Actions (submit participation, sauvegarde profil, cashout) : bouton en state loading avec spinner + disabled.

Empty states (par page) :
- Dashboard : si aucun concours recommandé, afficher “Aucun concours éligible pour l’instant” + CTA “Voir tous les concours”.
- Contests list : “Aucun concours trouvé avec ces filtres” + CTA “Réinitialiser les filtres”.
- Submissions : illustration + texte “Pas encore de participation” + CTA “Découvrir les concours”.
- Wallet : “Aucun gain pour l’instant” + CTA “Voir les concours actifs”.
- Profile : si champs obligatoires manquants, banner warning + CTA “Compléter mon profil”.

Error states :
- Bloc par liste avec message court, bouton Retry, et log (console/Sentry).
- Participation : message inline rouge sous l’input + toast global “Échec de l’envoi, réessaie”.
- Cashout : badge “Failed” + CTA “Contacter le support”.

15. Onboarding & accès creator

- Gate d’accès : si role !== creator ou profil incomplet, redirect vers écran “Devenir créateur” (CTA onboarding) ou “Changer de rôle”.
- Banner d’alerte dans le layout si primary_network manquant ou réseaux non liés.
- Vérif côté server layout : auth.uid + get_user_role = creator, sinon redirect /onboarding.

16. Microcopy & langue

- Langue référence : Français (ton court, actif). Tenir la VO pour les labels techniques (ex: "Submit" → "Envoyer").
- Exemples de toasts :
  - Succès participation : "Participation envoyée ! Suis-la dans 'Mes participations'."
  - Erreur lien : "Lien invalide ou déjà soumis pour ce concours."
  - Profil : "Profil sauvegardé."
  - Cashout : "Demande de retrait créée."
- Labels uniformes : "Voir le concours", "Participer maintenant", "Enregistrer", "Réessayer".
- Langue unique : tout l'UI en FR (pas de mix FR/EN). Exceptions tolérées : noms de marque/plateforme, termes techniques non traduits (API, URL).
- Ton : phrase courte, verbe d’action, pas de jargon. Max 2 lignes pour les messages système.
- Lexique standard :
  - Statuts : pending = "En attente", approved = "En compétition", rejected = "Refusée", completed = "Terminé".
  - Actions : submit = "Envoyer", save = "Enregistrer", retry = "Réessayer", continue = "Continuer", cancel = "Annuler".
  - Champs : video link = "Lien de la vidéo", network = "Réseau", followers = "Abonnés", views = "Vues".
- Empty/error : toujours un titre + 1 phrase + 1 CTA (ex : "Aucun concours trouvé" + "Ajuste tes filtres" + bouton "Réinitialiser").

17. Accessibilité & focus

- Focus rings visibles (outline-primary) sur tous les éléments focusables.
- aria-label pour icônes seules (cloche, avatar, toggle theme).
- aria-live polite pour toasts et messages de validation lien vidéo.
- Ordre de tab cohérent dans le flow de participation (1 réseau → 2 lien → 3 confirmation).

18. Composants transverses

- Banner (info/warning/error) réutilisable dans layout et pages.
- EmptyState (icone/illustration + titre + CTA).
- StatCard (titre/valeur/sous-texte/variation).
- ContestCard fallback : gradient si pas de cover, initials si pas de logo.
- ProgressSteps pour le flow participation (state current/past/next).
- Toast provider avec variants success/error/info, durée 4-6s.

19. Données, pagination, perf

- Contests : pagination serveur (20 par page), tri par défaut “Fin proche”, filtres via query params.
- Submissions : pagination (20), tri par date desc, filtres statut/concours.
- Leaderboard : top 5 en SSR, bouton “Voir tout” avec fetch paginé.
- Polling léger (ou revalidate) : leaderboard et stats dashboard toutes les 30-60s si la page est active.
- Anti double-submit : disable CTA tant que la requête n’est pas finie, debounce du collage de lien (300 ms).

20. Instrumentation & events

- Événements à tracer : view_contest, click_participate, submit_video, save_profile, start_cashout, view_leaderboard.
- Inclure contest_id, submission_id, network, user_id (si safe) dans les payloads.
- Erreurs critiques (échec lien, échec cashout) envoyées à Sentry/console.

21. Responsive & mobile

- Bottom nav (mobile) : Accueil (/creator), Concours, Participations, Gains, Profil. Icônes lucide, labels courts.
- Désactiver hover/translate sur cartes en mobile, garder shadow fixe.
- Reflow : toutes les grilles → stack; encart sticky participation devient bloc au-dessus du contenu.
- CTA principal visible sur mobile (ex: bouton “Participer” flottant sur /contests/[id]).

22. Plan de delivery (implémentation)

1) Fondations : vérifier tokens theme (colors, radius, shadows), animations tailwind, setup next-themes, Toast provider global.
2) Layout creator : sidebar/topbar (desktop), bottom nav (mobile), gate d’accès role creator + banners profil incomplet.
3) Composants transverses : StatCard, ContestCard (fallbacks), EmptyState, Banner, ProgressSteps, Skeletons.
4) Pages :
   - /creator (dashboard) avec stats, recommandations, milestones, states loading/empty/error.
   - /creator/contests (+ filtres, pagination, empty/error).
   - /creator/contests/[id] (+ why/how/prizes/submissions/leaderboard, CTA, fallback si terminé).
   - /creator/contests/[id]/participate (steps, validation lien, toasts, anti double-submit).
   - /creator/submissions (liste filtrable, statuses, empty/error).
   - /creator/wallet (résumé, cards, graphique, cashouts list + failed state).
   - /creator/profile (form validé, upload avatar, warning si incomplet).
5) Données : brancher Supabase (RSC) avec filtres/pagination, revalidate/polling selon besoin, requêtes minimales.
6) QA & accessibilité : keyboard nav, focus rings, aria-live, responsive tests, erreurs réseau simulées (401/403/timeout).
7) Instrumentation : log des événements clés + erreurs critiques.
