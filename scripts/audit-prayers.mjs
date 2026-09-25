// Vet every prayer: declared lang vs. the actual script of its text, and
// whether transliteration (s) / translation (e) are present when they should
// be (and absent when redundant). Reports, does not fail the build.
import { SPIRITUALITIES, loadSpirit } from '../src/data/prayers.js'

// Unicode ranges used to fingerprint the dominant script of a text.
const RANGES = {
  Latin: /[A-Za-zÀ-ɏ]/,
  Devanagari: /[ऀ-ॿ]/,
  Bengali: /[ঀ-৿]/,
  Gurmukhi: /[਀-੿]/,
  Gujarati: /[઀-૿]/,
  Tamil: /[஀-௿]/,
  Telugu: /[ఀ-౿]/,
  Kannada: /[ಀ-೿]/,
  Malayalam: /[ഀ-ൿ]/,
  Arabic: /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/,
  Hebrew: /[֐-׿]/,
  Tibetan: /[ༀ-࿿]/,
  Thai: /[฀-๿]/,
  CJK: /[一-鿿㐀-䶿]/,
  Kana: /[぀-ゟ゠-ヿ]/,
  Hangul: /[가-힯ᄀ-ᇿ]/,
  Cyrillic: /[Ѐ-ӿ]/,
  Greek: /[Ͱ-Ͽ]/,
}

function dominantScript(text) {
  if (!text) return null
  const counts = {}
  for (const ch of text) {
    for (const [name, re] of Object.entries(RANGES)) {
      if (re.test(ch)) { counts[name] = (counts[name] || 0) + 1; break }
    }
  }
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1])
  return entries.length ? entries[0][0] : null
}

// Which script(s) are acceptable for a given lang code.
const EXPECTED = {
  sa: ['Devanagari'], hi: ['Devanagari'], mr: ['Devanagari'], ne: ['Devanagari'],
  pi: ['Devanagari', 'Latin'], bn: ['Bengali'], gu: ['Gujarati'], ta: ['Tamil'],
  te: ['Telugu'], kn: ['Kannada'], ml: ['Malayalam'], pa: ['Gurmukhi'],
  ar: ['Arabic'], fa: ['Arabic'], ur: ['Arabic'], ps: ['Arabic'],
  bo: ['Tibetan'], th: ['Thai'], he: ['Hebrew'],
  zh: ['CJK'], ja: ['CJK', 'Kana'], ko: ['Hangul'],
  ru: ['Cyrillic'], uk: ['Cyrillic'], bg: ['Cyrillic'], sr: ['Cyrillic'],
  el: ['Greek'],
}

const NON_LATIN = new Set([
  'sa', 'hi', 'mr', 'ne', 'bn', 'gu', 'ta', 'te', 'kn', 'ml', 'pa', 'ar', 'fa',
  'ur', 'ps', 'bo', 'th', 'he', 'zh', 'ja', 'ko', 'ru', 'uk', 'bg', 'sr', 'el', 'pi'
])

const issues = []
const langTally = {}
let totalPrayers = 0

for (const s of SPIRITUALITIES) await loadSpirit(s.id)
for (const spirit of SPIRITUALITIES) {
  for (const p of spirit.prayers || []) {
    totalPrayers++
    const where = `${spirit.id}/${p.id}`
    const lang = p.lang
    langTally[lang] = (langTally[lang] || 0) + 1
    if (!p.title) issues.push(['no-title', where])
    if (!p.langLabel) issues.push(['no-langLabel', where])
    if (!Array.isArray(p.phrases) || !p.phrases.length) {
      issues.push(['no-phrases', where]); continue
    }
    const nonLatin = NON_LATIN.has(lang)
    let scriptOk = true
    let hasT = 0, hasS = 0, hasE = 0
    // Whether transliteration/translation are *needed* depends on the actual
    // script of the text, not the language code: romanticized Latin Pāli (pi)
    // or romanized chants need no romanization, while a Devanagari/Arabic/
    // Tibetan/CJK original needs both a transliteration and an English meaning.
    let tIsLatin = true
    p.phrases.forEach((ph, i) => {
      if (!ph.t) issues.push(['phrase-missing-t', `${where}#${i}`])
      else {
        hasT++
        const sc = dominantScript(ph.t)
        if (sc && sc !== 'Latin') tIsLatin = false
      }
      if (ph.s) hasS++
      if (ph.e) hasE++
      if (ph.t) {
        const sc = dominantScript(ph.t)
        const exp = EXPECTED[lang]
        if (exp && !exp.includes(sc)) { scriptOk = false; issues.push(['script-mismatch', `${where}#${i}`, `lang=${lang} t-script=${sc} (expected ${exp.join('/')})`]) }
      }
    })
    const needsRomanization = !tIsLatin
    if (needsRomanization && hasS === 0) issues.push(['missing-transliteration', where, `lang=${lang}`])
    if (needsRomanization && hasE === 0) issues.push(['missing-translation', where, `lang=${lang}`])
    if (!nonLatin && lang === 'en' && hasE > 0) {
      // an English prayer only flags a redundant `e` when it merely repeats `t`;
      // a distinct `e` (e.g. the English meaning of a mantra name) is useful.
      const dupE = p.phrases.filter((ph) => ph.e && ph.e === ph.t).length
      if (dupE) issues.push(['redundant-english-e', where, `${dupE} phrase(s) e===t`])
    }
    // Latin-script text does not need a transliteration that just repeats it
    if (!nonLatin && hasS > 0) {
      const dupS = p.phrases.filter((ph) => ph.s && ph.s === ph.t).length
      if (dupS) issues.push(['redundant-latin-s', where, `${dupS} phrase(s) s===t`])
    }
    if (!scriptOk) { /* individual mismatches already reported */ }
  }
}

console.log(`Prayers audited: ${totalPrayers}`)
console.log('Lang distribution:', Object.entries(langTally).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(' '))
console.log(`Issues: ${issues.length}`)
const byType = {}
for (const [type] of issues) byType[type] = (byType[type] || 0) + 1
console.log('By type:', Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join(' ') || 'none')
console.log('--- details (first 80) ---')
for (const row of issues.slice(0, 80)) console.log(' ', row.join(' | '))
if (issues.length > 80) console.log(`  ... +${issues.length - 80} more`)
// Fail the build on any real issue (wrong script for a lang, missing
// transliteration/translation, redundant duplicated text, etc.).
if (issues.length) {
  console.log(`\n[audit-prayers] ${issues.length} issue(s) found — see above.`)
  process.exit(1)
}
console.log('\n[audit-prayers] ALL PRAYERS OK')
process.exit(0)
