import { test, expect } from '@playwright/test';
import { waitForArchive } from './archive';

const REVIEWS_URL = '/reviews/';

test.beforeEach(async ({ page }) => {
  await page.goto(REVIEWS_URL);
  await waitForArchive(page);
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
  await waitForArchive(page);
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

test('verdict cards show a glyph pill with the wording kept as a label', async ({ page }) => {
  const tags = page.locator('.game-archive-card .archive-verdict-tag');
  await expect(tags.first()).toBeVisible();
  const data = await tags.evaluateAll((els) =>
    els.slice(0, 12).map((el) => ({
      text: (el.textContent || '').trim(),
      label: el.getAttribute('aria-label') || '',
    }))
  );
  expect(data.length).toBeGreaterThan(0);
  for (const d of data) {
    expect(['✓', '–', '✗']).toContain(d.text);
    expect(d.label).toMatch(/^Verdict: (recommended|not sure|not recommended)$/i);
  }
});

test('the verdict dropdown keeps the full wording with slug values', async ({ page }) => {
  const options = await page.locator('#filter-verdict option').evaluateAll((els) =>
    els.map((el) => ({
      label: (el.textContent || '').trim(),
      value: (el as HTMLOptionElement).value,
    }))
  );
  const real = options.filter((o) => o.value);
  expect(real.length).toBeGreaterThan(0);
  expect(real.map((o) => o.label)).toContain('Recommended');
  for (const o of real) {
    expect(o.label).not.toMatch(/[✓–✗]/);
    expect(o.value).toMatch(/^[a-z]+(-[a-z]+)*$/);
  }
});

test('filtering by verdict matches the cards carrying that slug', async ({ page }) => {
  await page.selectOption('#filter-verdict', 'recommended');
  await expect(page).toHaveURL(/verdict=recommended/);
  const verdicts = await page.locator('.game-archive-card:visible').evaluateAll((cards) =>
    cards.map((c) => (c as HTMLElement).dataset.verdict)
  );
  expect(verdicts.length).toBeGreaterThan(0);
  for (const v of verdicts) expect(v).toBe('recommended');
});

test('the build-time and client-rendered cards share one markup skeleton', async ({ page }) => {
  // Two renderers paint the same card — _includes/review-card.html for the
  // first page, the client renderer in pages/reviews.html for the ~460 behind
  // it — and every filter, sort, search and pagination path reads the card
  // straight off the DOM. A tweak to one that misses the other would silently
  // desync half the archive, so pin them together.
  const cards = await page.evaluate(() => {
    // Which renderer painted which card is not in the markup (and should not
    // be): the two halves are told apart by their hrefs below.
    const normaliseClass = (value: string) =>
      value
        .split(/\s+/)
        .filter(Boolean)
        // The badge's suffix is the verdict, not the card's structure.
        .map((c) => c.replace(/^archive-badge-.*$/, 'archive-badge-<verdict>'))
        .sort()
        .join(' ');

    // Attribute names are the contract; only the attributes both renderers
    // write as fixed literals also have to agree on their value.
    const FIXED_ATTRS = ['role', 'aria-hidden', 'loading', 'decoding', 'width', 'height'];

    const skeleton = (el: Element): string => {
      const attrs = [...el.attributes]
        .map((a) => {
          if (a.name === 'class') return `class="${normaliseClass(a.value)}"`;
          if (FIXED_ATTRS.includes(a.name)) return `${a.name}="${a.value}"`;
          return a.name;
        })
        // Pagination sets its own display on every card at runtime; that is
        // not part of either renderer's markup.
        .filter((a) => a !== 'style')
        .sort()
        .join(' ');
      return `<${el.tagName.toLowerCase()} ${attrs}>${[...el.children].map(skeleton).join('')}`;
    };

    return [...document.querySelectorAll<HTMLElement>('.archive-grid .game-archive-card')].map((card) => ({
      href: card.getAttribute('href'),
      skeleton: skeleton(card),
    }));
  });

  // The card index is what the browser renders the tail from, so anything in
  // it was painted in JS; everything else came from the build.
  const index = await (await page.request.get('/reviews-cards.json')).json();
  const indexed = new Set<string>(index.map((entry: { url: string }) => entry.url));
  const sources = cards.map((c) => (indexed.has(c.href || '') ? 'index' : 'build'));
  expect([...new Set(sources)].sort(), 'both renderers have to be represented').toEqual(['build', 'index']);

  const shapes = [...new Set(cards.map((c) => c.skeleton))];
  expect(shapes, 'one card shape shared by both renderers').toHaveLength(1);

  // ...and the two halves have to join into one complete, unduplicated list.
  const pageSize = Number(await page.locator('.archive-grid').getAttribute('data-page-size')) || 20;
  const hrefs = cards.map((c) => c.href);
  expect(new Set(hrefs).size, 'no review is rendered twice').toBe(hrefs.length);
  expect(hrefs.length).toBe(index.length + pageSize);
});

test('no dead space between the last content element and the footer', async ({ page }) => {
  const gap = await page.evaluate(() => {
    const footerText = document.querySelector('.site-footer p') as HTMLElement;
    const last = document.querySelector('#paginationNav') as HTMLElement;
    if (!footerText || !last) return -1;
    return Math.round(footerText.getBoundingClientRect().top - last.getBoundingClientRect().bottom);
  });
  expect(gap).toBeGreaterThanOrEqual(0);
  expect(gap).toBeLessThan(60);
});

test('archive covers fill their frame at their own ratio so nothing is cropped', async ({ page }) => {
  await page.waitForFunction(() => {
    const img = document.querySelector('.game-archive-card img') as HTMLImageElement | null;
    return !!img && img.naturalWidth > 0;
  });
  // cards below the fold are lazily loaded (naturalWidth 0) until scrolled to,
  // and pagination displays:none's the rest, so measure only the loaded ones
  const covers = await page
    .locator('.game-archive-card:visible img')
    .evaluateAll((imgs) =>
      imgs
        .map((i) => i as HTMLImageElement)
        .filter((i) => i.naturalWidth > 0)
        .slice(0, 12)
        .map((img) => {
          const cs = getComputedStyle(img);
          const box = img.getBoundingClientRect();
          const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
          const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
          return {
            padded: padX > 0.5 || padY > 0.5,
            content: (box.width - padX) / (box.height - padY),
            natural: img.naturalWidth / img.naturalHeight,
          };
        })
    );
  expect(covers.length).toBeGreaterThan(0);
  for (const c of covers) {
    // `img { padding: 0 9% }` from the theme would inset and crop the cover
    expect(c.padded).toBe(false);
    expect(Math.abs(c.content - c.natural)).toBeLessThan(0.02);
  }
});
