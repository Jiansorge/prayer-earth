// All-time totals start at true zero on launch: only real prayers (server
// counts plus the person's own completions) grow these numbers. The world
// begins empty and honest. If you ever want it to look lived-in on a fresh
// install again, re-add a deterministic base seed here (e.g. `320 + hash % N`
// per prayer), the store reads these exports and adds them on top.

export const prayerBaseTotals = {}
export const spiritBaseTotals = {}
