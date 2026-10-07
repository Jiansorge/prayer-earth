// Duplicate keys in a locale file.
//
// A JS object literal silently keeps the LAST value for a repeated key. So a
// locale that defines `prayer.muted` twice does not error and does not warn: it
// quietly serves whatever the second one says.
//
// zh.js did exactly this. It defined `prayer.muted` twice - once with real
// Japanese katakana, and once with a mojibake copy of that same katakana
// (å·²é™éŸ£, which is what UTF-8 looks like read as Latin-1). The mojibake one
// came last, so Chinese users were shown a garbled string instead of a word.
// Every audit so far checked parity and encoding per value and therefore missed
// it: each value on its own looked fine to "is there a replacement character?".
//
// This finds duplicates by parsing, which also catches the two-keys-on-one-line
// form the locale files use for short pairs.
import fs from 'node:fs'
import path from 'node:path'

const DIR = 'src/locales'

// Key occurrences, in file order, with their values.
function entries(src) {
  const out = []
  const re = /'((?:[^'\\]|\\.)*)'\s*:\s*'((?:[^'\\]|\\.)*)'/g
  let m
  while ((m = re.exec(src))) out.push({ key: m[1], value: m[2], at: m.index })
  return out
}

let total = 0
for (const file of fs.readdirSync(DIR).filter((f) => f.endsWith('.js'))) {
  const src = fs.readFileSync(path.join(DIR, file), 'utf8')
  const seen = new Map()
  const dups = []
  for (const e of entries(src)) {
    if (seen.has(e.key)) dups.push({ key: e.key, first: seen.get(e.key), second: e })
    else seen.set(e.key, e)
  }
  if (!dups.length) continue
  for (const d of dups) {
    total++
    console.log(`  [${file}] ${d.key} defined twice`)
    console.log(`      first  : ${JSON.stringify(d.first.value.slice(0, 60))}`)
    console.log(`      SECOND : ${JSON.stringify(d.second.value.slice(0, 60))}   <- this one wins`)
    const moji = /[\u00C2-\u00C3\u00E0-\u00EF]/.test(d.second.value) || /[\uFFFD]/.test(d.second.value)
    console.log(`      second value looks like mojibake: ${moji}`)
    console.log('')
  }
}

console.log(total ? `${total} duplicate key(s)` : 'no duplicate keys')
process.exit(total ? 1 : 0)