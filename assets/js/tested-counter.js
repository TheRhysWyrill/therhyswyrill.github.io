/*
 * Tested-games counter for the Is It Playable data.
 *
 * Fetches every platform sheet CSV once, counts rows with a real test
 * result (any status except "to be tested" / blank), and exposes:
 *
 *   window.__compatTestedCount   -> number
 *   window.__compatTestedDetails -> { tested, backlog, platforms: [...] }
 *
 * Results are cached in localStorage for 12h so repeat visits don't refetch
 * the 12 sheets. Consumers can listen for the "compat-tested-count" event.
 *
 * NOTE: keep the sheet list in sync with pages/compatibility.md.
 */
(function () {
  'use strict';

  var SHEETS = [
    { name: 'Nintendo 3DS', url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS8WCGQqGmcBqDZ1mIvuanPSjkFWIKeVK54FVefiNPSqu5q-IL4XrE8A2mYzrEoWH6CVpwvyEsDJ8EV/pub?gid=989513195&single=true&output=csv' },
    { name: 'GameCube / Wii', url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS8WCGQqGmcBqDZ1mIvuanPSjkFWIKeVK54FVefiNPSqu5q-IL4XrE8A2mYzrEoWH6CVpwvyEsDJ8EV/pub?gid=722868656&single=true&output=csv' },
    { name: 'Nintendo Switch', url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS8WCGQqGmcBqDZ1mIvuanPSjkFWIKeVK54FVefiNPSqu5q-IL4XrE8A2mYzrEoWH6CVpwvyEsDJ8EV/pub?gid=412405791&single=true&output=csv' },
    { name: 'PS2', url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS8WCGQqGmcBqDZ1mIvuanPSjkFWIKeVK54FVefiNPSqu5q-IL4XrE8A2mYzrEoWH6CVpwvyEsDJ8EV/pub?gid=2142455474&single=true&output=csv' },
    { name: 'PS3', url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS8WCGQqGmcBqDZ1mIvuanPSjkFWIKeVK54FVefiNPSqu5q-IL4XrE8A2mYzrEoWH6CVpwvyEsDJ8EV/pub?gid=223480540&single=true&output=csv' },
    { name: 'PS4', url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS8WCGQqGmcBqDZ1mIvuanPSjkFWIKeVK54FVefiNPSqu5q-IL4XrE8A2mYzrEoWH6CVpwvyEsDJ8EV/pub?gid=1869087751&single=true&output=csv' },
    { name: 'PS5', url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS8WCGQqGmcBqDZ1mIvuanPSjkFWIKeVK54FVefiNPSqu5q-IL4XrE8A2mYzrEoWH6CVpwvyEsDJ8EV/pub?gid=83107815&single=true&output=csv' },
    { name: 'PS Vita', url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS8WCGQqGmcBqDZ1mIvuanPSjkFWIKeVK54FVefiNPSqu5q-IL4XrE8A2mYzrEoWH6CVpwvyEsDJ8EV/pub?gid=1379946484&single=true&output=csv' },
    { name: 'SteamOS', url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS8WCGQqGmcBqDZ1mIvuanPSjkFWIKeVK54FVefiNPSqu5q-IL4XrE8A2mYzrEoWH6CVpwvyEsDJ8EV/pub?gid=441094204&single=true&output=csv' },
    { name: 'Wii U', url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS8WCGQqGmcBqDZ1mIvuanPSjkFWIKeVK54FVefiNPSqu5q-IL4XrE8A2mYzrEoWH6CVpwvyEsDJ8EV/pub?gid=84424098&single=true&output=csv' },
    { name: 'Xbox', url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS8WCGQqGmcBqDZ1mIvuanPSjkFWIKeVK54FVefiNPSqu5q-IL4XrE8A2mYzrEoWH6CVpwvyEsDJ8EV/pub?gid=91761340&single=true&output=csv' },
    { name: 'Xbox 360', url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS8WCGQqGmcBqDZ1mIvuanPSjkFWIKeVK54FVefiNPSqu5q-IL4XrE8A2mYzrEoWH6CVpwvyEsDJ8EV/pub?gid=1207700995&single=true&output=csv' }
  ];

  var CACHE_KEY = 'compat_tested_cache';
  var CACHE_TTL = 12 * 60 * 60 * 1000;

  function parseCSV(text) {
    var rows = [], row = [], cell = '', inQ = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (inQ) {
        if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else { inQ = false; } }
        else cell += c;
      } else if (c === '"') { inQ = true; }
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n') { row.push(cell.replace(/\r$/, '')); if (row.length > 1 || row[0] !== '') rows.push(row); row = []; cell = ''; }
      else cell += c;
    }
    row.push(cell.replace(/\r$/, ''));
    if (row.length > 1 || row[0] !== '') rows.push(row);
    return rows;
  }

  function countSheet(text, name, out) {
    var rows = parseCSV(text);
    if (!rows.length) return;
    var head = rows[0].map(function (h) { return h.trim().toLowerCase(); });
    var gi = head.indexOf('game title') >= 0 ? head.indexOf('game title') : head.indexOf('game');
    var si = head.indexOf('status') >= 0 ? head.indexOf('status') : head.indexOf('emulation status');
    var platformTested = 0;
    for (var i = 1; i < rows.length; i++) {
      var r = rows[i];
      var game = gi >= 0 && gi < r.length ? r[gi].trim() : '';
      var status = si >= 0 && si < r.length ? r[si].trim().toLowerCase() : '';
      if (!game) continue;
      if (!status || status === 'to be tested' || status === 'to-be-tested') { out.backlog++; continue; }
      out.tested++;
      platformTested++;
    }
    if (platformTested > 0) out.platforms.push(name);
  }

  function readCache() {
    try {
      var raw = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (raw && raw.ts && (Date.now() - raw.ts) < CACHE_TTL && typeof raw.tested === 'number') return raw;
    } catch (e) { /* ignore */ }
    return null;
  }

  function publish(details, fromCache) {
    details.fromCache = !!fromCache;
    window.__compatTestedCount = details.tested;
    window.__compatTestedDetails = details;
    var evt;
    try { evt = new CustomEvent('compat-tested-count', { detail: details }); }
    catch (e) { evt = document.createEvent('CustomEvent'); evt.initCustomEvent('compat-tested-count', false, false, details); }
    document.dispatchEvent(evt);
  }

  function load() {
    var cached = readCache();
    if (cached) {
      publish(cached.details || cached, true);
      return;
    }
    Promise.all(SHEETS.map(function (s) {
      return fetch(s.url).then(function (r) { return r.text(); }).then(function (t) {
        var out = { tested: 0, backlog: 0, platforms: [] };
        countSheet(t, s.name, out);
        return out;
      }).catch(function () { return { tested: 0, backlog: 0, platforms: [] }; });
    })).then(function (outs) {
      var details = { tested: 0, backlog: 0, platforms: [] };
      outs.forEach(function (o) {
        details.tested += o.tested;
        details.backlog += o.backlog;
        details.platforms = details.platforms.concat(o.platforms);
      });
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), details: details })); } catch (e) { /* ignore */ }
      publish(details, false);
    });
  }

  window.__compatTestedCount = null;
  window.__compatTestedDetails = null;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load);
  } else {
    load();
  }
})();
