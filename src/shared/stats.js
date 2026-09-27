// Pure, shared logic used by both the browser client and the Node server.
// Nothing here may import from the app or touch the DOM / Node APIs.

// A YYYY-MM-DD UTC day key, matching how day maps are keyed everywhere.
export function dayKeyUTC(d) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
    d.getUTCDate()
  ).padStart(2, '0')}`
}

// The current prayer streak, derived from the set of days actually prayed.
// A streak stays alive if you prayed today OR yesterday; otherwise it's 0.
// Derived (rather than max-merged) so a legitimately broken streak can decrease —
// a stored/max streak could only ever grow, so a lapsed streak got silently
// restored on the next sync.
export function streakFromDays(dayMap, now = new Date()) {
  const days = Object.keys(dayMap || {})
  if (!days.length) return 0
  const has = new Set(days)
  let cursor
  if (has.has(dayKeyUTC(now))) {
    cursor = new Date(now.getTime())
  } else {
    const y = new Date(now.getTime() - 86400000)
    if (!has.has(dayKeyUTC(y))) return 0
    cursor = y
  }
  let n = 0
  while (has.has(dayKeyUTC(cursor))) {
    n += 1
    cursor = new Date(cursor.getTime() - 86400000)
  }
  return n
}

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
  // streak is DERIVED from the merged day map (a real value that can decrease),
  // never max-merged — otherwise a broken streak was restored on every sync.
  out.streak = streakFromDays(out.prayerDayCompletions)
  out.bestStreak = Math.max(pick(base?.bestStreak, incoming.bestStreak), out.streak)
  const ld = incoming.lastPrayedDay || base?.lastPrayedDay
  if (ld) out.lastPrayedDay = ld > (base?.lastPrayedDay || '') ? ld : base.lastPrayedDay
  return out
}
