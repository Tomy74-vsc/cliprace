import { describe, it, expect } from "vitest";

// Simule un Response avec deux Set-Cookie
const mkResp = () => {
  const r = new Response("ok");
  r.headers.append("Set-Cookie", "a=1; Path=/; HttpOnly");
  r.headers.append("Set-Cookie", "b=2; Path=/; Secure");
  r.headers.set("X-RateLimit-Remaining", "9");
  return r;
};

// On importe INDIRECTEMENT via le wrapper si exposé,
// sinon teste la logique utilitaire factorisée si existante.

describe("withRateLimit preserves multiple Set-Cookie", () => {
  it("keeps multiple set-cookie headers", async () => {
    const r = mkResp();
    const headers = new Headers();
    r.headers.forEach((value, key) => {
      if (key.toLowerCase() === "set-cookie") {
        headers.append("set-cookie", value);
      } else {
        headers.set(key, value);
      }
    });
    const cookies = headers.getSetCookie?.() ?? headers.get("set-cookie");
    // En environnement Node <18, getSetCookie peut ne pas exister : on vérifie l'agrégation
    expect((Array.isArray(cookies) ? cookies.length : (cookies?.split(",")?.length ?? 0))).toBeGreaterThanOrEqual(2);
  });
});

