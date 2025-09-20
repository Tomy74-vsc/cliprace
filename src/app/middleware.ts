import { NextResponse, type NextRequest } from "next/server";

export const config = {
  matcher: ["/admin/:path*"], // on n’intercepte que /admin/*
};

export function middleware(req: NextRequest) {
  // Supabase pose un cookie de session (sb-access-token / ou sb:token)
  const hasAuth =
    req.cookies.has("sb-access-token") || req.cookies.has("sb:token");

  if (!hasAuth) {
    const login = new URL("/login", req.url);
    login.searchParams.set("redirect", req.nextUrl.pathname);
    return NextResponse.redirect(login);
  }

  // Pas de check admin ici → c’est géré dans le layout (RPC côté serveur)
  return NextResponse.next();
}
