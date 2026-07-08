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
				A comprehensive digital vault for edited Let's Plays, emulation performance logs, complete longplays, and raw livestream archives. Explore the collection to see how games hold up across various systems and setups.
			</p>
		</div>
	</div>
	
	<div class="vault-fluid-row" style="margin-top: -5px !important;">
	<div class="channel-tabs" style="display: flex; flex-direction: row; justify-content: center; gap: 12px; width: 100%; padding-bottom: 5px;">
		<button class="tab-btn active" onclick="switchChannel('trw')" style="background: #9146ff; color: #fff; border: none; padding: 12px 20px; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s ease; font-size: 0.9rem; flex: 1; text-align: center; min-width: 180px;">
		TheRhysWyrill (Let's Plays)
		</button>
		<button class="tab-btn" onclick="switchChannel('iip')" style="background: rgba(255,255,255,0.05); color: #a0aec0; border: 1px solid rgba(255,255,255,0.08); padding: 12px 20px; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s ease; font-size: 0.9rem; flex: 1; text-align: center; min-width: 180px;">
		Is It Playable? (Performance)
		</button>
		<button class="tab-btn" onclick="switchChannel('tga')" style="background: rgba(255,255,255,0.05); color: #a0aec0; border: 1px solid rgba(255,255,255,0.08); padding: 12px 20px; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s ease; font-size: 0.9rem; flex: 1; text-align: center; min-width: 180px;">
		The Gaming Archive (Longplays)
		</button>
		<button class="tab-btn" onclick="switchChannel('vods')" style="background: rgba(255,255,255,0.05); color: #a0aec0; border: 1px solid rgba(255,255,255,0.08); padding: 12px 20px; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s ease; font-size: 0.9rem; flex: 1; text-align: center; min-width: 180px;">
		Full Livestream VODs
		</button>
	</div>
	</div>
	
	<div class="vault-fluid-row">
	<hr style="border: 0; height: 1px; background: linear-gradient(to right, rgba(255,255,255,0), rgba(255,255,255,0.1), rgba(255,255,255,0)); margin: 15px 0 20px 0;">
	</div>
	
	<div class="vault-fluid-row" id="vault-content-container">
	<div class="vault-header-wrapper" style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 25px; gap: 20px; flex-wrap: wrap; width: 100%;">
		<div>
		<h2 id="channel-title" style="margin-bottom: 5px; font-weight: 700; color: #fff;">Edited Let's Plays</h2>
		<p id="channel-description" style="color: #a0aec0; margin: 0;">Edited commentary playthroughs, focusing on complete playthroughs.</p>
		</div>
		<div style="width: 100%; max-width: 320px;">
		<input type="text" id="vault-search" class="vault-search-input" placeholder="Filter videos..." oninput="handleSearch()">
		</div>
	</div>
	
	<div id="video-vault-grid" style="display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 15px; margin-bottom: 40px; width: 100%;">
	</div>
	
	<div id="pagination-container" class="pagination-controls" style="display: flex; justify-content: center; align-items: center; gap: 8px; margin-top: 40px; padding-bottom: 60px;">
			<!-- JavaScript will dynamically inject the chevrons and numbers here -->
		</div>
	</div>
	
	<script>
	const channelsConfig = {
	trw: { title: "Edited Let's Plays", desc: "Edited commentary playthroughs, focusing on complete playthroughs.", tag: "Let's Play", color: "#9146ff" },
	iip: { title: "Emulation & Proton Testing", desc: "Performance testing to see how emulation holds up and testing how 'plug and play' the Proton compatibility layer is.", tag: "Performance Log", color: "#c0c0c0" },
	tga: { title: "No-Commentary Longplays", desc: "Clean, mostly unedited, no-commentary complete playthroughs.", tag: "Longplay", color: "#d4af37" },
	vods: { title: "Full Livestream VODs", desc: "Unedited stream recordings vaulted permanently from past live streams.", tag: "Live VOD", color: "#a91b1b" }
	};
	
	let videoDatabase = {}; 
	let currentChannel = localStorage.getItem('vault_channel') || 'trw';
	let currentPage = parseInt(localStorage.getItem('vault_page')) || 1;
	let searchQuery = localStorage.getItem('vault_search') || '';
	let filteredVideos = [];
	const itemsPerPage = 18;
	
	document.addEventListener("DOMContentLoaded", () => {
	document.getElementById('vault-search').value = searchQuery;
	
	fetch('/assets/data/all_videos.json')
		.then(response => response.json())
		.then(data => {
		videoDatabase = data;
		updateFilteredList();
		applyChannelUI(currentChannel);
		renderVault();
		})
		.catch(err => console.error("Error retrieving video logs:", err));
	});
	
	function updateFilteredList() {
	const baseVideos = videoDatabase[currentChannel] || [];
	const searchTokens = searchQuery.toLowerCase().split(/\s+/).filter(token => token.length > 0);
	
	filteredVideos = baseVideos.filter(video => {
		const titleLower = video.title.toLowerCase();
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
		card.innerHTML = `
		<a href="https://www.youtube.com/watch?v=${video.id}" target="_blank" style="text-decoration: none;">
			<div style="background-image: url('https://img.youtube.com/vi/${video.id}/mqdefault.jpg'); background-size: cover; background-position: center; aspect-ratio: 16/9; border-bottom: 1px solid rgba(255,255,255,0.05);"></div>
		</a>
		<div style="padding: 12px;">
			<span style="color: ${config.color}; font-size: 0.7rem; font-weight: 700; text-transform: uppercase;">${config.tag}</span>
			<h4 style="color: #fff; font-size: 0.85rem; margin: 5px 0 0 0; font-weight:600; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; height: 2.6em;">${video.title}</h4>
		</div>
		`;
		grid.appendChild(card);
	});
	
	setupPagination(totalPages);
	}
	
	function setupPagination(totalPages) {
	const container = document.getElementById('pagination-container');
	container.innerHTML = '';
	
	if (filteredVideos.length <= itemsPerPage) {
		container.style.display = 'none';
		return;
	}
	
	container.style.display = 'flex';
	container.style.gap = '8px';
	container.style.alignItems = 'center';
	container.style.justifyContent = 'center';
	
	// Get current active tab accent color
	const activeChannelColor = channelsConfig[currentChannel].color;
	
	const createNavButton = (text, targetPage, isDisabled = false) => {
		const btn = document.createElement("button");
		btn.innerText = text;
		
		// Exact sizing, layout borders, and font structure matched directly from the reviews layout
		btn.style.background = targetPage === currentPage && !isDisabled ? activeChannelColor : "transparent";
		btn.style.color = isDisabled ? "rgba(255,255,255,0.2)" : (targetPage === currentPage ? "#ffffff" : "#ccdee9");
		btn.style.border = targetPage === currentPage && !isDisabled ? "1px solid rgba(255,255,255,0.2)" : "1px solid rgba(255,255,255,0.05)";
		btn.style.padding = "8px 16px"; 
		btn.style.borderRadius = "6px";
		btn.style.fontWeight = targetPage === currentPage ? "bold" : "normal";
		btn.style.minWidth = "40px"; 
		btn.style.display = "flex";
		btn.style.justifyContent = "center";
		btn.style.alignItems = "center";
		btn.style.transition = "all 0.2s ease";
		
		// Forced font size property override
		btn.style.setProperty("font-size", "18px", "important");
		
		if (isDisabled) {
		btn.style.cursor = "not-allowed";
		} else {
		btn.style.cursor = "pointer";
		if (targetPage !== currentPage) {
			btn.addEventListener("mouseover", () => {
			btn.style.background = "rgba(255,255,255,0.08)";
			btn.style.borderColor = "rgba(255,255,255,0.15)";
			});
			btn.addEventListener("mouseout", () => {
			btn.style.background = "transparent";
			btn.style.borderColor = "rgba(255,255,255,0.05)";
			});
			btn.addEventListener("click", () => {
			currentPage = targetPage;
			localStorage.setItem('vault_page', currentPage);
			renderVault();
			document.getElementById('vault-content-container').scrollIntoView({ behavior: 'smooth' });
			});
		}
		}
		return btn;
	};
	
	// 1. Single Chevron Left Symbol (‹)
	const prevArrow = createNavButton("«", currentPage - 1, currentPage === 1);
	container.appendChild(prevArrow);
	
	// Calculate inner pagination layout limits window
	let pages = [];
	pages.push(1);
	
	let startWindow = Math.max(2, currentPage - 1);
	let endWindow = Math.min(totalPages - 1, currentPage + 1);
	
	if (currentPage <= 2) {
		endWindow = Math.min(totalPages - 1, 3);
	}
	if (currentPage >= totalPages - 1) {
		startWindow = Math.max(2, totalPages - 2);
	}
	
	for (let i = startWindow; i <= endWindow; i++) {
		if (i > 1 && i < totalPages) {
		pages.push(i);
		}
	}
	
	if (totalPages > 1) {
		pages.push(totalPages);
	}
	pages = [...new Set(pages)].sort((a, b) => a - b);
	
	// 2. Render Page Numbers and structural Ellipses
	let lastPageNum = 0;
	pages.forEach(pageNum => {
		if (lastPageNum > 0 && pageNum - lastPageNum > 1) {
		const ellipsis = document.createElement("span");
		ellipsis.innerText = "...";
		ellipsis.style.color = "#ccdee9";
		ellipsis.style.padding = "0 6px";
		ellipsis.style.fontSize = "16px"; 
		ellipsis.style.width = "40px";
		ellipsis.style.textAlign = "center";
		container.appendChild(ellipsis);
		}
	
		const numBtn = createNavButton(pageNum, pageNum);
		container.appendChild(numBtn);
		lastPageNum = pageNum;
	});
	
	// 3. Single Chevron Right Symbol (›)
	const nextArrow = createNavButton("»", currentPage + 1, currentPage === totalPages);
	container.appendChild(nextArrow);
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
	updateFilteredList();
	renderVault();
	}
	
	function applyChannelUI(channelKey) {
	const tabs = document.querySelectorAll('.tab-btn');
	const targetColor = channelsConfig[channelKey].color;
	
	tabs.forEach((btn, idx) => {
		const keys = Object.keys(channelsConfig);
		if (keys[idx] === channelKey) {
		btn.style.background = targetColor;
		btn.style.color = '#fff';
		btn.style.border = 'none';
		} else {
		btn.style.background = 'rgba(255,255,255,0.05)';
		btn.style.color = '#a0aec0';
		btn.style.border = '1px solid rgba(255, 255, 255, 0.08)';
		}
	});
	}
	
	function changePage(direction) {
	currentPage += direction;
	localStorage.setItem('vault_page', currentPage);
	renderVault();
	document.getElementById('vault-content-container').scrollIntoView({ behavior: 'smooth' });
	}
	</script>
</div>