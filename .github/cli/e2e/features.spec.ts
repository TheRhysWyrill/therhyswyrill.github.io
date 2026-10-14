import { test, expect } from '@playwright/test';
import { waitForArchive } from './archive';

// Regression specs for the 2026-10 feature batch: active-filter chips,
// clickable genre/year pills, the aria-live result counts, the vault sort
// dropdown, the watched-tracker, verdict deep links, the homepage vault
// strip, The Numbers page, and the reviews page width/header layout.

const REVIEWS_URL = '/reviews/';
const VAULT_URL = '/content/';
const NUMBERS_URL = '/numbers/';

// ── Active-filter chips ────────────────────────────────────────────────────

test('setting a filter reveals a removable chip and clearing it resets that filter', async ({ page }) => {
  await page.goto(REVIEWS_URL);
  await waitForArchive(page);
  await page.selectOption('#filter-genre', 'RPG');
  const chip = page.locator('.active-chip', { hasText: 'RPG' });
  await expect(chip).toBeVisible();
  await chip.locator('.chip-clear').click();
  await expect(page.locator('.active-chips')).toBeHidden();
  await expect(page.locator('#filter-genre')).toHaveValue('');
});

test('search shows its own chip and each chip clears independently', async ({ page }) => {
  await page.goto(REVIEWS_URL);
  await waitForArchive(page);
  await page.fill('#live-search', 'hollow');
  await page.selectOption('#filter-verdict', 'recommended');
  await expect(page.locator('.active-chip', { hasText: 'hollow' })).toBeVisible();
  await expect(page.locator('.active-chip', { hasText: 'Recommended' })).toBeVisible();

  await page.locator('.active-chip', { hasText: 'hollow' }).locator('.chip-clear').click();
  await expect(page.locator('#live-search')).toHaveValue('');
  await expect(page.locator('.active-chip', { hasText: 'Recommended' })).toBeVisible();
  await expect(page.locator('#filter-verdict')).toHaveValue('recommended');
});

// ── Clickable genre/year pills ─────────────────────────────────────────────

test('clicking a genre pill navigates to the genre-filtered archive', async ({ page }) => {
  await page.goto(REVIEWS_URL);
  await waitForArchive(page);
  const card = page.locator('.game-archive-card:visible').first();
  // Read the raw genre from data-genre: the pill's innerText is uppercased by CSS,
  // while navigation uses the first comma token in its original casing
  const genreText = ((await card.getAttribute('data-genre')) || '').split(',')[0].trim();
  await card.locator('.archive-card-pill--genre').click();
  await expect(page).toHaveURL(new RegExp('genre=' + encodeURIComponent(genreText)));
});

test('clicking a year pill navigates to the year-filtered archive', async ({ page }) => {
  await page.goto(REVIEWS_URL);
  await waitForArchive(page);
  const card = page.locator('.game-archive-card:visible').first();
  const year = ((await card.getAttribute('data-year')) || '').trim();
  await card.locator('.archive-card-pill--year').click();
  await expect(page).toHaveURL(new RegExp('year=' + year));
});

// ── Verdict deep links (from the homepage backlog strip) ──────────────────

test('a verdict deep link filters the archive and shows its chip', async ({ page }) => {
  await page.goto(REVIEWS_URL + '?verdict=not-sure');
  await waitForArchive(page);
  await expect(page.locator('#filter-verdict')).toHaveValue('not-sure');
  await expect(page.locator('.active-chip', { hasText: 'Not Sure' })).toBeVisible();
  const visible = page.locator('.game-archive-card:visible');
  expect(await visible.count()).toBeGreaterThan(0);
});

// ── aria-live result counts ────────────────────────────────────────────────

test('filtering announces the result count to screen readers', async ({ page }) => {
  await page.goto(REVIEWS_URL);
  await waitForArchive(page);
  const live = page.locator('#reviews-result-count');
  await page.selectOption('#filter-verdict', 'recommended');
  await expect(live).toContainText(/match/);
  expect(await live.innerText()).toMatch(/\d/);
});

