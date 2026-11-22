#!/usr/bin/env python3
"""Subset the vendored Font Awesome webfonts down to the glyphs this site uses.

The fonts in assets/fonts/font-awesome/ are the full Font Awesome 6.7.2 kits:
~277 KB of webfont for the ~20 icons the site actually renders, and each page
that renders any icon downloads the whole file. This rewrites them in place as
subsets, which is invisible to the rest of the site — the @font-face rules keep
pointing at the same filenames, so no HTML, CSS or JS changes with them.

The glyph set is derived, not hard-coded, so re-running this after adding an
icon to a template keeps it correct:

  * `fa-<name>` classes present in the built site (default ./_site) — what
    actually renders,
  * `fa-<name>` classes in this repository's own templates and JS, which covers
    icons injected at runtime (back to top, dark-mode toggle) and ones behind a
    data flag (social/share buttons),
  * raw `content: "\\fXXX"` escapes in the theme's own SCSS.

Usage:
    bundle exec jekyll build     # so _site/ reflects the current templates
    python subset_font_awesome.py [--built _site] [--dry-run]

Requires fontTools (pip install fonttools). The subset is deterministic for a
given _variables.scss and glyph set, so re-running it is a no-op in content.
"""
import argparse
import glob
import os
import re
import subprocess
import sys

FONTS = ["fa-solid-900", "fa-brands-400", "fa-regular-400"]
FA_DIR = os.path.join("assets", "fonts", "font-awesome")
VARIABLES = os.path.join("_sass", "external", "font-awesome", "_variables.scss")
# _data/icons_builder.yml is a catalogue used to generate _data/icons.yml, not
# something that renders icons itself.
SKIP_SOURCES = {os.path.join("_data", "icons_builder.yml")}


def name_to_codepoint():
    """Font Awesome's own name -> codepoint table."""
    src = open(VARIABLES, encoding="utf-8", errors="replace").read()
    table = {
        m.group(1): int(m.group(2), 16)
        for m in re.finditer(r"\$fa-var-([a-z0-9-]+):\s*\\([0-9a-fA-F]+)\s*;", src)
    }
    if not table:
        sys.exit("no icon names found in %s" % VARIABLES)
    return table


def icons_used_in(built_dir, table):
    """Icon names (and codepoints) the site can render, with provenance."""
    from_html = set()
    for path in glob.glob(os.path.join(built_dir, "**", "*.html"), recursive=True):
        text = open(path, encoding="utf-8", errors="replace").read()
        for classes in re.findall(r'class="([^"]*)"', text):
            from_html.update(
                name for name in re.findall(r"\bfa-([a-z0-9-]+)", classes) if name in table
            )

    from_source = set()
    files = []
    for base in ("_includes", "_layouts", "pages", "genres", "reviews", "assets/js", "_data"):
        files += [p for p in glob.glob(os.path.join(base, "**", "*"), recursive=True) if os.path.isfile(p)]
    files.append("index.html")
    for path in files:
        if path.replace("\\", "/") in {p.replace("\\", "/") for p in SKIP_SOURCES}:
            continue
        try:
            text = open(path, encoding="utf-8", errors="replace").read()
        except OSError:
            continue
        # Any fa-<name> token, because JS assembles class strings at runtime.
        from_source.update(m for m in re.findall(r"\bfa-([a-z0-9-]+)", text) if m in table)

    literals = set()
    for path in glob.glob("_sass/**/*.scss", recursive=True):
        if "/font-awesome/" in path.replace("\\", "/"):
            continue
        text = open(path, encoding="utf-8", errors="replace").read()
        literals.update(
            int(m.group(1), 16)
            for m in re.finditer(r'content:\s*["\']\\([0-9a-fA-F]{4,6})["\']', text)
        )
    return from_html, from_source, literals


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--built", default="_site", help="built site to read rendered icons from")
    ap.add_argument("--dry-run", action="store_true", help="report only, change nothing")
    ap.add_argument("--verify", action="store_true",
                    help="check the committed fonts already cover every needed glyph")
    args = ap.parse_args()

    table = name_to_codepoint()
    if os.path.isdir(args.built):
        rendered, sources, literals = icons_used_in(args.built, table)
    else:
        print("no %s directory: falling back to templates only" % args.built)
        rendered, sources, literals = set(), icons_used_in("_layouts", table)[1], set()

    used = rendered | sources
    if not used:
        sys.exit("refusing to subset to nothing — no icon classes found")
    codepoints = {table[name] for name in used} | literals
    print("%d glyphs: %s" % (len(codepoints), " ".join(sorted(used))))

    if args.verify:
        from fontTools.ttLib import TTFont

        covered = set()
        for stem in FONTS:
            path = os.path.join(FA_DIR, "%s.woff2" % stem)
            if os.path.exists(path):
                covered |= set(TTFont(path).getBestCmap())
        missing = sorted(codepoints - covered)
        if missing:
            print("MISSING GLYPHS %s — re-run without --verify to subset again"
                  % " ".join("U+%04X" % cp for cp in missing))
            sys.exit(1)
        print("all %d needed glyphs are in the committed subsets" % len(codepoints))
        return

    unicodes = ",".join("U+%04X" % cp for cp in sorted(codepoints))
    tmp = os.path.join(FA_DIR, ".subset.tmp.woff2")
    for stem in FONTS:
        src = os.path.join(FA_DIR, "%s.woff2" % stem)
        if not os.path.exists(src):
            continue
        result = subprocess.run(
            [sys.executable, "-m", "fontTools.subset", src,
             "--unicodes=" + unicodes, "--flavor=woff2", "--output-file=" + tmp,
             "--layout-features=", "--no-hinting", "--desubroutinize",
             "--name-IDs=*", "--drop-tables+=DSIG", "--recalc-bounds"],
            capture_output=True, text=True,
        )
        if result.returncode != 0:
            sys.exit("subsetting %s failed:\n%s\n%s" % (stem, result.stdout, result.stderr))
        before, after = os.path.getsize(src), os.path.getsize(tmp)
        if args.dry_run:
            print("  %-16s %7d -> %6d bytes" % (stem, before, after))
            os.remove(tmp)
        else:
            os.replace(tmp, src)
            print("  %-16s %7d -> %6d bytes  (%.1f%% smaller)" % (stem, before, after, 100 * (1 - after / before)))


if __name__ == "__main__":
    main()
