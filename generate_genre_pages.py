#!/usr/bin/env python3
"""Generate a landing page for every genre with enough reviews to deserve one.

The reviews archive already filters by genre via /reviews/?genre=horror, so a
genre page is deliberately NOT another way to list the same reviews. It is a
front door: a hand-checkable "start here", the shape of the genre's verdicts,
the genres it overlaps with, and one link into the filtered archive. That is
worth doing for the big genres and not worth doing for the stubs -- "Rhythm"
has one review, "Dreamcast" as a platform has one review -- so a page is only
written for genres with at least MIN_REVIEWS entries.

Why a script and not a Jekyll plugin: the site builds on GitHub Pages, which
runs Jekyll with a fixed plugin allowlist. A generator there would never run.
So this writes plain page stubs into genres/ and Jekyll picks them up like any
other page; everything dynamic happens at build time in
_includes/genre-page.html. Re-run after adding or re-tagging reviews:

    python generate_genre_pages.py           # write/refresh genres/
    python generate_genre_pages.py --check    # exit 1 if anything is stale (CI)
    python generate_genre_pages.py --min 15   # lower the bar for a page
"""

from __future__ import annotations

import argparse
import os
import re
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
REVIEWS_DIR = os.path.join(ROOT, "reviews")
OUT_DIR = os.path.join(ROOT, "genres")

# Below this, a genre page is a worse experience than the filtered archive it
# would link to. 25 leaves the eight genres that actually carry traffic.
MIN_REVIEWS = 25

# Marker so --check and the prune step only ever touch files we generated.
MARKER = "genre_page: true"


def slugify(name: str) -> str:
    """Point & Click -> point-and-click, Beat 'em up -> beat-em-up."""
    slug = name.lower().replace("&", " and ")
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    return slug.strip("-")


def read_front_matter(path: str) -> dict:
    """Pull the handful of scalar keys we need out of a review's front matter.

    Deliberately not a YAML parse: these files are machine-written with one
    scalar per line, and a full parser is not worth a dependency here.
    """
    keys = ("genre", "verdict", "date")
    found = {}
    with open(path, encoding="utf-8", errors="replace") as handle:
        if handle.readline().strip() != "---":
            return found
        for line in handle:
            stripped = line.strip()
            if stripped == "---":
                break
            for key in keys:
                prefix = key + ":"
                if stripped.startswith(prefix):
                    found[key] = stripped[len(prefix):].strip().strip('"')
    return found


def collect_genres() -> dict:
    """genre name -> review count, preserving the casing used in front matter."""
    counts: dict[str, int] = {}
    if not os.path.isdir(REVIEWS_DIR):
        sys.exit(f"no reviews directory at {REVIEWS_DIR}")
    for name in sorted(os.listdir(REVIEWS_DIR)):
        if not name.endswith(".md"):
            continue
        matter = read_front_matter(os.path.join(REVIEWS_DIR, name))
        for genre in matter.get("genre", "").split(","):
            genre = genre.strip()
            if genre:
                counts[genre] = counts.get(genre, 0) + 1
    return counts


def build(counts: dict, minimum: int) -> dict:
    """Slug -> (display name, count), biggest genre first."""
    pages = {}
    for genre, count in counts.items():
        if count < minimum:
            continue
        slug = slugify(genre)
        if slug in pages:
            # Two genres slugging to the same URL: keep the bigger one.
            if count <= pages[slug][1]:
                continue
        pages[slug] = (genre, count)
    return dict(sorted(pages.items(), key=lambda kv: (-kv[1][1], kv[1][0])))


def render(slug: str, genre: str, count: int) -> str:
    description = "All %d %s reviews on The Playability Report" % (count, genre)
    return (
        "---\n"
        "layout: default\n"
        'title: "%s Reviews"\n' % genre
        + "permalink: /genres/%s/\n" % slug
        + "hide: true\n"
        + "genre_page: true\n"
        + 'genre: "%s"\n' % genre
        + 'seo_description: "%s. The starters, the verdicts, and every game '
        "tagged %s.\"\n" % (description, genre)
        + "---\n\n"
        + "{% include genre-page.html genre=page.genre %}\n"
    )


def reconcile(pages: dict, write: bool) -> list:
    """Write the pages we want, drop the generated pages we no longer want."""
    if not os.path.isdir(OUT_DIR):
        os.makedirs(OUT_DIR)

    stale = []
    for name in sorted(os.listdir(OUT_DIR)):
        if not name.endswith(".html"):
            continue
        path = os.path.join(OUT_DIR, name)
        with open(path, encoding="utf-8") as handle:
            if MARKER not in handle.read():
                continue  # not ours; leave it alone
        if name[:-5] not in pages:
            stale.append(name)
            if write:
                os.remove(path)

    changed = []
    for slug, (genre, count) in pages.items():
        path = os.path.join(OUT_DIR, slug + ".html")
        body = render(slug, genre, count)
        existing = None
        if os.path.exists(path):
            with open(path, encoding="utf-8") as handle:
                existing = handle.read()
        if existing != body:
            changed.append(slug)
            if write:
                with open(path, "w", encoding="utf-8", newline="\n") as handle:
                    handle.write(body)

    return changed, stale


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--min", type=int, default=MIN_REVIEWS, dest="minimum",
                        help="reviews a genre needs before it gets a page")
    parser.add_argument("--check", action="store_true",
                        help="report drift without writing anything")
    args = parser.parse_args()

    counts = collect_genres()
    pages = build(counts, args.minimum)
    changed, stale = reconcile(pages, write=not args.check)

    skipped = len(counts) - len(pages)
    print("genres seen: %d | pages: %d | below threshold (%d): %d"
          % (len(counts), len(pages), args.minimum, skipped))
    for slug, (genre, count) in pages.items():
        print("  /genres/%-16s %-14s %d" % (slug + "/", genre, count))
    if stale:
        print("would remove: %s" % ", ".join(stale))
    if changed:
        print("%s: %s" % ("would write" if args.check else "wrote",
                         ", ".join(changed)))

    if args.check and (changed or stale):
        print("\ngenre pages are out of date. Run: python generate_genre_pages.py")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())