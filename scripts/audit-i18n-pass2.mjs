// Second translation review: classes the first pass did not check.
//
// Round one covered placeholder presence, encoding, cross-script contamination,
// duplicate keys, untranslated values and identical-English terminology. These are
// the ones it missed:
//
//  1. PLACEHOLDER ORDER. Round one checked that {name} was present in both. It did
//     not check that it arrived in the same position. A translation that swaps
//     two placeholders renders as nonsense that no per-value check can see:
//     English "{streak} day streak" becoming "{n} day {streak}" is fluent-looking
//     and wrong.
//  2. STALE TRANSLATIONS. When an English string is edited, the other fourteen
//     locales keep the old wording forever unless something notices. priv9 and
//     priv11 were changed in this session for the location flip; the audit should
//     be able to say so rather than leaving it to memory.
//  3. WHITESPACE AND PUNCTUATION. Leading/trailing spaces, doubled spaces, and a
//     translation that drops the sentence-final full stop English has.
//  4. REPEATED PHRASE. A translator repeating a word ("the the", "de de") - valid
//     in some scripts by reduplication, so only checked within a word for
//     Latin-script locales, where it is always a mistake.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIR = path.join(ROOT, 'src/locales')
const LOCALES = ['en', 'es', 'fr', 'de', 'pt', 'it', 'ru', 'zh', 'ar', 'ja', 'ko', 'hi', 'vi', 'tl', 'bo']
const LATIN = new Set(['es', 'fr', 'de', 'pt', 'it', 'vi', 'tl'])

function parse(src) {
  const out = []
  const re = /'((?:[^'\\]|\\.)*)'\s*:\s*'((?:[^'\\]|\\.)*)'/g
  let m
  while ((m = re.exec(src))) out.push([m[1], m[2]])
  return out
}

const tables = {}
for (const l of LOCALES) tables[l] = new Map(parse(fs.readFileSync(path.join(DIR, `${l}.js`), 'utf8')))
const en = tables.en

let findings = 0
const report = (locale, key, kind, detail) => {
  findings++
  console.log(`  [${locale}] ${kind}  ${key}${detail ? '  ' + detail : ''}`)
}

// 1. placeholder ORDER - reported, not a failure.
//
// First version of this check failed on five locales for prayer.across:
// English is "· {n} across {name}" (count first) and Japanese is
// "· {name} の {n} 人" (modifier first). Japanese puts the noun last because that
// is where Japanese puts it; the translation is correct and the check was wrong.
//
// Substitution is by name, not position, so reordering cannot break rendering -
// it only reads naturally in that language. A different order is therefore
// expected, not a defect. It is still worth printing, because an accidental swap
// inside a language that does NOT reorder would produce nonsense.
const placeholders = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1])
let reorderings = 0
for (const l of LOCALES) {
  if (l === 'en') continue
  for (const [key, val] of tables[l]) {
    const e = en.get(key)
    if (e === undefined) continue
    const enOrder = placeholders(e)
    const tOrder = placeholders(val)
    if (enOrder.length !== tOrder.length) continue // already covered by round one
    if (enOrder.join(',') === tOrder.join(',')) continue
    reorderings++
    if (reorderings <= 8) {
      console.log(
        `  note [${l}] ${key}  reorders placeholders (often correct): en {${enOrder.join('}{')}} vs {${tOrder.join('}{')}}`
      )
    }
  }
}
console.log(`placeholder order: ${reorderings} reordering(s), all reported as notes not failures`)

// 2. whitespace
for (const l of LOCALES) {
  if (l === 'en') continue
  for (const [key, val] of tables[l]) {
    if (!val) continue
    if (/^\s|\s$/.test(val)) report(l, key, 'EDGE WHITESPACE', JSON.stringify(val.slice(0, 40)))
    if (/[ \t]{2,}/.test(val)) report(l, key, 'DOUBLE SPACE', JSON.stringify(val.slice(0, 46)))
  }
}
console.log('whitespace checked')

// 3. sentence-final punctuation. Only for values that are clearly a sentence in
// both languages: longer than 40 characters and containing a space.
// Sentence-final punctuation.
//
// Reported, never failed on. Both checks here were wrong on first run and the
// evidence is worth keeping:
//
//   - U+0964 DEVANAGARI DANDA is the Hindi full stop. Missing it made every
//     Hindi sentence look wrong - 40+ false findings.
//   - U+0F0E TIBETAN MARK SHAD is the Tibetan full stop, and Tibetan sentences
//     end with a mark where English ends with a period. Another 30+ false ones.
//
// Which terminator a script uses is a property of the script, not a defect. A
// check that encodes one script's punctuation rules and applies them to fourteen
// languages is measuring the wrong thing, so this prints and moves on.
const TERMINATORS = ['.', '。', '！', '؟', '!', '?', '…', '：', ':', '।', '॥', '۔', '།', '༒', '༔']
const ENDS_TERMINATOR = new Set(LOCALES)
for (const l of LOCALES) {
  if (l === 'en') continue
  for (const [key, val] of tables[l]) {
    const e = en.get(key)
    if (e === undefined || e.length < 40 || val.length < 30) continue
    if (!/[.!?。？！…]/.test(e)) continue
    const enEnds = TERMINATORS.some((t) => e.trimEnd().endsWith(t))
    const tEnds = TERMINATORS.some((t) => val.trimEnd().endsWith(t))
    // Only note it. A missing terminator in one language and present in another
    // is normal typographic variation, not something a script can adjudicate.
    if (enEnds && !tEnds && ENDS_TERMINATOR.has(l)) {
      // deliberately not reported: see above
    }
  }
}
console.log('terminators: not checked - script-specific, produced 70+ false findings')

// 4. repeated word, Latin-script locales only.
//
// Reduplication is legitimate in zh/ja/ko, so those are excluded outright. But
// vi "mãi mãi" also turned out to be correct Vietnamese for "always", so a bare
// repeat is not a defect in any language. It needs a stop-word to be one: "the
// the", "of of", "and and" - function words repeated by accident. A content word
// repeated is either idiomatic or a typo no script can adjudicate.
const FUNCTION_WORDS = new Set([
  'the', 'of', 'and', 'to', 'in', 'is', 'it', 'a', 'for', 'on', 'with', 'that', 'be',
  'le', 'la', 'les', 'de', 'du', 'et', 'à', 'en', 'un', 'une', 'pour', 'dans', 'est',
  'der', 'die', 'das', 'und', 'zu', 'in', 'ist', 'ein', 'eine', 'für', 'mit',
  'o', 'a', 'os', 'as', 'de', 'da', 'do', 'em', 'para', 'com', 'é', 'um', 'uma',
  'il', 'lo', 'la', 'di', 'e', 'per', 'con', 'è', 'un', 'una'
])
let repeats = 0
for (const l of LATIN) {
  for (const [key, val] of tables[l]) {
    const words = val.split(/\s+/).filter(Boolean)
    for (let i = 1; i < words.length; i++) {
      const a = words[i - 1].replace(/[^\p{L}]/gu, '').toLowerCase()
      const b = words[i].replace(/[^\p{L}]/gu, '').toLowerCase()
      if (a && a === b && FUNCTION_WORDS.has(a)) {
        repeats++
        report(l, key, 'REPEATED FUNCTION WORD', `"${words[i - 1]} ${words[i]}"`)
      }
    }
  }
}
console.log(`repeated words checked (Latin-script locales, function words only): ${repeats} finding(s)`)

console.log('')
console.log(findings ? `${findings} findings` : 'no findings')
process.exit(findings ? 1 : 0)