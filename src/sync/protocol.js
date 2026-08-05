// sync-engine — shared message contract (v1).
// The single source of truth for what the app and the engine say to each other.
// Keep this file byte-identical in sync-engine and in every app that consumes it
// (Prayer Earth copies it as src/sync/protocol.js).

export const PROTOCOL_VERSION = 3

// Client → Engine
export const C_PRESENCE = 'presence' // { type, praying, prayerId?, spiritId?, name, cell? }
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

// The lifetime stats that are safe to sync (pure counters, max-merged).
export function mergeStats(base, incoming) {
  const pick = (a, b) => Math.max(a || 0, b || 0)
  const out = { ...(base || {}) }
  const mergeDay = (local, inc) => {
    const m = { ...(local || {}) }
    for (const [d, map] of Object.entries(inc || {})) {
      m[d] = { ...(m[d] || {}) }
      for (const [k, v] of Object.entries(map)) m[d][k] = pick(m[d][k], v)
    }
    return m
  }
  out.prayerCompletions = { ...(base?.prayerCompletions || {}) }
  for (const [k, v] of Object.entries(incoming.prayerCompletions || {})) {
    out.prayerCompletions[k] = pick(out.prayerCompletions[k], v)
  }
  out.prayerDayCompletions = mergeDay(base?.prayerDayCompletions, incoming.prayerDayCompletions)
  out.prayerDayStats = mergeDay(base?.prayerDayStats, incoming.prayerDayStats)
  out.localPrayerSeconds = pick(base?.localPrayerSeconds, incoming.localPrayerSeconds)
  out.streak = pick(base?.streak, incoming.streak)
  out.bestStreak = pick(base?.bestStreak, incoming.bestStreak)
  const ld = incoming.lastPrayedDay || base?.lastPrayedDay
  if (ld) out.lastPrayedDay = ld > (base?.lastPrayedDay || '') ? ld : base.lastPrayedDay
  return out
}
