import { test, expect } from '@playwright/test';

const REVIEW_URL = '/reviews/a-space-for-the-unbound/';

test('review page shows 1-5 related reviews sharing the genre', async ({ page }) => {
  await page.goto(REVIEW_URL);
  const section = page.locator('.related-reviews');
  await expect(section).toBeVisible();
  const cards = section.locator('.game-archive-card');
  const count = await cards.count();
  expect(count).toBeGreaterThanOrEqual(1);
  expect(count).toBeLessThanOrEqual(5);
  for (let i = 0; i < count; i++) {
    await expect(cards.nth(i)).toHaveAttribute('href', /\/reviews\//);
  }
});

test('related review covers keep their 16:9 ratio instead of being cropped', async ({ page }) => {
  await page.goto(REVIEW_URL);
  const first = page.locator('.related-reviews .game-archive-card').first();
  const ratio = await first.locator('img').evaluate((img) => {
    const r = img.getBoundingClientRect();
    return +(r.width / r.height).toFixed(2);
  });
  expect(Math.abs(ratio - 16 / 9)).toBeLessThan(0.08);
});

test('review card meta uses pills with no text separators', async ({ page }) => {
  await page.goto(REVIEW_URL);
  const meta = page.locator('.archive-card-meta').first();
  await expect(meta).not.toContainText('|');
  expect(await meta.locator('.archive-card-pill').count()).toBeGreaterThanOrEqual(2);
  await expect(meta.locator('.archive-card-pill--genre')).toHaveCount(1);
  await expect(meta.locator('.archive-card-pill--year')).toHaveCount(1);
});

test('related reviews never include the current review', async ({ page }) => {
  await page.goto(REVIEW_URL);
  const hrefs = await page.locator('.related-reviews .game-archive-card').evaluateAll((cards) =>
    cards.map((c) => c.getAttribute('href'))
  );
  for (const href of hrefs) expect(href).not.toBe(REVIEW_URL);
});

test('the review page still spells the verdict out in its sidebar pill', async ({ page }) => {
  await page.goto(REVIEW_URL);
  const pill = page.locator('.verdict-pill');
  await expect(pill).toBeVisible();
  await expect(pill).toHaveText(/recommended|not sure/i);
  await expect(pill).not.toHaveText(/^[✓–✗]$/);
});

test('"More like this" is no longer capped at the old 800px strip', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto(REVIEW_URL);
  const section = page.locator('.related-reviews');
  const maxWidth = await section.evaluate((el) => parseInt(getComputedStyle(el).maxWidth, 10));
  expect(maxWidth).toBeGreaterThanOrEqual(1100);

  const widths = await section
    .locator('.game-archive-card')
    .evaluateAll((els) => els.map((e) => e.getBoundingClientRect().width));
  expect(widths.length).toBeGreaterThan(0);
  for (const w of widths) expect(w).toBeGreaterThan(150);
});

test('review cards keep the two badges that carry real information', async ({ page }) => {
  await page.goto(REVIEW_URL);
  const first = page.locator('.game-archive-card').first();
  await expect(first.locator('.archive-verdict-tag')).toBeVisible();
  await expect(first.locator('.archive-card-platform')).not.toBeEmpty();

  // The reading-time chip was removed: 99.5% of the archive read as 3 or 4
  // minutes, so it labelled every card with the same thing.
  await expect(page.locator('.archive-card-readtime')).toHaveCount(0);
});

test('the hero cover fills its banner instead of being inset by image padding', async ({ page }) => {
  // The theme's base stylesheet gives every bare `img` 9% side padding. With
  // box-sizing: border-box that shrinks a filling image's content box, so the
  // banner's own background shows down both sides as black bars. A CSS
  // background is immune to it, which is why this only appeared once the cover
  // became a real <img> — the same trap the archive covers and vault
  // thumbnails already have tests for.
  for (const width of [1600, 420]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(REVIEW_URL);

    const img = page.locator('.review-hero-cover');
    await expect(img).toBeVisible();

    const m = await img.evaluate((el) => {
      const cs = getComputedStyle(el);
      const frame = el.parentElement!.getBoundingClientRect();
      const box = el.getBoundingClientRect();
      return {
        padding: [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft],
        objectFit: cs.objectFit,
        gapLeft: box.left - frame.left,
        gapRight: frame.right - box.right,
        gapTop: box.top - frame.top,
        gapBottom: frame.bottom - box.bottom,
      };
    });

    // the cause: a filling image must carry no padding of its own
    expect(m.padding, `at ${width}px`).toEqual(['0px', '0px', '0px', '0px']);
    expect(m.objectFit).toBe('cover');

    // and the effect: flush against the banner, whose own 1px border is the
    // only thing that may show between them
    for (const gap of [m.gapLeft, m.gapRight, m.gapTop, m.gapBottom]) {
      expect(Math.abs(gap), `at ${width}px, gaps ${JSON.stringify(m)}`).toBeLessThanOrEqual(2);
    }
  }
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
