import json
import os
import subprocess

# Define your channels here
CHANNELS = {
    "trw": "https://www.youtube.com/channel/UCKK7ydtKLQjnD9k5jal4XuQ/",
    "iip": "https://www.youtube.com/channel/UCKBIk4jH8Ow8BRcGwVKVMIA/",
    "tga": "https://www.youtube.com/channel/UCgVbOWuIhwWNpvHJ5AbIA2w/",
    "vods": "https://www.youtube.com/channel/UCYQlzu1EsF04EUOdNTZhCFg/"
}

OUTPUT_DIR = "./assets/data"

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
            
    # Save each channel into its own file so pages only download the data they need
    output_path = os.path.join(OUTPUT_DIR, f"videos_{key}.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(channel_videos, f, indent=2, ensure_ascii=False)

    print(f"Done! Found {len(channel_videos)} videos. Saved to {output_path}")

print("\nSuccess! Vault database updated.")