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
// iOS IPA), not a regular browser tab or an installed PWA.
//
// Use Capacitor's own isNativePlatform(), which correctly returns
// getPlatform() !== 'web'. Do NOT treat a truthy getPlatform() as native:
// Capacitor core is bundled into the web build too, where getPlatform() returns
// the string 'web' -- which is truthy. Testing its truthiness made this function
// return true in every normal browser, which inverted all the native-only
// affordances: the "Add to Home Screen" prompt was hidden on the web (where it
// matters most), the physical-keyboard shortcuts were disabled on the web, and
// the keyboard help was unreachable.
export const isAppShell = () =>
  !!window.Capacitor?.isNativePlatform?.() || !!window.CapacitorAndroid

export default { isMobile, isIos, isAppShell }
