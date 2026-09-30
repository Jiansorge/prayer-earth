// Built-asset audit — runs against dist/ AFTER vite build + inline-css.
//
// Guards two Lighthouse/security invariants that are silent to CI otherwise:
//   1. dist/index.html must not contain any executable inline <script> — the
//      served CSP (script-src 'self' https://static.cloudflareinsights.com, no
//      'unsafe-inline') would otherwise block it and light up console errors,
//      dragging the Best Practices score. The only allowed inline script is the
//      type="application/ld+json" structured data (harmless data block).
//   2. The service-worker precache (public/sw.js CORE) must include the beacon
//      loader + the responsive prayer icon sizes, so the offline/Lighthouse
//      promise of a fully precached shell holds.
// Exit code 1 on any violation.

import { readFileSync, existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIST = path.join(ROOT, 'dist')

let fails = 0
const check = (name, ok, extra = '') => {
  if (ok) console.log(`[audit] PASS  ${name}${extra ? ` (${extra})` : ''}`)
  else {
    fails += 1
    console.log(`[audit] FAIL  ${name}${extra ? ` (${extra})` : ''}`)
  }
}

if (!existsSync(path.join(DIST, 'index.html'))) {
  console.error('[audit] no dist/index.html — run `npm run build` first.')
  process.exit(1)
}

// 1. No executable inline scripts in the shipped HTML.
const html = readFileSync(path.join(DIST, 'index.html'), 'utf8')
const scripts = [...html.matchAll(/<script\b([^>]*)>/gi)]
const bad = scripts.filter(
  (m) => !/>\s*<\//i.test(m[0]) && !/type\s*=\s*["']application\/ld\+json["']/i.test(m[1]) && !/\bsrc\s*=/i.test(m[1])
)
check('no executable inline <script> in dist/index.html', bad.length === 0, bad.map((m) => m[0].slice(0, 60)).join(' | ') || 'none')

// The entry stylesheet must be inlined, not a separate render-blocking request.
const cssLinks = [...html.matchAll(/<link[^>]*\brel="stylesheet"/gi)]
check('entry CSS inlined (no render-blocking <link rel=stylesheet>)', cssLinks.length === 0, cssLinks.map((m) => m[0].slice(0, 60)).join(' | ') || 'none')

const assetDir = path.join(DIST, 'assets')
const missingCss = []
for (const file of readdirSync(assetDir)) {
  if (!file.endsWith('.js')) continue
  const source = readFileSync(path.join(assetDir, file), 'utf8')
  for (const match of source.matchAll(/assets\/[^"'`\s]+\.css/g)) {
    const asset = match[0].replace(/^assets\//, '')
    if (!existsSync(path.join(assetDir, asset))) missingCss.push(`${file}:${match[0]}`)
  }
}
check('lazy preload CSS targets exist', missingCss.length === 0, missingCss.join(' | ') || 'none')

// 2. SW CORE precache holds the beacon loader + responsive icons.
const swPath = path.join(DIST, 'sw.js')
const swPresent = existsSync(swPath)
check('dist/sw.js exists', swPresent)
if (swPresent) {
  const sw = readFileSync(swPath, 'utf8')
  const core = sw.match(/\bCORE\s*=\s*\[([^]*?)\]/)?.[1] || ''
  for (const entry of ['/analytics-loader.js', '/icons/icon-prayer-64.webp', '/icons/icon-prayer-128.webp', '/icons/icon-prayer-256.webp']) {
    check(`SW CORE precaches ${entry}`, core.includes(`'${entry}'`))
  }
}

// 3. No test hooks in a RELEASE bundle. window.__store / __speech / __ambient
// are full read/write handles on prayer state and the audio engines, so shipping
// one hands a stranger the user's data and their identity. They are gated at
// build time (shared/testHooks.js).
//
// Two builds exist on purpose: `build:capacitor` leaves the hooks ON so the
// on-device smoke test can drive the app; `build:release` forces them OFF. So
// this is a hard failure only when the caller says it is auditing a release
// (build-release.mjs sets AUDIT_REQUIRE_NO_HOOKS=1). Otherwise it reports the
// state, so a deliberately-hooked capacitor build is not falsely failed.
{
  const leaks = []
  for (const file of readdirSync(assetDir)) {
    if (!file.endsWith('.js')) continue
    const source = readFileSync(path.join(assetDir, file), 'utf8')
    // `__speechAudio` is the hidden <audio> element's DOM id, not the hook.
    for (const hook of ['__store', '__speech', '__ambient']) {
      const re = new RegExp(`window\\s*\\.\\s*${hook}\\b|\\b${hook}\\s*=`)
      if (re.test(source)) leaks.push(`${file}: ${hook}`)
    }
  }
  if (process.env.AUDIT_REQUIRE_NO_HOOKS === '1') {
    check('RELEASE bundle has no test hooks (window.__store/__speech/__ambient)',
      leaks.length === 0, leaks.join(' | ') || 'clean')
  } else {
    console.log(leaks.length === 0
      ? '[audit] INFO  no test hooks in this bundle (clean)'
      : `[audit] INFO  ${leaks.length} test hook(s) present - expected for build:capacitor, FORBIDDEN for a release. Publish with: npm run build:release`)
  }
}

// 4. The app's own code must be minified, so a copy of the Play build is not a
// readable source drop. Third-party vendor chunks (notably three.js) are
// open-source and readable by nature, so they are exempt -- chasing them would
// only add build fragility for no confidentiality gain.
{
  const appChunks = readdirSync(assetDir).filter((f) => f.endsWith('.js') && !f.startsWith('three-'))
  const readable = []
  for (const file of appChunks) {
    const source = readFileSync(path.join(assetDir, file), 'utf8')
    const lines = source.split('\n').length
    // A minified chunk is a handful of very long lines. A file with many short
    // lines is unminified app code.
    const longest = Math.max(...source.split('\n').map((l) => l.length))
    if (lines > 40 && longest < 2000) readable.push(`${file} (${lines} lines, longest ${longest})`)
  }
  check('app code is minified (no readable source drop)', readable.length === 0,
    readable.join(' | ') || `${appChunks.length} chunks checked`)
}

console.log(fails === 0 ? '\n[audit] ALL CHECKS PASSED' : `\n[audit] ${fails} check(s) FAILED`)
process.exit(fails === 0 ? 0 : 1)