import json
import os
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
RSS_NS = {
    "atom": "http://www.w3.org/2005/Atom",
    "yt": "http://www.youtube.com/xml/schemas/2015",
}


def fetch_rss_latest(channel_id):
    """Pull the ~15 newest uploads from the channel's RSS feed.

    yt-dlp's flat-playlist extraction can occasionally serve stale results,
    which silently freezes the vault at old data while the workflow still
    "succeeds". The channel RSS feed is always current, so it is fetched
    separately and merged in as the source of truth for recent uploads.
    """
    url = f"https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}"
    with urllib.request.urlopen(url, timeout=30) as resp:
        root = ET.fromstring(resp.read())
    videos = []
    for entry in root.findall("atom:entry", RSS_NS):
        vid = entry.find("yt:videoId", RSS_NS)
        title = entry.find("atom:title", RSS_NS)
        if vid is not None and title is not None and vid.text:
            videos.append({"id": vid.text, "title": title.text if title.text else ""})
    return videos


for key, url in CHANNELS.items():
    print(f"Fetching full archive for {key}...")

    # Run yt-dlp to extract just the IDs and Titles
    cmd = [
        "yt-dlp",
        "--flat-playlist",
        "--dump-json",
        f"{url}/videos"
    ]

    result = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8")

    channel_videos = []
    for line in result.stdout.splitlines():
        if line.strip():
            video_info = json.loads(line)
            channel_videos.append({
                "id": video_info.get("id"),
                "title": video_info.get("title")
            })

    # Always-fresh recent uploads from the RSS feed (see docstring above)
    channel_id = url.rstrip("/").split("/")[-1]
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

    # Save each channel into its own file so pages only download the data they need
    output_path = os.path.join(OUTPUT_DIR, f"videos_{key}.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(merged, f, indent=2, ensure_ascii=False)

    # Slim companion file with just the "Complete Journey" videos (~2 KB).
    # Review pages match against this instead of the full vault archive,
    # which keeps a ~1.8 MB payload off every review page load.
    journeys = [v for v in merged if "complete journey" in (v.get("title") or "").lower()]
    journeys_path = os.path.join(OUTPUT_DIR, f"journeys_{key}.json")
    with open(journeys_path, "w", encoding="utf-8") as f:
        json.dump(journeys, f, separators=(",", ":"), ensure_ascii=False)

    print(f"Done! Found {len(merged)} videos ({len(journeys)} complete journeys). Saved to {output_path}")

print("\nSuccess! Vault database updated.")
