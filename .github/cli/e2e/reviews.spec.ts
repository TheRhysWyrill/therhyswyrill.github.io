import { test, expect } from '@playwright/test';

const REVIEWS_URL = '/reviews/';

test.beforeEach(async ({ page }) => {
  await page.goto(REVIEWS_URL);
});

test('hides Reset and clear-search on a clean default view', async ({ page }) => {
  await expect(page.locator('#reset-filters')).toBeHidden();
  await expect(page.locator('#clear-search')).toBeHidden();
});

test('genre filter syncs to the URL and reveals Reset (but not clear-search)', async ({ page }) => {
  await page.selectOption('#filter-genre', 'RPG');
  await expect(page).toHaveURL(/genre=RPG/);
  await expect(page.locator('#reset-filters')).toBeVisible();
  await expect(page.locator('#clear-search')).toBeHidden();
});

test('search adds q to the URL; the clear button empties just the search term', async ({ page }) => {
  await page.fill('#live-search', 'hollow');
  await expect(page).toHaveURL(/q=hollow/);
  await expect(page.locator('#clear-search')).toBeVisible();

  await page.click('#clear-search');
  await expect(page.locator('#live-search')).toHaveValue('');
  await expect(page).not.toHaveURL(/[?&]q=/);
  await expect(page.locator('#clear-search')).toBeHidden();
});

test('clicking a pagination page updates the page param and renders cards', async ({ page }) => {
  await page.locator('.pagination-btn').filter({ hasText: /^2$/ }).click();
  await expect(page).toHaveURL(/page=2/);
  const cards = page.locator('.game-archive-card:visible');
  await expect(cards.first()).toBeVisible();
  expect(await cards.count()).toBeGreaterThan(0);
});

test('Reset clears filters, search, saved state and the URL in one click', async ({ page }) => {
  await page.selectOption('#filter-genre', 'RPG');
  await page.fill('#live-search', 'hollow');
  await expect(page.locator('#reset-filters')).toBeVisible();

  await page.click('#reset-filters');
  await expect(page).toHaveURL(/\/reviews\/$/);
  await expect(page.locator('#filter-genre')).toHaveValue('');
  await expect(page.locator('#live-search')).toHaveValue('');
  await expect(page.locator('#reset-filters')).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem('reviews_current_page'))).toBeNull();
});

test('a shared filtered URL restores that state on load', async ({ page }) => {
  await page.goto(`${REVIEWS_URL}?genre=RPG&q=hollow&page=2`);
  await expect(page.locator('#filter-genre')).toHaveValue('RPG');
  await expect(page.locator('#live-search')).toHaveValue('hollow');
  await expect(page.locator('#reset-filters')).toBeVisible();
});

test('visible cards actually match the selected genre', async ({ page }) => {
  await page.selectOption('#filter-genre', 'RPG');
  const genres = await page.locator('.game-archive-card:visible').evaluateAll((cards) =>
    cards.map((c) => c.getAttribute('data-genre'))
  );
  expect(genres.length).toBeGreaterThan(0);
  for (const g of genres) expect(g).toContain('RPG');
});
