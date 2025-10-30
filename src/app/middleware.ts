import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { logSecurityViolation } from "@/lib/audit-logger";
import { bootstrapSecurity } from "./api/_bootstrap";
import { ALLOWED_ORIGINS } from "@/lib/config";
import { isAllowedOrigin, isStateChangingMethod, supabaseCookieOptions } from "@/lib/cookies";

export const config = {
  matcher: [
    "/admin/:path*",
    "/brand/:path*",
    "/creator/:path*",
    "/app/:path*",
    "/auth/confirm",
    "/auth/email-verified",
    "/api/:path*",
  ],
};

/** Redirect helper qui garde les headers de sécurité, et durcit le cache côté auth */
function redirectWithSecurityHeaders(target: URL, opts?: { auth?: boolean }) {
  const res = NextResponse.redirect(target);
  // Sécurité commune
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  res.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  res.headers.set("Cross-Origin-Resource-Policy", "same-site");
  if (opts?.auth) {
    res.headers.set("Cache-Control", "no-store, max-age=0, must-revalidate");
  }
  return res;
}

/** Petit utilitaire lisible pour les zones protégées */
function isProtectedPath(pathname: string) {
  return (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/brand") ||
    pathname.startsWith("/creator")
  );
}

/**
 * Middleware SSR optimisé pour la gestion des sessions Supabase
 * Protège les routes et gère les callbacks d'authentification
 */
export async function middleware(req: NextRequest) {
  // 1) Boot sécurité (idempotent côté serveur)
  await bootstrapSecurity();

  // 2) Génère un nonce par requête et le propage aux pages via headers
  const nonce = crypto.randomUUID();
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);

  // Réponse "pass-through" en transmettant les headers modifiés
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  response.headers.set("Cross-Origin-Resource-Policy", "same-site");
  // CSP stricte (prod: sans unsafe-inline/eval; dev: tolère unsafe-eval pour React Fast Refresh)
  const isDev = process.env.NODE_ENV !== "production";
  const scriptSrc = isDev
    ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval'`
    : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`;
  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co https://cdn.jsdelivr.net",
    "frame-ancestors 'none'",
    "form-action 'self'",
  ].join("; ");
  response.headers.set("Content-Security-Policy", csp);

  // Origin check (soft): marque l'origine non autorisée, sans bloquer
  const origin = req.headers.get("origin");
  if (origin) {
    response.headers.set("Vary", "Origin");
    if (!ALLOWED_ORIGINS.has(origin)) {
      response.headers.set("X-Origin-Check", "fail");
    } else {
      response.headers.set("X-Origin-Check", "ok");
    }
  }

  // Enforce Origin only in production (dev: ne bloque pas)
  if (
    process.env.NODE_ENV === "production" &&
    isStateChangingMethod(req.method) &&
    !isAllowedOrigin(origin)
  ) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  // 3) Durcissement cache API et Auth
  if (req.nextUrl.pathname.startsWith("/api/")) {
    response.headers.set("Cache-Control", "no-store, max-age=0");
    response.headers.set("X-API-Version", "1.0");
  }
  if (req.nextUrl.pathname.startsWith("/auth/")) {
    response.headers.set("Cache-Control", "no-store, max-age=0, must-revalidate");
  }

  // 4) Journalisation violation CSP (optionnelle via header interne)
  const cspViolation = req.headers.get("x-csp-violation");
  if (cspViolation) {
    logSecurityViolation(
      "xss_attempt",
      {
        violation: cspViolation,
        url: req.url,
        user_agent: req.headers.get("user-agent"),
        referer: req.headers.get("referer"),
      },
      req
    );
  }

  // 4.5) Court-circuiter les routes d'auth pour éviter les manipulations de cookies inutiles
  const pathname = req.nextUrl.pathname;
  if (pathname.startsWith("/api/auth")) {
    return response; // Pas d'auth/guard ni de client Supabase sur ces endpoints
  }

  // 5) Client Supabase (cookies-sûrs uniquement sur la réponse sortante)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: Record<string, any> = {}) {
          const base = supabaseCookieOptions();
          response.cookies.set({
            name,
            value,
            ...base,
            ...options,
          });
        },
        remove(name: string, options: Record<string, any> = {}) {
          const base = supabaseCookieOptions();
          response.cookies.set({
            name,
            value: "",
            ...base,
            expires: new Date(0),
            ...options,
          });
        },
      },
    }
  );

  try {
    // 6) Laisse passer les callbacks d'auth (gérés par leurs route handlers)
    if (
      req.nextUrl.pathname.startsWith("/auth/confirm") ||
      req.nextUrl.pathname.startsWith("/auth/email-verified")
    ) {
      return response;
    }

    // 7) Zones protégées → session requise (incluant /app/**)
    if (isProtectedPath(req.nextUrl.pathname) || req.nextUrl.pathname.startsWith("/app")) {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      // Erreur lecture session → redirige login
      if (error) {
        if (process.env.NODE_ENV === "development") {
          console.error("Erreur de session dans middleware:", error);
        }
        const login = new URL("/login", req.url);
        login.searchParams.set("redirect", req.nextUrl.pathname);
        return redirectWithSecurityHeaders(login, { auth: true });
      }

      // Pas de session → login
      if (!session) {
        const login = new URL("/login", req.url);
        login.searchParams.set("redirect", req.nextUrl.pathname);
        return redirectWithSecurityHeaders(login, { auth: true });
      }

      // Email non confirmé → onboarding step 2
      if (!session.user.email_confirmed_at) {
        const signup = new URL("/signup", req.url);
        signup.searchParams.set("step", "2");
        signup.searchParams.set("message", "email_not_verified");
        return redirectWithSecurityHeaders(signup, { auth: true });
      }

      // Accès admin strict
      if (req.nextUrl.pathname.startsWith("/admin")) {
        const role = (session.user.app_metadata as any)?.role;
        if (role !== "admin") {
          const login = new URL("/login", req.url);
          login.searchParams.set("error", "insufficient-permissions");
          return redirectWithSecurityHeaders(login, { auth: true });
        }
      }
    }
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.error("Erreur inattendue dans middleware:", err);
    }
    // En cas d'erreur sur zone protégée → login
    if (isProtectedPath(req.nextUrl.pathname)) {
      const login = new URL("/login", req.url);
      login.searchParams.set("redirect", req.nextUrl.pathname);
      return redirectWithSecurityHeaders(login, { auth: true });
    }
  }

  // 8) Par défaut on laisse passer avec headers durcis
  return response;
}
