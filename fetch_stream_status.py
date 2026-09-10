"""
Fetches the current Twitch livestream status for the configured channel.

Uses Twitch's public GQL endpoint with the same client-id that public tools
like Streamlink and yt-dlp use - no personal OAuth token required.

Writes assets/data/stream_status.json shaped like:

    {
      "isLive": false,
      "checkedAt": "2026-09-08T12:00:00Z",
      "stream": { "title": "...", "game": "...", "viewers": 123, "startedAt": "..." },
      "latestVod": { "id": "...", "title": "...", "createdAt": "..." }
    }

The JSON only changes when the live state, stream title/game/viewers or the
latest VOD changes, so a scheduled job committing this file does not produce
empty "status refresh" commits.
"""

import json
import os
import urllib.request
from datetime import datetime, timezone

CHANNEL = "therhyswyrill"
CLIENT_ID = "kimne78kx3ncx6brgo4mv6wki5h1ko"  # public web client-id, not a secret
OUTPUT_PATH = "./assets/data/stream_status.json"
STATUS_URL = "https://gql.twitch.tv/gql"

STATUS_QUERY = {
    "query": """
    query StreamStatus($login: String!) {
      user(login: $login) {
        stream {
          title
          game { displayName }
          viewersCount
          createdAt
        }
        videos(first: 1, type: ARCHIVE) {
          edges {
            node {
              id
              title
              createdAt
              lengthSeconds
            }
          }
        }
      }
    }
    """,
    "variables": {"login": CHANNEL},
}


def gql_request(payload):
    request = urllib.request.Request(
        STATUS_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Client-ID": CLIENT_ID,
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def main():
    data = gql_request(STATUS_QUERY)
    user = (data.get("data") or {}).get("user") or {}

    stream = user.get("stream")
    stream_payload = None
    if stream:
        game = stream.get("game") or {}
        stream_payload = {
            "title": stream.get("title"),
            "game": game.get("displayName"),
            "viewers": stream.get("viewersCount"),
            "startedAt": stream.get("createdAt"),
        }

    edges = ((user.get("videos") or {}).get("edges")) or []
    vod_payload = None
    if edges:
        node = edges[0].get("node") or {}
        vod_payload = {
            "id": node.get("id"),
            "title": node.get("title"),
            "createdAt": node.get("createdAt"),
            "lengthSeconds": node.get("lengthSeconds"),
        }

    status = {
        "isLive": stream is not None,
        "checkedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "stream": stream_payload,
        "latestVod": vod_payload,
    }

    existing = None
    if os.path.exists(OUTPUT_PATH):
        try:
            with open(OUTPUT_PATH, encoding="utf-8") as handle:
                existing = json.load(handle)
        except (OSError, ValueError):
            existing = None

    # checkedAt always differs between runs, so compare everything but it
    def meaningful(payload):
        return {k: v for k, v in (payload or {}).items() if k != "checkedAt"}

    if existing is not None and meaningful(existing) == meaningful(status):
        print("Status unchanged; leaving stream_status.json as-is.")
        return

    with open(OUTPUT_PATH, "w", encoding="utf-8") as handle:
        json.dump(status, handle, indent=2, ensure_ascii=False)
        handle.write("\n")

    print(f"Status updated: live={status['isLive']}, vod={'yes' if vod_payload else 'no'}")


if __name__ == "__main__":
    main()