test('the vault announces its filtered count too', async ({ page }) => {
  await page.goto(VAULT_URL);
  await page.fill('#vault-search', 'mana');
  await expect(page.locator('#vault-result-count')).toContainText(/video/, { timeout: 10_000 });
});

// ── Vault sort dropdown ────────────────────────────────────────────────────

test('newest-first sorts dated videos descending', async ({ page }) => {
  await page.goto(VAULT_URL);
  await page.waitForFunction(() => document.querySelectorAll('.media-card').length > 0);
  await page.selectOption('#vault-sort', 'newest');
  await expect(page.locator('#vault-sort')).toHaveValue('newest');

  // Page 1 under "newest" must be the newest dated videos: match the rendered
  // titles against the channel data and check the dates never increase.
  const titles = await page.locator('.media-card h4').allInnerTexts();
  const data = await (await page.request.get('/assets/data/videos_trw.json')).json();
  const dateByTitle = new Map(data.map((v) => [v.title, v.published || '']));
  const dated = titles.map((t) => dateByTitle.get(t) || '').filter(Boolean);
  expect(dated.length).toBeGreaterThan(0);
  for (let i = 1; i < dated.length; i++) expect(dated[i - 1] >= dated[i]).toBe(true);
  // persisted for next visit
  expect(await page.evaluate(() => localStorage.getItem('vault_sort'))).toBe('newest');
  await page.evaluate(() => localStorage.removeItem('vault_sort'));
});

test('oldest-first is the reverse of newest-first and really reorders', async ({ page }) => {
  await page.goto(VAULT_URL);
  await page.waitForFunction(() => document.querySelectorAll('.media-card h4').length > 0);
  const data = await (await page.request.get('/assets/data/videos_trw.json')).json();
  const dateByTitle = new Map(data.map((v: any) => [v.title, v.published || '']));

  await page.selectOption('#vault-sort', 'newest');
  const newestTitles = await page.locator('.media-card h4').allInnerTexts();

  await page.selectOption('#vault-sort', 'oldest');
  // The control has to visibly change the grid, not just its own value: a
  // comparator fed no dates used to return 0 for every pair and no-op.
  await expect
    .poll(async () => (await page.locator('.media-card h4').allInnerTexts())[0])
    .not.toBe(newestTitles[0]);

  const oldestTitles = await page.locator('.media-card h4').allInnerTexts();
  const dated = oldestTitles.map((t) => dateByTitle.get(t) || '').filter(Boolean);
  expect(dated.length).toBeGreaterThan(0);
  for (let i = 1; i < dated.length; i++) expect(dated[i - 1] <= dated[i]).toBe(true);

  // Undated uploads cannot be placed in a date order, so they must all sink
  // past the dated ones rather than scattering through the results.
  const undatedIdx = oldestTitles.map((t) => (dateByTitle.get(t) ? 0 : 1));
  expect(undatedIdx.indexOf(1)).toBe(-1);
  await page.evaluate(() => localStorage.removeItem('vault_sort'));
});

test('the sort dropdown remembers its persisted value on reload', async ({ page }) => {
  await page.goto(VAULT_URL);
  await page.selectOption('#vault-sort', 'alpha');
  await page.reload();
  await expect(page.locator('#vault-sort')).toHaveValue('alpha');
  // clean up so other specs see the default
  await page.evaluate(() => localStorage.removeItem('vault_sort'));
});

// ── Watched tracker ────────────────────────────────────────────────────────

