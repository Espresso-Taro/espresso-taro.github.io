/**
 * Attach every userProfile personalId on this device to the migration
 * banner link so a click carries the whole roster to the new site. The
 * new site picks each up in turn and offers to inherit them.
 *
 * Two sources for the roster:
 *   1) window.__migrationUsers — published by app.js once the user
 *      manager has hydrated (covers multi-user devices).
 *   2) localStorage lastPersonalId_v1:<authUid> — fallback for the first
 *      moments before the user manager runs (covers single-user devices).
 */
(function () {
  function readFromWindow() {
    var arr = window.__migrationUsers;
    if (!Array.isArray(arr) || arr.length === 0) return null;
    var pids = [];
    for (var i = 0; i < arr.length; i++) {
      var p = arr[i] && arr[i].personalId;
      if (p && pids.indexOf(p) === -1) pids.push(p);
    }
    return pids.length ? pids : null;
  }

  function readFromStorage() {
    var pid = null;
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.indexOf("lastPersonalId_v1:") === 0) {
        var v = localStorage.getItem(k);
        if (v) { pid = v; break; }
      }
    }
    return pid ? [pid] : null;
  }

  function attachClaim() {
    var pids = readFromWindow() || readFromStorage();
    if (!pids) return false;
    var banner = document.getElementById("migration-banner");
    if (!banner) return true; // banner absent — no-op, but stop polling
    var link = banner.querySelector("a[href*='kanji-typing-game']");
    if (!link) return true;
    try {
      var url = new URL(link.href);
      // Encode as comma-separated so a legacy user with 7 profiles doesn't
      // blow the URL into a wall of repeated params.
      var joined = pids.join(",");
      if (url.searchParams.get("claim") === joined) return true; // unchanged
      url.searchParams.set("claim", joined);
      link.href = url.toString();
    } catch (_) { /* leave link alone */ }
    return true;
  }

  if (attachClaim()) return;
  // Poll while auth + userManager settle.
  var attempts = 0;
  var iv = setInterval(function () {
    // Keep going even after the storage fallback fires so we can upgrade
    // to the fuller window list once app.js publishes it.
    attachClaim();
    if (++attempts > 40) clearInterval(iv);
  }, 250);
})();
