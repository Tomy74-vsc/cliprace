Guide UI Créateur – Tokens & Patterns (Phase 0)
==============================================

Objectif : poser une base commune pour toutes les pages créateur (dashboard, Discover, notifications, wallet…) afin d’éviter les variations de vocabulaire et de styles.

1. Typographie
--------------

- Police : `font-sans` (Plus Jakarta Sans), poids principaux : 400/500/600.
- Titres de page (H1 créateur) : classe utilitaire `display-2` (déjà définie dans `src/app/style/globals.css`), ou `text-3xl font-semibold` quand `display-*` n’est pas pertinent.
- Sous‑titres / sections (H2) : `text-xl font-semibold`.
- Texte principal : `text-base`.
- Texte secondaire : `text-sm text-muted-foreground`.
- Micro‑texte / labels : `text-xs text-muted-foreground` (badges, hints, timestamps).

Règle : pas de texte critique en dessous de `text-sm`, et toujours utiliser `text-muted-foreground` pour les textes secondaires/explicatifs.

2. Rayons (border-radius)
-------------------------

- Variable globale : `--radius: 1rem` (voir `tailwind.config.js` → `borderRadius.lg`).
- Cartes principales / surfaces créateur : `rounded-2xl` (composant `Card`), sections hero : `rounded-3xl`.
- Éléments d’interface (inputs, boutons, filtres) : `rounded-lg` ou `rounded-full` pour les pills.
- Avatars / icônes circulaires : `rounded-full`.

Règle : sur l’espace créateur, privilégier `rounded-2xl` pour les cartes et `rounded-3xl` pour les gros blocs (hero, bandeaux).

3. Ombres
---------

- Ombre carte par défaut : `shadow-card` (définie dans `tailwind.config.js`).
- Hover élevé : `shadow-card-hover` (cards interactives, carrousels de concours).
- Boutons primaires : gardent l’ombre par défaut (`shadow-card`) via le design system bouton.

Règle : éviter d’empiler des ombres différentes sur une même surface (une seule ombre par bloc). Les états hover accentuent `shadow-card` via `hover:shadow-card-hover` plutôt que de changer la couleur de fond de façon brutale.

4. Badges – Statuts
-------------------

Composant : `src/components/ui/badge.tsx`.

- Variants de base (statuts génériques) :  
  - `default` : neutre / fond gris (`bg-muted text-foreground`).  
  - `success` : succès / actif (`bg-emerald-500/15 text-emerald-500`).  
  - `info` : information / neutre positif (`bg-accent/15 text-accent`).  
  - `warning` : attention / bientôt terminé, seuil à surveiller (`bg-amber-500/15 text-amber-600`).  
  - `danger` : erreur / bloquant (`bg-rose-500/15 text-rose-600`).  
  - `secondary` : étiquette secondaire (pré-requis, seuils, labels neutres).  
  - `outline` : puce d’étape ou d’information légère (barre de confiance, listes numérotées).
- Statuts de soumission (mappés sur ces couleurs) : `pending`, `approved`, `rejected`, `won` – à utiliser via le variant dédié plutôt qu’en recodant les couleurs.

Règle : pour les statuts métier créateur, utiliser uniquement `success | info | warning | danger | default`. `secondary` et `outline` sont réservés aux chips d’information (filtres, seuils, étapes) et non aux statuts métiers.

5. Vocabulaire FR (créateur)
----------------------------

- Statut concours : `Actif` / `À venir` / `Clôturé` (pas de variantes type *Terminé* pour le statut principal, sauf dans des phrases complètes).
- Entrées utilisateur : toujours parler de « soumissions » (ex. `Mes soumissions`) et non « participations » dans la navigation créateur.
- Wallet : `Gains`, `Gains cumulés`, `Gains 30 derniers jours`, `Mon portefeuille`.
- Notifications : `Notifications`, `Centre de notifications`, mentions type `non lues` pour les compteurs.

Règle : privilégier les mêmes libellés sur toutes les pages (header, dashboard, Discover, FAQ, notifications) et ne pas introduire de synonymes locaux.

6. Spacing & layout de base
---------------------------

- Conteneur page créateur : `mx-auto max-w-4xl` (ou `max-w-5xl/6xl/7xl` selon le type d’écran) avec `px-4 py-8`.
- Espacement vertical entre blocs : `space-y-6` pour des pages denses, `space-y-8` pour les vues principales (Discover, dashboard).
- Grilles : `gap-4` pour des cartes compactes, `gap-6` pour des layouts plus aérés (Discover grid, cartes recommandées).
- Sections héro / bandeaux : cartes principales avec `rounded-3xl border border-border bg-card/60 p-6 shadow-card` ou équivalent gradient (`bg-gradient-to-r from-primary/10 via-accent/5`…).

Règle : utiliser `space-y-6` ou `space-y-8` comme base, éviter les `gap-*` exotiques sauf pour des micro‑layouts très locaux.
