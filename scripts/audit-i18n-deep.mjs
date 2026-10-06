// A 10x pass over the translations.
//
// Not "are they all translated" - the i18n audit already proves that. This looks
// for the ways a translation can be present, non-empty, and still WRONG, which
// is what a key-count audit cannot see:
//
//   1. A value that is byte-identical to English where it should not be
//      (untranslated, but present so the audit passes)
//   2. A placeholder present in English and missing in the translation, so the
//      UI renders a literal "{name}" to a real person
//   3. A placeholder the translation invented that English does not have
//   4. Suspicious mojibake: replacement chars, stray control characters, or the
//      mojibake sequence you get when UTF-8 is read as Latin-1
//   5. A string that has ballooned far past English (usually a machine
//      translation of a short UI label)
//   6. HTML that survived into a translation and will render as text
//   7. Right-to-left languages with no RTL punctuation fix

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const LOCALES = path.join(ROOT, 'src', 'locales')

const files = fs.readdirSync(LOCALES).filter((f) => f.endsWith('.js') && f !== 'en.js')
const enSrc = fs.readFileSync(path.join(LOCALES, 'en.js'), 'utf8')

// Parse `  'key': 'value',` pairs, allowing escaped quotes inside values.
function parse(src) {
  const out = new Map()
  const re = /^([ \t]*)'((?:[^'\\]|\\.)*)'\s*:\s*'((?:[^'\\]|\\.)*)'/gm
  let m
  while ((m = re.exec(src))) out.set(m[2], m[3])
  return out
}
const en = parse(enSrc)

// Keys whose value legitimately matches English in another language (product
// name, numerals, a loanword) so the identical-value check does not scream.
const ALLOWED_IDENTICAL = new Set([
  'Joining Palms',
  'keyboard.title',
  'picker.close',
  'prayer.close',
  'prayer.tuneClose'
])

const RTLS = new Set(['ar'])

let findings = 0
const report = (locale, key, kind, detail) => {
  findings++
  console.log(`  [${locale}] ${kind}  ${key}${detail ? '  ' + detail : ''}`)
}

console.log('[i18n] 10x translation pass')
console.log(`  ${en.size} keys in en, ${files.length} other locales\n`)

for (const f of files) {
  const locale = f.replace('.js', '')
  const t = parse(fs.readFileSync(path.join(LOCALES, f), 'utf8'))

  // 2/3. placeholder parity
  for (const [key, enVal] of en) {
    const val = t.get(key)
    if (val === undefined) continue
    const ph = (s) => [...new Set((String(s).match(/\{(\w+)\}/g) || []))].sort()
    const enPh = ph(enVal)
    const tPh = ph(val)
    const missing = enPh.filter((p) => !tPh.includes(p))
    const extra = tPh.filter((p) => !enPh.includes(p))
    if (missing.length) report(locale, key, 'MISSING PLACEHOLDER', missing.join(','))
    if (extra.length) report(locale, key, 'INVENTED PLACEHOLDER', extra.join(','))
  }

  // 1. untranslated but present
  for (const [key, val] of t) {
    const enVal = en.get(key)
    if (enVal === undefined) continue
    if (val !== enVal) continue
    if (ALLOWED_IDENTICAL.has(key)) continue
    // A value with no letters (punctuation, "—", "OK") is fine.
    if (!/[A-Za-z]{3,}/.test(val)) continue
    // Single words that are the same in both languages are usually loans.
    if (!val.includes(' ')) continue
    // Punctuation-only difference, e.g. straight vs curly quotes.
    if (val.replace(/[^\w\s]/g, '') === enVal.replace(/[^\w\s]/g, '')) continue
    report(locale, key, 'IDENTICAL TO ENGLISH', JSON.stringify(val.slice(0, 48)))
  }

  // 4. mojibake and control characters
  for (const [key, val] of t) {
    if (val.includes('\uFFFD')) report(locale, key, 'REPLACEMENT CHARACTER', 'corrupt encoding')
    if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(val)) report(locale, key, 'CONTROL CHARACTER')
    if (/[ÃÂ][-¿]/.test(val)) report(locale, key, 'MOJIBAKE', JSON.stringify(val.slice(0, 40)))
  }

  // 5. ballooned UI strings
  for (const [key, val] of t) {
    const enVal = en.get(key)
    if (!enVal || !/[A-Za-z]{3,}/.test(enVal)) continue
    const ratio = val.length / Math.max(1, enVal.length)
    // Latin scripts; CJK is naturally shorter or longer per character.
    if (ratio > 2.6 && val.length > 120) {
      report(locale, key, 'MUCH LONGER THAN ENGLISH', `${enVal.length} -> ${val.length}`)
    }
  }

  // 6. markup leaking into a translation
  for (const [key, val] of t) {
    if (/<\/?(div|span|button|p|br)\b/i.test(val) && !/<[a-z]+>/.test(en.get(key) || '')) {
      report(locale, key, 'HTML IN TRANSLATION', JSON.stringify(val.slice(0, 40)))
    }
  }

  // 7. RTL punctuation: a left-to-right mark wrapping RTL text is a common
  //    machine-translation artefact that renders as boxes.
  if (RTLS.has(locale)) {
    for (const [key, val] of t) {
      if (/[\u202A\u202B\u200E\u200F]/.test(val)) {
        report(locale, key, 'RTL DIRECTION MARK', JSON.stringify(val.slice(0, 30)))
      }
    }
  }

  // 8. a Latin fragment welded onto non-Latin text.
  //    "اسمmade-up" is a single token with no space, so it does not read as
  //    "untranslated" - it reads as a typo. It happened because a machine
  //    translation left one English word inside an Arabic sentence and the
  //    key-count audit had nothing to complain about.
  //
  //    Not every Latin run is a defect. The product name, legal acronyms and
  //    "cookie" are conventionally left in Latin script in these scripts, and
  //    flagging them every run buries the real findings.
  const LATIN_OK = new Set([
    'joining',
    'palms',
    'gdpr',
    'eea',
    'uk',
    'eu',
    'cookie',
    'cookies',
    'android',
    'ios',
    'cloudflare',
    'web',
    'analytics',
    'api',
    'url',
    'pdf',
    'email',
    'app',
    'store',
    'id',
    'faq'
  ])
  for (const [key, val] of t) {
    if (!/[\u0600-\u06FF\u0900-\u097F\u0F00-\u0FFF\u4E00-\u9FFF]/.test(val)) continue
    const enVal = en.get(key) || ''
    // Latin that English also has is fine: product name, units, tech terms.
    const latin = new Set(
      (enVal.match(/[A-Za-z][A-Za-z'-]{2,}/g) || []).map((w) => w.toLowerCase())
    )
    for (const run of val.match(/[A-Za-z][A-Za-z'-]{2,}/g) || []) {
      // A trailing hyphen is a joining mark ("GDPR-based"), not part of the word.
      const word = run.replace(/^-+|-+$/g, '')
      if (word.length < 3) continue
      if (LATIN_OK.has(word.toLowerCase())) continue
      if (latin.has(run.toLowerCase())) continue
      if (/^(and|or|the|with|for|from|you|your|not|no|off|on|show|hide)$/.test(word.toLowerCase())) continue
      report(locale, key, 'LATIN FRAGMENT IN NON-LATIN TEXT', JSON.stringify(run))
    }
  }
}

console.log('')

// --- legal text must be English everywhere ---------------------------------
//
// The in-app policy falls back to English on purpose (i18n.js), because the
// hosted policy is English-only and two copies of a privacy document cannot be
// kept honest by hand. This checks that promise instead of assuming it: a
// non-English locale must not define a legal.* string, or it would quietly
// start shipping an unreviewed translation again.
//
// legal.langNote is the exception - it is the sentence telling the reader that
// English governs, so it has to exist in their language.
for (const f of files) {
  const locale = f.replace('.js', '')
  if (locale === 'en') continue
  const src = fs.readFileSync(path.join(LOCALES, f), 'utf8')
  const own = [...src.matchAll(/'((?:legal\.)[^']+)'\s*:/g)].map((m) => m[1])
  const unwanted = own.filter((k) => k !== 'legal.langNote')
  if (unwanted.length) {
    findings++
    console.log(
      `  [${locale}] LEGAL STRING DEFINED  ${unwanted.length} keys would ship a translation: ${unwanted.slice(0, 4).join(', ')}${unwanted.length > 4 ? '…' : ''}`
    )
  }
}

// en must carry the note, because that is what every locale falls back to. A
// locale may carry its own translation. Three locales had neither and were
// rendering the literal string 'legal.langNote'; en now guarantees it resolves.
if (!/'legal\.langNote'\s*:/.test(fs.readFileSync(path.join(LOCALES, 'en.js'), 'utf8'))) {
  findings++
  console.log('  [en] MISSING legal.langNote  nothing for other locales to fall back to')
}

console.log('')
console.log(findings ? `${findings} findings` : 'no findings')
process.exit(findings ? 1 : 0)