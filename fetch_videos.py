import argparse
import json
import os
import re
import subprocess
import urllib.request
import xml.etree.ElementTree as ET

# Define your channels here
CHANNELS = {
    "trw": "https://www.youtube.com/channel/UCKK7ydtKLQjnD9k5jal4XuQ/",
    "iip": "https://www.youtube.com/channel/UCKBIk4jH8Ow8BRcGwVKVMIA/",
    "tga": "https://www.youtube.com/channel/UCgVbOWuIhwWNpvHJ5AbIA2w/",
    "vods": "https://www.youtube.com/channel/UCYQlzu1EsF04EUOdNTZhCFg/"
}

OUTPUT_DIR = "./assets/data"

# Upload dates live in their own sidecar rather than only inside videos_*.json.
# `yt-dlp --flat-playlist` is the fast way to list a channel but it returns no
# dates at all (no `published`, no `upload_date`, `timestamp` is null), so dates
# can only come from a real extraction -- roughly a second per video, which is
# far too slow to redo for a 19,000 video channel on every run. The sidecar is
# therefore the date cache: a run harvests only the uploads that have no date
# yet and merges them in, so a date is paid for once and kept forever.
DATES_PATH = os.path.join(OUTPUT_DIR, "video_dates.json")

# How many of the newest uploads per channel to check for dates on each run.
# Only uploads that still have no date are actually extracted (see
# harvest_dates), so this is a ceiling on new work, not a fixed cost. A
# channel's /videos listing is newest-first, so the window moves forward as the
# schedule runs; raise it for a deliberate backfill, or set
# VAULT_DATE_HARVEST=0 to skip.
DATE_HARVEST = int(os.environ.get("VAULT_DATE_HARVEST", "300"))

# How many of a channel's newest uploads to re-list when an archive already
# exists. The full listing is ~190 pages for the largest channel and ~235 across
# all four, which is minutes of paging every single day just to discover a
# handful of new ids at the front. A scheduled run therefore lists the newest
# page and appends it to the archive it already has; `--full` re-lists every
# video, which also drops uploads that no longer exist on YouTube.
LIST_WINDOW = int(os.environ.get("VAULT_LIST_WINDOW", "100"))

RSS_NS = {
    "atom": "http://www.w3.org/2005/Atom",
    "yt": "http://www.youtube.com/xml/schemas/2015",
}

# "#811" in a Complete Journey title. Not a reliable date, but a free sanity
# check that the harvested dates agree with the channel's own numbering.
JOURNEY_NUM = re.compile(r"#(\d+)\s*$")


def load_dates():
    """Known id -> ISO date, from the sidecar plus whatever the current
    archives already carry, so a corrupt sidecar can never lose data."""
    known = {}
    if os.path.exists(DATES_PATH):
        try:
            with open(DATES_PATH, encoding="utf-8") as f:
                known = {k: v for k, v in json.load(f).items() if v}
        except (OSError, ValueError) as e:
            print(f"WARNING: could not read {DATES_PATH} ({e}); starting fresh.")
    for key in CHANNELS:
        path = os.path.join(OUTPUT_DIR, f"videos_{key}.json")
        if not os.path.exists(path):
            continue
        try:
            with open(path, encoding="utf-8") as f:
                for v in json.load(f):
                    if v.get("id") and v.get("published"):
                        known.setdefault(v["id"], v["published"])
        except (OSError, ValueError):
            pass
    return known


def save_dates(known):
    with open(DATES_PATH, "w", encoding="utf-8") as f:
        json.dump(known, f, separators=(",", ":"), sort_keys=True, ensure_ascii=False)


def normalise_date(raw):
    """yt-dlp hands back YYYYMMDD (upload_date) or a unix timestamp, and the
    channel RSS feed hands back an ISO-8601 timestamp ("2026-10-15T17:00:35
    +00:00"). Normalise all of them to the YYYY-MM-DD the archive and the
    vault's string comparison expect."""
    if not raw:
        return None
    raw = str(raw).strip()
    if re.fullmatch(r"\d{8}", raw):
        return f"{raw[0:4]}-{raw[4:6]}-{raw[6:8]}"
    if re.fullmatch(r"\d{9,}", raw):
        import datetime

        return datetime.datetime.utcfromtimestamp(int(raw)).strftime("%Y-%m-%d")

    # atom:published from the RSS feed. Without this branch every RSS date came
    # back None, which silently disarmed the always-current fallback that
    # fetch_rss_latest exists to provide: the feed's uploads were merged in
    # undated, so the newest uploads could only ever be dated by the slow
    # yt-dlp harvest, and latest_videos.json (dated videos only) could never
    # move past whatever that harvest last reached.
    import datetime

    try:
        return datetime.datetime.fromisoformat(raw.replace("Z", "+00:00")).strftime("%Y-%m-%d")
    except ValueError:
        return None


