import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles.css'

if ('serviceWorker' in navigator && import.meta.env.PROD) {
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
    if (reloading) return
    reloading = true
    window.location.reload()
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
