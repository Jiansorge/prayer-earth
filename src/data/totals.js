// Believable all-time totals so the "prayers ever carried" figures look lived-in
// on a fresh install, while the server and the person's own completed prayers
// add real counts on top. Deterministic per prayer id — stable across sessions.

import { SPIRITUALITIES } from './prayers.js'

const hashStr = (s) => {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0
  }
  return h
}

export const prayerBaseTotals = {}
export const spiritBaseTotals = {}

for (const s of SPIRITUALITIES) {
  let sum = 0
  for (const p of s.prayers) {
    const base = 320 + (hashStr(`${s.id}/${p.id}`) % 9200)
    prayerBaseTotals[p.id] = base
    sum += base
  }
  spiritBaseTotals[s.id] = sum
}
