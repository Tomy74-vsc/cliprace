import { cookies, headers } from 'next/headers';

export async function getRequestCookieHeader() {
  try {
    const cookieStore = await cookies();
    const all = cookieStore.getAll();
    if (all.length === 0) return '';
    return all.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ');
  } catch {
    return '';
  }
}

export async function getRequestOrigin() {
  try {
    const headerStore = await headers();
    const forwardedProto = headerStore.get('x-forwarded-proto');
    const proto = forwardedProto ? forwardedProto.split(',')[0].trim() : 'http';
    const envSiteUrl = process.env.NEXT_PUBLIC_SITE_URL || '';
    const envHost = envSiteUrl.includes('://') ? new URL(envSiteUrl).host : '';
    const host =
      headerStore.get('x-forwarded-host') ||
      headerStore.get('host') ||
      envHost;
    if (!host) return 'http://localhost:3000';
    return `${proto}://${host}`;
  } catch {
    return process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  }
}

export async function fetchAdminApi(input: string, init: RequestInit = {}) {
  const [origin, cookieHeader] = await Promise.all([getRequestOrigin(), getRequestCookieHeader()]);
  const url = input.startsWith('http://') || input.startsWith('https://') ? input : `${origin}${input}`;
  const headersOut = new Headers(init.headers);
  if (cookieHeader && !headersOut.has('cookie')) {
    headersOut.set('cookie', cookieHeader);
  }
  return fetch(url, { ...init, headers: headersOut });
}
