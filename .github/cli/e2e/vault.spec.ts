import { test, expect } from '@playwright/test';

const VAULT_URL = '/content/';

test('switching channel syncs to the URL and activates the tab', async ({ page }) => {
  await page.goto(VAULT_URL);
  await page.getByRole('button', { name: /Is It Playable/ }).click();
  await expect(page).toHaveURL(/channel=iip/);
  await expect(page.locator('.tab-btn.active')).toHaveText(/Is It Playable/);
});

test('a shared channel URL activates the right tab', async ({ page }) => {
  await page.goto(`${VAULT_URL}?channel=iip`);
  await expect(page.locator('.tab-btn.active')).toHaveText(/Is It Playable/);
});

test('an invalid channel param is ignored and the default stays active', async ({ page }) => {
  await page.goto(`${VAULT_URL}?channel=nope`);
  await expect(page.locator('.tab-btn.active')).toHaveText(/TheRhysWyrill/);
  await expect(page).not.toHaveURL(/channel=/);
});

test('vault search filters and syncs q to the URL', async ({ page }) => {
  await page.goto(VAULT_URL);
  await page.fill('#vault-search', 'elden');
  await expect(page).toHaveURL(/[?&]q=elden/);
});

test('vault pagination updates the page param', async ({ page }) => {
  await page.goto(VAULT_URL);
  await page.locator('.pagination-btn').filter({ hasText: /^2$/ }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.locator('.media-card:visible').first()).toBeVisible();
});

test("livestream VODs are excluded from the Let's Plays tab", async ({ page }) => {
  await page.goto(VAULT_URL);
  // The filter runs in updateFilteredList; poll past the initial JSON fetch
  await page.waitForFunction(() => document.querySelectorAll('.media-card h4').length > 0);
  const titles = await page.$$eval('.media-card h4', els => els.map(e => e.textContent.toLowerCase()));
  expect(titles.length).toBeGreaterThan(0);
  expect(titles.some(t => t.includes('livestream'))).toBe(false);
});
