import { test, expect, Page } from '@playwright/test';
import { waitForArchive } from './archive';

// The reviews archive renders its first page at build time and fetches the
// rest of its cards afterwards, so these specs drive that loading directly:
// when it starts, what happens when it fails, and that the first page is
// usable throughout.

const REVIEWS_URL = '/reviews/';
const INDEX_URL = 'reviews-cards.json';

/** Never let the idle trigger fire, so "did it load?" is only ever the page's own doing. */
async function holdIdleTrigger(page: Page): Promise<void> {
  await page.addInitScript(() => {
    (window as unknown as { requestIdleCallback: () => number }).requestIdleCallback = () => 0;
  });
}

test('the card index stays out of the first paint', async ({ page }) => {
  await holdIdleTrigger(page);
  const requested: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes(INDEX_URL)) requested.push(request.url());
  });

  await page.goto(REVIEWS_URL);
  const pageSize = Number(await page.locator('.archive-grid').getAttribute('data-page-size')) || 20;

  // The archive document ships one page of cards and nothing else.
  await expect(page.locator('.archive-grid .game-archive-card')).toHaveCount(pageSize);
  expect(requested, 'a plain visit must not fetch the index before it is wanted').toEqual([]);

  // ...and reaching for the filter bar is all it takes to start it.
  await page.locator('.reviews-header-container').hover();
  await waitForArchive(page);
  expect(requested.length).toBeGreaterThan(0);
});

test('a deep link fetches the card index on arrival rather than waiting for idle', async ({ page }) => {
  await holdIdleTrigger(page);
  await page.goto(`${REVIEWS_URL}?genre=Horror`);
  // Without the immediate load this never becomes ready, because the idle
  // trigger is held open and nothing was hovered.
  await waitForArchive(page);
  await expect(page.locator('#filter-genre')).toHaveValue('Horror');
});

test('a card index that never arrives leaves a working first page', async ({ page }) => {
  await page.route(`**/${INDEX_URL}`, (route) => route.fulfill({ status: 500, body: 'no index today' }));
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto(REVIEWS_URL);
  await page.waitForFunction(() => document.documentElement.dataset.archiveReady === 'true');

  const pageSize = Number(await page.locator('.archive-grid').getAttribute('data-page-size')) || 20;
  await expect(page.locator('.archive-grid .game-archive-card')).toHaveCount(pageSize);

  // The filters still work, they just cover the cards that are there.
  const genre = await page.locator('#filter-genre option').nth(1).getAttribute('value');
  expect(genre).toBeTruthy();
  await page.selectOption('#filter-genre', genre as string);
  const visible = await page.locator('.game-archive-card:visible').evaluateAll((cards) =>
    cards.map((c) => (c as HTMLElement).dataset.genre || '')
  );
  expect(visible.length).toBeGreaterThan(0);
  for (const g of visible) expect(g).toContain(genre);

  expect(pageErrors).toEqual([]);
});
