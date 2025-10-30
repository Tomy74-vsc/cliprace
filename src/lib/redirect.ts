export function redirectToRole(role?: string | null): string {
  if (!role) return "/app";
  const r = role.toLowerCase();
  if (r === "creator") return "/creator";
  if (r === "brand") return "/brand";
  return "/app";
}

const ALLOWLIST: ReadonlyArray<string> = [
  "/app",
  "/app/creator",
  "/app/brand",
];

function isExternal(urlOrPath: string): boolean {
  // Reject absolute URLs with protocol or protocol-relative
  if (/^https?:\/\//i.test(urlOrPath) || urlOrPath.startsWith("//")) return true;
  return false;
}

export function safeRedirect(redirect: string | null | undefined, role?: string | null): string {
  if (typeof redirect === "string" && redirect.length > 0 && !isExternal(redirect)) {
    // Normalize: only path portion, drop query/hash for safety
    const path = redirect.split("?")[0].split("#")[0];
    if (ALLOWLIST.includes(path)) return path;
  }
  return redirectToRole(role);
}


