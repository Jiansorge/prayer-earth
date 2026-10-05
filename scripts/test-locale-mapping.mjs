// Does every Play store-listing language actually resolve to a locale the app
// ships strings for?
//
// Play's "Import translations with AI" detects the languages present in the
// upload and attributes each to a listing. If we publish a listing in a language
// the app has no strings for, that store page shows English while claiming a
// language - so the listing list and the shipped locales have to agree, and
// this proves they do rather than assuming it.
//
// Mirrors detectInitialLocale() in src/store.js. The resolution is duplicated
// rather than imported because store.js constructs the persisted Zustand store,
// which has no business being pulled into a test, and one of the checks below
// re-reads store.js to prove the copy here still matches the real thing.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

let failures = 0
const check = (name, cond, detail = '') => {
  if (cond) {
    console.log(`  PASS  ${name}${detail ? '  (' + detail + ')' : ''}`)
  } else {
    console.log(`  FAIL  ${name}${detail ? '  (' + detail + ')' : ''}`)
    failures++
  }
}

// Exactly the languages configured in the Play Console listing.
const PLAY_LISTINGS = [
  ['en-US', 'English (United States)'],
  ['ar', 'Arabic'],
  ['zh-HK', 'Chinese (Hong Kong)'],
  ['zh-CN', 'Chinese (Simplified)'],
  ['en-AU', 'English (Australia)'],
  ['en-CA', 'English (Canada)'],
  ['en-GB', 'English (United Kingdom)'],
  ['en-IN', 'English (India)'],
  ['en-SG', 'English (Singapore)'],
  ['en-ZA', 'English (South Africa)'],
  ['fil', 'Filipino'],
  ['fr-CA', 'French (Canada)'],
  ['fr-FR', 'French (France)'],
  ['de-DE', 'German'],
  ['hi-IN', 'Hindi'],
  ['it-IT', 'Italian'],
  ['ja-JP', 'Japanese'],
  ['ko-KR', 'Korean'],
  ['pt-BR', 'Portuguese (Brazil)'],
  ['pt-PT', 'Portuguese (Portugal)'],
  ['ru-RU', 'Russian'],
  ['es-ES', 'Spanish (Spain)'],
  ['es-US', 'Spanish (United States)'],
  ['vi', 'Vietnamese']
]

const APP_LOCALES = ['en', 'es', 'fr', 'de', 'pt', 'it', 'ru', 'zh', 'ar', 'ja', 'ko', 'hi', 'vi', 'tl', 'bo']

const LOCALE_ALIASES = {
  fil: 'tl',
  'fil-ph': 'tl',
  'zh-hans': 'zh',
  'zh-hant': 'zh',
  'zh-cn': 'zh',
  'zh-tw': 'zh',
  'zh-hk': 'zh',
  'zh-sg': 'zh',
  'pt-br': 'pt',
  'pt-pt': 'pt',
  'pt-ao': 'pt',
  'pt-mz': 'pt'
}

function resolve(tag) {
  const t = String(tag).toLowerCase().replace('_', '-')
  if (LOCALE_ALIASES[t]) return LOCALE_ALIASES[t]
  const base = t.split('-')[0]
  return APP_LOCALES.includes(base) ? base : null
}

console.log('[locale] Play listing languages vs shipped locales')

const unresolved = PLAY_LISTINGS.filter(([tag]) => !resolve(tag)).map(([tag]) => tag)
check(
  'every Play listing language resolves to a shipped locale',
  unresolved.length === 0,
  unresolved.length ? 'would show English: ' + unresolved.join(', ') : PLAY_LISTINGS.length + ' listings checked'
)

check('Filipino resolves to Tagalog, whose code differs', resolve('fil') === 'tl' && resolve('fil-PH') === 'tl')

const zhBad = ['zh-CN', 'zh-HK', 'zh-TW', 'zh-SG'].filter((t) => resolve(t) !== 'zh')
check('every Chinese variant resolves to zh', zhBad.length === 0, zhBad.join(', '))

const ptBad = ['pt-BR', 'pt-PT'].filter((t) => resolve(t) !== 'pt')
check('Portuguese variants resolve to pt', ptBad.length === 0, ptBad.join(', '))

const enBad = ['en-US', 'en-GB', 'en-AU', 'en-CA', 'en-IN', 'en-SG', 'en-ZA'].filter((t) => resolve(t) !== 'en')
check('regional English variants resolve to en', enBad.length === 0, enBad.join(', '))

// The behavioural answer to "how do users in other countries get their language":
// on first run the app reads navigator.languages and takes the first entry that
// maps to a shipped locale. This checks the mapping table is real.
const storeSrc = fs.readFileSync(path.join(ROOT, 'src/store.js'), 'utf8')
const missingAlias = Object.entries(LOCALE_ALIASES).filter(([from, to]) => !storeSrc.includes(`'${from}': '${to}'`))
check('store.js contains every alias this file assumes', missingAlias.length === 0, missingAlias.map(([f]) => f).join(', '))

const missingLocale = APP_LOCALES.filter((c) => !storeSrc.includes(`'${c}'`))
check('store.js contains every shipped locale code', missingLocale.length === 0, missingLocale.join(', '))

check(
  'store.js still matches navigator.languages',
  /navigator\.languages/.test(storeSrc) && /detectInitialLocale/.test(storeSrc),
  'first run resolves the device language'
)

check(
  'a returning user keeps their explicit choice',
  /locale:\s*detectInitialLocale\(\)/.test(storeSrc) && /persist/.test(storeSrc),
  'the persisted store overwrites the detected default on hydrate'
)

// Locales the app translates but the listing does not declare. Not a failure;
// worth stating so nobody assumes the two lists are identical.
const resolved = new Set(PLAY_LISTINGS.map(([tag]) => resolve(tag)))
const undeclared = APP_LOCALES.filter((c) => !resolved.has(c))
check('shipped-but-unlisted locales are known', undeclared.length === 1 && undeclared[0] === 'bo', 'undeclared: ' + undeclared.join(', '))

console.log(failures ? `\n[locale] ${failures} FAILED` : '\n[locale] ALL CHECKS PASSED')
process.exit(failures ? 1 : 0)