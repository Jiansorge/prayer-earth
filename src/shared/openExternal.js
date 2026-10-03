// Open a link outside the app.
//
// A plain <a target="_blank"> is DEAD in the Android WebView: the WebView does
// not create a second window, so the tap does nothing at all. That silently
// broke the report-a-re-upload link, the delete-data link and the manual
// deletion link - every route off the device. On the web the same markup works,
// which is why it survived.
//
// Capacitor's Browser plugin hands the URL to the system browser instead, so
// the user lands in Chrome and the app keeps its own state. Falls back to
// window.open for the web, where it is unnecessary but harmless.

const BRIDGE_ORIGINS = ['capacitor://localhost', 'https://localhost', 'http://localhost']

export const isAppShell = () => {
  if (typeof window === 'undefined') return false
  const href = window.location?.href || ''
  return (
    !!window.Capacitor?.isNativePlatform?.() ||
    BRIDGE_ORIGINS.some((o) => href.startsWith(o)) ||
    window.matchMedia?.('(display-mode: standalone)')?.matches === true
  )
}

export async function openExternal(url) {
  const target = String(url || '').trim()
  if (!target) return false

  // Resolve the plugin through the live registry rather than a static import:
  // a static import would pull the web shim into every bundle, and the app
  // shell is the only place it is ever needed.
  const plugin = window.Capacitor?.Plugins?.Browser
  if (isAppShell() && plugin?.open) {
    try {
      await plugin.open({ url: target })
      return true
    } catch {
      // fall through to the web path
    }
  }

  const w = window.open(target, '_blank', 'noopener,noreferrer')
  if (w) return true
  // Popup blocked, or no window support at all: navigate in place as a last
  // resort rather than leaving the user with a dead tap.
  window.location.assign(target)
  return true
}