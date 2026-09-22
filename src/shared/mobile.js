// Join prompt should only surface on phones and tablets, never desktop.
export const isMobile = () =>
  /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent) ||
  (navigator.maxTouchPoints > 0 && window.innerWidth < 900)

// iOS has no beforeinstallprompt and installs via the Share sheet, so the
// join-install hint needs different wording than other browsers.
export const isIos = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

// True when running inside the native Capacitor app shell (Android APK /
// iOS IPA), not a regular browser tab. The shell has no browser UI to
// install onto, so the 'Add to home screen' prompt and its hints must be
// hidden in that environment.
export const isAppShell = () =>
  !!window.Capacitor?.isNativePlatform?.() ||
  !!window.Capacitor?.getPlatform?.() ||
  !!window.CapacitorAndroid

export default { isMobile, isIos, isAppShell }
