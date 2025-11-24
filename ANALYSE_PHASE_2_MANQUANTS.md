# Analyse Phase 2 — Éléments Manquants

**Date**: 2025-01-20  
**Statut**: Analyse complète

---

## ✅ Ce qui a été fait (Phase 2)

### Pages Implémentées
- ✅ `/app/creator/discover` — Liste concours actifs
- ✅ `/app/creator/contests/[id]` — Détail concours complet
- ✅ `/app/creator/submissions` — Tableau soumissions
- ✅ `/app/creator/wallet` — Solde et cashout
- ✅ `/app/creator/dashboard` — KPIs et résumé
- ✅ `/app/creator/messages` — Messages (existe)
- ✅ `/app/creator/settings` — Settings (existe)

### Composants Créés
- ✅ `ContestCard` — Carte concours
- ✅ `SubmissionForm` — Formulaire participation
- ✅ `SubmissionsTable` — Tableau soumissions
- ✅ `WalletBalance` — Solde et historique

### Fonctionnalités
- ✅ Affichage contest_prizes (répartition gains)
- ✅ Affichage contest_assets (ressources)
- ✅ Affichage contest_terms (CGU)
- ✅ Vérification éligibilité côté serveur (`is_contest_active`, `can_creator_submit`)
- ✅ Notifications dans dashboard (ajouté par l'utilisateur)

---

## ⚠️ Éléments Manquants selon le Plan

### 1. **Filtres par Tags/Catégories dans Discover** ❌
**Plan**: "liste concours publics actifs (filtres par tags/categories)"
**État actuel**: Pas de filtres, juste liste brute
**Impact**: Moyen — UX améliorée mais pas critique pour MVP

**À implémenter**:
- Filtres par tags (si table `tags_categories` utilisée)
- Filtres par catégories
- Filtres par plateforme (TikTok, Instagram, YouTube)
- Filtres par prize pool (min/max)
- Barre de recherche (optionnel)

### 2. **Enregistrement `contest_terms_acceptances`** ✅
**Plan**: "Enregistrement de `contest_terms_acceptances` si première participation"
**État actuel**: ✅ **DÉJÀ IMPLÉMENTÉ** dans `/api/submissions/create` (lignes 85-104)
**Impact**: ✅ Traçabilité légale assurée

**Implémentation existante**:
- Vérifie si `contest_terms_id` existe sur le concours
- Vérifie si `contest_terms_acceptances` n'existe pas déjà pour ce user+contest+terms
- Crée ligne `contest_terms_acceptances` avec `accepted_at`, `ip_address`, `user_agent`

### 3. **Tooltip avec raison si inéligible** ❌
**Plan**: "CTA « Participer » désactivé si inéligible (tooltip avec raison)"
**État actuel**: Formulaire masqué si non éligible, mais pas de tooltip explicatif
**Impact**: Moyen — UX améliorée

**À implémenter**:
- Vérification éligibilité côté client (appel API ou fonction SQL)
- Affichage bouton "Participer" désactivé avec tooltip
- Messages selon raison :
  - "Concours non actif"
  - "Vous avez déjà participé"
  - "Concours terminé"
  - "Critères d'éligibilité non remplis" (followers, pays, etc.)

### 4. **Vérification éligibilité côté client** ⚠️
**Plan**: "appeler la fonction SQL `can_submit_to_contest(p_contest_id, auth.uid())`"
**État actuel**: Vérification uniquement côté serveur dans route API
**Impact**: Moyen — Permet d'afficher tooltip avant soumission

**À implémenter**:
- Route API `/api/contests/[id]/eligibility` qui appelle `can_creator_submit`
- Ou composant client qui appelle directement la fonction SQL via Supabase
- Affichage conditionnel du formulaire avec message d'erreur

### 5. **Tri par date/status dans Submissions** ⚠️
**Plan**: "Page « Mes soumissions »: badges de statut, tri par date/status"
**État actuel**: Tri par date uniquement (plus récentes en premier)
**Impact**: Faible — Fonctionnel mais pourrait être amélioré

**À implémenter**:
- Dropdown de tri (date, statut)
- Filtres par statut (pending, approved, rejected, won)
- Tri ascendant/descendant

### 6. **Affichage feedback modération** ⚠️
**Plan**: "feedback modération" dans page soumissions
**État actuel**: Affichage `rejection_reason` si présent
**Impact**: Faible — Déjà partiellement implémenté

**À vérifier**:
- Affichage `moderation_notes` si présent
- Affichage `moderated_by` (qui a modéré)
- Date de modération (`approved_at`)

### 7. **Affichage délais cashout** ⚠️
**Plan**: "afficher délais" dans wallet
**État actuel**: Pas d'affichage des délais estimés
**Impact**: Faible — Nice to have

**À implémenter**:
- Message informatif sur délais de traitement
- Affichage délai estimé selon statut (requested → processing → paid)

---

## 📊 Priorisation

### 🔴 **Critique** (À faire avant MVP)
1. **Enregistrement `contest_terms_acceptances`** — Traçabilité légale

### 🟡 **Important** (Améliore significativement l'UX)
2. **Tooltip avec raison si inéligible** — Meilleure UX
3. **Vérification éligibilité côté client** — Permet tooltip

### 🟢 **Nice to have** (Peut attendre Phase 3+)
4. **Filtres par tags/catégories** — Amélioration discover
5. **Tri/filtres avancés soumissions** — Amélioration page soumissions
6. **Affichage délais cashout** — Information supplémentaire

---

## 🔍 Détails Techniques

### 1. Enregistrement `contest_terms_acceptances`

**Fichier à modifier**: `src/app/api/submissions/create/route.ts`

```typescript
// Après création de la soumission
if (contestRow.contest_terms_id) {
  // Vérifier si acceptation existe déjà
  const { data: existingAcceptance } = await admin
    .from('contest_terms_acceptances')
    .select('id')
    .eq('contest_id', contest_id)
    .eq('creator_id', user.id)
    .single();

  if (!existingAcceptance) {
    // Créer acceptation
    await admin.from('contest_terms_acceptances').insert({
      contest_id: contest_id,
      creator_id: user.id,
      contest_terms_id: contestRow.contest_terms_id,
      accepted_at: new Date().toISOString(),
    });
  }
}
```

### 2. Tooltip éligibilité

**Fichier à modifier**: `src/app/app/creator/contests/[id]/page.tsx`

```typescript
// Créer composant client pour vérification éligibilité
'use client';
import { useEffect, useState } from 'react';
import { Tooltip } from '@/components/ui/tooltip';

function EligibilityCheck({ contestId, userId }: { contestId: string; userId: string }) {
  const [eligibility, setEligibility] = useState<{ canSubmit: boolean; reason?: string } | null>(null);
  
  useEffect(() => {
    // Appel API ou fonction SQL
    checkEligibility(contestId, userId).then(setEligibility);
  }, [contestId, userId]);

  if (!eligibility) return <Skeleton />;
  
  if (!eligibility.canSubmit) {
    return (
      <Tooltip content={eligibility.reason}>
        <Button disabled>Participer</Button>
      </Tooltip>
    );
  }
  
  return <SubmissionForm ... />;
}
```

### 3. Filtres Discover

**Fichier à modifier**: `src/app/app/creator/discover/page.tsx`

```typescript
// Ajouter composant client pour filtres
'use client';
import { useState } from 'react';
import { Select } from '@/components/ui/select';

function DiscoverFilters({ onFilterChange }: { onFilterChange: (filters: FilterState) => void }) {
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  // ...
  
  return (
    <div className="flex gap-4 mb-6">
      <Select value={platforms} onValueChange={setPlatforms}>
        {/* Options plateformes */}
      </Select>
      {/* Autres filtres */}
    </div>
  );
}
```

---

## ✅ Checklist Éléments Manquants

### Critique
- [x] Enregistrement `contest_terms_acceptances` dans `/api/submissions/create` ✅ **DÉJÀ FAIT**

### Important
- [ ] Vérification éligibilité côté client (route API ou composant)
- [ ] Tooltip avec raison si inéligible
- [ ] Affichage bouton "Participer" désactivé avec tooltip

### Nice to have
- [ ] Filtres par tags/catégories dans discover
- [ ] Tri/filtres avancés dans submissions
- [ ] Affichage délais cashout dans wallet
- [ ] Affichage `moderation_notes` et `moderated_by` dans submissions

---

## 📝 Notes

1. **Messages et Settings** : Ces pages existent déjà (fichiers trouvés), donc pas besoin de les créer
2. **Contest_prizes, contest_assets, contest_terms** : Déjà affichés dans la page détail concours ✅
3. **Vérification éligibilité** : Côté serveur OK, manque côté client pour UX
4. **Notifications** : Déjà ajoutées dans dashboard par l'utilisateur ✅

---

**Conclusion** : La Phase 2 est **~95% complète**. Il manque principalement :
- ✅ L'enregistrement `contest_terms_acceptances` — **DÉJÀ FAIT**
- ⚠️ Les tooltips d'éligibilité (important pour UX)
- ⚠️ Les filtres discover (nice to have)
- ⚠️ Vérification éligibilité côté client (important pour UX)

