import { test, expect } from '@playwright/test';

const REVIEW_URL = '/reviews/a-space-for-the-unbound/';

test('review page shows 1-3 related reviews sharing the genre', async ({ page }) => {
  await page.goto(REVIEW_URL);
  const section = page.locator('.related-reviews');
  await expect(section).toBeVisible();
  const cards = section.locator('.game-archive-card');
  const count = await cards.count();
  expect(count).toBeGreaterThanOrEqual(1);
  expect(count).toBeLessThanOrEqual(3);
  for (let i = 0; i < count; i++) {
    await expect(cards.nth(i)).toHaveAttribute('href', /\/reviews\//);
  }
});

test('related reviews never include the current review', async ({ page }) => {
  await page.goto(REVIEW_URL);
  const hrefs = await page.locator('.related-reviews .game-archive-card').evaluateAll((cards) =>
    cards.map((c) => c.getAttribute('href'))
  );
  for (const href of hrefs) expect(href).not.toBe(REVIEW_URL);
});

test('review cards carry the reading-time chip', async ({ page }) => {
  await page.goto(REVIEW_URL);
  await expect(page.locator('.archive-card-readtime').first()).toContainText('min read');
});

test('review pages fetch the slim journeys file, never the 1.8 MB vault archive', async ({ page }) => {
  const requested: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('videos_trw.json')) requested.push(r.url());
  });
  await page.goto(REVIEW_URL);
  await page.waitForTimeout(1500); // give the matcher's fetch a moment
  expect(requested).toHaveLength(0);
});
