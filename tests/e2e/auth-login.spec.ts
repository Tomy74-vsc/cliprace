import { test, expect } from "@playwright/test";

test.describe("Auth - Login UX", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const originalReplace = window.location.replace.bind(window.location);
      (window as typeof window & { __redirects?: string[] }).__redirects = [];
      window.location.replace = (url: string | URL) => {
        const redirects = (window as typeof window & { __redirects?: string[] }).__redirects!;
        redirects.push(String(url));
        // prevent navigation during tests
      };
      (window as typeof window & { __restoreLocation?: () => void }).__restoreLocation =
        () => {
          window.location.replace = originalReplace;
        };
    });

  });

  test.afterEach(async ({ page }) => {
    await page.evaluate(() => {
      (window as typeof window & { __restoreLocation?: () => void }).__restoreLocation?.();
    });
  });

  test("success: resolves redirect from API", async ({ page }) => {
    await page.route("**/api/auth/login", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, redirect: "/dashboard" }),
      });
    });

    await page.goto("/login");
    await page.getByLabel("Adresse email").fill("user@example.com");
    await page.getByLabel("Mot de passe").fill("P@ssw0rd!Test");
    await page.getByRole("button", { name: "Se connecter" }).click();

    await page.waitForFunction(
      () =>
        (window as typeof window & { __redirects?: string[] }).__redirects?.[0] ===
        "/dashboard",
    );
  });

  test("error: wrong password shows toast feedback", async ({ page }) => {
    await page.route("**/api/auth/login", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ success: false, error: "Erreur de connexion" }),
      });
    });

    await page.goto("/login");
    await page.getByLabel("Adresse email").fill("user@example.com");
    await page.getByLabel("Mot de passe").fill("wrong-password");
    await page.getByRole("button", { name: "Se connecter" }).click();

    await expect(page.getByText("Connexion echouee")).toBeVisible();
    await expect(page.getByText("Erreur de connexion")).toBeVisible();
  });
});
