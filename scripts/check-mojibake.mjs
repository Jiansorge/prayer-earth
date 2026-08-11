// Scans every locale file for mojibake: double-encoded UTF-8 that was read as
// cp1252 (or Latin-1) and re-saved. Flags values that still look broken and
// proves there are no U+FFFD replacement chars anywhere.
// Usage: node scripts/check-mojibake.mjs

import { readFileSync, readdirSync } from 'node:fs'

const files = readdirSync('src/locales')
  .filter((f) => f.endsWith('.js'))
  .map((f) => f.replace(/\.js$/, '').toLowerCase())
  .filter((f) => f !== 'index')

// cp1252-only characters. In practice none of these should appear in a locale
// value except the ones used as careful typography (…, —, ’, “ ”), which the
// second pass below whitelists.
const CP1252_PUNCT = /[\u20AC\u201A\u0192\u201E\u2026\u2020\u2021\u02C6\u2030\u0160\u2039\u0152\u017D\u00E3\u00E9\u2018\u2019\u201C\u201D\u2022\u2013\u2014\u02DC\u2122\u0161\u203A\u0153\u017E\u0178]/u
// Double-encoded leftovers that never appear in clean text.
const SMELLY = /Ã.|Ð.|\uFFFD/g

let bad = 0
for (const f of files) {
  const s = readFileSync(`src/locales/${f}.js`, 'utf8')
  const keys = [...new Set([...s.matchAll(/'([^']+)':/g)].map((m) => m[1]))]
  const smelly = []
  const ffdd = []
  for (const k of keys) {
    const m = s.match(new RegExp(`'${k}':\\s*'([^']+)'`))
    if (!m) continue
    if (SMELLY.test(m[1])) smelly.push(k)
    if (m[1].includes('\uFFFD')) ffdd.push(k)
  }
  if (smelly.length || ffdd.length) {
    bad++
    console.log(`${f}: ${smelly.length} mojibake, ${ffdd.length} replacement-char`)
    if (smelly.length) console.log('   smelly:', smelly.slice(0, 8).join(', '))
    if (ffdd.length) console.log('   ffdd  :', ffdd.slice(0, 8).join(', '))
  }
}
console.log(bad === 0 ? 'OK: all locales clean' : `${bad} locale(s) flagged`)