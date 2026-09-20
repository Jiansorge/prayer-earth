// Join prompt should only surface on phones and tablets, never desktop.
export const isMobile = () =>
  /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent) ||
  (navigator.maxTouchPoints > 0 && window.innerWidth < 900)

// iOS has no beforeinstallprompt and installs via the Share sheet, so the
// Settings hint needs different wording than other browsers.
export const isIos = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
