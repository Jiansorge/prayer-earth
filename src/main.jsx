import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { isSmallTouchDevice } from './shared/deviceTier.js'
import './styles.css'

// Tag weak hardware before the first paint so styles.css can gate the paint
// that stacks on top of the WebGL canvas (stage blur, blend passes, particle
// fields). The threshold mirrors EarthBackdrop's staticMode and sits where
// EarthScene cuts its own geometry: a touch-first device with <=4 cores, or
// <=2GB (Chrome-only, undefined in Safari/Firefox), catches the old iPads and
// budget Androids that reported the chop without slowing anyone else. Cores on
// their own put every 4-core desktop browser - Safari on a Mac included - in
// this class, which is why the pointer type is part of the test.
if (
  typeof navigator !== 'undefined' &&
  (isSmallTouchDevice() || (navigator.deviceMemory ?? 8) <= 2)
) {
  document.documentElement.classList.add('low-power')
}

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  const hadController = !!navigator.serviceWorker.controller
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
  // A deploy installs a new service worker, but `clients.claim` only swaps the
  // controller — the page's already-loaded JS is still the old build. Without
  // this, an open tab can sit on a stale bundle (and stale counts) forever.
  // Reload once when the controller actually changes so every deploy reaches
  // the user without a manual hard-refresh. `reloading` guards against a loop.
  let reloading = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return
    reloading = true
    window.location.reload()
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

// Opt-in diagnostics for a report we cannot reproduce in CI (Safari speed,
// ambient crackle, coarse Earth, missing marker). Loaded by dynamic import, so
// a normal visitor never downloads it, and it is read-only: it prints numbers
// and copies them, it never exposes a handle on the store or the audio engines
// (that is what src/shared/testHooks.js is warning about). `?diag=1` works in
// the query or the hash, since the router owns the fragment.
if (/(?:^|[?&#])diag=1\b/.test(window.location.search + window.location.hash)) {
  import('./diag.js')
    .then((m) => m.mountDiag())
    .catch(() => {})
}
