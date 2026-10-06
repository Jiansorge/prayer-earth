import { readFileSync } from 'node:fs'
const locales = ['en', 'es', 'fr', 'de', 'hi', 'pt', 'it', 'ru', 'zh', 'ar', 'ja', 'ko', 'vi', 'tl', 'bo']
const keys = {}
for (const loc of locales) {
  const src = readFileSync(`src/locales/${loc}.js`, 'utf8')
  keys[loc] = new Set(src.match(/'([^']+)':/g)?.map((s) => s.slice(1, -2)) || [])
}
const enKeys = [...keys.en]

// No legal.* key is required per locale. legal.langNote is the one a locale may
// translate, and a locale without one falls back to English; every other
// legal.* key is English by design (see i18n.js) and falls back too. The only
// hard requirement is that en carries legal.langNote at all, which is checked
// below.
const mustTranslate = (k) => !k.startsWith('legal.')

let failed = false
console.log(`en has ${enKeys.length} keys`)
if (!keys.en.has('legal.langNote')) {
  failed = true
  console.log('en: MISSING legal.langNote - nothing for other locales to fall back to')
}
for (const loc of locales.slice(1)) {
  const missing = enKeys.filter((k) => mustTranslate(k) && !keys[loc].has(k))
  if (missing.length) {
    failed = true
    console.log(`${loc}: MISSING ${missing.length} keys -> ${missing.join(', ')}`)
  } else console.log(`${loc}: complete`)
}
if (failed) process.exitCode = 1