test('marking watched persists to localStorage and toggles back off', async ({ page }) => {
  await page.goto(VAULT_URL);
  await page.waitForFunction(() => document.querySelectorAll('.watched-toggle').length > 0);

  const btn = page.locator('.watched-toggle').first();
  await btn.click();
  await expect(btn).toHaveAttribute('aria-pressed', 'true');
  await expect(btn).toContainText('Watched');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('vault_watched') || '[]'));
  expect(stored.length).toBe(1);

  await btn.click();
  await expect(btn).toHaveAttribute('aria-pressed', 'false');
  await expect(btn).toContainText('Mark watched');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('vault_watched') || '[]'))).toHaveLength(0);
});

test('unwatched-only hides videos marked watched', async ({ page }) => {
  await page.goto(VAULT_URL);
  await page.waitForFunction(() => document.querySelectorAll('.watched-toggle').length > 0);
  const firstId = await page.locator('.watched-toggle').first().evaluate((btn) => {
    return btn.getAttribute('onclick').match(/'([^']+)'/)[1];
  });
  await page.locator('.watched-toggle').first().click();
  await page.check('#unwatched-only');
  const ids = await page.locator('.watched-toggle').evaluateAll((btns) =>
    btns.map(b => b.getAttribute('onclick').match(/'([^']+)'/)[1])
  );
  expect(ids).not.toContain(firstId);
  // clean up
  await page.evaluate((id) => {
    localStorage.setItem('vault_watched', JSON.stringify(JSON.parse(localStorage.getItem('vault_watched') || '[]').filter(v => v !== id)));
    localStorage.removeItem('vault_sort');
  }, firstId);
});

test('the vault progress counter reflects watched state', async ({ page }) => {
  await page.goto(VAULT_URL);
  await page.waitForFunction(() => document.querySelectorAll('.watched-toggle').length > 0);
  const before = await page.locator('#vault-progress').innerText();
  await page.locator('.watched-toggle').first().click();
  const after = await page.locator('#vault-progress').innerText();
  expect(parseInt(after, 10)).toBe(parseInt(before, 10) + 1);
  await page.locator('.watched-toggle').first().click(); // reset
});

// ── Reviews page width + header layout (the four UI fixes) ────────────────

test('the reviews archive lays out whole-pixel cards with an even 16px gap', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto(REVIEWS_URL);
  await waitForArchive(page);

  const info = await page.evaluate(() => {
    const container = document.querySelector('.archive-container') as HTMLElement | null;
    const grid = document.querySelector('.archive-grid') as HTMLElement | null;
    if (!container || !grid) return null;

    // Effective zoom of the grid, measured rather than read: a 1000px probe
    // box must come out at exactly 1000 device px.
    const probe = document.createElement('div');
    probe.style.cssText = 'width:1000px;height:10px;position:absolute;top:-99999px;left:0';
    grid.appendChild(probe);
    const effectiveZoom = probe.getBoundingClientRect().width / 1000;
    probe.remove();

    const cards = [...document.querySelectorAll<HTMLElement>('.archive-grid .game-archive-card')]
      .slice(0, 6)
      .map((c) => {
        const r = c.getBoundingClientRect();
        return { x: r.x, w: r.width };
      });

    return {
      container: container.getBoundingClientRect().width,
      grid: grid.getBoundingClientRect().width,
      columns: getComputedStyle(grid).gridTemplateColumns.split(' ').length,
      effectiveZoom,
      cards,
    };
  });

  expect(info).not.toBeNull();
  if (!info) return;

  // Four cards per row at 1600px (the ladder runs 4-up from 1422px and 5-up
  // from 1800px — six-up could never give the widest genre pill enough room).
  // The point of the assertion is the whole-pixel width and even gap below,
  // not a specific column count.
  expect(info.columns).toBe(4);
  expect(info.effectiveZoom).toBe(1);
  expect(info.container).toBeGreaterThan(1500);

  // Every card is an integer number of pixels wide with an integer 16px gap,
  // so all of them share one sub-pixel offset instead of drifting down the row.
  const frac = (n: number) => Math.round((n % 1) * 100) / 100;
  const whole = (n: number) => Math.abs(n - Math.round(n)) < 0.02;
  for (const card of info.cards) {
    expect(whole(card.w)).toBe(true);
    expect(card.w).toBeGreaterThan(300);
  }
  // Only compare cards that are actually in the same row: at 4-up the fifth
  // and sixth cards sit on the second row, where x restarts at the left edge.
  const inRow = info.cards.slice(0, info.columns);
  for (let i = 1; i < inRow.length; i++) {
    expect(inRow[i].x - inRow[i - 1].x).toBeCloseTo(inRow[0].w + 16, 1);
    expect(frac(inRow[i].x)).toBeCloseTo(frac(inRow[0].x), 2);
  }
});

