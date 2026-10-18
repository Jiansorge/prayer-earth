import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles.css'

// Tag weak hardware before the first paint so styles.css can gate the paint
// that stacks on top of the WebGL canvas (stage blur, blend passes, particle
// fields). The threshold mirrors EarthBackdrop's staticMode and sits where
// EarthScene cuts its own geometry: <=4 cores or <=2GB catches the old iPads
// and budget Androids that reported the chop without slowing anyone else.
if (
  typeof navigator !== 'undefined' &&
  (navigator.hardwareConcurrency <= 4 || (navigator.deviceMemory ?? 8) <= 2)
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
