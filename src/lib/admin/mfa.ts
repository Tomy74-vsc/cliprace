import crypto from 'crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { createError } from '@/lib/errors';
import { getAdminClient } from '@/lib/admin/supabase';

type AdminMfaRow = {
  user_id: string;
  secret_enc: string;
  is_enabled: boolean;
  verified_at: string | null;
  last_used_step: number | null;
};

type SupabaseErrorLike = { message?: string; code?: string } | null | undefined;

function isMissingTable(error: SupabaseErrorLike, tableName: string) {
  const code = String((error as UnsafeAny)?.code || '').toUpperCase();
  if (code === '42P01') return true;
  const msg = String((error as UnsafeAny)?.message || '').toLowerCase();
  if (!msg.includes(tableName.toLowerCase())) return false;
  return msg.includes('does not exist') || msg.includes('could not find') || msg.includes('schema cache');
}

export function isAdminMfaRequired() {
  const raw = String(process.env.ADMIN_MFA_REQUIRED || '').toLowerCase().trim();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

const COOKIE_NAME = 'admin_mfa_verified';

function getCookieSecret() {
  const secret = process.env.ADMIN_MFA_COOKIE_SECRET || '';
  return secret || null;
}

function getCookieSecretOrThrow() {
  const secret = getCookieSecret();
  if (!secret) throw createError('CONFIG_ERROR', 'ADMIN_MFA_COOKIE_SECRET is missing', 500);
  return secret;
}

function getEncryptionKey() {
  const raw = process.env.ADMIN_MFA_ENCRYPTION_KEY || '';
  if (!raw) {
    throw createError(
      'CONFIG_ERROR',
      'ADMIN_MFA_ENCRYPTION_KEY is missing',
      500
    );
  }
  const buf = Buffer.from(raw, 'base64');
  if (buf.length !== 32) {
    throw createError(
      'CONFIG_ERROR',
      'ADMIN_MFA_ENCRYPTION_KEY must be 32 bytes base64',
      500
    );
  }
  return buf;
}

export function encryptAdminTotpSecret(secret: string) {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString('base64');
}

export function decryptAdminTotpSecret(enc: string) {
  const key = getEncryptionKey();
  const raw = Buffer.from(enc, 'base64');
  if (raw.length < 12 + 16 + 1) {
    throw createError('VALIDATION_ERROR', 'Invalid secret encoding', 400);
  }
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const ciphertext = raw.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString('utf8');
}

export async function getAdminMfaRow(userId: string): Promise<AdminMfaRow | null> {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from('admin_mfa')
    .select('user_id, secret_enc, is_enabled, verified_at, last_used_step')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    if (isMissingTable(error, 'admin_mfa')) return null;
    throw createError('DATABASE_ERROR', 'Failed to load admin MFA status', 500, error.message);
  }

  return (data as AdminMfaRow | null) ?? null;
}

type CookiePayload = { userId: string; expiresAt: number };

function signCookiePayload(input: CookiePayload) {
  const body = JSON.stringify(input);
  const sig = crypto
    .createHmac('sha256', getCookieSecretOrThrow())
    .update(body)
    .digest('base64url');
  return `${Buffer.from(body).toString('base64url')}.${sig}`;
}

function verifyCookieValue(value: string): CookiePayload | null {
  const secret = getCookieSecret();
  if (!secret) return null;
  const [bodyB64, sig] = value.split('.');
  if (!bodyB64 || !sig) return null;
  const body = Buffer.from(bodyB64, 'base64url').toString('utf8');
  const expected = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('base64url');
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const parsed = JSON.parse(body) as CookiePayload;
    if (!parsed?.userId || typeof parsed.expiresAt !== 'number') return null;
    if (Date.now() > parsed.expiresAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function readAdminMfaVerifiedCookie(userId: string) {
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  if (!raw) return false;
  const payload = verifyCookieValue(raw);
  return Boolean(payload && payload.userId === userId);
}

export function buildAdminMfaCookieValue(userId: string, ttlSeconds: number) {
  return signCookiePayload({ userId, expiresAt: Date.now() + ttlSeconds * 1000 });
}

export async function requireAdminMfaVerified(userId: string) {
  if (!isAdminMfaRequired()) return;

  if (!process.env.ADMIN_MFA_COOKIE_SECRET) {
    throw createError('CONFIG_ERROR', 'ADMIN_MFA_COOKIE_SECRET is missing', 500);
  }

  const ok = await readAdminMfaVerifiedCookie(userId);
  if (!ok) {
    throw createError('FORBIDDEN', 'Admin MFA required', 403, { code: 'ADMIN_MFA_REQUIRED' });
  }
}

export async function enforceAdminMfa(userId: string) {
  if (!isAdminMfaRequired()) return;

  const row = await getAdminMfaRow(userId);
  if (!row || !row.is_enabled) {
    throw createError('FORBIDDEN', 'Admin MFA setup required', 403, { code: 'ADMIN_MFA_SETUP_REQUIRED' });
  }

  await requireAdminMfaVerified(userId);
}

export async function enforceAdminMfaOrRedirect(userId: string) {
  if (!isAdminMfaRequired()) return;
  try {
    await enforceAdminMfa(userId);
  } catch (e) {
    redirect('/auth/admin-mfa');
  }
}
