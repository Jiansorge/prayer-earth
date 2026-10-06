// Production origin for every share / QR / deep link. Using
// `window.location.origin` would hand someone a dead "localhost" link when
// the app is running inside the Android/iOS shell or opened from file://.
// This mirrors the og:url / canonical rel in index.html.
export const CANONICAL_ORIGIN = 'https://joining-palms.app'

// Where someone goes to request deletion by hand, and where they report a
// re-upload. Both are free and open, so they work for anyone who needs them
// without an account.
//
// These live here rather than in a component because the Settings sheet and
// the Your data panel both link to them; a second copy of a URL is a URL that
// eventually disagrees with the first.
export const DELETE_DATA_URL = 'https://joining-palms.app/delete-data.html'
export const REPORT_URL = 'https://joining-palms.app/legal#report'