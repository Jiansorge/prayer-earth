// Production origin for every share / QR / deep link. Using
// `window.location.origin` would hand someone a dead "localhost" link when
// the app is running inside the Android/iOS shell or opened from file://.
// This mirrors the og:url / canonical rel in index.html.
export const CANONICAL_ORIGIN = 'https://joining-palms.app'
