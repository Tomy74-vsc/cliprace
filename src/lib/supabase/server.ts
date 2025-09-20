// supabase/server.ts
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

export function createSupabaseServerClient() {
  // Avec Next 15, cookies() doit être await — on gère ça en rendant nos méthodes async.
  const cookieStorePromise = Promise.resolve(cookies() as ReturnType<typeof cookies>);

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // appelé par supabase-js pour lire toutes les cookies
        async getAll() {
          const store = await cookieStorePromise;
          return store.getAll();
        },
        // appelé pour écrire/mettre à jour des cookies (auth)
        async setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          const store = await cookieStorePromise;
          cookiesToSet.forEach(({ name, value, options }) => {
            store.set({ name, value, ...options });
          });
        },
      },
    }
  );
}
