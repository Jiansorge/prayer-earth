// The prayer count must be true everywhere it is stated.
//
// This exists because the count was wrong for a long time and nothing noticed.
// scripts/store-listing.mjs counted every `id:` in each spirit file, which also
// matched the spirit's own top-level id, so the Play listing - in all fifteen
// languages - said 273 when the app shipped 254. The error was exactly the number
// of traditions, so it grew every time a tradition was added and looked
// plausible.
//
// Three separate places declare a number, and all of them drifted at once:
//   - src/data/prayers.js          prayerCount, shown on the home tile
//   - scripts/store-listing.mjs    the Play listing, in 15 languages
//   - README.md                    the headline figures
//
// So this asserts them against the actual data rather than against each other.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SPIRITS = path.join(ROOT, 'src/data/spirits')

let fail = 0
const t = (name, fn) => {
  try {
    const detail = fn()
    console.log(`[counts] PASS  ${name}${detail ? `  (${detail})` : ''}`)
  } catch (e) {
    fail++
    console.log(`[counts] FAIL  ${name}\n         ${e.message}`)
  }
}
const eq = (a, b, msg) => {
  if (a !== b) throw new Error(`${msg}: expected ${b}, got ${a}`)
}

// The truth: ids INSIDE each spirit's `prayers: [` array. Deliberately not a
// whole-file pattern - that is the bug this file exists to keep fixed.
const actual = new Map()
let total = 0
for (const f of fs.readdirSync(SPIRITS).filter((f) => f.endsWith('.js'))) {
  const src = fs.readFileSync(path.join(SPIRITS, f), 'utf8')
  const start = src.indexOf('prayers: [')
  const body = start >= 0 ? src.slice(start) : ''
  const ids = [...body.matchAll(/id:\s*'([^']+)'/g)].map((m) => m[1])
  actual.set(f.replace('.js', ''), ids.length)
  total += ids.length
}
const traditions = actual.size
console.log(`[counts] ${total} prayers across ${traditions} traditions`)

// 1. prayers.js prayerCount, per tradition.
t('every prayerCount in prayers.js matches the real count', () => {
  const src = fs.readFileSync(path.join(ROOT, 'src/data/prayers.js'), 'utf8')
  const declared = new Map(
    [...src.matchAll(/id:\s*'([a-z]+)'[\s\S]{0,200}?prayerCount:\s*(\d+)/g)].map((m) => [m[1], Number(m[2])])
  )
  const wrong = []
  for (const [id, real] of actual) {
    if (!declared.has(id)) { wrong.push(`${id}: not declared at all (real ${real})`); continue }
    if (declared.get(id) !== real) wrong.push(`${id}: declared ${declared.get(id)}, real ${real}`)
  }
  for (const id of declared.keys()) {
    if (!actual.has(id)) wrong.push(`${id}: declared but has no spirit file`)
  }
  if (wrong.length) throw new Error(wrong.join('; '))
  return `${declared.size} traditions checked`
})

// 2. The generator's source must not count whole files again. This is the exact
// shape of the original bug, so it is worth pinning even though test 4 already
// checks the generator's output end to end.
t('the store listing no longer counts ids from the whole file', () => {
  const src = fs.readFileSync(path.join(ROOT, 'scripts/store-listing.mjs'), 'utf8')
  const body = src.slice(src.indexOf('prayerCount = 0'))
  if (body.includes("readFileSync(path.join(SPIRITS_DIR, f), 'utf8')") && !body.includes('prayers: [')) {
    throw new Error('store-listing.mjs counts ids without restricting to the prayers array')
  }
  if (!body.includes('prayers: [')) {
    throw new Error('store-listing.mjs no longer restricts the count to the prayers array')
  }
  return 'counts inside prayers: ['
})

// 3. README figures.
t('README quotes the real totals', () => {
  const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8')
  const prayersClaim = readme.match(/\*\*(\d+)\s+prayers\*\*/i)
  if (!prayersClaim) throw new Error('README states no prayer count')
  eq(Number(prayersClaim[1]), total, 'README prayer count')
  const tradClaim = readme.match(/\*\*(\d+)\s+traditions\*\*/i)
  if (!tradClaim) throw new Error('README states no tradition count')
  eq(Number(tradClaim[1]), traditions, 'README tradition count')
  return `${prayersClaim[1]} prayers / ${tradClaim[1]} traditions`
})

// 4. The generated Play CSV, which is what actually gets uploaded.
t('the generated Play CSV states the real total', () => {
  const csvPath = path.join(ROOT, 'dist-store/play-listing-translations.csv')
  if (!fs.existsSync(csvPath)) {
    throw new Error('dist-store/play-listing-translations.csv is missing - run: npm run build:play-translations')
  }
  const csv = fs.readFileSync(csvPath, 'utf8').replace(/^\uFEFF/, '')
  const claimed = new Set(
    [...csv.matchAll(/(\d+)\s+(?:prayers|oraciones|Gebete|orações|preghier|oraisons)/gi)].map((m) => Number(m[1]))
  )
  const wrong = [...claimed].filter((n) => n !== total)
  if (wrong.length) throw new Error(`CSV says ${wrong.join(', ')}, reality is ${total}`)
  if (!claimed.size) throw new Error('no prayer count found in the CSV')
  return `${claimed.size} language rows agree on ${total}`
})

// 5. Nothing anywhere is quoting the old, inflated number.
//
// Comments are stripped first, and that matters: store-listing.mjs contains a
// comment that deliberately quotes the historical "145 prayers" figure to explain
// why the numbers must not be hand-kept. Flagging that would be flagging the
// explanation of the bug as another instance of it.
t('no file still quotes a superseded prayer count', () => {
  const stale = []
  const stripComments = (text) =>
    text
      .split('\n')
      .map((line) => line.replace(/\/\/.*$/, '').replace(/^\s*\*.*$/, '').replace(/^\s*#.*$/, ''))
      .join('\n')
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === '.git' || e.name === 'build' || e.name === 'dist') continue
      const full = path.join(dir, e.name)
      if (e.isDirectory()) { walk(full); continue }
      if (!/\.(mjs|js|jsx|md|yml|json)$/.test(e.name)) continue
      // This file quotes the superseded figures on purpose, to explain them.
      if (path.relative(ROOT, full) === 'scripts/audit-counts.mjs') continue
      const text = stripComments(fs.readFileSync(full, 'utf8'))
      for (const m of text.matchAll(/(\d{3})\s+prayers/g)) {
        const n = Number(m[1])
        if (n !== total && n !== total + traditions) {
          stale.push(`${path.relative(ROOT, full)}: "${m[0]}"`)
        }
      }
    }
  }
  walk(ROOT)
  if (stale.length) throw new Error(stale.join('; '))
  return 'no stale figures outside comments'
})

console.log('')
console.log(fail ? `[counts] ${fail} failure(s)` : '[counts] every stated count is true')
process.exit(fail ? 1 : 0)