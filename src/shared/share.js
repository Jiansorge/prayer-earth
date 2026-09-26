// Sharing a link must never be a dead button, especially inside the Android /
// iOS WebView shell where `navigator.share` is often missing and the async
// `navigator.clipboard` API can be unavailable or blocked (it also needs a
// secure context + user gesture). So we try, in order, the native share sheet,
// the async clipboard, the legacy `execCommand('copy')`, and finally fall back
// to the caller's manual-copy path. Every path returns a status so the UI can
// give honest feedback instead of failing silently.

export async function copyText(text) {
  const value = String(text ?? '')
  // 1) Async Clipboard API (works in browsers over https / localhost).
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value)
      return true
    }
  } catch {}
  // 2) Legacy copy — still honoured by many WebViews where the async API is not.
  try {
    const ta = document.createElement('textarea')
    ta.value = value
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.top = '-1000px'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    ta.setSelectionRange(0, value.length)
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return !!ok
  } catch {}
  return false
}

// Returns one of: 'shared' | 'cancelled' | 'copied' | 'failed'
export async function shareLink({ title, text, url } = {}) {
  const target = url || ''
  // 1) Native share sheet (mobile browsers, and some installed PWAs).
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url: target })
      return 'shared'
    } catch (err) {
      // The user dismissing the sheet is a normal outcome, not a failure.
      if (err?.name === 'AbortError' || err?.name === 'NotAllowedError') return 'cancelled'
      // Any other error: fall through to copying.
    }
  }
  // 2) Copy the link.
  const copied = await copyText(target)
  return copied ? 'copied' : 'failed'
}
