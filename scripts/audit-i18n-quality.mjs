// Untranslated strings, doubled words, and terminology drift.
//
// The three defects the other audits could not see, because each requires
// comparing values to each other rather than checking one in isolation.
//
//  1. UNTRANSLATED. Identical to the English. audit-i18n-deep already has this
//     check, but with a broad allowlist; here the allowlist is derived from the
//     data instead - a key is exempt if its English value is a product name, a
//     unit, or appears verbatim in a majority of locales (which is how a loan
//     word or an intentional shared label looks).
//
//  2. DOUBLED WORDS. "the the", "de de", a repeated token - the classic
//     machine-translation artefact, and invisible to any per-value check.
//
//  3. TERMINOLOGY DRIFT. The same English word rendered two different ways
//     inside one locale, so the UI calls one thing by two names. Grouped by
//     English value, then reported when the same source word maps to more than
//     one target within a locale.
import fs from 'node:fs'
import path from 'node:path'

const DIR = 'src/locales'
const LOCALES = ['en', 'es', 'fr', 'de', 'pt', 'it', 'ru', 'zh', 'ar', 'ja', 'ko', 'hi', 'vi', 'tl', 'bo']

function parse(src) {
  const out = []
  const re = /'((?:[^'\\]|\\.)*)'\s*:\s*'((?:[^'\\]|\\.)*)'/g
  let m
  while ((m = re.exec(src))) out.push([m[1], m[2]])
  return out
}

const tables = {}
for (const l of LOCALES) {
  tables[l] = new Map(parse(fs.readFileSync(path.join(DIR, `${l}.js`), 'utf8')))
}
const en = tables.en

// Which English values are exempt from the untranslated check, derived rather
// than hand-listed: a value shared verbatim by most locales is a deliberate
// label, not a missing translation.
const shareCount = new Map()
for (const l of LOCALES) {
  if (l === 'en') continue
  for (const [k, v] of tables[l]) {
    if (en.has(k) && en.get(k) === v) shareCount.set(k, (shareCount.get(k) || 0) + 1)
  }
}
const exempt = new Set()
for (const [k, n] of shareCount) {
  // 10+ of the 14 non-English locales keeping the English wording is a shared term.
  if (n >= 10) exempt.add(k)
}
console.log(`untranslated check: ${exempt.size} keys exempt as deliberate shared labels\n`)

let findings = 0
const report = (locale, key, kind, detail) => {
  findings++
  console.log(`  [${locale}] ${kind}  ${key}${detail ? '  ' + detail : ''}`)
}

// 1. Untranslated
for (const l of LOCALES) {
  if (l === 'en') continue
  for (const [k, v] of tables[l]) {
    const e = en.get(k)
    if (e === undefined || v !== e) continue
    if (exempt.has(k)) continue
    if (!/[A-Za-z]{4,}/.test(v)) continue
    if (!/\s/.test(v)) continue
    report(l, k, 'UNTRANSLATED', JSON.stringify(v.slice(0, 46)))
  }
}

// 2. DOUBLED WORDS - removed.
//
// This was in the first version and it was wrong. Reduplication is a legitimate
// feature of these languages, not a translation artefact:
//
//   zh 静静 (quiet), 刚刚 (just now), 试试 (try a bit)
//   ja とともに (together), ここ (here), ささやか (gentle)
//   ko 기기 (device), 지지 (support)
//   vi mãi mãi (always)
//
// It reported 40+ false positives, including two where the regex straddled a
// real word boundary (语音音量 matched as "音音"). A check that cries wolf is
// worse than no check, because it trains you to ignore the output. Only the
// untranslated check and the terminology check below remain, both of which
// compare values against each other and had no false positives on the current
// corpus.

// Terminology drift is REPORTED, not failed on.
//
// It found real inconsistencies, but also a lot of correct behaviour: es/fr/de
// render "Dismiss" as cerrar/descartar and fechar/dispensar, which is the
// translations being MORE precise than an English that collapses close and
// dismiss into one word. Failing on that would train people to ignore the
// output, so this section prints for a human to judge and does not set exit 1.
//
// Findings fixed from this output so far:
//   tl settings.backupCopyTitle / settings.playStoreComingSoon left in English
//   es settings.back "Atrás" against prayer.back "Volver" for the same "Back"
//   ar home.title carried a spurious fatha the other four instances of the
//      same imperative did not have
//
// Findings deliberately NOT fixed, because resolving them means choosing a
// rendering across fourteen languages and is a judgement about register and
// layout rather than a typo:
//   home.yourPrayersToday vs prayer.today        - differ in all 14 locales
//   prayer.voiceVolume vs sound.prayerVoice      - differ in 11 locales
//   settings.ambientLabel vs settings.ambientSound, prayer.speed vs sound.speed
//
// The first version compared single English WORDS across keys and produced ~90
// lines of correct behaviour: "reflexión estoica" and "reflexión estacional" are
// different traditions, "buscar oraciones" and "oraciones" are a button and a
// noun, and "volumen de la voz" vs "velocidad de habla" are different controls.
// Comparing word-by-word across unrelated keys cannot tell those apart.
//
// What IS a defect: two keys whose English values are IDENTICAL, rendered two
// different ways inside one locale. The UI then calls one thing by two names.
// Exact-value matching gives no false positives on the current corpus.
const exact = new Map() // english value -> [key, ...]
for (const [k, v] of en) {
  if (v.length < 2) continue
  if (!exact.has(v)) exact.set(v, [])
  exact.get(v).push(k)
}

console.log('\nterminology drift (identical English rendered two ways in one locale):')
let drift = 0
for (const l of LOCALES) {
  if (l === 'en') continue
  for (const [english, keys] of exact) {
    if (keys.length < 2) continue
    const rendered = new Map()
    for (const k of keys) {
      const t = (tables[l].get(k) || '').trim().toLowerCase()
      if (!t) continue
      if (!rendered.has(t)) rendered.set(t, [])
      rendered.get(t).push(k)
    }
    if (rendered.size < 2) continue
    drift++
    console.log(`  [${l}] ${JSON.stringify(english)} ->`)
    for (const [t, ks] of rendered) {
      console.log(`       ${JSON.stringify(t)}  (${ks.join(', ')})`)
    }
  }
}

console.log('')
console.log(findings ? `${findings} value-level findings, ${drift} terminology groups` : 'no value-level findings')
process.exit(findings ? 1 : 0)