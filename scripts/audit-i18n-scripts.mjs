// Cross-script contamination.
//
// The first version of this flagged every kanji string in ja.js as "foreign
// script", which is nonsense: Japanese is written with Han characters plus
// kana, and Korean legitimately uses hanja (인(仁) is correct Korean, not
// contamination). 289 "findings" of which 3 were real.
//
// The rule that works: every locale is ALLOWED its own scripts plus Latin (for
// the product name, AGPL, GDPR, QR). Any other script is contamination, because
// it means text from a different language was pasted in.
import fs from 'node:fs'
import path from 'node:path'

const DIR = 'src/locales'

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

// Which scripts each locale may legitimately use.
// ja writes with Han + kana; ko uses Hangul + hanja. Everything else is strict.
const ALLOWED = {
  en: ['latin'],
  es: ['latin'],
  fr: ['latin'],
  de: ['latin'],
  pt: ['latin'],
  it: ['latin'],
  tl: ['latin'],
  vi: ['latin'],
  ru: ['cyrillic', 'latin'],
  zh: ['han', 'latin'],
  ja: ['han', 'kana', 'latin'],
  ko: ['hangul', 'han', 'latin'],
  ar: ['arabic', 'latin'],
  hi: ['devanagari', 'latin'],
  bo: ['tibetan', 'latin']
}

// Pull every `'key': 'value'` pair, handling the two-line form where the value
// sits on the following line.
function parse(src) {
  const out = []
  const lines = src.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const m = /^([ \t]*)'((?:[^'\\]|\\.)*)'\s*:\s*(.*)$/.exec(lines[i])
    if (!m) continue
    let value = m[3]
    const rest = m[3].match(/^'((?:[^'\\]|\\.)*)'/)
    if (rest) {
      value = rest[1]
    } else {
      // value continues on the next line
      const next = lines[i + 1] || ''
      const v = next.match(/^\s*'((?:[^'\\]|\\.)*)'/)
      if (v) value = v[1]
    }
    out.push([m[2], value])
  }
  return out
}

let findings = 0
for (const [locale, allowed] of Object.entries(ALLOWED)) {
  const src = fs.readFileSync(path.join(DIR, `${locale}.js`), 'utf8')
  for (const [key, value] of parse(src)) {
    const foreign = Object.keys(S).filter((s) => S[s].test(value) && !allowed.includes(s))
    if (foreign.length) {
      findings++
      const where = []
      if (S.latin.test(value) && !allowed.includes('latin')) where.push('latin')
      // Name the specific offending run so it can be found by eye.
      const sample = foreign
        .map((s) => {
          const m = new RegExp(
            '[\\u4E00-\\u9FFF\\u3040-\\u30FF\\uAC00-\\uD7AF\\u0400-\\u04FF\\u0600-\\u06FF\\u0900-\\u097F\\u0F00-\\u0FFF]+'
          ).exec(value)
          return m ? m[0] : ''
        })
        .filter(Boolean)
        .slice(0, 2)
      console.log(
        `  [${locale}] ${key}\n      foreign script: ${foreign.join(', ')}` +
          (sample.length ? `\n      offending run: ${sample.join(' / ')}` : '') +
          `\n      value: ${JSON.stringify(value.slice(0, 110))}\n`
      )
    }
  }
}

console.log(findings ? `${findings} cross-script findings` : 'no cross-script contamination')
process.exit(findings ? 1 : 0)