export type CookieOptions = {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax' | 'strict';
  path: string;
  maxAge?: number;
  expires?: Date;
};

// Returns hardened cookie options for Supabase auth cookies
export function supabaseCookieOptions(): CookieOptions {
  const isProd = process.env.NODE_ENV === 'production';
  // SameSite 'lax' is recommended for auth flows to preserve redirects/callbacks
  // Use 'strict' only for app-specific non-auth cookies if needed
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
  };
}

export function isStateChangingMethod(method: string): boolean {
  return method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE';
}

// Validates the Origin header against NEXT_PUBLIC_APP_URL (no trailing slash)
export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return true; // allow non-browser clients
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
  return appUrl.length > 0 ? origin === appUrl : true;
}


