/**
 * Input sanitization helpers for the brand interface.
 * Mirror of src/lib/admin/sanitize.ts with stricter signatures
 * (maxLength, min/max bounds, nullable URL).
 */

/**
 * Strip HTML tags, trim whitespace, and truncate to maxLength.
 */
export function sanitizeString(input: string, maxLength = 2000): string {
  if (typeof input !== 'string') return '';
  return input
    .trim()
    .replace(/<[^>]*>/g, '')
    .slice(0, maxLength);
}

/**
 * Normalize and validate an email address.
 * Returns empty string if the input doesn't look like an email.
 */
export function sanitizeEmail(input: string): string {
  if (typeof input !== 'string') return '';
  const trimmed = input.trim().toLowerCase();
  // Basic RFC-5321 shape check
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? trimmed : '';
}

/**
 * Parse and return a safe URL (http/https only).
 * Returns null if the URL is invalid or uses a disallowed scheme.
 */
export function sanitizeUrl(input: string): string | null {
  if (typeof input !== 'string') return null;
  try {
    const parsed = new URL(input.trim());
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Coerce a value to a number and clamp it within [min, max].
 * Returns null if the value cannot be parsed as a finite number.
 */
export function sanitizeNumber(
  input: unknown,
  min = -Infinity,
  max = Infinity,
): number | null {
  const num = typeof input === 'string' ? parseFloat(input) : Number(input);
  if (!isFinite(num)) return null;
  return Math.min(Math.max(num, min), max);
}
