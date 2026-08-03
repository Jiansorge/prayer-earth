// Pure, shared logic used by both the browser client and the Node server.
// Nothing here may import from the app or touch the DOM / Node APIs.

// Fold one device's lifetime stats into another, taking the greater of every
// counter so a prayer is never lost when devices (or the server) meet.
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
