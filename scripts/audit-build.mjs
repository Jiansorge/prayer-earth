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

import { readFileSync, existsSync } from 'node:fs'
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

console.log(fails === 0 ? '\n[audit] ALL CHECKS PASSED' : `\n[audit] ${fails} check(s) FAILED`)
process.exit(fails === 0 ? 0 : 1)