# ClipRace

## Admin MFA

### Objectif

Toutes les routes **`/app/admin/*`** exigent une session **AAL2** (MFA TOTP Supabase) **sauf** les routes **`/app/admin/mfa/*`** qui servent à configurer/vérifier la MFA.

### Routes

- **Setup**: `GET /app/admin/mfa/setup`
  - Si un facteur TOTP existe déjà → redirection vers `GET /app/admin/mfa/verify`
  - Sinon → `supabase.auth.mfa.enroll({ factorType: 'totp' })` + affichage du QR code
- **Verify**: `GET /app/admin/mfa/verify`
  - Si aucun facteur TOTP → redirection vers `GET /app/admin/mfa/setup`
  - Sinon → `supabase.auth.mfa.challengeAndVerify({ factorId, code })`

### Guard server-side (anti-bypass)

- **Pages admin**: `src/app/app/admin/(protected)/layout.tsx`
  - **Non connecté** → `/auth/login`
  - **Pas admin** → `/forbidden`
  - **AAL1** → redirect vers `/app/admin/mfa/setup` (pas de TOTP) ou `/app/admin/mfa/verify` (TOTP présent)
- **API admin**: `src/lib/admin/rbac.ts` utilise `requireAdminAal2OrThrow()` avant d’autoriser une permission admin.

### Tester manuellement (checklist)

- **1. Admin sans MFA**
  - Se connecter avec un compte `profiles.role = 'admin'`
  - Aller sur `GET /app/admin/dashboard`
  - Attendu: redirection vers `GET /app/admin/mfa/setup`
  - Scanner le QR code (Google Authenticator / Microsoft Authenticator)
  - Cliquer “Continuer” → `GET /app/admin/mfa/verify`
  - Entrer un code 6 chiffres → redirection vers `/app/admin`

- **2. Refresh / navigation**
  - Rafraîchir `/app/admin/dashboard`
  - Attendu: accès OK tant que la session est **AAL2**

- **3. Expiration AAL1 → forcer re-verify**
  - Attendre l’expiration AAL1 (option “Limit duration of AAL1 sessions” activée côté Supabase)
  - Aller sur n’importe quelle route `/app/admin/*`
  - Attendu: redirection vers `GET /app/admin/mfa/verify`

- **4. Non-admin**
  - Se connecter avec un compte non-admin
  - Aller sur `/app/admin/dashboard`
  - Attendu: redirection `/forbidden`

### (Optionnel) RLS AAL2 côté DB

Migration idempotente: `db_refonte/57_admin_aal2_rls.sql`

- Pattern RLS:
  - `public.is_admin(auth.uid())`
  - **ET** `COALESCE(auth.jwt() ->> 'aal','') = 'aal2'`


