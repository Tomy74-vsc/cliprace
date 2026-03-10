# Audit OAuth — Connexions YouTube, Instagram, TikTok (onboarding créateur)

**Date:** 2026-03-06  
**Constat:** Les connexions YouTube, Instagram et TikTok ne fonctionnent pas.  
**Objectif:** Identifier ce qui manque dans le code et fournir une checklist claire pour les consoles développeur (Google Cloud, Meta, TikTok).

---

## 1) Implémentation actuelle (pas Supabase Auth OAuth)

L’application **n’utilise pas** `signInWithOAuth` de Supabase. Elle utilise un **flux OAuth propriétaire** pour lier les **comptes plateformes** (YouTube, TikTok, Instagram) au **compte créateur** déjà authentifié (email/password ou magic link via Supabase).

### 1.1 Flux côté code

| Étape | Fichier / route | Rôle |
|-------|------------------|------|
| 1 | `src/components/onboarding/platform-connect-step.tsx` | Clic « Connecter » → redirection `GET /api/auth/oauth/{platform}/connect` |
| 2 | `src/app/api/auth/oauth/[platform]/connect/route.ts` | Vérifie session Supabase, rate limit, construit l’URL d’autorisation via `buildAuthUrl()` et redirige vers le provider (Google / TikTok / Meta) |
| 3 | Provider | L’utilisateur autorise l’app ; le provider redirige vers notre callback avec `?code=...&state=...` |
| 4 | `src/app/api/auth/oauth/[platform]/callback/route.ts` | Vérifie `state` (cookie), échange `code` contre tokens via `exchangeCodeForTokens()`, chiffre les tokens, upsert `platform_accounts` + `platform_oauth_tokens` (Supabase admin), redirige vers onboarding ou settings avec `?connected=true&platform=...` |

### 1.2 Config OAuth (env + redirect)

- **Config plateformes :** `src/lib/oauth/platforms.ts`
  - **YouTube :** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` ; scopes `youtube.readonly` ; redirect = `{origin}/api/auth/oauth/youtube/callback`
  - **TikTok :** `TIKTOK_CLIENT_ID`, `TIKTOK_CLIENT_SECRET` ; scopes `user.info.basic`, `video.list` ; redirect = `{origin}/api/auth/oauth/tiktok/callback`
  - **Instagram :** `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET` (Facebook App) ; scopes Graph API ; redirect = `{origin}/api/auth/oauth/instagram/callback`
- **Redirect URI utilisé partout :**  
  `{origin}/api/auth/oauth/{platform}/callback`  
  avec `origin = req.url` (donc en prod : `https://votredomaine.com`).

### 1.3 Ce qui manque ou peut faire échouer dans le code

1. **Variables d’environnement absentes**  
   Si `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `TIKTOK_CLIENT_ID`, `TIKTOK_CLIENT_SECRET`, `INSTAGRAM_APP_ID` ou `INSTAGRAM_APP_SECRET` sont vides :
   - `buildAuthUrl()` lance une erreur (clientId manquant) → 500 sur `/connect`.
   - `exchangeCodeForTokens()` lance une erreur (clientId/clientSecret manquant) → redirection vers onboarding avec `?error=oauth_failed`.

2. **`OAUTH_TOKEN_ENCRYPTION_KEY`**  
   Utilisé dans le callback pour chiffrer les tokens avant stockage en base. Si absent, le callback échoue (erreur serveur).

3. **Aucun diagnostic OAuth dans `/api/auth/check-config`**  
   L’endpoint actuel ne vérifie que Supabase (URL, anon key, service role, site URL). Il ne vérifie pas la présence des clés OAuth (Google, TikTok, Instagram) ni l’URL de callback. En cas de mauvaise config, on n’a qu’une 500 ou une redirect `oauth_failed` sans détail.

4. **Gestion d’erreur côté provider**  
   Si le provider renvoie `?error=...` (refus utilisateur, app non autorisée, redirect_uri mismatch), le callback ne lit que `code` et `state`. Les paramètres `error` et `error_description` ne sont pas lus ni renvoyés à l’utilisateur (pas de message explicite dans l’UI).

5. **Instagram : produit Meta**  
   Le code utilise l’**Instagram Graph API** (scopes `instagram_graph_user_profile`, `instagram_graph_user_media`). Cela nécessite :
   - Une **Facebook App** (Meta for Developers),
   - L’ajout du produit **Instagram Graph API**,
   - Un compte **Instagram Business ou Creator** lié à une **Page Facebook**.
   Les comptes Instagram “perso” uniquement ne sont pas éligibles sans migration vers Business/Creator.

6. **TikTok : Login Kit v2**  
   Les scopes `user.info.basic` et `video.list` et l’URL d’autorisation utilisées correspondent au **Login Kit v2**. Il faut une app sur [TikTok for Developers](https://developers.tiktok.com/) avec **Login Kit** activé et les bons scopes/redirect.

Aucun appel Supabase OAuth (type “Sign in with Google”) n’est utilisé ; tout passe par ces routes et `platform_accounts` / `platform_oauth_tokens`.

---

## 2) Checklist — Clés d’API et Redirect URIs

À faire dans chaque console **avant** de tester la connexion.

### 2.1 Google Cloud (YouTube)

| Élément | Où / Valeur |
|--------|-------------|
| **Projet** | Créer ou sélectionner un projet dans [Google Cloud Console](https://console.cloud.google.com). |
| **APIs** | Activer **YouTube Data API v3** (et si besoin **Google Identity** / OAuth pour l’écran de consentement). |
| **OAuth 2.0** | **APIs & Services → Credentials → Create Credentials → OAuth client ID**. Type : **Web application**. |
| **Authorized redirect URIs** | Ajouter **exactement** :<br>• Dev : `http://localhost:3000/api/auth/oauth/youtube/callback`<br>• Prod : `https://VOTRE_DOMAINE/api/auth/oauth/youtube/callback` |
| **Authorized JavaScript origins** (si demandé) | `http://localhost:3000` et `https://VOTRE_DOMAINE` |
| **Variables d’env** | `GOOGLE_CLIENT_ID` = Client ID du client OAuth<br>`GOOGLE_CLIENT_SECRET` = Client Secret |

