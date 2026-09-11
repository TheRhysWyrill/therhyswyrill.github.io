---
layout: default
title: "Video Vault"
permalink: /content/
position: 3
---
<div class="vault-page">
	<div class="isolated-cinematic-card">
		<div class="billboard-overlay"></div>
		<div class="billboard-title-card">
			<h1>Video Vault</h1>
			<p class="billboard-subtitle">
				A comprehensive digital vault for edited Complete Journeys, emulation performance logs, complete longplays, and raw livestream archives. Explore the collection to see how games hold up across various systems and setups.
			</p>
		</div>
	</div>
	
	<div class="vault-fluid-row vault-fluid-row--tabs">
	<div class="channel-tabs">
	<button class="tab-btn active" onclick="switchChannel('trw')">
		TRW (Complete Journeys)
		</button>
	<button class="tab-btn" onclick="switchChannel('iip')">
		Is It Playable? (Performance)
		</button>
	<button class="tab-btn" onclick="switchChannel('tga')">
		The Gaming Archive (Longplays)
		</button>
	<button class="tab-btn" onclick="switchChannel('vods')">
		Full Livestream VODs
		</button>
	</div>
	</div>
	
	<div class="vault-fluid-row">
	<hr style="border: 0; height: 1px; background: linear-gradient(to right, rgba(255,255,255,0), rgba(255,255,255,0.1), rgba(255,255,255,0)); margin: 15px 0 20px 0;">
	</div>
	
	<div class="vault-fluid-row" id="vault-content-container">
	<div class="vault-header-wrapper">
		<div>
	<h2 id="channel-title">Complete Journeys</h2>
	<p id="channel-description">Edited, commentated playthroughs — each game played through to the credits and stitched into one complete journey.</p>
		</div>
	<div class="vault-header-search">
		<input type="text" id="vault-search" class="vault-search-input" placeholder="Filter videos..." oninput="handleSearch()">
		</div>
	</div>
	
	<div id="video-vault-grid">
	</div>
	
	<div id="pagination-container" class="pagination-controls">
			<!-- JavaScript will dynamically inject the chevrons and numbers here -->
		</div>
	</div>
	
	<script src="/assets/js/pagination.js" defer></script>
	<script>
	const channelsConfig = {
	trw: { title: "Complete Journeys", desc: "Edited, commentated playthroughs, each game played through to the credits and stitched into one complete journey.", tag: "Complete Journey", color: "#9146ff", excludeLivestreams: true },
	iip: { title: "Emulation & Proton Testing", desc: "Performance testing to see how emulation holds up and testing how 'plug and play' the Proton compatibility layer is.", tag: "Performance Log", color: "#c0c0c0" },
	tga: { title: "No-Commentary Longplays", desc: "Clean, mostly unedited, no-commentary complete playthroughs.", tag: "Longplay", color: "#d4af37" },
	vods: { title: "Full Livestream VODs", desc: "Unedited stream recordings vaulted permanently from past live streams.", tag: "Live VOD", color: "#a91b1b" }
	};
	
	let videoDatabase = {};
	let currentChannel = localStorage.getItem('vault_channel') || 'trw';
	let currentPage = parseInt(localStorage.getItem('vault_page')) || 1;
	let searchQuery = localStorage.getItem('vault_search') || '';
	let filteredVideos = [];
	let inFlightChannel = null;
	const itemsPerPage = 18;

