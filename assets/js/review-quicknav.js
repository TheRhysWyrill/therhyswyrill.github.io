/*
 * Review page: the "Top" quick-nav button, the pinned spec/controls bar's
 * navbar offset, and the reading-progress bar.
 *
 * Extracted from _layouts/review.html so the browser caches it instead of
 * re-reading it in every review page's HTML; it holds no per-review data, so
 * it is identical on all 480 pages. Loaded with `defer`, which still runs
 * before DOMContentLoaded, so the wiring below is unchanged.
 */
(function () {
  // Quick-nav: jump back to the top of the review. Wired on DOMContentLoaded:
  // this script block sits before the article markup, so the body does not
  // exist yet at parse time.
  document.addEventListener('DOMContentLoaded', function () {
    var nav = document.querySelector('.review-quicknav');
    if (nav) {
      var topBtn = nav.querySelector('[data-nav="top"]');
      nav.addEventListener('click', function (e) {
        if (!e.target.closest('.quicknav-btn')) return;
        // window.scrollY 0 puts the banner directly under the sticky navbar;
        // scrollIntoView on the article box would hide its top edge behind it.
        window.scrollTo({ top: 0, behavior: 'auto' });
      });
      var tickingNav = false;
      window.addEventListener('scroll', function () {
        if (tickingNav) return;
        tickingNav = true;
        requestAnimationFrame(function () {
          if (topBtn) topBtn.classList.toggle('is-current', window.scrollY < 200);
          tickingNav = false;
        });
      }, { passive: true });
    }
  });

  var bar = document.getElementById('reading-progress');
  if (!bar) return;
  var header = document.querySelector('.site-header') || document.querySelector('body > header');
  function positionBar() {
    if (!header) return;
    // The progress bar sits under the navbar, and the pinned review bar sits
    // at the same edge, so both read the navbar's live height: the navbar is
    // percentage-padded, so its height changes with the viewport.
    bar.style.top = header.offsetHeight + 'px';
    document.documentElement.style.setProperty('--sticky-offset', header.offsetHeight + 'px');
  }
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
