// Stale translations: English edited, a locale left behind.
//
// The failure mode this exists for. en.js is the source, so when an English
// string is corrected, every other locale keeps the old wording until somebody
// remembers. Nothing detects it: the i18n audit only checks that the key is
// present, which it is.
//
// This session edited English for the location flip (priv9, priv11 said the
// opposite thing afterwards), added home.shareCopied, and unified two label
// pairs. Each of those is a place where thirteen locales can now be quietly
// describing old behaviour.
//
// Method: compare each locale's committed value for a key against the English in
// the same tree, for a set of keys known to have changed recently, and report
// locales that were not touched in the same commit as their English. Kept to a
// list rather than derived from git history on purpose - the point is to name the
// strings we know we changed, not to guess at all of them.
//
// The legal.* keys are excluded: they are English by design and resolve through en,
// so a locale that lacks them is correct rather than stale.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIR = path.join(ROOT, 'src/locales')

function parse(src) {
  const out = new Map()
  const re = /'((?:[^'\\]|\\.)*)'\s*:\s*'((?:[^'\\]|\\.)*)'/g
  let m
  while ((m = re.exec(src))) out.set(m[1], m[2])
  return out
}

const en = parse(fs.readFileSync(path.join(DIR, 'en.js'), 'utf8'))

// Keys whose English changed in this session. Each is named with why, so a
// reviewer can judge whether the locale text is now wrong rather than merely
// older.
const CHANGED = [
  ['settings.presenceWelcomeBody', 'first-run opt-out prompt added'],
  ['settings.presenceWelcomeTitle', 'first-run opt-out prompt added'],
  ['home.shareCopied', 'new string, share confirmation'],
  ['settings.secPrivacy', 'settings reorganisation'],
  ['settings.secSupport', 'settings reorganisation'],
  ['settings.secData', 'settings reorganisation'],
  ['settings.back', 'settings reorganisation'],
  ['settings.backupRowHint', 'settings reorganisation'],
  ['settings.yourDataRow', 'settings reorganisation'],
  ['settings.yourDataRowHint', 'settings reorganisation'],
  ['settings.deleteDataArmedHint', 'two-step deletion'],
  ['settings.reportCopyLink', 'settings reorganisation'],
  ['settings.privacyOn', 'settings reorganisation'],
  ['settings.privacyOff', 'settings reorganisation']
]

const LOCALES = ['es', 'fr', 'de', 'pt', 'it', 'ru', 'zh', 'ar', 'ja', 'ko', 'hi', 'vi', 'tl', 'bo']

// Which commits touched en.js at all, so we can say whether a locale was carried
// along in the same change.
const touchedTogether = new Map()
const log = execFileSync('git', ['log', '--format=%H', '-40', '--', 'src/locales/en.js'], {
  cwd: ROOT,
  encoding: 'utf8'
})
  .split('\n')
  .filter(Boolean)

let findings = 0
console.log('stale-translation check')
console.log(`  en.js has been changed in ${log.length} of the last 40 commits\n`)

for (const [key, why] of CHANGED) {
  const e = en.get(key)
  if (e === undefined) {
    console.log(`  note  ${key} is no longer in en.js (renamed or removed)`)
    continue
  }
  const missing = []
  for (const l of LOCALES) {
    const t = parse(fs.readFileSync(path.join(DIR, `${l}.js`), 'utf8'))
    if (!t.has(key)) missing.push(l)
  }
  if (missing.length) {
    findings++
    console.log(`  STALE  ${key}  (${why})`)
    console.log(`         en: ${JSON.stringify(e.slice(0, 72))}`)
    console.log(`         absent from: ${missing.join(', ')}`)
  } else {
    console.log(`  ok     ${key}  present in all locales`)
  }
}

console.log('')
console.log(
  findings
    ? `${findings} key(s) where the English changed and some locales are behind`
    : 'no stale keys among the strings changed this session'
)
process.exit(findings ? 1 : 0)