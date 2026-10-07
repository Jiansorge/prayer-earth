// Prayer backup / restore — a no-login safety net so a lost or replaced device
// never means lost prayers.
//
// Design (privacy-first, no account): the app packages your prayer history +
// your anonymous sync id into a single "recovery code" (base64 of JSON). You
// save it anywhere — a note, an email to yourself, a photo, a file. On a new
// device you import it and everything is back, including the anonId, which
// reconnects your server-synced lifetime history too.
//
// Import MERGES (max) rather than overwrites, so restoring an older backup can
// never lower newer local counts. Profile name / theme / language are
// intentionally NOT included — they are device/identity, not prayer data.

import { useStore } from '../store.js'
import { mergeStats } from './stats.js'

const PREFIX = 'JP1:'
const VERSION = 1

// The fields that constitute "your prayers". Everything sacred, nothing private.
function payloadFrom(state) {
  return {
    v: VERSION,
    anonId: state.anonId,
    // Carried so that restoring onto a new phone still allows self-service
    // deletion: whoever holds the recovery code holds the deletion capability,
    // which is the correct ownership model for a no-account app.
    deleteToken: state.deleteToken,
    firstSeen: state.firstSeen,
    prayerCompletions: state.prayerCompletions,
    prayerDayCompletions: state.prayerDayCompletions,
    prayerDayStats: state.prayerDayStats,
    localPrayerSeconds: state.localPrayerSeconds,
    streak: state.streak,
    bestStreak: state.bestStreak,
    lastPrayedDay: state.lastPrayedDay
  }
}

const b64encode = (str) => {
  const bytes = new TextEncoder().encode(str)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}
