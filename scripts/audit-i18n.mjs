import { readFileSync } from 'node:fs'
const locales = ['en', 'es', 'fr', 'de', 'hi', 'pt', 'it', 'ru', 'zh', 'ar', 'ja', 'ko']
const keys = {}
for (const loc of locales) {
  const src = readFileSync(`src/locales/${loc}.js`, 'utf8')
  keys[loc] = new Set(src.match(/'([^']+)':/g)?.map((s) => s.slice(1, -2)) || [])
}
const enKeys = [...keys.en]
console.log(`en has ${enKeys.length} keys`)
for (const loc of locales.slice(1)) {
  const missing = enKeys.filter((k) => !keys[loc].has(k))
  if (missing.length) console.log(`${loc}: MISSING ${missing.length} keys -> ${missing.join(', ')}`)
  else console.log(`${loc}: complete`)
}
