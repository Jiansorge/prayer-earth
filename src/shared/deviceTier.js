// One definition of "weak hardware", shared by everything that trades looks for
// smoothness: the static Earth fallback (EarthBackdrop), the reduced geometry in
// EarthScene, and the .low-power CSS gate in main.jsx.
//
// It used to be `hardwareConcurrency <= 4` on its own, and that is not a
// statement about the device so much as about the browser: the same Mac reports
// 8 cores to Chrome and 4 to Safari, so the Earth came out as a different,
// smaller globe depending on which browser was opened - the reported "Safari
// gets a worse Earth and no marker". Cores alone also described a five-year-old
// iPad and a current desktop CPU identically.
//
// A coarse pointer is the signal that survives: it says "touch-first device",
// which is the class the static globe exists for (an old tablet or a budget
// phone that freezes when the render loop meets the audio graph). Cores then
// say the device is also small. iPadOS 13+ sends a desktop Mac user agent, so
// the UA cannot be trusted for this and is not consulted.
//
// Deliberately conservative: a mid-range phone with 6-8 cores keeps the live
// scene, and anything that genuinely cannot draw it still fails over on
// evidence - EarthBackdrop's `failed` path covers a throw, a WebGL error and a
// lost context. deviceMemory (Chrome-only, undefined in Safari and Firefox) is
// checked separately by the CSS gate for the budget-Android case.
export function isSmallTouchDevice() {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return false
  let coarse = false
  try {
    coarse = !!window.matchMedia && window.matchMedia('(pointer: coarse)').matches
  } catch {
    coarse = false
  }
  return coarse && (navigator.hardwareConcurrency || 0) <= 4
}

// Is this a WebKit engine (Safari, and every browser on iOS, since they all run
// WebKit regardless of the badge on the icon)?
//
// It matters for exactly one thing, and it is the whole Safari audio report:
// WebKit does not honour `playbackRate` or `preservesPitch` on a media element
// that has been connected to an AudioContext through createMediaElementSource
// (bugs.webkit.org 240405, reported on Safari 15 and only fixed in Safari
// Technology Preview 241). The element keeps REPORTING the rate it was given
// while it renders at 1x, so the speed control looks inert, every deadline
// priced at the rate cuts the line early - "the words are skipped and it cuts
// off" - and the same report describes the graph itself as choppy, which is the
// clicking heard under the ambient bed. Chrome and Firefox are Blink/Gecko and
// do not have it, so the test is the engine: AppleWebKit without a Blink vendor
// token. iOS Chrome (CriOS) and iOS Edge (EdgiOS) are WebKit too and are
// deliberately included.
export function isWebKitEngine(ua) {
  const s = ua === undefined ? (typeof navigator === 'undefined' ? '' : navigator.userAgent) : ua
  return /AppleWebKit/.test(s) && !/Chrome|Chromium/.test(s)
}
