// Generates the card-sized review covers the archive uses.
//
// assets/img/reviews/*.webp are full 1280x720 covers (~70 KB each, up to
// 245 KB). A card in the archive grid is about 300 CSS px wide, so every card
// downloaded 3-4x the pixels it could show — 20 cards on the first page came to
// ~1.4 MB. This writes 640px-wide copies to assets/img/reviews/thumbs/, which
// the cards offer through srcset alongside the original; browsers that do not
// support srcset simply use the original, because nothing here replaces it.
//
// 640 is exactly half of the 1280x720 master (a clean 2x2 box downsample), and
// it is the width the card's `sizes` hint needs on a retina screen: the archive
// card declares 300px, so DPR 2 asks for 600px, and a 560px file is too small to
// be chosen — the browser fell back to the full 1280 cover and downloaded 66 KB
// instead of the thumbnail. At 640w the thumbnail wins that slot at ~27 KB.
//
//   node make_review_thumbs.mjs            # only missing/stale thumbnails
//   node make_review_thumbs.mjs --force    # regenerate everything
//   node make_review_thumbs.mjs --check    # report, exit 1 if any are stale
//
// Run it after adding a review cover. Requires sharp (already a devDependency
// for the image pipeline in .github/cli).
import { mkdir, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const SRC = 'assets/img/reviews';
const OUT = path.join(SRC, 'thumbs');
const WIDTH = 640;
const args = process.argv.slice(2);
const force = args.includes('--force');
const check = args.includes('--check');

await mkdir(OUT, { recursive: true });

const entries = (await readdir(SRC, { withFileTypes: true }))
  .filter((e) => e.isFile() && e.name.endsWith('.webp'))
  .map((e) => e.name);

let written = 0;
let skipped = 0;
let stale = [];
let srcBytes = 0;
let outBytes = 0;
// A single unreadable cover used to abort the whole run, leaving every later
// thumbnail stale and no clue which file was at fault. Record it and keep going;
// the summary at the end names it and the exit status stays non-zero.
let failed = [];

for (const name of entries) {
  const src = path.join(SRC, name);
  const dest = path.join(OUT, name);
  const [srcStat, destStat] = await Promise.all([
    stat(src),
    stat(dest).catch(() => null),
  ]);
  srcBytes += srcStat.size;
  const fresh = destStat && destStat.mtimeMs >= srcStat.mtimeMs;
  if (fresh && !force) {
    skipped++;
    outBytes += destStat.size;
    continue;
  }
  if (check) {
    stale.push(name);
    continue;
  }
  try {
    await sharp(src)
      .resize({ width: WIDTH, withoutEnlargement: true })
      .webp({ quality: 72, effort: 5 })
      .toFile(dest);
  } catch (e) {
    failed.push(`${name}: ${String(e.message).split('\n')[0]}`);
    continue;
  }
  written++;
  outBytes += (await stat(dest)).size;
}

const kb = (n) => (n / 1024).toFixed(0) + ' KB';
if (check) {
  console.log(`${entries.length} covers, ${stale.length} without a current thumbnail`);
  if (stale.length) {
    console.log(stale.slice(0, 10).join('\n') + (stale.length > 10 ? `\n... and ${stale.length - 10} more` : ''));
    process.exit(1);
  }
  console.log(`full covers ${kb(srcBytes)} -> thumbnails ${kb(outBytes)}`);
} else {
  console.log(`thumbnails: ${written} written, ${skipped} up to date (${entries.length} covers), ${WIDTH}px wide`);
  console.log(`archive page-1 cover weight: ${kb(srcBytes / entries.length * 20)} -> ${kb(outBytes / entries.length * 20)} per 20 cards`);
  if (failed.length) {
    console.log(`\n${failed.length} cover(s) could not be read, so they have no thumbnail:`);
    for (const f of failed) console.log(`  ${f}`);
    console.log('Replace the cover itself; nothing here can rebuild an undecodable image.');
    process.exit(1);
  }
}
