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
# far too slow to redo for a 19,000 video channel on every run. Harvesting a
# bounded window of the newest videos and merging it into a sidecar means each
# scheduled run dates a fresh slice instead of repeating the last one, so
# coverage climbs on its own and old dates are never thrown away.
DATES_PATH = os.path.join(OUTPUT_DIR, "video_dates.json")

# How many of the newest uploads per channel to date on each run. A channel's
# /videos listing is newest-first, so this window moves forward as the schedule
# runs; raise it for a deliberate backfill, or set VAULT_DATE_HARVEST=0 to skip.
DATE_HARVEST = int(os.environ.get("VAULT_DATE_HARVEST", "300"))

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
    """yt-dlp hands back YYYYMMDD (upload_date) or a unix timestamp. Normalise
    to the YYYY-MM-DD the archive and the vault's string comparison expect."""
    if not raw:
        return None
    raw = str(raw).strip()
    if re.fullmatch(r"\d{8}", raw):
        return f"{raw[0:4]}-{raw[4:6]}-{raw[6:8]}"
    if re.fullmatch(r"\d{9,}", raw):
        import datetime

        return datetime.datetime.utcfromtimestamp(int(raw)).strftime("%Y-%m-%d")
    return None


def harvest_dates(channel_id, known, limit):
    """Date the newest `limit` uploads with a real (non-flat) extraction.

    Returns the number of ids that gained a date for the first time.
    """
    if limit <= 0:
        return 0
    url = f"https://www.youtube.com/channel/{channel_id}/videos"
    cmd = [
        "yt-dlp",
        "--skip-download",
        "--no-warnings",
        "--ignore-errors",
        f"--playlist-end={limit}",
        "--print",
        "%(id)s|%(upload_date)s",
        url,
    ]
    gained = 0
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8")
    except FileNotFoundError:
        print("WARNING: yt-dlp not on PATH; skipping date harvest.")
        return 0
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
    return gained


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


def list_channel(key, url):
    """The full channel listing: fast, ids and titles, no dates."""
    cmd = ["yt-dlp", "--flat-playlist", "--dump-json", f"{url}/videos"]
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
            print(f"Fetching full archive for {key}...")
            channel_videos = list_channel(key, url)

            # Always-fresh recent uploads from the RSS feed (see docstring above)
            try:
                rss_videos = fetch_rss_latest(channel_id)
                print(f"  RSS feed: {len(rss_videos)} recent uploads")
            except Exception as e:
                print(f"  WARNING: RSS fetch failed for {key} ({e}); using yt-dlp results only.")
                rss_videos = []

            # Merge: RSS newest-first, then the full archive, deduplicated by id
            seen = set()
            merged = []
            for v in rss_videos + channel_videos:
                vid = v.get("id")
                if vid and vid not in seen:
                    seen.add(vid)
                    merged.append(v)

            # Guard against writing an empty/partial archive (e.g. YouTube hiccup):
            # keep the previous file untouched rather than wiping the vault.
            if not merged:
                print(f"  WARNING: no videos extracted for {key}; keeping existing file unchanged.")
                continue

        for v in merged:
            if v.get("id") and v.get("published"):
                known.setdefault(v["id"], v["published"])  # keep RSS dates too
            if v.get("id") and known.get(v["id"]):
                v["published"] = known[v["id"]]

        gained = harvest_dates(channel_id, known, DATE_HARVEST)
        save_dates(known)  # persist per channel: a later failure keeps this progress
        apply_dates(merged, known)
        print(f"  Date harvest: {DATE_HARVEST} newest checked, {gained} newly dated "
              f"({len(known)} known overall).", flush=True)

        latest_all[key] = sorted((v for v in merged if v.get("published")),
                                 key=lambda v: v["published"], reverse=True)[:8]
        write_latest(latest_all)

        latest_all[key] = sorted((v for v in merged if v.get("published")),
                                 key=lambda v: v["published"], reverse=True)[:8]

        if args.dates_only:
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(merged, f, indent=2, ensure_ascii=False)
            journeys = [v for v in merged if "complete journey" in (v.get("title") or "").lower()]
            with open(os.path.join(OUTPUT_DIR, f"journeys_{key}.json"), "w", encoding="utf-8") as f:
                json.dump(journeys, f, separators=(",", ":"), ensure_ascii=False)
            undated = sum(1 for v in merged[:20] if not v.get("published"))
            print(f"Patched {key}: {len(merged)} videos, {sum(1 for v in merged if v.get('published'))} dated, "
                  f"{undated} of newest 20 undated.")
        else:
            latest_all[key] = sorted((v for v in merged if v.get("published")),
                                     key=lambda v: v["published"], reverse=True)[:8]

    save_dates(known)
    print(f"\nUpload dates known: {len(known)}")

    latest_path, total_latest = write_latest(latest_all)
    print(f"Latest uploads bundle written to {latest_path} ({total_latest} videos).")


if __name__ == "__main__":
    main()