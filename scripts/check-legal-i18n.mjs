import fs from 'node:fs'
const NON = ['ar', 'bo', 'hi', 'ja', 'ko', 'ru', 'zh']
// Product/tech loanwords that legitimately stay Latin inside a translated
// sentence. Case-insensitive: Russian and Tibetan both use lowercase "cookie".
const OK = /Cloudflare|Web Analytics|Android|cookie/gi
let bad = 0
for (const l of NON) {
  const s = fs.readFileSync(`src/locales/${l}.js`, 'utf8')
  for (const k of ['priv10', 'priv11']) {
    const m = s.match(new RegExp(`'legal\\.${k}':\\s*'([^']*)'`))
    if (!m) { console.log(`${l} ${k}: MISSING`); bad++; continue }
    const runs = (m[1].replace(OK, '').match(/[A-Za-z]{4,}/g) || [])
    if (runs.length) { console.log(`${l} ${k}: LATIN -> ${runs.join(',')}`); bad++ }
  }
}
console.log(bad === 0
  ? 'legal i18n: clean in all 7 non-latin locales'
  : `legal i18n: ${bad} problem(s)`)
