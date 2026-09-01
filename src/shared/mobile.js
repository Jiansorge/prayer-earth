// Join prompt should only surface on phones and tablets, never desktop.
export const isMobile = () =>
  /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent) ||
  (navigator.maxTouchPoints > 0 && window.innerWidth < 900)
