import { test, expect } from '@playwright/test';

test.describe('Brand dashboard', () => {
  test('Brand dashboard loads with KPIs', async ({ page }) => {
    const res = await page.goto('/app/brand/dashboard');

    // If redirected to login, skip (no authenticated session in environment)
    if (res && res.url().includes('/auth/login')) {
      test.skip(true, 'No authenticated brand session, skipping dashboard smoke test.');
    }

    await expect(page.getByTestId('kpi-hero')).toBeVisible();
    await expect(page.getByTestId('kpi-strip')).toBeVisible();
    await expect(page.getByTestId('live-rail')).toBeVisible();

    const consoleMessages: string[] = [];
    page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      consoleMessages.push(`[${type}] ${text}`);
    });

    // Allow some activity to surface console errors
    await page.waitForTimeout(2000);

    const criticalErrors = consoleMessages.filter(
      (msg) =>
        msg.includes('Error') &&
        !msg.includes('Warning') &&
        !msg.toLowerCase().includes('react-dom') &&
        !msg.toLowerCase().includes('deprecated'),
    );

    expect(criticalErrors, `Unexpected console errors:\n${criticalErrors.join('\n')}`).toEqual([]);
  });
});