def harvest_dates(known, candidates, limit):
    """Date the newest uploads that do not have a date yet.

    A real (non-flat) extraction costs ~1.4 s per video, and a scheduled run
    used to ask yt-dlp for the channel's newest `limit` uploads outright -- of
    which roughly 340 of every 400 already carried a date from an earlier run.
    That re-dated the same videos every day for no new information and was the
    bulk of the job's runtime. Only the ids that are actually undated are
    extracted now, passed as explicit watch URLs so the channel has to be paged
    only once.

    Returns (newly dated, extractions attempted).
    """
    if limit <= 0:
        return 0, 0
    todo, seen = [], set()
    for v in candidates:
        vid = v.get("id")
        if not vid or vid in seen or known.get(vid):
            continue
        seen.add(vid)
        todo.append(vid)
    todo = todo[:limit]
    if not todo:
        return 0, 0

    cmd = [
        "yt-dlp",
        "--skip-download",
        "--no-warnings",
        "--no-update",
        "--ignore-errors",
        "--print",
        "%(id)s|%(upload_date)s",
    ]
    cmd.extend(f"https://www.youtube.com/watch?v={vid}" for vid in todo)
    gained = 0
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8")
    except FileNotFoundError:
        print("WARNING: yt-dlp not on PATH; skipping date harvest.")
        return 0, len(todo)
    for line in result.stdout.splitlines():
        if "|" not in line:
            continue
        vid, _, raw = line.partition("|")
        vid, date = vid.strip(), normalise_date(raw)
        if not vid or not date:
            continue
        if vid not in known:
            gained += 1
        known[vid] = date
    return gained, len(todo)


def fetch_rss_latest(channel_id):
    """Pull the ~15 newest uploads from the channel's RSS feed.

    yt-dlp's flat-playlist extraction can occasionally serve stale results,
    which silently freezes the vault at old data while the workflow still
    "succeeds". The channel RSS feed is always current, so it is fetched
    separately and merged in as the source of truth for recent uploads. It also
    carries a publish date, which dates the newest uploads for free.
    """
    url = f"https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}"
    with urllib.request.urlopen(url, timeout=30) as resp:
        root = ET.fromstring(resp.read())
    videos = []
    for entry in root.findall("atom:entry", RSS_NS):
        vid = entry.find("yt:videoId", RSS_NS)
        title = entry.find("atom:title", RSS_NS)
        published = entry.find("atom:published", RSS_NS)
        if vid is not None and title is not None and vid.text:
            videos.append({
                "id": vid.text,
                "title": title.text if title.text else "",
                "published": normalise_date(published.text) if published is not None else None,
            })
    return videos


def list_channel(key, url, limit=None):
    """The channel listing: fast, ids and titles, no dates.

    `limit` caps how far into the channel yt-dlp pages. One page is 100 ids. This
    still costs a request per page, so on a channel with 19 000 uploads the
    difference between `limit=100` and no limit is ~190 requests.
    """
    cmd = ["yt-dlp", "--flat-playlist", "--no-warnings", "--no-update", "--dump-json"]
    if limit:
        cmd.append(f"--playlist-end={limit}")
    cmd.append(f"{url}/videos")
    result = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8")
    videos = []
    for line in result.stdout.splitlines():
        if line.strip():
            video_info = json.loads(line)
            videos.append({
                "id": video_info.get("id"),
                "title": video_info.get("title"),
                "published": None,  # filled in from the sidecar below
            })
    return videos


def apply_dates(videos, known):
    for v in videos:
        if v.get("id") and known.get(v["id"]):
            v["published"] = known[v["id"]]
    return videos


def write_latest(latest_all):
    """Homepage bundle, rewritten after every channel so a run that dies part
    way through still leaves the site's newest uploads visible."""
    latest_path = os.path.join(OUTPUT_DIR, "latest_videos.json")
    with open(latest_path, "w", encoding="utf-8") as f:
        json.dump(latest_all, f, separators=(",", ":"), ensure_ascii=False)
    return latest_path, sum(len(v) for v in latest_all.values())


def write_archives(merged_by_key, latest_all):
    for key, merged in merged_by_key.items():
        output_path = os.path.join(OUTPUT_DIR, f"videos_{key}.json")
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(merged, f, indent=2, ensure_ascii=False)

        # Slim companion file with just the "Complete Journey" videos (~2 KB).
        # Review pages match against this instead of the full vault archive,
        # which keeps a multi-megabyte payload off every review page load.
        journeys = [v for v in merged if "complete journey" in (v.get("title") or "").lower()]
        journeys_path = os.path.join(OUTPUT_DIR, f"journeys_{key}.json")
        with open(journeys_path, "w", encoding="utf-8") as f:
            json.dump(journeys, f, separators=(",", ":"), ensure_ascii=False)

        dated = [v for v in merged if v.get("published")]
        latest_all[key] = sorted(dated, key=lambda v: v["published"], reverse=True)[:8]

        # The newest uploads should carry the newest dates. If they do not, the
        # harvest has silently stopped advancing and every sort on the site is
        # about to look broken -- so say so loudly instead of shipping it.
        undated = [v for v in merged[:20] if not v.get("published")]
        print(f"Done! {len(merged)} videos ({len(journeys)} complete journeys), "
              f"{len(dated)} dated, {len(undated)} of the newest 20 undated.")
        if undated:
            print(f"  WARNING: newest uploads missing dates for {key} "
                  f"(e.g. {undated[0]['id']}); date sort will look inert.")
        journeys_nums = [int(m.group(1)) for v in merged[:200]
                         if (m := JOURNEY_NUM.search(v.get("title") or ""))]
        if journeys_nums:
            print(f"  Journey numbering runs {min(journeys_nums)}–{max(journeys_nums)} in the newest 200.")