const b64decode = (b64) => {
  const bin = atob(b64)
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

// CRC-32 (IEEE), used ONLY to catch accidental corruption -- a truncated paste,
// a mangled character, a half-copied line. It is explicitly not a security
// control: it is trivially forgeable, and anyone able to craft a code could
// equally hand over a well-formed one. The server already guards the shared
// world totals against junk, so the realistic harm this prevents is a user
// restoring subtly wrong data and not finding out for weeks.
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

export function crc32(str) {
  let c = 0xffffffff
  for (let i = 0; i < str.length; i++) {
    c = CRC_TABLE[(c ^ str.charCodeAt(i)) & 0xff] ^ (c >>> 8)
  }
  return (c ^ 0xffffffff) >>> 0
}

// Build the recovery code string for the current device.
export function buildBackupCode() {
  const body = payloadFrom(useStore.getState())
  // Checksum the body WITHOUT the checksum field, so verification is a pure
  // function of what we actually stored.
  const json = JSON.stringify({ ...body, crc: crc32(JSON.stringify(body)) })
  return PREFIX + b64encode(json)
}

// Parse + validate a recovery code. Returns the payload or throws with a
// human-readable reason. Rejects anything that isn't a JP1 backup.
export function parseBackupCode(code) {
  const trimmed = String(code || '').trim()
  if (!trimmed.startsWith(PREFIX)) throw new Error('notBackup')
  // Refuse absurd input before decoding. A user's own code is a few KB; this
  // stops a pasted megabyte from being base64-decoded (and then JSON-parsed)
  // on the UI thread, and costs nothing for a real code.
  if (trimmed.length > 512 * 1024) throw new Error('corrupt')
  let obj
  try {
    obj = JSON.parse(b64decode(trimmed.slice(PREFIX.length)))
  } catch {
    throw new Error('corrupt')
  }
  if (!obj || obj.v !== VERSION || typeof obj !== 'object') throw new Error('corrupt')
  // Integrity check. Without it, a code truncated mid-copy can still decode to
  // syntactically valid JSON with some fields missing or half-merged, and the
  // user would only discover the loss later. A checksum field from a pre-checksum
  // build is accepted so an older code still restores.
  if (Number.isFinite(obj.crc)) {
    const { crc, ...body } = obj
    if (crc32(JSON.stringify(body)) !== crc) throw new Error('damaged')
  }
  return obj
}

// A plain-language digest of what a backup actually contains, so a restore can
// tell the user what they got back. Without this, pasting a code is a leap of
// faith: "Restored." is indistinguishable from pasting the wrong person's code.
export function summarizePayload(payload) {
  const completions = payload?.prayerCompletions && typeof payload.prayerCompletions === 'object'
    ? payload.prayerCompletions
    : {}
  const ids = Object.keys(completions).filter((k) => Number.isFinite(completions[k]))
  const days = Object.keys(payload?.prayerDayCompletions || {})
    .map(Number)
    .filter(Number.isFinite)
    .sort((a, b) => a - b)
  // A negative count is meaningless, and Number.isFinite alone lets one through:
  // -99999 is finite. That value reaches here from a damaged localStorage entry
  // or a hand-edited backup code, and it then drives the "what was restored"
  // readout and the wasNoop / gainedSeconds comparisons.
  //
  // This does not put the live data at risk - the store's higher() and maxMap()
  // merge with Math.max, so a negative can never lower a real total. It is the
  // summary that was wrong, and a summary that says "-99999s" is worse than no
  // summary at all.
  const atLeastZero = (n) => (Number.isFinite(n) ? Math.max(0, n) : 0)
  return {
    distinctPrayers: ids.length,
    completions: atLeastZero(ids.reduce((sum, k) => sum + completions[k], 0)),
    seconds: atLeastZero(payload?.localPrayerSeconds),
    bestStreak: atLeastZero(payload?.bestStreak),
    days: days.length,
    fromDay: days.length ? days[0] : 0,
    toDay: days.length ? days[days.length - 1] : 0
  }
}

// The same digest for live state, so a restore can report the result and say
// whether the backup was older than what the device already had.
export function summarizeState(state) {
  return summarizePayload(state)
}

// Merge a backup into the live store. Counters are max-merged (so an older
// backup never lowers newer data); the anonId is adopted so server-side lifetime
// sync reconnects to the restored identity. Returns a summary describing both
// the backup's contents and what the merge actually did.
export function applyBackup(payload) {
  const s = useStore.getState()
  const backup = summarizePayload(payload)
  const before = summarizeState(s)
  const merged = mergeStats(s, payload)
  const next = {
    prayerCompletions: merged.prayerCompletions,
    prayerDayCompletions: merged.prayerDayCompletions,
    prayerDayStats: merged.prayerDayStats,
    localPrayerSeconds: merged.localPrayerSeconds,
    streak: merged.streak,
    bestStreak: merged.bestStreak,
    lastPrayedDay: merged.lastPrayedDay
  }
  // Adopt the backed-up anonId so synced history follows the restored identity.
  if (typeof payload.anonId === 'string' && payload.anonId && payload.anonId !== s.anonId) {
    next.anonId = payload.anonId
  }
  // Likewise the deletion token, so a restored device can delete its own record
  // without falling back to the emailed route.
  if (typeof payload.deleteToken === 'string' && payload.deleteToken) {
    next.deleteToken = payload.deleteToken
  }
  if (Number.isFinite(payload.firstSeen) && (!s.firstSeen || payload.firstSeen < s.firstSeen)) {
    next.firstSeen = payload.firstSeen
  }
  useStore.setState(next)

  // Report what the merge actually did, not just that it ran. "wasNoop" means
  // the backup held nothing this device didn't already have -- the honest
  // answer to "I pasted my old code and nothing changed".
  const after = summarizeState(useStore.getState())
  const identityChanged = next.anonId && next.anonId !== s.anonId
  return {
    backup,
    result: after,
    identityChanged: Boolean(identityChanged),
    wasNoop:
      !identityChanged &&
      after.seconds === before.seconds &&
      after.completions === before.completions &&
      after.bestStreak === before.bestStreak,
    gainedSeconds: Math.max(0, after.seconds - before.seconds)
  }
}

// Convenience: parse + apply in one call.
export function restoreFromCode(code) {
  return applyBackup(parseBackupCode(code))
}
