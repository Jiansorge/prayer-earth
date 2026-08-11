// Captures the browser's native PWA install prompt so it can be triggered
// from a button in Settings (instead of only on first visit / heuristics).

let deferredPrompt = null

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  deferredPrompt = e
})

export function canInstall() {
  return !!deferredPrompt
}

export async function promptInstall() {
  if (!deferredPrompt) return false
  deferredPrompt.prompt()
  const result = await deferredPrompt.userChoice
  deferredPrompt = null
  return result.outcome === 'accepted'
}
