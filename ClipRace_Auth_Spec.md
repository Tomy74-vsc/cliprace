# ClipRace — Auth Spec (Signup/Login) ✅

## 🎯 Objectif
Implémenter des pages **Inscription** et **Connexion** robustes, sécurisées, style **Clerk** (sobre/premium), connectées à Supabase.  
Flux d’inscription en **2 étapes**, vérification e-mail en temps réel, création de profil **immédiate** côté serveur, redirection selon **rôle** (creator/brand).

---

## 🧱 Stack & contraintes
- **Next.js 14 / App Router / TypeScript**
- **Tailwind CSS** + **shadcn/ui** + **lucide-react**
- **Supabase** (Auth, DB, RLS) — **Service Role côté serveur uniquement**
- Accessibilité WCAG AA, Dark mode
- CI prête (build), code linté/typé

---

## 📦 Arborescence à créer/compléter

```
src/
  app/
    (auth)/
      signup/page.tsx             # Wizard 2 étapes
      login/page.tsx              # Connexion
    auth/
      callback/page.tsx           # Échange de code → session → redirect par rôle
    api/
      auth/
        signup/route.ts           # POST — signUp + upsert profile (+ rel table)
      profile/
        complete/route.ts         # POST — upsert profil (optionnel, enrichissement)
  lib/
    env.ts                        # Validation ENV + constantes
    supabase/
      client.ts                   # getBrowserSupabase()
      server.ts                   # getSupabaseAdmin(), getServerSupabase()
  components/auth/
    RoleSelector.tsx
    PasswordStrength.tsx
    EmailAvailabilityHint.tsx
    ResendEmailButton.tsx
    TermsCheckbox.tsx
    AuthCard.tsx
```

---

## 🔐 Variables d’environnement (obligatoire)

Créer `src/lib/env.ts` :

```ts
const isDev = process.env.NODE_ENV !== "production";

function requireEnv(name: string, fallback?: string) {
  const val = process.env[name] ?? fallback;
  if (!val) throw new Error(`Missing env: ${name}`);
  return val;
}

export const ENV = {
  SITE_URL: requireEnv("NEXT_PUBLIC_SITE_URL", isDev ? "http://localhost:3000" : undefined),
  SUPABASE_URL: requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
  SUPABASE_ANON: requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  REQUIRE_EMAIL_CONFIRMATION:
    (process.env.NEXT_PUBLIC_REQUIRE_EMAIL_CONFIRMATION ?? "true") === "true",
};
```

`.env.local` attendu :
```
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE=...
NEXT_PUBLIC_REQUIRE_EMAIL_CONFIRMATION=true
```

---

## 🗃️ Supabase — exigences config
- `enable_confirmations = true`
- Rate limit e-mails en dev : `email_sent = 10`
- URL de redirection autorisée = `NEXT_PUBLIC_SITE_URL`
- RLS activé
- Tables : `profiles`, `profiles_creator`, `profiles_brand`
- Policies minimales (sélection par soi, admin full). La **création initiale** de profil se fait **via Service Role** (contourne RLS).

---

## 🚦 Middleware (rappels)
- **Whitelists** routes : `/signup`, `/login`, `/auth/*`, `/api/auth/*`
- Si `REQUIRE_EMAIL_CONFIRMATION=true` **et** confirmations activées → bloquer accés aux apps si `email_confirmed_at` absent, sinon **désactiver** ce check.

```ts
import { ENV } from "@/lib/env";
if (ENV.REQUIRE_EMAIL_CONFIRMATION && session?.user && !session.user.email_confirmed_at) {
  return NextResponse.redirect(new URL("/signup?step=2&message=email_not_verified", req.url));
}
```

---

## 🧩 API — /api/auth/signup (critique)

**Objectif** : créer l’utilisateur + **upsert profil immédiatement** + (si role = creator/brand) upsert dans table liée.

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { ENV } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const SignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["creator", "brand", "admin"]).default("creator"),
  name: z.string().min(1).max(120).optional(),
});

export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  const body = await req.json().catch(() => ({}));
  const parse = SignupSchema.safeParse(body);
  if (!parse.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const { email, password, role, name } = parse.data;
  const supabaseAdmin = getSupabaseAdmin();

  const { data, error } = await supabaseAdmin.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${ENV.SITE_URL}/auth/callback`,
      data: { role },
    },
  });
  if (error || !data.user)
    return NextResponse.json({ error: error?.message ?? "Signup failed" }, { status: 400 });

  const user = data.user;
  await supabaseAdmin.from("profiles").upsert({
    id: user.id,
    email: user.email!,
    role,
    name: name ?? user.email!.split("@")[0],
    is_active: true,
  });

  if (role === "creator") await supabaseAdmin.from("profiles_creator").upsert({ user_id: user.id });
  if (role === "brand") await supabaseAdmin.from("profiles_brand").upsert({ user_id: user.id });

  return NextResponse.json({ success: true, userId: user.id });
}
```

---

## 🌐 Page /auth/callback — échange code & redirect

```tsx
"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabase/client";

export default function Callback() {
  const router = useRouter();
  useEffect(() => {
    (async () => {
      const supabase = getBrowserSupabase();
      const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
      if (error) return router.replace("/login?message=callback_failed");
      const { data: { user } } = await supabase.auth.getUser();
      const role = (user?.user_metadata as any)?.role ?? "creator";
      router.replace(role === "brand" ? "/brand" : "/creator");
    })();
  }, [router]);
  return null;
}
```

---

## 🧑‍💻 Page /signup — Wizard 2 étapes (UI & logique)

### Step 1
- Rôle (creator/brand)
- Email (check disponibilité)
- Mot de passe (jauge force)
- Confirmer mot de passe
- Cases conditions & emails
- CTA : “Continuer → Vérifier mon e-mail”
- Lien : “Déjà un compte ? Se connecter”

### Step 2
- Titre : “Vérifiez votre e-mail”
- Texte : “Un e-mail a été envoyé à {email}.”
- Spinner “En attente de confirmation…”
- Boutons : “Renvoyer l’e-mail”, “Modifier l’e-mail”, “Retour à l’accueil”

**Redirect automatique** dès confirmation → `/creator` ou `/brand`.

---

## 🧠 Page /login

- Email, mot de passe
- Lien “Mot de passe oublié ?”
- CTA : “Se connecter”
- Pied : “Pas de compte ? Créer un compte”
- Erreurs : identifiants invalides, e-mail non confirmé.

---

## 🧰 Composants à créer
- `RoleSelector.tsx`
- `PasswordStrength.tsx`
- `EmailAvailabilityHint.tsx`
- `ResendEmailButton.tsx`
- `TermsCheckbox.tsx`
- `AuthCard.tsx`

---

## 🛡️ Sécurité
- CORS exact (`ENV.SITE_URL`)
- CSRF token
- Rate limit (5 req/min)
- RLS activé (création via service role)
- Session persistée

---

## 🧪 Tests
1. Signup creator → callback → /creator  
2. Signup brand → callback → /brand  
3. E-mail non confirmé → redirect step 2  
4. Resend cooldown & plafond respectés  

---

## ✅ Critères d’acceptation
- Profil créé avant vérification
- Redirection selon rôle
- UX fluide, style Clerk
- Sécurité & CORS corrects
- Textes FR cohérents
