## Cliprace – Plateforme de concours UGC (MVP)

MVP professionnel pour que les marques lancent des concours UGC et que les créateurs participent avec des vidéos short-form. Next.js App Router, Supabase, Stripe, Tailwind, shadcn/ui. Structure prête prod avec tests, CI et seed.

### Stack
- Next.js 15 (App Router) + TypeScript + TailwindCSS + shadcn/ui + Radix
- Supabase (Postgres, Auth, Storage) + RLS
- Stripe (Checkout + Connect Standard)
- i18n: next-intl (FR par défaut)
- Tests: Vitest/RTL, Playwright
- Qualité: ESLint + Prettier + GitHub Actions

### Démarrage rapide
1. Copier la config d’environnement: `.env.example` -> `.env.local`
2. Installer: `npm i`
3. Supabase:
   - Cloud recommandé, sinon `npx supabase start`
   - `npm run db:migrate`
   - `npm run db:seed`
4. Lancer: `npm run dev`

### Variables d’environnement
Créer `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE=
SUPABASE_JWT_SECRET=

STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_CONNECT_CLIENT_ID=

APP_URL=http://localhost:3000
NODE_ENV=development
```

### Scripts
- dev, build, start
- lint, format, typecheck
- test (Vitest), e2e (Playwright)
- db:migrate, db:seed

### Déploiement
- Vercel: définir les variables d’env.
- Supabase: appliquer migrations, configurer webhooks Stripe.
- Stripe: clés + webhook; en dev `stripe listen`.

### Notes
- Runbook: recalcul classement, refresh metrics, cashout (à compléter)
