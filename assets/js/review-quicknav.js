/*
 * Review page: the quick-nav ("Top" / "Verdict") and the reading-progress bar.
 *
 * Extracted from _layouts/review.html so the browser caches it instead of
 * re-reading it in every review page's HTML; it holds no per-review data, so
 * it is identical on all 480 pages. Loaded with `defer`, which still runs
 * before DOMContentLoaded, so the wiring below is unchanged.
 */
(function () {
  // Quick-nav: jump to Top or the verdict paragraph ("Overall, …"). The
  // verdict button only shows once its paragraph is located in the DOM.
  // Wired on DOMContentLoaded: this script block sits before the article
  // markup, so the sidebar and body do not exist yet at parse time.
  document.addEventListener('DOMContentLoaded', function () {
  var nav = document.querySelector('.review-quicknav');
  if (nav) {
    var verdictBtn = nav.querySelector('[data-nav="verdict"]');
    var body = document.querySelector('.review-article-body');
    var verdictEl = null;
    if (body) {
      var paras = body.querySelectorAll('p');
      for (var i = 0; i < paras.length; i++) {
        if (/^Overall,/i.test(paras[i].textContent.trim())) { verdictEl = paras[i]; break; }
      }
    }
    if (!verdictEl) verdictBtn.style.display = 'none';
    verdictEl && (verdictEl.id = verdictEl.id || 'review-verdict');
    nav.addEventListener('click', function (e) {
      var btn = e.target.closest('.quicknav-btn');
      if (!btn) return;
      var target = btn.dataset.nav === 'verdict' ? document.getElementById('review-verdict') : document.querySelector('.review-article-box');
      if (target) target.scrollIntoView({ behavior: 'instant', block: btn.dataset.nav === 'verdict' ? 'center' : 'start' });
    });
    var tickingNav = false;
    window.addEventListener('scroll', function () {
      if (!tickingNav) {
        tickingNav = true;
        requestAnimationFrame(function () {
          var nearTop = window.scrollY < 200;
          var nearVerdict = verdictEl && (function () {
            var r = verdictEl.getBoundingClientRect();
            return r.top < window.innerHeight * 0.5 && r.bottom > 0;
          })();
          nav.querySelector('[data-nav="top"]').classList.toggle('is-current', nearTop && !nearVerdict);
          verdictBtn.classList.toggle('is-current', !!nearVerdict);
          tickingNav = false;
        });
      }
    }, { passive: true });
  }
  });

  var bar = document.getElementById('reading-progress');
  if (!bar) return;
  var header = document.querySelector('.site-header') || document.querySelector('body > header');
  function positionBar() { if (header) bar.style.top = header.offsetHeight + 'px'; }
  function update() {
    var doc = document.documentElement;
    var max = doc.scrollHeight - window.innerHeight;
    var pct = max > 0 ? Math.min(1, window.scrollY / max) : 0;
    bar.style.width = (pct * 100).toFixed(2) + '%';
  }
  var ticking = false;
  window.addEventListener('scroll', function () {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(function () { update(); ticking = false; });
    }
  }, { passive: true });
  window.addEventListener('resize', function () { positionBar(); update(); });
  positionBar();
  update();
})();
