// sync-engine — shared message contract (v1).
// The single source of truth for what the app and the engine say to each other.
// Keep this file byte-identical in sync-engine and in every app that consumes it
// (Prayer Earth copies it as src/sync/protocol.js).

export const PROTOCOL_VERSION = 3

// Client → Engine
export const C_PRESENCE = 'presence' // { type, praying, prayerId?, spiritId?, sessionId?, name, cell? }
export const C_SYNC = 'sync' // { type, anonId, stats }
export const C_PING = 'ping' // { type } — client keepalive probe

// Engine → Client
export const E_STATE = 'state' // { type, people, lights, lightSpirits, prayers, spirits, totals, usersToday, usersWeek, totalPrayerSeconds }
export const E_FEED = 'feed' // { type, feed: FeedEntry[] }
export const E_SYNC = 'sync' // { type, stats }
export const E_PONG = 'pong' // { type } — engine's liveness ack to a C_PING
export const E_ERROR = 'error' // { type, code } — engine's reason before it closes a socket (e.g. 'rate')

// A coarse 1-degree grid cell ("lat,lon") — the most precise location ever
// shared, so privacy is built into the wire format (~110km resolution).
export function gridKey(lat, lon) {
  const la = Math.max(-60, Math.min(72, Math.round(lat)))
  let lo = Math.round(lon)
  if (lo >= 180) lo = -180
  return `${la},${lo}`
}

// The stats merge lives in shared/stats.js (one implementation for the app).
// This re-export exists so the historical `./protocol.js` import path can't hand
// back a divergent copy that still max-merged `streak` (the bug that made a
// lapsed streak unbreakable). Do NOT re-add a local mergeStats here.
export { mergeStats } from '../shared/stats.js'

