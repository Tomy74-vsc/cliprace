import { describe, it, expect } from "vitest";
import { validateCSRF } from "../../src/lib/csrf";

describe("CSRF shim behaviour", () => {
  it("marks POST requests without headers as valid", async () => {
    const request = new Request("http://localhost:3000/api/test", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ test: "data" }),
    });

    const result = await validateCSRF(request as any);
    expect(result.valid).toBe(true);
  });

  it("marks GET requests as valid", async () => {
    const request = new Request("http://localhost:3000/api/test", {
      method: "GET",
    });

    const result = await validateCSRF(request as any);
    expect(result.valid).toBe(true);
  });
});
