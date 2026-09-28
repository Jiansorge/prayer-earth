// Boot failsafe. Kept as a small, independent classic script (not part of the
// module bundle) so it still runs when the entry chunk 404s or throws before
// React mounts — the exact case it exists to rescue. Loaded via <script src>
// (allowed by the served CSP `script-src 'self'`, which forbids inline code).
(function () {
  var fired = false
  function escape() {
    if (fired) return
    var boot = document.getElementById('boot')
    if (!boot || boot.classList.contains('done')) return
    fired = true
    boot.setAttribute('aria-hidden', 'false')
    var name = boot.querySelector('.boot-name')
    if (name) name.textContent = 'Tap to reload'
    // Make the splash a real, keyboard/AT-reachable control. It is the app's
    // ONLY recovery path after a failed chunk load, so a keyboard or screen
    // reader user must be able to activate it — not just tap.
    boot.setAttribute('role', 'button')
    boot.setAttribute('tabindex', '0')
    boot.setAttribute('aria-label', 'Tap to reload')
    boot.style.pointerEvents = 'auto'
    boot.style.cursor = 'pointer'
    var go = function () { location.reload() }
    boot.onclick = go
    boot.onkeydown = function (e) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); go() }
    }
    try { boot.focus() } catch {}
  }
  setTimeout(escape, 12000)
  window.addEventListener('error', function () { setTimeout(escape, 1500) })
  window.addEventListener('unhandledrejection', function () { setTimeout(escape, 1500) })
})()
