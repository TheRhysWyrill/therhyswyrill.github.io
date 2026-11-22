import { expect, Page } from '@playwright/test';

/**
 * The reviews archive renders its first page of cards at build time, fetches
 * the rest of the card index afterwards (on idle, or straight away for a deep
 * link), and only then wires up its filters, sort, search and pagination.
 * Anything that reads the grid therefore has to wait for the archive rather
 * than for the page's `load` event.
 */
export async function waitForArchive(page: Page): Promise<void> {
  await page.waitForFunction(() => document.documentElement.dataset.archiveReady === 'true', undefined, {
    timeout: 20_000,
  });

  // "Ready" also covers a card index that never arrived — the archive then
  // falls back to the build-rendered first page — so check it actually did:
  // the grid has to hold more cards than the build renders on its own.
  const grid = page.locator('.archive-grid');
  const pageSize = Number(await grid.getAttribute('data-page-size')) || 20;
  const cards = await grid.locator('.game-archive-card').count();
  expect(cards, 'the card index should extend the build-rendered first page').toBeGreaterThan(pageSize);
}
