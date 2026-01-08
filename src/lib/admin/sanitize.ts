export function sanitizeString(input: string): string {
  if (typeof input !== 'string') return '';
  // Basic sanitization - remove HTML tags and trim
  return input.trim().replace(/<[^>]*>/g, '');
}

export function sanitizeEmail(email: string): string {
  if (typeof email !== 'string') return '';
  return email.trim().toLowerCase();
}

export function sanitizeNumber(input: number | string): number {
  const num = typeof input === 'string' ? parseFloat(input) : input;
  return isNaN(num) ? 0 : Math.max(0, num);
}

export function sanitizeUrl(url: string): string {
  if (typeof url !== 'string') return '';
  try {
    const parsed = new URL(url.trim());
    return parsed.toString();
  } catch {
    return '';
  }
}

