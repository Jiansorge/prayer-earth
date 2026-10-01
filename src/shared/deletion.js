// Self-service data deletion.
//
// Joining Palms has no accounts, so the anonymous ID is the only way to name a
// record - but deleting on the ID alone would let anyone who ever saw a recovery
// code destroy that person's history. So a second secret is involved: a
// high-entropy deleteToken generated on this device, sent over the existing TLS
// connection, and stored on the server only as a hash.
//
// The token is part of the persisted store and therefore part of the backup
// code, so someone who restores a backup onto a new phone can still self-serve.
// Losing it falls back to the emailed request, which is the honest path.

import { TEST_HOOKS } from './testHooks.js'
import { useStore } from '../store.js'

// The on-device test needs to drive the real client logic, not a reimplementation
// of it, and a previous version of that test imported the bundle and then passed
// when the import failed - which proved nothing. Exposing the two real functions
// under the same build-time gate as the other hooks keeps the test honest without
// shipping a deletion capability to production.
if (TEST_HOOKS && typeof window !== 'undefined') {
  window.__deletion = { requestDeletion, forgetIdentity, newDeleteToken }
}

// A URL-safe base64 of 32 random bytes. crypto.getRandomValues is available in
// both the browser and the Android WebView (unlike crypto.subtle, which is not,
// because the app shell is not a secure context) - which is exactly why the
// hashing is done server-side.
export function newDeleteToken() {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// The sync Worker, derived the same way the rest of the app derives it.
const SYNC_ORIGIN = 'https://joining-palms.app'

const syncBase = () => {
  const override = import.meta.env.VITE_SYNC_URL
  if (override) return String(override).replace(/\/$/, '')
  return SYNC_ORIGIN
}

// Ask the server to erase the record for this identity.
//
// Resolves to one of:
//   'deleted'     - gone, confirmed by the server
//   'local_only'  - this device never synced, so there is no server record that
//                   could be named. Nothing was removed from the server because
//                   there is provably nothing there; the local wipe still runs.
//                   Deliberately NOT reported as 'deleted', because that would
//                   claim a server-side deletion that never happened.
//   'not_found'   - the server did not recognise this identity/token, so nothing
//                   was changed. Either this device has not synced since
//                   self-service existed, or the token was lost, so the emailed
//                   route is the fallback.
//   'offline'     - no network; nothing was sent
//   'error'       - anything else
export async function requestDeletion() {
  const state = useStore.getState()
  const anonId = state.anonId
  // No identity means no synced history to erase, and nothing that could be
  // named on the server. Reporting 'not_found' here left the user pressing a
  // button that did nothing at all, with no idea why.
  if (!anonId) return 'local_only'
  // Mint the token on demand rather than bailing out. A device that installed
  // before this feature has no token in storage, and an early return here told
  // the user "we could not find your data" without ever contacting the server -
  // so the button silently did nothing and the only route left was the email
  // fallback this feature exists to remove.
  const token = state.deleteToken || state.getDeleteToken()
  if (!token) return 'not_found'

  let res
  try {
    res = await fetch(`${syncBase()}/delete`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ anonId, token })
    })
  } catch {
    return 'offline'
  }
  if (res.status === 404) return 'not_found'
  if (!res.ok) return 'error'
  try {
    const body = await res.json()
    return body && body.ok ? 'deleted' : 'not_found'
  } catch {
    return 'error'
  }
}

// Forget everything this identity has, locally too.
//
// Called only after the server has confirmed the deletion, so the local wipe
// never happens on a failed or unconfirmed request. The user gets a genuinely
// fresh start: new anonymous ID, new token, counters at zero.
//
// Order matters, and it is the opposite of what looks natural. The store's
// write guard folds every write into whatever is already stored, so a zeroed
// state would simply be merged back up to the old totals and the wipe would
// silently do nothing. Removing the stored key FIRST means the next write finds
// no previous value and passes straight through. The guard stays intact for
// every other code path, and no "reset" escape hatch is added to it.
export function forgetIdentity() {
  const KEY = 'prayer-earth-v1'
  try {
    window.localStorage.removeItem(KEY)
    window.localStorage.removeItem(`${KEY}.unreadable`)
    window.localStorage.removeItem(`${KEY}.unreadable.count`)
  } catch {}

  useStore.setState({
    // Minted through the store's own generator so the new identity has the same
    // shape as any other, rather than a format invented here.
    anonId: '',
    deleteToken: newDeleteToken(),
    firstSeen: 0,
    prayerCompletions: {},
    prayerDayCompletions: {},
    prayerDayStats: {},
    localPrayerSeconds: 0,
    streak: 0,
    bestStreak: 0,
    lastPrayedDay: 0,
    dataQuarantined: false,
    dataPreservationFailed: false
  })
  useStore.getState().getAnonId()
}
