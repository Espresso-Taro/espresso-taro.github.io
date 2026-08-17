/**
 * Attach every userProfile on this device to the migration banner link so a
 * click carries the whole roster to the new site. The new site picks each
 * up in turn and offers to inherit them.
 *
 * Sources:
 *   1) window.__migrationUsers — published by app.js after the user
 *      manager hydrates. Carries {personalId, userName} for every profile.
 *   2) localStorage lastPersonalId_v1:<authUid> — fallback for early
 *      moments before the user manager runs (single-user case, no name).
 *
 * We send BOTH personalId and userName so the new site can render the
 * confirmation modal without hitting Firestore first — important when the
 * user's daily read quota is already exhausted.
 */
(function () {
  function encodeList(names) {
    // Names may contain commas and Japanese chars. encodeURIComponent
    // each, then join with a comma delimiter that survives the round-trip.
    return names.map(function (n) { return encodeURIComponent(String(n || "")); }).join(",");
  }

  function readFromWindow() {
    var arr = window.__migrationUsers;
    if (!Array.isArray(arr) || arr.length === 0) return null;
    var seen = {};
    var out = [];
    for (var i = 0; i < arr.length; i++) {
      var u = arr[i];
      var pid = u && u.personalId;
      if (!pid || seen[pid]) continue;
      seen[pid] = 1;
      out.push({ personalId: pid, userName: (u.userName || "").toString() });
    }
    return out.length ? out : null;
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
    return pid ? [{ personalId: pid, userName: "" }] : null;
  }

  function attachClaim() {
    var users = readFromWindow() || readFromStorage();
    if (!users) return false;
    var banner = document.getElementById("migration-banner");
    if (!banner) return true; // banner absent — no-op, but stop polling
    var link = banner.querySelector("a[href*='kanji-typing-game']");
    if (!link) return true;
    try {
      var url = new URL(link.href);
      var pids = users.map(function (u) { return u.personalId; });
      var names = users.map(function (u) { return u.userName; });
      var claimVal = pids.join(",");
      var namesVal = encodeList(names);
      if (
        url.searchParams.get("claim") === claimVal
        && url.searchParams.get("names") === namesVal
      ) return true;
      url.searchParams.set("claim", claimVal);
      url.searchParams.set("names", namesVal);
      link.href = url.toString();
    } catch (_) { /* leave link alone */ }
    return true;
  }

  // Kick off, then keep polling so we upgrade from the storage fallback
  // to the fuller window list once app.js publishes it, and pick up
  // newly-added users mid-session too.
  attachClaim();
  var attempts = 0;
  var iv = setInterval(function () {
    attachClaim();
    if (++attempts > 60) clearInterval(iv); // ~15s
  }, 250);
})();
