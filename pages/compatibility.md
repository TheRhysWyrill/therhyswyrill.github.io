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
	</div>

	<div class="excel-tabs"></div>
	<select id="mobile-platform-select" class="compat-mobile-platform-select"></select>
	<div id="table-workspace-wrapper"></div>

	<script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
	<script src="https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js"></script>

	<script>
		let externalVideoCache = [];
		let sortedPlatformKeys  = [];
		let currentData         = [];
		let currentConfig       = null;
		let currentSearchTerm   = '';
		let currentSort         = { col: 0, dir: 'asc' };
		let currentPage         = 1;
		const getPageSize       = () => window.innerWidth <= 768 ? 18 : 42;

		$(document).ready(function () {

			$.getJSON("{{ '/assets/data/all_videos.json' | relative_url }}")
				.done(function (data) {
					if (data && data.iip) {
						externalVideoCache = data.iip;
						// Re-link videos if a platform tab already finished rendering before this resolved
						if (currentConfig) {
							autoLinkCardVideos(currentConfig.emulatorKeywords, currentConfig.excludeKeywords);
						}
					}
				})
				.fail(function () {
					console.warn("Could not load all_videos.json. Video cross-referencing falls back to inactive.");
				});

			const platformRegistry = {
				"3ds": {
					name: "NINTENDO 3DS",
					type: "standard",
					emulatorKeywords: ["azahar", "3ds"],
					excludeKeywords: ["retroarch", "ra"],
					specs: "Ryzen 9 7950X | Radeon RX 7800 XT | SteamOS",
					config: "4x Native Resolution",
					url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vS8WCGQqGmcBqDZ1mIvuanPSjkFWIKeVK54FVefiNPSqu5q-IL4XrE8A2mYzrEoWH6CVpwvyEsDJ8EV/pub?gid=989513195&single=true&output=csv"
				},
				"3ds_retroarch": {
					name: "NINTENDO 3DS (RETROARCH)",
					type: "standard",
					emulatorKeywords: ["azahar retroarch", "azahar ra"],
					specs: "Ryzen 9 7950X | Radeon RX 7800 XT | SteamOS",
					config: "Hardware Shaders = Off, 4x Native Resolution",
					url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vS8WCGQqGmcBqDZ1mIvuanPSjkFWIKeVK54FVefiNPSqu5q-IL4XrE8A2mYzrEoWH6CVpwvyEsDJ8EV/pub?gid=1690649920&single=true&output=csv"
				},
				"gamecube_wii": {
					name: "GAMECUBE / WII",
					type: "standard",
					emulatorKeywords: ["dolphin", "gamecube", "wii"],
					specs: "Ryzen 9 7950X | Radeon RX 7800 XT | SteamOS",
					config: "4x Native Resolution",
					url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vS8WCGQqGmcBqDZ1mIvuanPSjkFWIKeVK54FVefiNPSqu5q-IL4XrE8A2mYzrEoWH6CVpwvyEsDJ8EV/pub?gid=722868656&single=true&output=csv"
				},
				"nintendo_switch": {
					name: "NINTENDO SWITCH (Citron Neo/Eden)",
					type: "standard",
					emulatorKeywords: ["citron", "neo", "eden"],
					specs: "Ryzen 9 7950X | Radeon RX 7800 XT | SteamOS",
					config: "Resolution = 2x, Anti-Aliasing Method = SMAA, Anisotropic Filtering = 16x, Enable asynchronous presentation = On, Extended Dynamic State = Disabled, Vertex Input Dynamic State = Off",
					url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vS8WCGQqGmcBqDZ1mIvuanPSjkFWIKeVK54FVefiNPSqu5q-IL4XrE8A2mYzrEoWH6CVpwvyEsDJ8EV/pub?gid=412405791&single=true&output=csv"
				},
				"nintendo_switch_ryujinx": {
					name: "NINTENDO SWITCH (RYUJINX)",
					type: "standard",
					emulatorKeywords: ["ryujinx", "switch"],
					specs: "Ryzen 9 7950X | Radeon RX 7800 XT | SteamOS",
					config: "2x Native Resolution, Audio Backend = OpenAL",
					url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vS8WCGQqGmcBqDZ1mIvuanPSjkFWIKeVK54FVefiNPSqu5q-IL4XrE8A2mYzrEoWH6CVpwvyEsDJ8EV/pub?gid=1611607237&single=true&output=csv"
				},
				"ps2": {
					name: "PS2",
					type: "standard",
					emulatorKeywords: ["pcsx2", "ps2"],
					specs: "Ryzen 9 7950X | Radeon RX 7800 XT | SteamOS",
					config: "EE Cycle Rate = 180%, 4x Native Resolution",
					url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vS8WCGQqGmcBqDZ1mIvuanPSjkFWIKeVK54FVefiNPSqu5q-IL4XrE8A2mYzrEoWH6CVpwvyEsDJ8EV/pub?gid=2142455474&single=true&output=csv"
				},
				"ps3": {
					name: "PS3",
					type: "standard",
					emulatorKeywords: ["rpcs3", "ps3"],
					specs: "Ryzen 9 7950X | Radeon RX 7800 XT | SteamOS",
					config: "Enable SPU Loop Detection = On, ZCULL Accuracy = Approximate, Multithreaded RSX = On, RSX FIFO Accuracy = Atomic",
					url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vS8WCGQqGmcBqDZ1mIvuanPSjkFWIKeVK54FVefiNPSqu5q-IL4XrE8A2mYzrEoWH6CVpwvyEsDJ8EV/pub?gid=223480540&single=true&output=csv"
				},
				"ps4": {
					name: "PS4",
					type: "ps4",
					emulatorKeywords: ["shadps4", "ps4"],
					specs: "Ryzen 9 7950X | Radeon RX 7800 XT | SteamOS",
					config: "none",
					url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vS8WCGQqGmcBqDZ1mIvuanPSjkFWIKeVK54FVefiNPSqu5q-IL4XrE8A2mYzrEoWH6CVpwvyEsDJ8EV/pub?gid=1869087751&single=true&output=csv"
				},
				"psvita": {
					name: "PS VITA",
					type: "standard",
					emulatorKeywords: ["vita3k", "psvita"],
					specs: "Ryzen 9 7950X | Radeon RX 7800 XT | SteamOS",
					config: "2x Native Resolution",
					url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vS8WCGQqGmcBqDZ1mIvuanPSjkFWIKeVK54FVefiNPSqu5q-IL4XrE8A2mYzrEoWH6CVpwvyEsDJ8EV/pub?gid=1379946484&single=true&output=csv"
				},
				"steamos": {
					name: "SteamOS",
					type: "steamos",
					emulatorKeywords: ["native"],
					specs: "Ryzen 9 7950X | Radeon RX 7800 XT | SteamOS",
					config: "none",
					url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vS8WCGQqGmcBqDZ1mIvuanPSjkFWIKeVK54FVefiNPSqu5q-IL4XrE8A2mYzrEoWH6CVpwvyEsDJ8EV/pub?gid=441094204&single=true&output=csv"
				},
				"wii_u": {
					name: "WII U",
					type: "standard",
					emulatorKeywords: ["cemu", "wiiu"],
					specs: "Ryzen 9 7950X | Radeon RX 7800 XT | SteamOS",
					config: "none",
					url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vS8WCGQqGmcBqDZ1mIvuanPSjkFWIKeVK54FVefiNPSqu5q-IL4XrE8A2mYzrEoWH6CVpwvyEsDJ8EV/pub?gid=84424098&single=true&output=csv"
				},
				"xbox": {
					name: "XBOX",
					type: "standard",
					emulatorKeywords: ["xemu", "xbox"],
					specs: "Ryzen 9 7950X | Radeon RX 7800 XT | SteamOS",
					config: "Backend = Vulkan, 3x Native Resolution",
					url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vS8WCGQqGmcBqDZ1mIvuanPSjkFWIKeVK54FVefiNPSqu5q-IL4XrE8A2mYzrEoWH6CVpwvyEsDJ8EV/pub?gid=91761340&single=true&output=csv"
				},
				"xbox_360": {
					name: "XBOX 360",
					type: "standard",
					emulatorKeywords: ["xenia", "xbox 360", "x360"],
					specs: "Ryzen 9 7950X | Radeon RX 7800 XT | SteamOS",
					config: "none",
					url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vS8WCGQqGmcBqDZ1mIvuanPSjkFWIKeVK54FVefiNPSqu5q-IL4XrE8A2mYzrEoWH6CVpwvyEsDJ8EV/pub?gid=1207700995&single=true&output=csv"
				}
			};

			sortedPlatformKeys = Object.keys(platformRegistry).sort((a, b) =>
				platformRegistry[a].name.localeCompare(platformRegistry[b].name)
			);

			// ── Tabs + mobile select ─────────────────────────────────────────
			function renderTabs() {
				const tabsContainer   = $('.excel-tabs');
				const selectContainer = $('#mobile-platform-select');
				tabsContainer.empty();
				selectContainer.empty();
				sortedPlatformKeys.forEach(key => {
					tabsContainer.append(`<li class="excel-tab-btn" data-target="${key}">${platformRegistry[key].name}</li>`);
					selectContainer.append(`<option value="${key}">${platformRegistry[key].name}</option>`);
				});
			}

			function selectPlatform(slug, updateHistory) {
				if (!platformRegistry[slug]) return;
				$('.excel-tab-btn').removeClass('active');
				$(`.excel-tab-btn[data-target="${slug}"]`).addClass('active');
				$('#mobile-platform-select').val(slug);
				if (updateHistory) history.pushState(null, null, `#${slug}`);
				fetchAndBuildWorkspace(slug);
			}

			// ── Fetch + build ────────────────────────────────────────────────
			function fetchAndBuildWorkspace(slug) {
				const config    = platformRegistry[slug];
				const container = $('#table-workspace-wrapper');
				container.html('<div class="table-loader">Fetching data...</div>');

				Papa.parse(config.url, {
					download: true,
					header: true,
					skipEmptyLines: true,
					complete: function (results) {
						currentData       = results.data.filter(row =>
							(row["Game"] || row["Game Title"] || "") ||
							(row["Status"] || row["Emulation Status"] || "")
						);
						currentConfig     = config;
						currentSearchTerm = '';
						currentSort       = { col: 0, dir: 'asc' };
						currentPage       = 1;

						let sortOptionsHTML = '';
						if (config.type === 'ps4') {
							sortOptionsHTML = `
								<option value="0:asc">Game Title (A–Z)</option>
								<option value="0:desc">Game Title (Z–A)</option>
								<option value="1:asc">Status (Gameplay First)</option>
								<option value="1:desc">Status (Doesn't Boot First)</option>
								<option value="2:desc">Build Version (Newest First)</option>
								<option value="2:asc">Build Version (Oldest First)</option>
							`;
						} else if (config.type === 'steamos') {
							sortOptionsHTML = `
								<option value="0:asc">Game Title (A–Z)</option>
								<option value="0:desc">Game Title (Z–A)</option>
								<option value="1:asc">Status (Playable First)</option>
								<option value="1:desc">Status (Not Playable First)</option>
								<option value="2:desc">Proton Version (Newest First)</option>
								<option value="2:asc">Proton Version (Oldest First)</option>
							`;
						} else {
							sortOptionsHTML = `
								<option value="0:asc">Game Title (A–Z)</option>
								<option value="0:desc">Game Title (Z–A)</option>
								<option value="1:asc">Status (Playable First)</option>
								<option value="1:desc">Status (Not Playable First)</option>
							`;
						}

						const html = `
							<div class="dt-meta-badges">
								<div class="meta-badge"><strong>Specs:</strong> ${config.specs}</div>
								${config.config && config.config.toLowerCase() !== 'none' ? `
								<div class="meta-badge"><strong>Config:</strong> ${config.config}</div>` : ''}
							</div>
							<div class="data-header-row">
								<input type="text" id="custom-table-search" placeholder="Search titles..." class="compat-search-input">
								<select id="compat-sort-select" class="compat-mobile-sort">
									<option value="">Sort by...</option>
									${sortOptionsHTML}
								</select>
							</div>
							<div class="compat-card-grid" id="compat-card-grid"></div>
						`;

						container.html(html);
						renderFilteredCards();

						$('#custom-table-search').on('keyup', function () {
							currentSearchTerm = this.value;
							currentPage = 1;
							renderFilteredCards();
						});

						$('#table-workspace-wrapper').off('change', '#compat-sort-select').on('change', '#compat-sort-select', function () {
							const val = $(this).val();
							if (!val) return;
							const [col, dir] = val.split(':');
							currentSort = { col: parseInt(col), dir };
							currentPage = 1;
							renderFilteredCards();
						});
					},
					error: function () {
						container.html('<div class="table-loader" style="color:#c62828;">Failed to connect to backend sheets. Please refresh or try again later.</div>');
					}
				});
			}

			// ── Helper: Version / Build Numeric Parser Engine ────────────────
			function parseVersionString(str) {
				if (!str) return { isNumeric: false, array: [] };
				
				// Clean string to check if it's explicitly an empty marker
				const cleanStr = str.trim().toLowerCase();
				if (cleanStr === 'n/a' || cleanStr === 'none' || cleanStr === '—') {
					return { isNumeric: false, array: [] };
				}
			
				const matches = str.match(/\d+/g);
				if (!matches) {
					// It's a text entry like "Proton Experimental"
					return { isNumeric: false, array: [], raw: cleanStr };
				}
				
				return { isNumeric: true, array: matches.map(Number) };
			}
			
			// ── Helper: Deep Numeric Array Sorting Rule ──────────────────────
			function compareVersionArrays(aRes, bRes, dir) {
				// Rule 1: Handle non-numeric items (N/A, Experimental) so they always drop to the bottom
				if (!aRes.isNumeric && !bRes.isNumeric) {
					// If both are text, sort them alphabetically relative to each other
					return (aRes.raw || '').localeCompare(bRes.raw || '');
				}
				if (!aRes.isNumeric) return 1; // Push A to the bottom
				if (!bRes.isNumeric) return -1; // Push B to the bottom
			
				// Rule 2: Standard deep numeric sequence evaluation for actual versions
				const maxLength = Math.max(aRes.array.length, bRes.array.length);
				for (let i = 0; i < maxLength; i++) {
					const numA = aRes.array[i] || 0;
					const numB = bRes.array[i] || 0;
					if (numA !== numB) {
						return dir === 'asc' ? numA - numB : numB - numA;
					}
				}
				return 0;
			}

			// ── Render cards (called on load, search, sort) ──────────────────
			function renderFilteredCards() {
				const config = currentConfig;
				let data     = currentData;

				// Filter
				if (currentSearchTerm) {
					const term = currentSearchTerm.toLowerCase();
					data = data.filter(row => {
						const game    = (row["Game"] || row["Game Title"] || "").toLowerCase();
						const status  = (row["Status"] || row["Emulation Status"] || "").toLowerCase();
						const notes   = (row["Notes"] || row["Additional Notes"] || "").toLowerCase();
						const version = (row["Proton Version"] || row["Build"] || "").toLowerCase();
						return game.includes(term) || status.includes(term) ||
						       notes.includes(term) || version.includes(term);
					});
				}

				// Unified Emulation Tier Weight Maps (Lower weights bubble to top on Ascending)
				const standardWeights = {
					"playable": 1,
					"perfect": 1,
					"playable with issues": 2,
					"playable-with-issues": 2,
					"unplayable": 3,
					"not playable": 3,
					"doesn't boot": 4,
					"doesnt boot": 4,
				};
				
				const ps4Weights = {
					"gameplay": 1,
					"playable": 1,
					"title/menus": 2,
					"menus": 2,
					"doesn't boot": 3,
					"doesnt boot": 3,
				};

				// Process Sort routine array
				data = [...data].sort((a, b) => {
					if (currentSort.col === 0) {
						// Alphabetical Rule for Title strings
						const aVal = (a["Game"] || a["Game Title"] || "").toLowerCase();
						const bVal = (b["Game"] || b["Game Title"] || "").toLowerCase();
						return currentSort.dir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
					} 
					
					if (currentSort.col === 1) {
						// Custom Tier Mapping Evaluator Rules
						const aStatus = (a["Status"] || a["Emulation Status"] || "").toLowerCase().trim();
						const bStatus = (b["Status"] || b["Emulation Status"] || "").toLowerCase().trim();
						
						const weightMap = (config.type === 'ps4') ? ps4Weights : standardWeights;
						
						const aWeight = weightMap[aStatus] || 99;
						const bWeight = weightMap[bStatus] || 99;
						
						if (aWeight !== bWeight) {
							return currentSort.dir === 'asc' ? aWeight - bWeight : bWeight - aWeight;
						}
						// Secondary Fallback: Sort alphabetically by title if statuses match
						return (a["Game"] || a["Game Title"] || "").toLowerCase().localeCompare((b["Game"] || b["Game Title"] || "").toLowerCase());
					} 
					
					if (currentSort.col === 2) {
						// Intelligent Version Array Processing
						const aVerStr = (a["Proton Version"] || a["Build"] || "");
						const bVerStr = (b["Proton Version"] || b["Build"] || "");
						
						const aRes = parseVersionString(aVerStr);
						const bRes = parseVersionString(bVerStr);
						
						// Pass direction down to ensure versions flip correctly, but text rules stay at the bottom
						const comparison = compareVersionArrays(aRes, bRes, currentSort.dir);
						if (comparison !== 0) {
							return comparison;
						}
						// Secondary Fallback: Sort alphabetically by title if version numbers match
						return (a["Game"] || a["Game Title"] || "").toLowerCase().localeCompare((b["Game"] || b["Game Title"] || "").toLowerCase());
					}
					return 0;
				});

				const grid = document.getElementById('compat-card-grid');
				if (!grid) return;

				if (data.length === 0) {
					grid.innerHTML = '<div class="table-loader">No results found.</div>';
					document.getElementById('compat-pagination')?.remove();
					return;
				}

				// Pagination slice
				const pageSize   = getPageSize();
				const totalPages = Math.ceil(data.length / pageSize);
				if (currentPage > totalPages) currentPage = totalPages;
				const pageData = data.slice((currentPage - 1) * pageSize, currentPage * pageSize);

				grid.innerHTML = pageData.map(row => {
					const game    = row["Game"] || row["Game Title"] || "";
					let status    = row["Status"] || row["Emulation Status"] || "";
					const notes   = (row["Notes"] || row["Additional Notes"] || "").trim();
					const version = (row["Proton Version"] || row["Build"] || "").trim();
					
					// Generate the clean CSS string BEFORE we modify the visual text display
					const statusClean = status.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');
				
					// Conditionally shorten the text string specifically for the SteamOS config display layout
					if (config.type === 'steamos' && status.toLowerCase() === 'playable with issues') {
						status = 'Issues';
					}
				
					return `
						<div class="compat-card status-${statusClean}">
							<div class="card-accent"></div>
							<div class="card-body-wrapper">
								<div class="card-main-info">
									<span class="card-game-title" title="${game}">${game}</span>
									${notes ? `
									<div class="card-notes">
										<span class="card-notes-text">${linkifyNotes(notes)}</span>
									</div>` : ''}
								</div>
								
								<div class="card-meta-tray">
									<span class="status-pill">${status}</span>
									${((config.type === 'steamos' || config.type === 'ps4') && version) 
										? `<span class="card-version">${version}</span>` : ''}
									<div class="video-container" data-game="${encodeURIComponent(game)}"></div>
								</div>
							</div>
						</div>
					`;
				}).join('');

				// ── Reviews-Style Pagination Controls Generation ──────────────────
				let paginationEl = document.getElementById('compat-pagination');
				if (!paginationEl) {
					paginationEl = document.createElement('div');
					paginationEl.id = 'compat-pagination';
					grid.parentNode.insertBefore(paginationEl, grid.nextSibling);
				}
				
				if (totalPages <= 1) {
					paginationEl.innerHTML = '';
				} else {
					paginationEl.innerHTML = '';
					paginationEl.style.display = "flex";
					paginationEl.style.gap = "8px"; 
					paginationEl.style.alignItems = "center";
					paginationEl.style.justifyContent = "center";
					paginationEl.style.marginTop = "25px";

					function createNavButton(text, targetPage, isDisabled = false) {
						const btn = document.createElement("button");
						btn.innerText = text;  
						btn.style.background = targetPage === currentPage && !isDisabled ? "#252e36" : "transparent";
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
									renderFilteredCards();
									window.scrollTo({ top: 0, behavior: 'smooth' });
								});
							}
						}
						return btn;
					}

					const prevArrow = createNavButton("«", currentPage - 1, currentPage === 1);
					paginationEl.appendChild(prevArrow);

					const maxVisibleWindows = 1; 
					let pages = [];
					pages.push(1);
					for (let i = currentPage - maxVisibleWindows; i <= currentPage + maxVisibleWindows; i++) {
						if (i > 1 && i < totalPages) {
							pages.push(i);
						}
					}
					if (totalPages > 1) {
						pages.push(totalPages);
					}
					pages = [...new Set(pages)].sort((a, b) => a - b);

					let lastPageNum = 0;
					pages.forEach(pageNum => {
						if (lastPageNum > 0 && pageNum - lastPageNum > 1) {
							const ellipsis = document.createElement("span");
							ellipsis.innerText = "...";
							ellipsis.style.color = "#ccdee9";
							ellipsis.style.padding = "0 6px";
							ellipsis.style.fontSize = "16px"; 
							paginationEl.appendChild(ellipsis);
						}

						const numBtn = createNavButton(pageNum, pageNum);
						paginationEl.appendChild(numBtn);
						lastPageNum = pageNum;
					});

					const nextArrow = createNavButton("»", currentPage + 1, currentPage === totalPages);
					paginationEl.appendChild(nextArrow);
				}

				autoLinkCardVideos(config.emulatorKeywords, config.excludeKeywords);
			}

			// ── Click to expand notes ────────────────────────────────────────
			$(document).on('click', '.compat-card', function (e) {
				if ($(e.target).closest('.vault-video-link').length) return;
				if ($(e.target).closest('.notes-link').length) return;
				if ($(this).find('.card-notes').length) {
					$(this).toggleClass('expanded');
				}
			});

			// ── Helper: Convert URLs and markdown links in notes to <a> tags ──
			function linkifyNotes(text) {
				if (!text) return '';
				// Markdown-style [label](url) first, so bare-URL pass doesn't double-wrap them
				text = text.replace(
					/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
					'<a href="$2" target="_blank" rel="noopener" class="notes-link">$1</a>'
				);
				// Bare URLs not already inside an href attribute
				text = text.replace(
					/(?<!href=")(https?:\/\/[^\s<,"']+)/g,
					'<a href="$1" target="_blank" rel="noopener" class="notes-link">$1</a>'
				);
				return text;
			}

			// ── Video cross-referencing (updated with regex extractor rule) ──
			function autoLinkCardVideos(emuKeywords, excludeKeywords) {
				if (!externalVideoCache || externalVideoCache.length === 0) return;
			
				document.querySelectorAll('.compat-card').forEach(card => {
					const titleEl = card.querySelector('.card-game-title');
					if (!titleEl) return;
			
					const cleanGameTitle = titleEl.innerText.replace(/▶ Watch Test/g, "").trim().toLowerCase();
					if (!cleanGameTitle) return;
			
					const matchedVideo = externalVideoCache.find(vid => {
						if (!vid.title || !vid.id) return false;
						const ytTitle = vid.title.toLowerCase();

						// Exact validation via explicit header title pattern evaluation logic
						const extracted = ytTitle.match(/^is\s+(.+?)\s+playable\?/i);
						if (!extracted) return false;
						const videoGameTitle = extracted[1].trim();

						const hardwareMatches   = ytTitle.includes("7950x");
						const structuralMatches = videoGameTitle === cleanGameTitle;
			
						let platformIsolates = false;
						if (emuKeywords && emuKeywords.includes("native")) {
							platformIsolates = ytTitle.includes("steamos");
						} else if (emuKeywords && Array.isArray(emuKeywords)) {
							platformIsolates = emuKeywords.some(k => ytTitle.includes(k.toLowerCase()));
						}
			
						let containsExcluded = false;
						if (excludeKeywords && Array.isArray(excludeKeywords)) {
							containsExcluded = excludeKeywords.some(f => ytTitle.includes(f.toLowerCase()));
						}
			
						return hardwareMatches && structuralMatches && platformIsolates && !containsExcluded;
					});
			
					if (matchedVideo) {
						const container = card.querySelector('.video-container');
						if (container && !container.querySelector('.vault-video-link')) {
							const videoLink = document.createElement('a');
							videoLink.href = `https://youtu.be/${matchedVideo.id}`;
							videoLink.target = "_blank";
							videoLink.className = "vault-video-link";
							videoLink.innerHTML = '<i class="fas fa-play"></i>';
							videoLink.title = "Watch Test Video";
							container.appendChild(videoLink);
						}
					}
				});
			}

			// ── Routing ──────────────────────────────────────────────────────
			function handleRouting() {
				const hash = window.location.hash.toLowerCase().replace('#', '').trim();
				if (hash && platformRegistry[hash]) {
					selectPlatform(hash, false);
				} else if (sortedPlatformKeys.length > 0) {
					selectPlatform(sortedPlatformKeys[0], false);
				}
			}

			renderTabs();

			// Responsive breakpoint active pagination update calculation routine
			let lastPageSize = getPageSize();
			window.addEventListener('resize', () => {
				const newSize = getPageSize();
				if (newSize !== lastPageSize) {
					lastPageSize = newSize;
					currentPage  = 1;
					renderFilteredCards();
				}
			});

			$(document).on('click', '.excel-tab-btn', function () {
				selectPlatform($(this).data('target'), true);
			});

			$('#mobile-platform-select').on('change', function () {
				selectPlatform($(this).val(), true);
			});

			window.addEventListener('hashchange', handleRouting);
			handleRouting();
		});
	</script>
</div>