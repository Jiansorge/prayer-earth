// Audit src/i18n/prayerL10n.js, which no suite has ever looked at.
//
// This file holds the actual translated prayer and phrase text - the words
// people are repeating, not UI chrome. It was the only source file in src/ that
// no test script named, and it carries the three defect classes that turned up
// real bugs elsewhere in this repo:
//
//   1. DUPLICATE KEYS. The file is an object literal keyed by the English text,
//      and a repeated English phrase means the second translation silently wins.
//      The same class of bug shipped in zh.js, where a duplicate key served a
//      mojibake copy of the intended string.
//   2. CROSS-SCRIPT CONTAMINATION. A correct-looking sentence in the wrong
//      language - which is how Japanese shipped with a Korean word in it.
//   3. MOJIBAKE. Replacement characters, or UTF-8 read as Latin-1.
//
// It is also the one file where a defect matters most, so the checks are strict
// rather than advisory.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const FILE = path.join(ROOT, 'src/i18n/prayerL10n.js')
const src = fs.readFileSync(FILE, 'utf8')

const S = {
  latin: /[A-Za-z]/,
  han: /[\u4E00-\u9FFF]/,
  kana: /[\u3040-\u30FF]/,
  hangul: /[\uAC00-\uD7AF\u1100-\u11FF]/,
  cyrillic: /[\u0400-\u04FF]/,
  arabic: /[\u0600-\u06FF]/,
  devanagari: /[\u0900-\u097F]/,
  tibetan: /[\u0F00-\u0FFF]/
}
const ALLOWED = {
  es: ['latin'], fr: ['latin'], de: ['latin'], pt: ['latin'], it: ['latin'],
  ru: ['cyrillic', 'latin'], zh: ['han', 'latin'], ja: ['han', 'kana', 'latin'],
  ko: ['hangul', 'han', 'latin'], ar: ['arabic', 'latin'], hi: ['devanagari', 'latin']
}

let findings = 0
const report = (kind, where, detail) => {
  findings++
  console.log(`  ${kind}\n      ${where}\n      ${detail}\n`)
}

// --- 1. duplicate keys -----------------------------------------------------
// Top-level entries are `  'English phrase': { ... },`. Count them.
const entryRe = /^([ \t]*)'((?:[^'\\]|\\.)*)'\s*:\s*\{/gm
const seen = new Map()
let m
while ((m = entryRe.exec(src))) {
  const key = m[2]
  if (seen.has(key)) {
    report('DUPLICATE KEY', `phrase ${JSON.stringify(key.slice(0, 60))}`,
      `defined again at line ${src.slice(0, m.index).split('\n').length} - the second one wins silently`)
  } else {
    seen.set(key, true)
  }
}
console.log(`duplicate check: ${seen.size} distinct phrases`)

// --- 2 & 3. per-locale value checks ---------------------------------------
// Inside each entry, `xx: '...'`.
const localesSeen = new Set()
const lineOf = (index) => src.slice(0, index).split('\n').length

let scan = 0
while ((scan = src.indexOf("': {", scan + 1)) !== -1) {
  const bodyStart = src.indexOf('{', scan)
  const bodyEnd = src.indexOf('}', bodyStart)
  if (bodyEnd < 0) continue
  const body = src.slice(bodyStart, bodyEnd)
  const valueRe = /\b(es|fr|de|pt|it|ru|zh|ar|ja|ko|hi)\s*:\s*'((?:[^'\\]|\\.)*)'/g
  let v
  while ((v = valueRe.exec(body))) {
    const loc = v[1]
    const val = v[2]
    localesSeen.add(loc)

    if (val.includes('\uFFFD')) {
      report('MOJIBAKE', `${loc} @ line ${lineOf(bodyStart + v.index)}`,
        `contains a replacement character: ${JSON.stringify(val.slice(0, 50))}`)
    }
    if (/[\u00C2-\u00C3]|[\u00E0-\u00EF]{1,2}[\u0080-\u00BF]/.test(val) && !/[a-z]/i.test(val)) {
      report('SUSPECT MOJIBAKE', `${loc} @ line ${lineOf(bodyStart + v.index)}`,
        `looks like UTF-8 read as Latin-1: ${JSON.stringify(val.slice(0, 50))}`)
    }
    const foreign = Object.keys(S).filter((s) => S[s].test(val) && !ALLOWED[loc].includes(s))
    if (foreign.length) {
      report('CROSS-SCRIPT', `${loc} @ line ${lineOf(bodyStart + v.index)}`,
        `contains ${foreign.join(', ')}: ${JSON.stringify(val.slice(0, 60))}`)
    }
  }
}

console.log(`locales present: ${[...localesSeen].sort().join(', ')}`)
const missing = Object.keys(ALLOWED).filter((l) => !localesSeen.has(l))
if (missing.length) {
  console.log(`locales with no phrase translations: ${missing.join(', ')} (the file documents this as deliberate)`)
}
console.log('')
console.log(findings ? `${findings} findings` : 'no findings')
process.exit(findings ? 1 : 0)