---
layout: default
title: "Livestream"
permalink: /live/
position: 4
---

<div class="isolated-cinematic-card">
    <div class="billboard-overlay"></div>
    <div class="billboard-title-card">
        <h1>Livestream</h1>
        <p class="billboard-subtitle">
            Catch me live.
        </p>
    </div>
</div>

<div class="stream-breakout-container">
    <div class="stream-player-wrapper">

        <div class="stream-video-pane" id="stream-video-pane">
            <!-- Live player: only injected when the channel is live, so offline
                 visitors never download the embed at all. -->
        </div>

        <!-- Offline state: friendly panel with the latest archived VOD -->
        <div class="stream-offline-pane" id="stream-offline-pane" hidden>
            <div class="stream-offline-message">
                <span class="stream-offline-dot" aria-hidden="true"></span>
                <h2>Not live right now</h2>
                <p id="stream-offline-text">
                    The stream is offline, but the archive keeps growing. Here is the latest VOD:
                </p>
                <a id="stream-vod-link" class="stream-vod-cta" href="https://www.twitch.tv/therhyswyrill/videos" target="_blank" rel="noopener">
                    Browse all VODs &rarr;
                </a>
            </div>

            <div class="stream-vod-embed" id="stream-vod-embed">
                <!-- Latest VOD player injected here by the status check -->
            </div>
        </div>

        <div class="stream-chat-pane" id="stream-chat-pane"></div>

    </div>
</div>

<script>
(function () {
    const CHANNEL = "therhyswyrill";
    const STATUS_URL = "/assets/data/stream_status.json";
    const STALE_AFTER_MS = 24 * 60 * 60 * 1000; // ignore status older than a day

    const videoPane = document.getElementById("stream-video-pane");
    const offlinePane = document.getElementById("stream-offline-pane");
    const chatPane = document.getElementById("stream-chat-pane");

    function embedParent() {
        // Twitch embeds refuse to render unless the parent matches the host page
        return window.location.hostname || "therhyswyrill.github.io";
    }

    function mountPlayer(src) {
        const iframe = document.createElement("iframe");
        iframe.src = src;
        iframe.allowFullscreen = true;
        iframe.setAttribute("frameborder", "0");
        iframe.setAttribute("scrolling", "no");
        iframe.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;";
        return iframe;
    }

    function showLive() {
        videoPane.appendChild(mountPlayer(
            "https://player.twitch.tv/?channel=" + CHANNEL + "&parent=" + embedParent() + "&autoplay=false"
        ));
        chatPane.appendChild(mountPlayer(
            "https://www.twitch.tv/embed/" + CHANNEL + "/chat?parent=" + embedParent() + "&darkpopout"
        ));
    }

    function showOffline(status) {
        videoPane.hidden = true;
        chatPane.hidden = true; // no chat to watch when the channel is offline
        offlinePane.hidden = false;

        const stream = status.stream;
        if (stream && stream.title) {
            // Last known broadcast info gives the offline state some personality
            const parts = [];
            if (stream.title) parts.push(stream.title);
            if (stream.game) parts.push(stream.game);
            if (parts.length) {
                document.getElementById("stream-offline-text").textContent =
                    "The stream is offline (last seen: " + parts.join(" \u2014 ") + "). Here is the latest VOD:";
            }
        }

        const vod = status.latestVod;
        if (vod && vod.id) {
            const vodEmbed = document.getElementById("stream-vod-embed");
            vodEmbed.appendChild(mountPlayer(
                "https://player.twitch.tv/?video=" + vod.id + "&parent=" + embedParent() + "&autoplay=false"
            ));

            const link = document.getElementById("stream-vod-link");
            link.href = "https://www.twitch.tv/videos/" + vod.id;
            link.textContent = "Watch on Twitch \u2192";
        }
    }

    function statusIsUsable(status) {
        if (!status || typeof status.isLive !== "boolean") return false;
        if (!status.checkedAt) return false;
        return (Date.now() - Date.parse(status.checkedAt)) < STALE_AFTER_MS;
    }

    document.addEventListener("DOMContentLoaded", function () {
        fetch(STATUS_URL)
            .then(function (response) {
                if (!response.ok) throw new Error("HTTP " + response.status);
                return response.json();
            })
            .then(function (status) {
                if (statusIsUsable(status) && !status.isLive) {
                    showOffline(status);
                } else {
                    // Live, unknown, or stale data: default to showing the player
                    showLive();
                }
            })
            .catch(function () {
                // No status data available: default to the live player
                showLive();
            });
    });
})();
</script>