test('no genre pill is ever truncated, at any viewport width', async ({ page }) => {
  await page.goto(REVIEWS_URL);
  await waitForArchive(page);

  // The column ladder in _site-styles.scss exists purely to guarantee this,
  // so check it at every tier boundary and a couple of common widths rather
  // than trusting the breakpoint arithmetic.
  const widths = [730, 900, 1071, 1072, 1280, 1421, 1422, 1600, 1799, 1800, 1920, 2560];

  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });

    const result = await page.evaluate(() => {
      // Pagination only renders 20 cards, so reveal them all first — the
      // widest list ("Action, Adventure, Metroidvania, Puzzle") may not be on
      // the current page.
      const cards = [...document.querySelectorAll<HTMLElement>('.game-archive-card')];
      const hidden = cards.filter((c) => getComputedStyle(c).display === 'none');
      cards.forEach((c) => c.style.setProperty('display', 'flex', 'important'));

      const pills = [...document.querySelectorAll<HTMLElement>('.archive-card-pill--genre')]
        .filter((p) => p.clientWidth > 0);
      const clipped = pills
        .filter((p) => p.scrollWidth > p.clientWidth + 1)
        .map((p) => (p.getAttribute('title') || p.textContent || '').trim());

      cards.forEach((c) => {
        if (hidden.includes(c)) c.style.removeProperty('display');
      });

      return {
        columns: getComputedStyle(document.querySelector('.archive-grid')!)
          .gridTemplateColumns.split(' ').length,
        measured: pills.length,
        clipped,
      };
    });

    expect(result.measured, `all cards visible at ${width}px`).toBeGreaterThan(400);
    expect(result.clipped, `genre pills clipped at ${width}px (${result.columns} columns)`).toEqual([]);
  }
});

test('the search box sits inside the filter row, not displaced below it', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto(REVIEWS_URL);
  await waitForArchive(page);
  const inRow = await page.evaluate(() => {
    const search = document.querySelector('.search-input-wrapper');
    const group = document.querySelector('.filter-controls-group');
    if (!search || !group) return false;
    const s = search.getBoundingClientRect();
    const g = group.getBoundingClientRect();
    const sameRow = s.top >= g.top - 2 && s.top <= g.bottom - s.height + 2;
    return group.contains(search) && sameRow;
  });
  expect(inRow).toBe(true);
});

// ── Homepage vault strip ───────────────────────────────────────────────────

test('the homepage Latest from the Vault section fills from latest_videos.json', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => {
    const s = document.getElementById('latest-vault-section');
    return s && s.hidden === false;
  }, { timeout: 10_000 });
  const cards = await page.locator('.home-vault-card').count();
  expect(cards).toBeGreaterThan(0);
  expect(cards).toBeLessThanOrEqual(8);
  const hrefs = await page.locator('.home-vault-card').evaluateAll((els) =>
    els.map(e => e.getAttribute('href'))
  );
  for (const h of hrefs) expect(h).toMatch(/^https:\/\/www\.youtube\.com\/watch\?v=/);
});

// ── The Numbers page ───────────────────────────────────────────────────────

