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

test('the default tab, heading and cards use the Complete Journeys branding', async ({ page }) => {
  await page.goto(VAULT_URL);
  await expect(page.locator('.tab-btn').first()).toHaveText(/Complete Journeys/);
  await expect(page.locator('#channel-title')).toHaveText('Complete Journeys');
  await page.waitForFunction(() => document.querySelectorAll('.media-card span').length > 0);
  await expect(page.locator('.media-card span').first()).toHaveText('Complete Journey');
});

test('livestream VODs are excluded from the Complete Journeys tab', async ({ page }) => {
  await page.goto(VAULT_URL);
  // The filter runs in updateFilteredList; poll past the initial JSON fetch
  await page.waitForFunction(() => document.querySelectorAll('.media-card h4').length > 0);
  const titles = await page.$$eval('.media-card h4', els => els.map(e => e.textContent.toLowerCase()));
  expect(titles.length).toBeGreaterThan(0);
  expect(titles.some(t => t.includes('livestream'))).toBe(false);
});

test('vault thumbnails fill the card edge to edge with no crop', async ({ page }) => {
  await page.goto(VAULT_URL);
  await page.waitForFunction(() => {
    const imgs = [...document.querySelectorAll('#video-vault-grid img')] as HTMLImageElement[];
    return imgs.length > 0 && imgs.slice(0, 8).every((i) => i.naturalWidth > 0);
  });
  // thumbnails below the fold are lazily loaded (naturalWidth 0), so measure
  // only the ones that have actually arrived
  const cards = await page.locator('#video-vault-grid img').evaluateAll((imgs) =>
    (imgs as HTMLImageElement[])
      .filter((i) => i.naturalWidth > 0)
      .slice(0, 8)
      .map((img) => {
        const cs = getComputedStyle(img);
        const box = img.getBoundingClientRect();
        const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
        const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
        const card = img.closest('div') as HTMLElement;
        return {
          padded: padX > 0.5 || padY > 0.5,
          contentRatio: (box.width - padX) / (box.height - padY),
          naturalRatio: img.naturalWidth / img.naturalHeight,
          naturalWidth: img.naturalWidth,
          // both from getBoundingClientRect: `html { zoom: 90% }` makes rect and
          // clientWidth disagree, so mixing them would measure the zoom, not a gap
          spread: Math.abs(box.width - card.getBoundingClientRect().width),
          fallbacks: img.dataset.thumbNext
        };
      })
  );
  expect(cards.length).toBeGreaterThan(0);
  for (const c of cards) {
    // the theme's `img { padding: 0 9% }` used to inset the content box, which
    // cut both sides off and sheared the frame's height
    expect(c.padded).toBe(false);
    expect(c.spread).toBeLessThanOrEqual(3.5); // card's own 1px borders
    expect(Math.abs(c.contentRatio - c.naturalRatio)).toBeLessThan(0.02);
    expect(Math.abs(c.contentRatio - 16 / 9)).toBeLessThan(0.02);
    // YouTube's 120x90 placeholder would fail this, and the fallback chain is what recovers it
    expect(c.naturalWidth).toBeGreaterThanOrEqual(320);
    expect(c.fallbacks).toContain('hq720');
  }
});
