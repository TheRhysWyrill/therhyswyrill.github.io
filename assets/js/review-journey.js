/*
 * Review page: the "Complete Journey" row.
 *
 * If the review's game has a "Complete Journey #N" longplay on the channel,
 * this adds a spec row linking to it. Extracted from _layouts/review.html (it
 * used to be templated with the game title) and the lookup now runs on idle:
 * the 6 KB journeys index used to be requested at parse time, competing with
 * the hero image that is this page's LCP element.
 *
 * The game title comes from data-game-title on the spec card, so this file is
 * identical on all 480 reviews and can be cached between them.
 */
(function () {
  'use strict';

  var specCard = document.querySelector('.review-spec-card');
  var rawGameTitle = (specCard && specCard.dataset.gameTitle) || '';
  if (!rawGameTitle) return;

  function normalise(str) {
    return str.toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  var normTarget = normalise(rawGameTitle);
  if (!normTarget) return;

  function run() {
    fetch('/assets/data/journeys_trw.json')
      .then(function (r) { return r.json(); })
      .then(function (videos) {
        var list = Array.isArray(videos) ? videos : [];
        var match = list.find(function (vid) {
          if (!vid.title || !vid.id) return false;
          var normTitle = normalise(vid.title);
          var hasJourney = normTitle.indexOf('complete journey') !== -1;
          var hasGame = normTitle.indexOf(normTarget) !== -1;
          return hasJourney && hasGame;
        });

        if (!match) return;

        // Only inject the row when a real match is confirmed
        if (!specCard) return;

        var row = document.createElement('div');
        row.className = 'spec-row';
        row.innerHTML = `
					<span class="spec-label">Complete Journey</span>
					<a href="https://youtu.be/${match.id}" target="_blank" class="journey-yt-badge" title="Watch full playthrough">
						<svg style="width:13px;height:13px;fill:#ffffff;flex-shrink:0;" viewBox="0 0 24 24"><path d="M10 15l5.19-3L10 9v6m11.56-7.83c.13.47.22 1.1.28 1.9.07.8.1 1.49.1 2.09L22 12c0 2.19-.16 3.8-.44 4.83-.25.9-.83 1.48-1.73 1.73-.47.13-1.33.22-2.65.28-1.3.07-2.49.1-3.59.1L12 19c-4.19 0-6.8-.16-7.83-.44-.9-.25-1.48-.83-1.73-1.73-.13-.47-.22-1.1-.28-1.9-.07-.8-.1-1.49-.1-2.09L2 12c0-2.19.16-3.8.44-4.83.25-.9.83-1.48 1.73-1.73.47-.13 1.33-.22 2.65-.28 1.3-.07 2.49-.1 3.59-.1L12 5c4.19 0 6.8.16 7.83.44.9.25 1.48.83 1.73 1.73z"/></svg>
						<span>Watch</span>
					</a>
				`;
        specCard.appendChild(row);
      })
      .catch(function () {});
  }

  if (window.requestIdleCallback) window.requestIdleCallback(run, { timeout: 3000 });
  else setTimeout(run, 300);
})();
