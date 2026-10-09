// The public URL surface, and whether it is still true.
//
// These URLs are not internal wiring. They are:
//   - the origin every share, QR code and deep link is built from
//   - the deletion route the Play listing tells users to visit
//   - the re-upload report route
//
// Nothing asserted any of that. CANONICAL_ORIGIN in src/shared/canonical.js has
// to agree with the og:url and rel=canonical tags in index.html by hand, the
// origin is retyped inside build-legal.mjs, and the delete/report pages are
// generated files that could stop being generated. A drift here is invisible
// until a shared link is wrong or a user is sent to a 404 on the one page that
// matters most to them.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

let fail = 0
const t = (name, fn) => {
  try {
    const detail = fn()
    console.log(`PASS  ${name}${detail ? `  (${detail})` : ''}`)
  } catch (e) {
    fail++
    console.log(`FAIL  ${name}\n        ${e.message}`)
  }
}
const eq = (a, b, msg) => {
  if (a !== b) throw new Error(`${msg}: expected ${b}, got ${a}`)
}

// Read the constants out of the module rather than importing it, so this works
// without a bundler and so it reads the shipped source.
const canonicalSrc = fs.readFileSync(path.join(ROOT, 'src/shared/canonical.js'), 'utf8')
const constOf = (name) => {
  const m = canonicalSrc.match(new RegExp(`export const ${name} = '([^']+)'`))
  if (!m) throw new Error(`${name} is not a plain string constant in canonical.js`)
  return m[1]
}
const ORIGIN = constOf('CANONICAL_ORIGIN')
const DELETE_URL = constOf('DELETE_DATA_URL')
const REPORT_URL = constOf('REPORT_URL')

t('the canonical origin is the production origin, not a dev host', () => {
  if (/localhost|127\.0\.0\.1|example\.com/i.test(ORIGIN)) {
    throw new Error(`CANONICAL_ORIGIN is a development host: ${ORIGIN}`)
  }
  if (!/^https:\/\//.test(ORIGIN)) throw new Error(`not https: ${ORIGIN}`)
  if (ORIGIN.endsWith('/')) throw new Error('has a trailing slash, which would double up in path joins')
  return ORIGIN
})

t('index.html agrees with the canonical origin', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')
  const og = (html.match(/property="og:url"\s+content="([^"]+)"/) || [])[1]
  const canon = (html.match(/rel="canonical"\s+href="([^"]+)"/) || [])[1]
  if (!og) throw new Error('no og:url meta tag in index.html')
  if (!canon) throw new Error('no rel=canonical link in index.html')
  eq(og, `${ORIGIN}/`, 'og:url')
  eq(canon, `${ORIGIN}/`, 'rel=canonical')
  return 'og:url and rel=canonical both match'
})

t('every hard-coded origin in the built legal pages matches', () => {
  // build-legal.mjs retypes the origin rather than importing it, so the two can
  // drift. It has to agree with canonical.js.
  const src = fs.readFileSync(path.join(ROOT, 'scripts/build-legal.mjs'), 'utf8')
  const origins = new Set([...src.matchAll(/https:\/\/([a-z0-9.-]+)\//gi)].map((m) => m[1]))
  if (!origins.size) throw new Error('build-legal.mjs has no absolute origin to check')
  for (const o of origins) {
    if (o !== new URL(ORIGIN).host) throw new Error(`build-legal.mjs points at ${o}, canonical.js says ${new URL(ORIGIN).host}`)
  }
  return `${origins.size} origin(s) agree`
})

t('the delete and report routes are on the canonical origin', () => {
  for (const [name, url] of [['DELETE_DATA_URL', DELETE_URL], ['REPORT_URL', REPORT_URL]]) {
    if (!url.startsWith(`${ORIGIN}/`)) throw new Error(`${name} is ${url}, which is not on ${ORIGIN}`)
  }
  return `${DELETE_URL}  ${REPORT_URL}`
})

t('the page the delete route points at exists', () => {
  // A self-service deletion route is the one link that must never 404: it is
  // what the Play Data Safety declaration relies on.
  const pathPart = new URL(DELETE_URL).pathname.replace(/^\//, '')
  const full = path.join(ROOT, 'public', pathPart)
  if (!fs.existsSync(full)) {
    throw new Error(`${DELETE_URL} -> public/${pathPart} does not exist`)
  }
  const html = fs.readFileSync(full, 'utf8')
  if (html.length < 500) throw new Error('the deletion page is suspiciously short')
  return `public/${pathPart}, ${html.length} bytes`
})

t('the report route resolves to a real anchor on a real page', () => {
  const parsed = new URL(REPORT_URL)
  if (!parsed.hash) throw new Error('REPORT_URL has no anchor, so it cannot open the report section')
  // The page has to exist as a file, not merely respond: a path with no file
  // behind it silently serves the app shell, which is what the old /legal#report
  // did - a 200 that was not the thing the user was sent to.
  const pageFile = path.join(ROOT, 'public', parsed.pathname.replace(/^\//, ''))
  if (!fs.existsSync(pageFile)) {
    throw new Error(`${REPORT_URL} -> public${parsed.pathname} does not exist, so the path serves the app shell`)
  }
  // And the generated page must actually carry the anchor. build-legal.mjs
  // writes it, so check the generator and the built file.
  const generator = fs.readFileSync(path.join(ROOT, 'scripts/build-legal.mjs'), 'utf8')
  const anchor = parsed.hash.slice(1)
  if (!generator.includes(`id="${anchor}"`)) {
    throw new Error(`build-legal.mjs does not emit id="${anchor}", so the anchor cannot resolve`)
  }
  return `${parsed.pathname}#${anchor} exists and is generated`
})

t('the hosted legal pages exist for the privacy policy URL', () => {
  for (const page of ['privacy.html', 'terms.html']) {
    const full = path.join(ROOT, 'public', page)
    if (!fs.existsSync(full)) throw new Error(`public/${page} is missing - the Play privacy policy URL would 404`)
  }
  return 'privacy.html, terms.html'
})

t('no other module retypes the production origin', () => {
  // canonical.js exists precisely so a second copy of the URL is never a second
  // value. Any other module that hard-codes it can drift silently.
  const offenders = []
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === '.git') continue
      const full = path.join(dir, e.name)
      if (e.isDirectory()) { walk(full); continue }
      if (!/\.(jsx?|mjs)$/.test(e.name)) continue
      if (full.endsWith(path.join('src', 'shared', 'canonical.js'))) continue
      // Comments are stripped: a deep-link example in a comment is
      // documentation, and a second literal that ships is what this is for.
      const text = fs
        .readFileSync(full, 'utf8')
        .split('\n')
        .map((line) => line.replace(/\/\/.*$/, '').replace(/^\s*\*.*$/, ''))
        .join('\n')
      const hits = [...text.matchAll(/https:\/\/joining-palms\.app[^\s'"`]*/g)]
      if (hits.length) {
        offenders.push(`${path.relative(ROOT, full)}: ${[...new Set(hits.map((h) => h[0]))].join(', ')}`)
      }
    }
  }
  walk(path.join(ROOT, 'src'))
  if (offenders.length) {
    throw new Error(`hard-coded outside canonical.js - import it instead:\n        ${offenders.join('\n        ')}`)
  }
  return 'canonical.js is the only place the origin appears'
})

console.log('')
console.log(fail ? `${fail} failure(s)` : 'the public URL surface is consistent')
process.exit(fail ? 1 : 0)