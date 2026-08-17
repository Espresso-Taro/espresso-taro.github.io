/**
 * Attach the user's personalId to the migration banner link so a click can
 * carry their identity to the new site. The new site sees ?claim=<pid>
 * on load and offers to inherit the old scores / rank / history.
 *
 * Runs once localStorage has `lastPersonalId_v1:<authUid>` populated —
 * anonymous auth writes that key as soon as it resolves.
 */
(function () {
  function readLatestPid() {
    // The key format is `lastPersonalId_v1:<authUid>`. We don't know the
    // authUid up front so just pick the most-recent value across whatever
    // matches — this device only ever has one anonymous auth session.
    var pid = null;
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.indexOf("lastPersonalId_v1:") === 0) {
        var v = localStorage.getItem(k);
        if (v) { pid = v; break; }
      }
    }
    return pid;
  }

  function attachClaim() {
    var pid = readLatestPid();
    if (!pid) return false;
    var banner = document.getElementById("migration-banner");
    if (!banner) return true; // banner absent — no-op, but stop polling
    var link = banner.querySelector("a[href*='kanji-typing-game']");
    if (!link) return true;
    try {
      var url = new URL(link.href);
      if (url.searchParams.get("claim")) return true; // already set
      url.searchParams.set("claim", pid);
      link.href = url.toString();
    } catch (_) { /* invalid URL — leave as is */ }
    return true;
  }

  if (attachClaim()) return;

  // Poll for a few seconds while anonymous auth resolves and userManager
  // writes the last-personalId key.
  var attempts = 0;
  var iv = setInterval(function () {
    if (attachClaim() || ++attempts > 30) clearInterval(iv);
  }, 250);
})();
