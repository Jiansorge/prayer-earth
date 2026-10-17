// Folding a deleted prayer id into the one that replaced it.
//
// Two prayers that were the same thing in two languages now live under a
// single id. Without this, deleting the old id would quietly take a
// listener's favourite, their completion counts and their streak with it —
// and none of that can be recovered from the server, because those numbers
// are the listener's own. So the history folds forward on the next launch
// instead of evaporating.

// [deleted id, surviving id]. Adding a line here is all a future merge needs.
export const FOLDED_PRAYERS = [['refuges', 'sarana']]

const foldPrayerMap = (map, from, to) => {
  if (!map || typeof map !== 'object') return map
  if (!(from in map)) return map
  const out = { ...map }
  out[to] = (Number(out[to]) || 0) + (Number(out[from]) || 0)
  delete out[from]
  return out
}

// The same fold for a day -> { prayerId: count } map: every day that carried
// the old id gains its count on the surviving one.
const foldPrayerDayMap = (map, from, to) => {
  if (!map || typeof map !== 'object') return map
  let changed = false
  const out = {}
  for (const [day, counts] of Object.entries(map)) {
    if (counts && typeof counts === 'object' && from in counts) {
      changed = true
      const next = { ...counts }
      next[to] = (Number(next[to]) || 0) + (Number(next[from]) || 0)
      delete next[from]
      out[day] = next
    } else {
      out[day] = counts
    }
  }
  return changed ? out : map
}

// Returns the same object untouched when there is nothing to fold, so a
// launch with no affected history does no work and changes no identity.
export const foldPrayers = (state) => {
  if (!state || typeof state !== 'object') return state
  let s = state
  for (const [from, to] of FOLDED_PRAYERS) {
    const next = { ...s }
    let touched = false
    if (Array.isArray(s.favorites) && s.favorites.includes(from)) {
      // Map, then de-duplicate: a listener who already favourited both would
      // otherwise end up with the survivor listed twice.
      next.favorites = s.favorites
        .map((id) => (id === from ? to : id))
        .filter((id, i, a) => a.indexOf(id) === i)
      touched = true
    }
    for (const key of ['prayerCompletions', 'prayerTotals']) {
      // typeof guard: `from in map` throws a TypeError on a primitive, and this
      // runs inside persist's migrate. A throw there aborts rehydration, so merge
      // never runs and the listener's whole saved state - volume, streak,
      // locale, favourites - is silently dropped back to defaults on boot.
      if (s[key] && typeof s[key] === 'object' && from in s[key]) {
        next[key] = foldPrayerMap(s[key], from, to)
        touched = true
      }
    }
    for (const key of ['prayerDayCompletions', 'prayerDayStats']) {
      const folded = foldPrayerDayMap(s[key], from, to)
      if (folded !== s[key]) {
        next[key] = folded
        touched = true
      }
    }
    // A voice choice belongs to the language it was made in, so it is dropped
    // rather than carried across into a different recitation. Same typeof guard
    // as above: a malformed store can carry a number here and `in` would throw.
    if (s.prayerVoices && typeof s.prayerVoices === 'object' && from in s.prayerVoices) {
      const voices = { ...s.prayerVoices }
      delete voices[from]
      next.prayerVoices = voices
      touched = true
    }
    s = touched ? next : s
  }
  return s
}
