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
    boot.style.pointerEvents = 'auto'
    boot.style.cursor = 'pointer'
    boot.onclick = function () { location.reload() }
  }
  setTimeout(escape, 12000)
  window.addEventListener('error', function () { setTimeout(escape, 1500) })
  window.addEventListener('unhandledrejection', function () { setTimeout(escape, 1500) })
})()