test('The Numbers page renders core stats sections', async ({ page }) => {
  await page.goto(NUMBERS_URL);
  // Head is the site's standard hero, same as the other pages
  await expect(page.locator('.isolated-cinematic-card .billboard-title-card h1')).toHaveText('The Numbers');
  await expect(page.locator('.isolated-cinematic-card .billboard-subtitle')).toHaveText('The whole archive, counted');
  await expect(page.locator('.numbers-section-title').first()).toBeVisible();
  const titles = await page.locator('.numbers-section-title').allInnerTexts();
  expect(titles).toContain('Archive totals');
  expect(titles).toContain('Verdicts');
  expect(titles).toContain('Reviews per year');
  expect(titles).toContain('Platforms covered');
  await expect(page.locator('.milestone-card').first()).toBeVisible();
  expect(await page.locator('.numbers-bar-row').count()).toBeGreaterThan(3);
  expect(await page.locator('.activity-col').count()).toBeGreaterThan(0);
});

test('The Numbers verdict percentages add up to exactly 100%', async ({ page }) => {
  await page.goto(NUMBERS_URL);
  // Each share used to be rounded on its own, which produced totals like
  // 97 + 1 + 1. Pull the percentage off the end of "380 · 97%".
  const texts = await page.locator('.numbers-bars:not(.numbers-bars--split) .numbers-bar-count').allInnerTexts();
  const pcts = texts.map((t) => {
    const m = t.match(/(\d+)%\s*$/);
    return m ? parseInt(m[1], 10) : NaN;
  });
  expect(pcts.length).toBe(3);
  expect(pcts.every((p) => Number.isInteger(p))).toBe(true);
  expect(pcts.reduce((a, b) => a + b, 0)).toBe(100);

  // The "recommended" milestone card quotes the same share as its bar.
  const rec = await page
    .locator('.milestone-card')
    .filter({ hasText: 'recommended' })
    .locator('.milestone-num')
    .innerText();
  expect(parseInt(rec.replace(/[^\d]/g, ''), 10)).toBe(pcts[0]);
});

test('The Numbers compat bar fills from the live counter', async ({ page }) => {
  await page.goto(NUMBERS_URL);
  await expect(page.locator('#numbers-tested-text')).toContainText('games tested', { timeout: 15_000 });
  const width = await page.locator('#numbers-tested-fill').evaluate((el) => parseFloat(el.style.width));
  expect(width).toBeGreaterThan(50); // 1,538 of 1,663 ≈ 92%
});

// ── Compat tested bar (compatibility page) ─────────────────────────────────

test('the compatibility tested bar shows the tested/backlog totals', async ({ page }) => {
  await page.goto('/compatibility/');
  await expect(page.locator('#compat-tested-text')).toContainText('games tested', { timeout: 15_000 });
  expect(await page.locator('#compat-tested-text').innerText()).toContain('still to be tested');
});

// ── Genre landing pages ────────────────────────────────────────────────────

test('a genre landing page counts exactly the reviews the archive filters to', async ({ page }) => {
  await page.goto('/genres/horror/');
  await expect(page.locator('.isolated-cinematic-card h1')).toHaveText('Horror');
  const shown = parseInt(
    (await page.locator('.milestone-card').first().locator('.milestone-num').innerText()).replace(/\D/g, ''),
    10
  );
  expect(shown).toBeGreaterThan(0);

  // Same genre, counted the way the archive's own dropdown counts it.
  await page.goto(REVIEWS_URL + '?genre=Horror');
  await waitForArchive(page);
  await expect(page.locator('#reviews-result-count')).toContainText(`${shown} reviews match`);
  // Every visible card carries the genre, and Horror must not have swallowed
  // the Survival Horror reviews (a substring match used to do exactly that).
  const genres = await page.locator('.game-archive-card:visible').evaluateAll((els) =>
    els.map((e) => (e.getAttribute('data-genre') || '').split(',').map((g) => g.trim()))
  );
  expect(genres.length).toBeGreaterThan(0);
  for (const list of genres) expect(list).toContain('Horror');
  const survivalOnly = genres.filter((list) => list.includes('Survival Horror') && !list.includes('Horror'));
  expect(survivalOnly.length).toBe(0);
});

