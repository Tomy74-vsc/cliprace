import { test, expect } from "@playwright/test";

test.describe("Auth - Signup Wizard", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const originalReplace = window.location.replace.bind(window.location);
      (window as typeof window & { __redirects?: string[] }).__redirects = [];
      window.location.replace = (url: string | URL) => {
        const redirects = (window as typeof window & { __redirects?: string[] }).__redirects!;
        redirects.push(String(url));
      };
      (window as typeof window & { __restoreLocation?: () => void }).__restoreLocation =
        () => {
          window.location.replace = originalReplace;
        };
    });


    await page.route("**/api/auth/check-email", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ available: true }),
      });
    });
  });

  test.afterEach(async ({ page }) => {
    await page.evaluate(() => {
      (window as typeof window & { __restoreLocation?: () => void }).__restoreLocation?.();
    });
  });

  test("creates account and shows email verification step", async ({ page }) => {
    await page.route("**/api/auth/signup", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    });

    await page.goto("/signup");

    await page.getByLabel("Adresse email professionnelle").fill("new-user@example.com");
    await page.getByLabel("Mot de passe").fill("Str0ngP@ssword!");
    await page.getByLabel("Confirmer le mot de passe").fill("Str0ngP@ssword!");

    await page.getByRole("button", { name: "Continuer" }).click();

    await expect(
      page.getByRole("heading", { level: 2, name: /email/i }),
    ).toBeVisible();
    await expect(page.getByText("new-user@example.com")).toBeVisible();
  });

  test("completes the full wizard flow and redirects to role dashboard", async ({
    page,
  }) => {
    await page.route("**/api/auth/signup", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    });

    await page.route("**/api/auth/complete-profile", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, redirect: "/creator" }),
      });
    });

    await page.addInitScript(() => {
      const state = { confirmed: false };
      setTimeout(() => {
        state.confirmed = true;
      }, 1500);

      (window as typeof window & { __supabaseMock__?: any }).__supabaseMock__ = {
        auth: {
          getSession: async () => ({
            data: {
              session: {
                user: {
                  email_confirmed_at: state.confirmed ? new Date().toISOString() : null,
                },
              },
            },
            error: null,
          }),
          getUser: async () => ({
            data: {
              user: {
                email_confirmed_at: state.confirmed ? new Date().toISOString() : null,
              },
            },
            error: null,
          }),
        },
      };
    });

    await page.goto("/signup");

    await page.getByLabel("Adresse email professionnelle").fill("mock-user@example.com");
    await page.getByLabel("Mot de passe").fill("Str0ngP@ssword!");
    await page.getByLabel("Confirmer le mot de passe").fill("Str0ngP@ssword!");
    await page.getByRole("button", { name: "Continuer" }).click();

    const continueButton = page.getByRole("button", { name: "Continuer" });
    await expect(continueButton).toBeDisabled();
    await page.waitForTimeout(2200);
    await expect(continueButton).toBeEnabled();
    await continueButton.click();

    await expect(page.getByRole("heading", { name: /Finalisez votre profil/i })).toBeVisible();

    await page.getByLabel("Nom public").fill("Creator Test");
    await page
      .getByLabel("Bio / description")
      .fill("Createur specialise en campagnes UGC performantes.");
    await page.getByLabel("Pays").fill("fr");
    await page.getByLabel("Handle principal").fill("creatortest");
    await page.getByLabel("Pitch rapide").fill("Bio courte et engageante.");

    await page
      .locator('button[aria-label="Plateforme principale"]')
      .click();
    await page.getByRole("option", { name: /instagram/i }).click();

    await page.getByRole("button", { name: "Acceder a mon espace" }).click();

    await page.waitForFunction(
      () =>
        (window as typeof window & { __redirects?: string[] }).__redirects?.[0] ===
        "/creator",
    );
  });
});
