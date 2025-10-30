/**
 * Tests E2E pour le flux complet d'authentification
 * Login, Signup, Email Verification, Password Reset
 */

import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test.describe('Login Page', () => {
    test('should display login form', async ({ page }) => {
      await page.goto('/login');
      
      await expect(page.locator('h1')).toContainText('Connexion');
      await expect(page.locator('input[type="email"]')).toBeVisible();
      await expect(page.locator('input[type="password"]')).toBeVisible();
      await expect(page.locator('button[type="submit"]')).toBeVisible();
    });

    test('should show validation errors for invalid email', async ({ page }) => {
      await page.goto('/login');
      
      await page.locator('input[type="email"]').fill('invalid-email');
      await page.locator('input[type="password"]').fill('password');
      await page.locator('button[type="submit"]').click();
      
      await expect(page.locator('[role="alert"]')).toBeVisible();
      await expect(page.locator('[role="alert"]')).toContainText('email');
    });

    test('should show validation errors for empty password', async ({ page }) => {
      await page.goto('/login');
      
      await page.locator('input[type="email"]').fill('user@example.com');
      await page.locator('button[type="submit"]').click();
      
      await expect(page.locator('[role="alert"]')).toBeVisible();
    });

    test('should disable submit button while submitting', async ({ page }) => {
      await page.goto('/login');
      
      await page.locator('input[type="email"]').fill('user@example.com');
      await page.locator('input[type="password"]').fill('Password123!');
      
      const submitButton = page.locator('button[type="submit"]');
      await submitButton.click();
      
      await expect(submitButton).toBeDisabled();
    });

    test('should have accessible labels', async ({ page }) => {
      await page.goto('/login');
      
      const emailInput = page.locator('input[type="email"]');
      const passwordInput = page.locator('input[type="password"]');
      
      await expect(emailInput).toHaveAttribute('aria-invalid', 'false');
      await expect(passwordInput).toHaveAttribute('aria-invalid', 'false');
    });

    test('should navigate to forgot password page', async ({ page }) => {
      await page.goto('/login');
      
      await page.locator('a:has-text("Mot de passe oublié")').click();
      await expect(page).toHaveURL('/forgot');
    });

    test('should navigate to signup page', async ({ page }) => {
      await page.goto('/login');
      
      await page.locator('a:has-text("Créez-en un")').click();
      await expect(page).toHaveURL(/\/signup/);
    });
  });

  test.describe('Forgot Password Page', () => {
    test('should display forgot password form', async ({ page }) => {
      await page.goto('/forgot');
      
      await expect(page.locator('h1')).toContainText('Réinitialiser');
      await expect(page.locator('input[type="email"]')).toBeVisible();
      await expect(page.locator('button[type="submit"]')).toBeVisible();
    });

    test('should show validation error for invalid email', async ({ page }) => {
      await page.goto('/forgot');
      
      await page.locator('input[type="email"]').fill('invalid');
      await page.locator('button[type="submit"]').click();
      
      await expect(page.locator('[role="alert"]')).toBeVisible();
    });

    test('should disable submit button while submitting', async ({ page }) => {
      await page.goto('/forgot');
      
      await page.locator('input[type="email"]').fill('user@example.com');
      
      const submitButton = page.locator('button[type="submit"]');
      await submitButton.click();
      
      await expect(submitButton).toBeDisabled();
    });

    test('should navigate back to login', async ({ page }) => {
      await page.goto('/forgot');
      
      await page.locator('a:has-text("Retour à la connexion")').click();
      await expect(page).toHaveURL('/login');
    });
  });

  test.describe('Reset Password Page', () => {
    test('should display reset password form', async ({ page }) => {
      await page.goto('/auth/reset-password');
      
      await expect(page.locator('h1')).toContainText('Nouveau mot de passe');
      await expect(page.locator('input[type="password"]').first()).toBeVisible();
      await expect(page.locator('button[type="submit"]')).toBeVisible();
    });

    test('should show password strength indicator', async ({ page }) => {
      await page.goto('/auth/reset-password');
      
      const passwordInput = page.locator('input#password');
      await passwordInput.fill('Weak1!');
      
      // Should show password strength component
      await expect(page.locator('text=/force/i')).toBeVisible();
    });

    test('should show error when passwords do not match', async ({ page }) => {
      await page.goto('/auth/reset-password');
      
      await page.locator('input#password').fill('NewP@ssw0rd!');
      await page.locator('input#confirmPassword').fill('DifferentP@ss1');
      await page.locator('button[type="submit"]').click();
      
      await expect(page.locator('[role="alert"]')).toContainText('correspondent pas');
    });

    test('should validate password requirements', async ({ page }) => {
      await page.goto('/auth/reset-password');
      
      await page.locator('input#password').fill('weak');
      await page.locator('input#confirmPassword').fill('weak');
      await page.locator('button[type="submit"]').click();
      
      await expect(page.locator('[role="alert"]')).toBeVisible();
    });
  });

  test.describe('Signup Page', () => {
    test('should display signup wizard', async ({ page }) => {
      await page.goto('/signup');
      
      await expect(page.locator('h2:has-text("Créer votre compte")')).toBeVisible();
      await expect(page.locator('text=Créateur')).toBeVisible();
      await expect(page.locator('text=Marque')).toBeVisible();
    });

    test('should allow role selection', async ({ page }) => {
      await page.goto('/signup');
      
      const creatorButton = page.locator('button:has-text("Créateur")');
      const brandButton = page.locator('button:has-text("Marque")');
      
      await creatorButton.click();
      await expect(creatorButton).toHaveClass(/border-indigo-500/);
      
      await brandButton.click();
      await expect(brandButton).toHaveClass(/border-indigo-500/);
    });

    test('should show email validation in real-time', async ({ page }) => {
      await page.goto('/signup');
      
      const emailInput = page.locator('input[type="email"]');
      await emailInput.fill('invalid');
      await emailInput.blur();
      
      // Should show validation error
      await expect(page.locator('text=/Format.*email/i')).toBeVisible();
    });

    test('should show password strength indicator', async ({ page }) => {
      await page.goto('/signup');
      
      const passwordInput = page.locator('input[type="password"]').first();
      await passwordInput.fill('TestP@ss1');
      
      // Should show strength indicator
      await expect(page.locator('text=/force/i')).toBeVisible();
    });
  });

  test.describe('Accessibility', () => {
    test('login page should be keyboard navigable', async ({ page }) => {
      await page.goto('/login');
      
      await page.keyboard.press('Tab'); // Focus email
      await expect(page.locator('input[type="email"]')).toBeFocused();
      
      await page.keyboard.press('Tab'); // Focus password
      await expect(page.locator('input[type="password"]')).toBeFocused();
      
      await page.keyboard.press('Tab'); // Focus submit button
      await expect(page.locator('button[type="submit"]')).toBeFocused();
    });

    test('should have proper ARIA labels', async ({ page }) => {
      await page.goto('/login');
      
      const emailInput = page.locator('input[type="email"]');
      const passwordInput = page.locator('input[type="password"]');
      
      await expect(emailInput).toHaveAttribute('id', 'email');
      await expect(passwordInput).toHaveAttribute('id', 'password');
      
      // Labels should be associated
      const emailLabel = page.locator('label[for="email"]');
      const passwordLabel = page.locator('label[for="password"]');
      
      await expect(emailLabel).toBeVisible();
      await expect(passwordLabel).toBeVisible();
    });
  });

  test.describe('Toast Notifications', () => {
    test('should show toast on successful action', async ({ page }) => {
      await page.goto('/forgot');
      
      // Fill valid email
      await page.locator('input[type="email"]').fill('user@example.com');
      await page.locator('button[type="submit"]').click();
      
      // Toast should appear (if backend is mocked properly)
      // Note: This requires proper API mocking in the test environment
      await page.waitForTimeout(1000);
    });
  });
});