def main():
    parser = argparse.ArgumentParser(description="Rebuild the video vault archive database.")
    parser.add_argument("--dates-only", action="store_true",
                        help="Harvest upload dates and patch the existing archives, "
                             "skipping the (slow) full channel listing refresh.")
    parser.add_argument("--full", action="store_true",
                        help="Re-list every video on each channel instead of only the "
                             "newest uploads. Slower, but it repairs a gap in the archive "
                             "and drops uploads that no longer exist on YouTube.")
    args = parser.parse_args()

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    known = load_dates()
    print(f"Known upload dates on arrival: {len(known)}")
    latest_all = {}

    for key, url in CHANNELS.items():
        channel_id = url.rstrip("/").split("/")[-1]
        output_path = os.path.join(OUTPUT_DIR, f"videos_{key}.json")

        if args.dates_only:
            if not os.path.exists(output_path):
                print(f"Skipping {key}: no existing archive to patch.")
                continue
            with open(output_path, encoding="utf-8") as f:
                merged = json.load(f)
            print(f"Patching existing {key} archive ({len(merged)} videos)...")
        else:
            # The archive already holds most of the channel, and new uploads only
            # ever appear at the front, so a scheduled run lists the newest page
            # and appends it rather than paging through every video again.
            existing = []
            if not args.full and os.path.exists(output_path):
                try:
                    with open(output_path, encoding="utf-8") as f:
                        existing = json.load(f)
                except (OSError, ValueError) as e:
                    print(f"  WARNING: could not read {output_path} ({e}); re-listing in full.")

            if existing:
                print(f"Refreshing newest {LIST_WINDOW} uploads for {key} "
                      f"({len(existing)} videos already archived)...")
                channel_videos = list_channel(key, url, limit=LIST_WINDOW)
            else:
                print(f"Fetching full archive for {key}...")
                channel_videos = list_channel(key, url)

            # Always-fresh recent uploads from the RSS feed (see docstring above)
            try:
                rss_videos = fetch_rss_latest(channel_id)
                print(f"  RSS feed: {len(rss_videos)} recent uploads")
            except Exception as e:
                print(f"  WARNING: RSS fetch failed for {key} ({e}); using yt-dlp results only.")
                rss_videos = []

            # Guard against writing an empty/partial archive (e.g. YouTube hiccup):
            # keep the previous file untouched rather than wiping the vault. With
            # an archive on disk every new-video source can still come back empty,
            # so the check has to look at what was fetched, not at `merged`.
            if not channel_videos and not rss_videos:
                print(f"  WARNING: no videos extracted for {key}; keeping existing file unchanged.")
                continue

            # Merge: RSS newest-first, then the newest page, then whatever is
            # already archived, deduplicated by id so the newest metadata wins.
            seen = set()
            merged = []
            for v in rss_videos + channel_videos + existing:
                vid = v.get("id")
                if vid and vid not in seen:
                    seen.add(vid)
                    merged.append(v)

        for v in merged:
            if v.get("id") and v.get("published"):
                known.setdefault(v["id"], v["published"])  # keep RSS dates too
            if v.get("id") and known.get(v["id"]):
                v["published"] = known[v["id"]]

        gained, attempted = harvest_dates(known, merged[:DATE_HARVEST], DATE_HARVEST)
        save_dates(known)  # persist per channel: a later failure keeps this progress
        apply_dates(merged, known)
        print(f"  Date harvest: {attempted} undated of the newest {DATE_HARVEST} extracted, "
              f"{gained} newly dated ({len(known)} known overall).", flush=True)

        # Both paths must write the per-channel archive. The scheduled (full)
        # run used to skip it entirely, so the daily job refreshed only
        # latest_videos.json and left videos_*.json / journeys_*.json frozen at
        # whenever that split landed -- the vault kept serving month-old
        # uploads while the workflow stayed green.
        write_archives({key: merged}, latest_all)
        write_latest(latest_all)  # rewritten per channel: a late crash keeps progress

        if args.dates_only:
            undated = sum(1 for v in merged[:20] if not v.get("published"))
            print(f"Patched {key}: {len(merged)} videos, {sum(1 for v in merged if v.get('published'))} dated, "
                  f"{undated} of newest 20 undated.")

    save_dates(known)
    print(f"\nUpload dates known: {len(known)}")

    latest_path, total_latest = write_latest(latest_all)
    print(f"Latest uploads bundle written to {latest_path} ({total_latest} videos).")


if __name__ == "__main__":
    main()