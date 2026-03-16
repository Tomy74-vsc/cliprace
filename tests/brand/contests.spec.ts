import { test, expect } from '@playwright/test';

async function navigateOrSkipToContests(page: import('@playwright/test').Page) {
  const res = await page.goto('/app/brand/contests');
  if (res && res.url().includes('/auth/login')) {
    test.skip(true, 'No authenticated brand session, skipping contests tests.');
  }
}

test.describe('Brand contests list', () => {
  test('Contests list loads and filters work', async ({ page }) => {
    await navigateOrSkipToContests(page);

    await expect(
      page.locator('table, [data-testid="contests-table"]'),
    ).toBeVisible({ timeout: 10_000 });

    // Click on "Active" pill
    const activePill = page.getByRole('tab', { name: /Active/i });
    await activePill.click();
    await expect(page).toHaveURL(/status=active/);

    // Click back on "All"
    const allPill = page.getByRole('tab', { name: /^All$/i });
    await allPill.click();
    await expect(page).not.toHaveURL(/status=/);
  });

  test('Contest detail tabs are accessible', async ({ page }) => {
    await navigateOrSkipToContests(page);

    const tableOrList = page.locator('table tbody tr, [data-testid="contests-table"] [data-row-id]');
    const rowCount = await tableOrList.count();
    if (rowCount === 0) {
      test.skip(true, 'No contests available to test detail view.');
    }

    // Click on the first row / item
    const firstRow = tableOrList.first();
    await firstRow.click();

    await expect(page.getByTestId('contest-tabs')).toBeVisible();

    const tablist = page.getByRole('tablist');
    await expect(tablist).toBeVisible();

    await expect(page.getByRole('tab', { name: /Overview/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /UGC/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Leaderboard/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Analytics/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Settings/i })).toBeVisible();
  });
});