test('a genre page lists start-here picks, hedged verdicts and a link into the archive', async ({ page }) => {
  await page.goto('/genres/platformer/');
  await expect(page.locator('.genre-section-title').first()).toHaveText('Start here');
  expect(await page.locator('.genre-start-grid .game-archive-card').count()).toBe(3);
  await expect(page.locator('.genre-start-grid')).toHaveCSS('grid-template-columns', /\S+ \S+ \S+/);

  // Platformer is the one genre with a genuinely mixed split, so the
  // "worth knowing about" block has to be present and populated.
  const hedged = page.locator('.genre-hedged-item');
  expect(await hedged.count()).toBeGreaterThan(0);
  await expect(hedged.first().locator('.genre-hedged-meta')).toContainText(/Not sure|Not recommended/);

  // Every block links out to the filtered archive rather than re-listing it.
  const archiveHref = await page.locator('.genre-section-link').first().getAttribute('href');
  expect(archiveHref).toContain('/reviews/?genre=Platformer');
  await page.locator('.genre-section-link').first().click();
  await expect(page.locator('#filter-genre')).toHaveValue('Platformer');
});

test('the /genres/ index links to every genre page and the reviews strip agrees', async ({ page }) => {
  await page.goto('/genres/');
  const cards = page.locator('.genre-index-card');
  const count = await cards.count();
  expect(count).toBeGreaterThanOrEqual(8);
  const hrefs = await cards.evaluateAll((els) => els.map((e) => e.getAttribute('href')));
  for (const href of hrefs) expect(href).toMatch(/^\/genres\/[a-z-]+\/$/);

  await page.goto(hrefs[0]);
  await expect(page.locator('.isolated-cinematic-card h1')).toBeVisible();

  await page.goto(REVIEWS_URL);
  await waitForArchive(page);
  const strip = page.locator('.genre-strip .genre-chip--link');
  expect(await strip.count()).toBe(count);
});

test('the reviews genre strip is centred, and the genre pages keep theirs left aligned', async ({ page }) => {
  await page.goto(REVIEWS_URL);
  await waitForArchive(page);

  // The strip box is centred in its container, so its label and every wrapped
  // row of chips should sit on the same centre line rather than hug the left.
  const offsets = await page.evaluate(() => {
    const centre = (el) => {
      const b = el.getBoundingClientRect();
      return b.left + b.width / 2;
    };
    const strip = document.querySelector('.genre-strip');
    const mid = centre(strip);
    const rows = {};
    for (const chip of strip.querySelectorAll('.genre-chip')) {
      const b = chip.getBoundingClientRect();
      (rows[Math.round(b.top)] ??= []).push([b.left, b.right]);
    }
    const rowOffsets = Object.values(rows).map((rs) => {
      const left = Math.min(...rs.map((r) => r[0]));
      const right = Math.max(...rs.map((r) => r[1]));
      return (left + right) / 2 - mid;
    });
    return { label: centre(document.querySelector('.genre-strip-label')) - mid, rowOffsets };
  });

  // A couple of pixels of slack for subpixel layout, nothing more.
  expect(Math.abs(offsets.label)).toBeLessThanOrEqual(2);
  expect(offsets.rowOffsets.length).toBeGreaterThan(0);
  for (const offset of offsets.rowOffsets) expect(Math.abs(offset)).toBeLessThanOrEqual(2);

  // The centring is scoped to the strip, so a genre page's own chip rows
  // (which sit under a left aligned heading) must not have moved.
  await page.locator('.genre-strip .genre-chip').first().click();
  const leftAligned = await page.locator('.genre-chip-row').first().evaluate((el) => {
    const row = el.getBoundingClientRect();
    const first = el.firstElementChild.getBoundingClientRect();
    return Math.abs(first.left - row.left);
  });
  expect(leftAligned).toBeLessThanOrEqual(2);
});