### 2.2 Meta (Facebook / Instagram)

| Élément | Où / Valeur |
|--------|-------------|
| **App** | [Meta for Developers](https://developers.facebook.com/) → Créer une app ou utiliser une existante. |
| **Produit** | Ajouter **Instagram Graph API** (ou “Instagram” selon l’interface). |
| **Instagram Graph API** | Dans la config du produit : **Valid OAuth Redirect URIs** doit contenir :<br>• Dev : `http://localhost:3000/api/auth/oauth/instagram/callback`<br>• Prod : `https://VOTRE_DOMAINE/api/auth/oauth/instagram/callback` |
| **Compte Instagram** | Compte **Instagram Business ou Creator** lié à une **Page Facebook**. |
| **Variables d’env** | `INSTAGRAM_APP_ID` = **ID de l’app Facebook** (pas l’ID Instagram)<br>`INSTAGRAM_APP_SECRET` = **Clé secrète de l’app Facebook** |

Note : pas de “Supabase Redirect” ici ; le redirect est uniquement notre URL de callback ci‑dessus.

### 2.3 TikTok for Developers

| Élément | Où / Valeur |
|--------|-------------|
| **App** | [TikTok for Developers](https://developers.tiktok.com/) → Créer une app (type **Login Kit**). |
| **Login Kit** | Activer **Login Kit** (v2). Scopes demandés dans le code : `user.info.basic`, `video.list`. |
| **Redirect URI** | Dans la config de l’app, **Redirect URI** doit être **exactement** :<br>• Dev : `http://localhost:3000/api/auth/oauth/tiktok/callback`<br>• Prod : `https://VOTRE_DOMAINE/api/auth/oauth/tiktok/callback` |
| **Variables d’env** | `TIKTOK_CLIENT_ID` = Client Key de l’app<br>`TIKTOK_CLIENT_SECRET` = Client Secret |

---

## 3) Récap des variables d’environnement OAuth

À définir dans `.env.local` (et en prod, ex. Vercel) :

| Variable | Obligatoire pour | Description |
|----------|-------------------|-------------|
| `GOOGLE_CLIENT_ID` | YouTube | Client ID OAuth 2.0 (Web application) |
| `GOOGLE_CLIENT_SECRET` | YouTube | Client Secret |
| `TIKTOK_CLIENT_ID` | TikTok | Client Key (Login Kit) |
| `TIKTOK_CLIENT_SECRET` | TikTok | Client Secret |
| `INSTAGRAM_APP_ID` | Instagram | Facebook App ID |
| `INSTAGRAM_APP_SECRET` | Instagram | Facebook App Secret |
| `OAUTH_TOKEN_ENCRYPTION_KEY` | Tous | Base64 32 bytes (chiffrement des tokens en base) |

---

## 4) Vérifications rapides

1. **Env** : Toutes les variables ci‑dessus sont définies et non vides pour les plateformes que tu actives.
2. **Redirect URI** : En prod, `NEXT_PUBLIC_SITE_URL` (ou `APP_URL`) doit être `https://VOTRE_DOMAINE` sans slash final ; l’origin utilisée par les routes est dérivée de `req.url`, donc en production elle doit correspondre à ce domaine.
3. **Consoles** : Les redirect URIs dans Google, Meta et TikTok sont **strictement** ceux listés ci‑dessus (même protocole, même host, même path).
4. **Instagram** : Compte Instagram en mode Business/Creator + Page Facebook liée.
5. **TikTok** : App en état “Live” ou “Development” avec Login Kit et scopes activés.

---

## 5) Recommandations côté code (optionnel)

- **Diagnostic** : Étendre `GET /api/auth/check-config` (ou un endpoint dédié) pour vérifier la présence des clés OAuth (sans les afficher) et afficher l’URL de callback attendue, pour faciliter le debug.
- **Callback** : Lire `error` et `error_description` dans l’URL de callback et les propager jusqu’à l’UI (ex. query params vers la page onboarding) pour afficher un message clair en cas de refus ou de mauvaise config provider.
- **Logs** : En dev, logger (sans secrets) le fait que `buildAuthUrl` ou `exchangeCodeForTokens` a été appelé et pour quelle plateforme, pour confirmer que la requête atteint bien le serveur.

---

**En résumé :** Rien ne manque côté “appels Supabase OAuth” (il n’y en a pas). Le flux est entièrement géré par nos routes et `src/lib/oauth/platforms.ts`. Les pannes viennent en pratique des **variables d’env manquantes**, du **redirect URI non autorisé** dans chaque console, ou des **prérequis métier** (Instagram Business/Creator, TikTok Login Kit configuré). La checklist ci‑dessus couvre les clés et redirect URIs à configurer dans Google Cloud, Meta et TikTok pour que les connexions fonctionnent.
