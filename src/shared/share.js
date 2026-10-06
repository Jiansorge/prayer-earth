// Sharing a link must never be a dead button, especially inside the Android /
// iOS WebView shell where `navigator.share` is often missing and the async
// `navigator.clipboard` API can be unavailable or blocked (it also needs a
// secure context + user gesture). So we try, in order, the native share sheet,
// the async clipboard, the legacy `execCommand('copy')`, and finally fall back
// to the caller's manual-copy path. Every path returns a status so the UI can
// give honest feedback instead of failing silently.

// Clipboard writes can be left pending indefinitely rather than rejecting.
//
// `navigator.clipboard.writeText()` returns a promise that settles when the
// permission decision is made. Without a user gesture, or where the permission
// prompt is suppressed (headless browsers, some embedded WebViews, kiosk modes),
// nothing ever settles it - so awaiting it meant the share button hung with no
// feedback, which is exactly the dead control this module exists to prevent.
//
// So the write is raced against a short deadline. Losing the race is not a
// failure: the legacy path below is what actually works in those environments,
// and it needs only a real tap, which the caller already has.
const CLIPBOARD_DEADLINE_MS = 1200

const withDeadline = (promise, ms) =>
  Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve('__pending__'), ms))
  ])

export async function copyText(text) {
  const value = String(text ?? '')
  // 1) Async Clipboard API (works in browsers over https / localhost).
  if (navigator.clipboard?.writeText) {
    const settled = await withDeadline(
      // Wrapped so a rejection arrives as a value rather than an exception.
      navigator.clipboard.writeText(value).then(() => 'ok', () => 'err'),
      CLIPBOARD_DEADLINE_MS
    )
    if (settled === 'ok') return true
  }
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

// Last resort when every copy mechanism failed: show the link in a real,
// visible, pre-selected field the user can copy by hand.
//
// This was `window.prompt(url)`, which is wrong twice over. It BLOCKS the
// renderer until dismissed, so a share button on the home header could freeze
// the page - and it is not implemented at all in the Android WebView, so on the
// platform that most needs the fallback it did nothing while looking like it had
// worked. The backup code already learned this lesson and uses a real <textarea>.
export function showManualCopy(value, label = '') {
  const text = String(value ?? '')
  if (typeof document === 'undefined') return false
  const wrap = document.createElement('div')
  wrap.setAttribute('data-testid', 'manual-copy-fallback')
  wrap.style.cssText = [
    'position:fixed',
    'top:max(16px,env(safe-area-inset-top))',
    'left:50%',
    'transform:translateX(-50%)',
    'z-index:9999',
    'display:flex',
    'flex-direction:column',
    'gap:6px',
    'padding:10px',
    'background:rgba(10,20,14,0.96)',
    'border:1px solid rgba(232,196,122,0.35)',
    'border-radius:10px',
    'max-width:min(92vw,420px)'
  ].join(';')
  const input = document.createElement('input')
  input.readOnly = true
  input.value = text
  input.setAttribute('aria-label', label || 'Link')
  input.style.cssText = 'width:100%;font:inherit;font-size:13px;padding:7px 9px;border-radius:7px;border:1px solid rgba(255,255,255,0.2);background:rgba(0,0,0,0.4);color:inherit'
  wrap.appendChild(input)
  if (label) {
    const cap = document.createElement('span')
    cap.textContent = label
    cap.style.cssText = 'font-size:11.5px;opacity:0.75'
    wrap.appendChild(cap)
  }
  document.body.appendChild(wrap)
  // Select rather than merely focus: the point is that the next tap is a copy.
  input.focus()
  try {
    input.select()
    input.setSelectionRange(0, text.length)
  } catch {}
  const dismiss = () => wrap.remove()
  input.addEventListener('blur', dismiss)
  setTimeout(dismiss, 20000)
  return true
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
      if (err?.name === 'AbortError') return 'cancelled'
      // NotAllowedError is deliberately NOT treated as a dismissal. Desktop
      // Chrome exposes navigator.share but rejects it with NotAllowedError
      // when there is no user gesture, and that is indistinguishable from a
      // cancel at this layer. Returning 'cancelled' made the caller give up
      // silently, so a refused share became a button that did nothing; fall
      // through to copying instead, which always does something visible.
      // Any other error: fall through to copying.
    }
  }
  // 2) Copy the link.
  const copied = await copyText(target)
  return copied ? 'copied' : 'failed'
}
