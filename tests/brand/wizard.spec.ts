import { test, expect } from '@playwright/test';

test.describe('Brand contest wizard', () => {
  test('Wizard navigation validates each step', async ({ page }) => {
    const res = await page.goto('/app/brand/contests/new');

    if (res && res.url().includes('/auth/login')) {
      test.skip(true, 'No authenticated brand session, skipping wizard test.');
    }

    await expect(page.getByTestId('wizard-progress')).toBeVisible();

    // Click continue without filling anything
    const continueButton = page.getByRole('button', { name: /Continue/i });
    await continueButton.click();

    // Expect a toast error
    const toast = page.locator('[role="status"], [data-sonner-toast], [class*="sonner"]');
    await expect(toast).toBeVisible();

    // Fill basics: title, brief, and one platform
    await page.getByLabel(/Contest title/i).fill('Summer UGC Challenge 2026');
    await page
      .getByLabel(/Brief/i)
      .fill('Describe what creators should make with at least twenty characters.');

    const platformButton = page.getByRole('button', { name: /TikTok|Instagram|YouTube|Twitter/i }).first();
    await platformButton.click();

    await continueButton.click();

    // Step 2 (budget) should now be visible
    await expect(page.getByText(/Total budget/i)).toBeVisible();

    // Go back to step 1 and ensure data is preserved
    const backButton = page.getByRole('button', { name: /Back/i });
    await backButton.click();

    await expect(page.getByDisplayValue('Summer UGC Challenge 2026')).toBeVisible();
  });
});

