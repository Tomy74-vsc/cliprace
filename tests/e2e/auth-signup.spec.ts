import { test, expect } from "@playwright/test";

test.describe("Auth - Signup Wizard UX", () => {
  test("chemin heureux 1→2→3", async ({ page }) => {
    // Step1: intercept signup
    await page.route("**/api/auth/signup", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, user: { id: "user_1" } }),
      });
    });

    // Step2: mock supabase endpoints via getUser (poll)
    // Nous simulons l'état vérifié après un temps en changeant la réponse
    let verified = false;
    await page.route("**/auth/v1/user", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: verified
            ? { id: "user_1", email: "new@exemple.com", email_confirmed_at: new Date().toISOString() }
            : { id: "user_1", email: "new@exemple.com", email_confirmed_at: null },
        }),
      });
    });
    await page.route("**/auth/v1/session", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ session: { access_token: "t", token_type: "bearer" } }),
      });
    });

    await page.goto("/signup");

    // Step1
    await page.getByLabel("Adresse email").fill("new@exemple.com");
    await page.getByLabel("Mot de passe").fill("P@ssw0rd!Test");
    await page.getByLabel("Confirmer le mot de passe").fill("P@ssw0rd!Test");
    await page.getByRole("button", { name: "S'inscrire" }).click();

    await expect(page.getByText("Vérifiez votre email")).toBeVisible();

    // Simule la vérification email
    verified = true;
    await page.waitForTimeout(2100);
    await page.getByRole("button", { name: /Continuer vers le profil/ }).click();

    // Step3 visible
    await expect(page.getByText("Complétez votre profil")).toBeVisible();
  });
});


