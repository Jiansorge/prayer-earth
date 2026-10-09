// Production origin for every share / QR / deep link. Using
// `window.location.origin` would hand someone a dead "localhost" link when
// the app is running inside the Android/iOS shell or opened from file://.
// This mirrors the og:url / canonical rel in index.html.
export const CANONICAL_ORIGIN = 'https://joining-palms.app'

// Where someone goes to request deletion by hand, and where they report a
// re-upload. Both are free and open, so they work for anyone who needs them
// without an account.
//
// REPORT_URL used to be `https://joining-palms.app/legal#report`. There is no
// hosted /legal page - that path just serves the app shell, so the link landed
// on the home screen with nothing highlighted, and no element on any page
// carried id="report" to jump to. The privacy policy is the real hosted page
// that carries the contact details, so the report route now points at its
// #report section, which build-legal.mjs renders.
export const DELETE_DATA_URL = 'https://joining-palms.app/delete-data.html'
export const REPORT_URL = 'https://joining-palms.app/privacy.html#report'