test('genres below the threshold get a page and the dropdown still lists them', async ({ page }) => {
  // "Rhythm" has one review, so it must not have generated a landing page...
  const response = await page.goto('/genres/rhythm/');
  expect(response?.status()).toBe(404);
  // ...but it must still be filterable from the archive.
  await page.goto(REVIEWS_URL + '?genre=Rhythm');
  await waitForArchive(page);
  await expect(page.locator('#reviews-result-count')).toContainText('1 review matches');
});

// ── Embeddable review card ────────────────────────────────────────────────

test('the embed card renders the requested review and links to the full page', async ({ page }) => {
  await page.goto('/embed/?game=home');
  const card = page.locator('.embed-card');
  await expect(card).toBeVisible();
  await expect(card.locator('.embed-title')).toHaveText('Home');
  await expect(card.locator('.embed-eyebrow')).toContainText('Horror');
  await expect(card.locator('.embed-verdict')).toContainText('Recommended');
  await expect(card.locator('.embed-verdict')).toContainText('✓');
  await expect(card.locator('.embed-summary')).not.toBeEmpty();
  expect(await card.getAttribute('href')).toContain('/reviews/home/');
  // No site chrome leaks into the widget.
  await expect(page.locator('.site-header')).toHaveCount(0);
});

test('the embed card keeps the hedged verdicts distinguishable', async ({ page }) => {
  // Only 11 of 413 reviews aren't a clean yes, so this is the case most
  // likely to collapse all three verdicts into one green pill.
  await page.goto('/embed/?game=spirit-roots');
  await expect(page.locator('.embed-verdict')).toContainText('Not Recommended');
  await expect(page.locator('.embed-verdict')).toContainText('✗');

  await page.goto('/embed/?game=103');
  await expect(page.locator('.embed-verdict')).toContainText('Not Sure');
  await expect(page.locator('.embed-verdict')).toContainText('–');
});

test('the embed card explains itself for a missing or unknown slug', async ({ page }) => {
  await page.goto('/embed/');
  await expect(page.locator('.embed-missing')).toContainText('?game=');
  await page.goto('/embed/?game=definitely-not-a-game');
  await expect(page.locator('.embed-missing')).toContainText('definitely-not-a-game');
  await expect(page.locator('.embed-card')).toHaveCount(0);
});

test('the review page copies a working embed snippet', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/reviews/home/');
  await page.locator('#embed-review-btn').click();
  await expect(page.locator('#embed-btn-text')).toHaveText('Embed code copied!');
  const snippet = await page.evaluate(() => navigator.clipboard.readText());
  expect(snippet).toContain('<iframe');
  expect(snippet).toContain('/embed/?game=home');

  const src = snippet.match(/src="([^"]+)"/)![1];
  const embedded = await context.newPage();
  await embedded.goto(src);
  await expect(embedded.locator('.embed-title')).toHaveText('Home');
});

// ── Navbar ─────────────────────────────────────────────────────────────────

test('the navbar keeps Reviews and does not promote the genre index', async ({ page }) => {
  await page.goto('/');
  const nav = page.locator('.site-header nav');

  // navbar.liquid dedupes nav entries with a substring test, so a hidden page
  // titled "Horror Reviews" silently suppressed the real "Reviews" link.
  await expect(nav.locator('a[href="/reviews/"]')).toBeVisible();
  // /genres/ is reached from the reviews strip instead of a top-level entry.
  expect(await nav.locator('a[href="/genres/"]').count()).toBe(0);

  const hrefs = await nav.locator('a').evaluateAll((els) =>
    els.map((e) => e.getAttribute('href')).filter((h) => h && h !== '#')
  );
  expect(hrefs).toEqual(['/compatibility/', '/reviews/', '/content/', '/live/', '/numbers/', '/about/']);
});
