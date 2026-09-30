// Compare what the web suite and the Android suite each verify, so a behaviour
// is not silently covered on one platform only.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const grab = (file, patterns) => {
  const src = readFileSync(file, 'utf8')
  const found = new Set()
  for (const re of patterns) {
    for (const m of src.matchAll(re)) {
      // Normalise: strip backticks, quotes, template interpolation, whitespace.
      found.add(m[1].replace(/[`'"]/g, '').replace(/\$\{[^}]*\}/g, '').replace(/\s+/g, ' ').trim())
    }
  }
  return found
}

const web = grab('scripts/test-usage.mjs', [
  /(?:ok|check)\(\s*\n?\s*[`'"]([^`'"]+)[`'"]/g,
  /ok\(\s*`([^`]+)`/g
])
const units = grab('scripts/test-units.mjs', [/\bt\(\s*\n?\s*[`'"]([^`'"]+)[`'"]/g, /\bt\(\s*'([^']+)'/g])
const backup = grab('scripts/test-backup.mjs', [/\bt\(\s*\n?\s*[`'"]([^`'"]+)[`'"]/g, /\bt\(\s*'([^']+)'/g])
const android = grab('scripts/test-android-device.mjs', [
  /check\(\s*\n?\s*`([^`]+)`/g,
  /check\(\s*'([^']+)'/g
])
const assets = grab('scripts/test-android-assets.mjs', [/\bcheck\(\s*'([^']+)'/g, /\bcheck\(\s*\n?\s*'([^']+)'/g])

const norm = (s) => s.toLowerCase()
  .replace(/`[^`]*`/g, '')
  .replace(/\(.*$/, '')
  .replace(/[^a-z ]/g, '')
  .replace(/\s+/g, ' ')
  .trim()

const webAll = new Set([...web, ...units, ...backup].map(norm).filter((s) => s.length > 8))
const androidAll = new Set([...android, ...assets].map(norm).filter((s) => s.length > 8))

// Loose topic buckets, so a web check with different wording still counts.
const TOPICS = {
  'deep link': ['deep link', 'deeplink', 'shared prayer', 'hash'],
  'persistence / counters survive': ['persist', 'survive', 'counter', 'force-stop', 'upgrade', 'reinstall'],
  'audio playback': ['audio', 'voice', 'recorded', 'reverb', 'element is not paused', 'taras'],
  'ambient / sound controls': ['ambient', 'sound', 'volume', 'preset'],
  'backup export + restore': ['backup', 'recovery', 'restore', 'clipboard'],
  'streak': ['streak'],
  'share': ['share', 'qr'],
  'install prompt': ['install'],
  'keyboard': ['keyboard', 'space', 'shortcut'],
  'offline / malformed state': ['malformed', 'offline', 'corrupt'],
  'settings sheet': ['settings'],
  'onboarding': ['onboard'],
  'backdrop / theme': ['backdrop', 'theme'],
  'errors / exceptions': ['console error', 'exception', 'boundary', 'unhandled'],
  'location / privacy': ['location', 'coarse', 'permission', 'fine'],
  'app-shell vs web': ['app shell', 'impossible download', 'installed']
}

const has = (set, words) => words.some((w) => [...set].some((s) => s.includes(w)))

console.log('TOPIC'.padEnd(30) + 'WEB'.padEnd(7) + 'ANDROID')
console.log('-'.repeat(48))
const gaps = []
for (const [topic, words] of Object.entries(TOPICS)) {
  const w = has(webAll, words)
  const a = has(androidAll, words)
  if (!a && w) gaps.push(topic)
  console.log(topic.padEnd(30) + (w ? 'yes' : '--').padEnd(7) + (a ? 'yes' : '--'))
}
console.log('\nCovered on web but NOT on Android:')
console.log(gaps.length ? gaps.map((g) => '  - ' + g).join('\n') : '  (none)')
