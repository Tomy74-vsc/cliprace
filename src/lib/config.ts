export const ALLOWED_ORIGINS = new Set<string>([
  process.env.NEXT_PUBLIC_APP_URL!,
]);

export const IS_PROD = process.env.NODE_ENV === "production";