// YouTube sometimes 404s a size variant it has not generated yet and answers
// with a 120x90 placeholder instead. Step up to the next real size until a
// full frame arrives, so every card shows a real 16:9 thumbnail.
function nextThumb(img) {
	const queue = (img.dataset.thumbNext || '').split(',').filter(Boolean);
	if (!queue.length) return;
	const size = queue.shift();
	img.dataset.thumbNext = queue.join(',');
	img.src = 'https://img.youtube.com/vi/' + img.dataset.videoId + '/' + size + '.jpg';
}
	
	// -- URL state sync (shareable / bookmarkable vault views) ----------------
	function syncStateToUrl() {
	if (!window.history || !window.history.replaceState) return;
	const params = new URLSearchParams();
	if (currentChannel !== 'trw') params.set('channel', currentChannel);
	if (searchQuery && searchQuery.trim()) params.set('q', searchQuery.trim());
	if (currentPage > 1) params.set('page', String(currentPage));
	const qs = params.toString();
	window.history.replaceState(null, '', qs ? '?' + qs : window.location.pathname);
	}
	
	function applyStateFromUrl() {
	const params = new URLSearchParams(window.location.search);
	let matched = false;
	
	const channel = params.get('channel');
	if (channel && channelsConfig[channel]) {
	currentChannel = channel;
	matched = true;
	}
	
	const query = params.get('q');
	if (query) {
	searchQuery = query;
	matched = true;
	}
	
	const page = parseInt(params.get('page'), 10);
	if (page > 1) {
	currentPage = page;
	matched = true;
	}
	
	return matched;
	}
	
	
	document.addEventListener("DOMContentLoaded", () => {
	applyStateFromUrl();
	document.getElementById('vault-search').value = searchQuery;
	applyChannelUI(currentChannel);
	loadChannel(currentChannel);
	});
	
	// Fetches a channel's data file on demand and caches it for repeat visits
	function loadChannel(channelKey) {
	if (videoDatabase[channelKey]) {
	updateFilteredList();
	renderVault();
	return;
	}
	inFlightChannel = channelKey;
	const grid = document.getElementById('video-vault-grid');
	grid.innerHTML = `<p style="color: #718096; grid-column: 1 / -1; text-align: center; padding: 40px 0;">Loading ${channelsConfig[channelKey].title}...</p>`;
	
	fetch(`/assets/data/videos_${channelKey}.json`)
	.then(response => {
	if (!response.ok) throw new Error(`HTTP ${response.status}`);
	return response.json();
	})
	.then(videos => {
	videoDatabase[channelKey] = videos;
	if (inFlightChannel !== channelKey) return; // user switched away mid-flight
	inFlightChannel = null;
	updateFilteredList();
	renderVault();
	})
	.catch(err => {
	console.error("Error retrieving video logs:", err);
	if (inFlightChannel !== channelKey) return;
	inFlightChannel = null;
	grid.innerHTML = `<p style="color: #718096; grid-column: 1 / -1; text-align: center; padding: 40px 0;">Could not load this channel's archive. Please try again later.</p>`;
	});
	}
	
	function updateFilteredList() {
	const baseVideos = videoDatabase[currentChannel] || [];
	const searchTokens = searchQuery.toLowerCase().split(/\s+/).filter(token => token.length > 0);
	
	filteredVideos = baseVideos.filter(video => {
		const titleLower = video.title.toLowerCase();
		// Livestream VODs live on their own tab; keep them off the Complete Journeys tab
		if (channelsConfig[currentChannel].excludeLivestreams && titleLower.includes('livestream')) return false;
		return searchTokens.every(token => titleLower.includes(token));
	});
	
	localStorage.setItem('vault_channel', currentChannel);
	localStorage.setItem('vault_page', currentPage);
	localStorage.setItem('vault_search', searchQuery);
	}
	
	function renderVault() {
	const grid = document.getElementById('video-vault-grid');
	const config = channelsConfig[currentChannel];
	
	document.getElementById('channel-title').innerText = config.title;
	document.getElementById('channel-description').innerText = config.desc;
	
	const totalPages = Math.ceil(filteredVideos.length / itemsPerPage) || 1;
	if (currentPage > totalPages) currentPage = totalPages;
	if (currentPage < 1) currentPage = 1;
	syncStateToUrl();
	
	const start = (currentPage - 1) * itemsPerPage;
	const end = start + itemsPerPage;
	const activePageVideos = filteredVideos.slice(start, end);
	
	grid.innerHTML = '';
	
	if (activePageVideos.length === 0) {
		grid.innerHTML = `<p style="color: #718096; grid-column: 1 / -1; text-align: center; padding: 40px 0;">No matching entries found.</p>`;
		setupPagination(totalPages);
		return;
	}
	
	activePageVideos.forEach(video => {
	const card = document.createElement('div');
	card.className = 'media-card';
	card.style.cssText = 'background: rgba(20, 24, 33, 0.4); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 8px; overflow: hidden;';
	// Real <img> with lazy loading instead of a background-image so the browser can defer offscreen thumbnails
	card.innerHTML = `
	<a href="https://www.youtube.com/watch?v=${video.id}" target="_blank" rel="noopener" style="text-decoration: none;">
	<img src="https://img.youtube.com/vi/${video.id}/mqdefault.jpg" alt="${video.title.replace(/"/g, '&quot;')} thumbnail" loading="lazy" decoding="async" width="320" height="180" data-video-id="${video.id}" data-thumb-next="hq720,maxresdefault" onload="if (this.naturalWidth < 320) nextThumb(this)" onerror="nextThumb(this)" style="width: 100%; height: auto; display: block; border-bottom: 1px solid rgba(255,255,255,0.05);">
	</a>
	<div style="padding: 12px;">
	<span style="display: inline-block; color: ${config.color}; font-size: 0.65rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; padding: 2px 9px; background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 999px;">${config.tag}</span>
	<h4 style="color: #fff; font-size: 0.85rem; margin: 7px 0 0 0; font-weight:600; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; height: 2.6em;">${video.title}</h4>
	</div>
	`;
	grid.appendChild(card);
	});
	
	setupPagination(totalPages);
	}
	
	function setupPagination(totalPages) {
	const container = document.getElementById('pagination-container');
	
	window.setupPaginationNav({
		container: container,
		totalPages: totalPages,
		currentPage: currentPage,
		activeColor: channelsConfig[currentChannel].color,
		onPageChange: (targetPage) => {
			currentPage = targetPage;
			localStorage.setItem('vault_page', currentPage);
			renderVault();
			document.getElementById('vault-content-container').scrollIntoView({ behavior: 'smooth' });
		}
	});
	}
	
	function handleSearch() {
	searchQuery = document.getElementById('vault-search').value;
	currentPage = 1; 
	updateFilteredList();
	renderVault();
	}
	
	function switchChannel(channelKey) {
	currentChannel = channelKey;
	currentPage = 1;
	searchQuery = '';
	document.getElementById('vault-search').value = '';
	
	applyChannelUI(channelKey);
	loadChannel(channelKey);
	}
	
	function applyChannelUI(channelKey) {
	const config = channelsConfig[channelKey];
	const tabs = document.querySelectorAll('.tab-btn');
	const keys = Object.keys(channelsConfig);
	
	tabs.forEach((btn, idx) => {
	btn.classList.toggle('active', keys[idx] === channelKey);
	});
	
	// Per-channel accent color consumed by the .tab-btn.active and
	// pagination .is-active styles instead of inline JS styling
	document.querySelector('.vault-page').style.setProperty('--tab-accent', config.color);
	}
	
	function changePage(direction) {
	currentPage += direction;
	localStorage.setItem('vault_page', currentPage);
	renderVault();
	document.getElementById('vault-content-container').scrollIntoView({ behavior: 'smooth' });
	}
	</script>
</div>