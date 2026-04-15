import { test, expect } from '@playwright/test';

test.describe('Dashboard smoke', () => {
  test('library loads and shows book cards', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#library-grid .card')).toHaveCount(3, { timeout: 5000 });
  });

  test('clicking a book opens the detail view', async ({ page }) => {
    await page.goto('/');
    await page.locator('#library-grid .card').first().click();
    await expect(page.locator('#view-book')).toBeVisible();
    await expect(page.locator('#view-library')).toBeHidden();
  });

  test('search returns at least one match on a known Urdu word', async ({ page }) => {
    await page.goto('/');
    // 'میرے' appears 130 times in ankhain — reliable cross-library search hit.
    await page.locator('#global-search-input').fill('میرے');
    await page.locator('#global-search-btn').click();
    // Wait for at least one result card to appear in the global search results.
    await expect(page.locator('#global-search-results .card').first()).toBeVisible({ timeout: 5000 });
  });

  test('theme toggle switches data-theme', async ({ page }) => {
    await page.goto('/');
    // Capture initial theme (light by default — data-theme attribute absent or 'light').
    const initial = await page.locator('html').getAttribute('data-theme');
    await page.locator('#theme-toggle').click();
    // After toggle, data-theme should differ from initial.
    const after = await page.locator('html').getAttribute('data-theme');
    expect(after).not.toBe(initial);
  });

  test('filter by author narrows the grid', async ({ page }) => {
    await page.goto('/');
    // Wait for the library grid to load its cards first.
    await expect(page.locator('#library-grid .card')).toHaveCount(3, { timeout: 5000 });
    // Wait for the author filter <select> to have at least 2 options (the blank + one author).
    await page.waitForFunction(() => {
      const sel = document.getElementById('filter-author');
      return sel && sel.options.length >= 2;
    }, { timeout: 5000 });
    const authorSelect = page.locator('#filter-author');
    // Capture the total card count before filtering.
    const totalBefore = await page.locator('#library-grid .card').count();
    // Pick the first non-empty author option.
    await authorSelect.selectOption({ index: 1 });
    // Wait for re-render (renderLibrary is called synchronously by applyFilters).
    await page.waitForTimeout(300);
    const cards = page.locator('#library-grid .card');
    // At least one card remains, and count is less than the unfiltered total.
    const countAfter = await cards.count();
    expect(countAfter).toBeGreaterThan(0);
    expect(countAfter).toBeLessThan(totalBefore);
  });
});
