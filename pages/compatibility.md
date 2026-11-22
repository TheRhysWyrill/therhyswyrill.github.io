---
layout: default
title: Is It Playable? Data
permalink: /compatibility/
position: 1
---

<div class="compat-page">
	<div class="isolated-cinematic-card">
		<div class="billboard-overlay"></div>
		<div class="billboard-title-card">
			<h1>Is It Playable? Data</h1>
			<p class="billboard-subtitle">
				Select a platform tab below to view game emulation status. Use the
				search bar to narrow down titles. Everything contained within this table is a matter of opinion, what might be considered "Playable with Issues" for me might be "Playable" for you and vice versa.
			</p>
		</div>
		<div class="compat-tested-bar" id="compat-tested-bar" aria-live="polite">
			<span class="compat-tested-text" id="compat-tested-text">Counting tested games…</span>
			<div class="compat-tested-track"><div class="compat-tested-fill" id="compat-tested-fill" style="width: 0%;"></div></div>
		</div>
	</div>

	<div class="excel-tabs"></div>
	<select id="mobile-platform-select" class="compat-mobile-platform-select"></select>
	<div id="table-workspace-wrapper"></div>

	<script src="/assets/js/tested-counter.js" defer></script>
	<script>
		(function () {
			function renderBar(d) {
				if (!d || !(d.tested > 0) && !(d.backlog > 0)) return;
				var total = d.tested + d.backlog;
				var pct = total > 0 ? Math.round(d.tested / total * 100) : 0;
				document.getElementById('compat-tested-text').innerHTML =
					'<strong>' + d.tested.toLocaleString('en-GB') + '</strong> games tested across ' + d.platforms.length +
					' platforms &nbsp;·&nbsp; ' + d.backlog.toLocaleString('en-GB') + ' still to be tested';
				document.getElementById('compat-tested-fill').style.width = pct + '%';
			}
			document.addEventListener('compat-tested-count', function (e) { renderBar(e.detail); });
			if (window.__compatTestedDetails) renderBar(window.__compatTestedDetails);
		})();
	</script>

	<link rel="preconnect" href="https://code.jquery.com" crossorigin>
	<link rel="preconnect" href="https://cdnjs.cloudflare.com" crossorigin>
	{% comment %}
	  jQuery and PapaParse stay on their CDNs (both are used heavily by the
	  table script), but all three are deferred: the table needs them, the first
	  paint does not. compat-table.js was a 29 KB inline block until it moved
	  out to a file, so it is cached between visits and no longer blocks the
	  parser behind a third-party round trip.
	{% endcomment %}
	<script src="https://code.jquery.com/jquery-3.6.0.min.js" defer></script>
	<script src="https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js" defer></script>
	<script src="{{ '/assets/js/compat-table.js' | relative_url }}" defer></script>
</div>
