// Production smoke test: drives the built app (vite preview or a LIVE url
// via APP_URL) and checks the shell renders, deep links work, the service
// worker registers, and no console errors occur. Unlike test-usage.mjs this
// does NOT depend on the dev-only window.__store handle.
//
// Run:  npm run build && node scripts/test-prod.mjs
// Live: APP_URL=https://joining-palms.app node scripts/test-prod.mjs
//
// sync-engine's deploy-app.mjs runs this against the freshly deployed site
// as a post-deploy gate (skip with --skip-smoke there): /health, /stats and
// the version contract can all pass while the app shell itself is broken,
// and nothing else in the pipeline opens the page that was just shipped.

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import WebSocket from 'ws'
import buddhism from '../src/data/spirits/buddhism.js'

const APP = process.env.APP_URL || 'http://localhost:4173'
const DEBUG_PORT = 9237
// os.tmpdir(), not process.env.TEMP: TEMP is Windows-only, and on the Linux
// CI runner the old template produced a literal "undefined\pe-prod-..."
// directory inside the repo.
const PROFILE = path.join(os.tmpdir(), `pe-prod-${Date.now()}`)

// Browser: this runs on the Windows dev box (Edge), the Linux CI runner
// (Chrome), and possibly macOS. Pick the first candidate that exists;
// BROWSER_BIN overrides. Not finding one is a hard failure on purpose - a
// gate that silently skips itself is not a gate.
const candidates = process.env.BROWSER_BIN
  ? [process.env.BROWSER_BIN]
  : process.platform === 'win32'
    ? [
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      ]
    : process.platform === 'darwin'
      ? [
          '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
          '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
        ]
      : [
          '/usr/bin/google-chrome',
          '/usr/bin/google-chrome-stable',
          '/usr/bin/chromium-browser',
          '/usr/bin/chromium',
        ]
const BROWSER = candidates.find((c) => existsSync(c))
if (!BROWSER) {
  console.error(`[prod] FAIL  no browser found (looked for: ${candidates.join(', ')}) — set BROWSER_BIN`)
  process.exit(1)
}

let fails = 0
const ok = (name, cond, extra = '') => {
  if (cond) console.log(`[prod] PASS  ${name}${extra ? ` (${extra})` : ''}`)
  else {
    fails += 1
    console.log(`[prod] FAIL  ${name}${extra ? ` (${extra})` : ''}`)
  }
}

// CI runners block Chrome's setuid sandbox in some configurations; only add
// the escape hatch there so local runs keep the sandbox.
const ciFlags = process.env.CI ? ['--no-sandbox', '--disable-dev-shm-usage'] : []
const edge = spawn(BROWSER, [
  '--headless=new', '--disable-gpu', '--mute-audio', '--no-first-run', ...ciFlags,
  `--user-data-dir=${PROFILE}`, `--remote-debugging-port=${DEBUG_PORT}`, 'about:blank'
])
// Keep the browser's own output instead of dropping it: when the launch fails
// (missing shared libs, crash, profile lock) the only evidence is on stderr,
// and a bare `no CDP` gave the deploy log nothing to diagnose from. Capped so
// a chatty browser can't bloat the log.
const browserLog = []
const capLog = (chunk) => {
  browserLog.push(chunk.toString())
  if (browserLog.length > 40) browserLog.splice(0, browserLog.length - 40)
}
edge.stdout.on('data', capLog)
edge.stderr.on('data', capLog)
let browserExit = null
edge.on('exit', (code, signal) => { browserExit = code === null ? `signal ${signal}` : `code ${code}` })
// Any throw below (no CDP, CDP error) must not leave a headless browser
// behind: the deploy gate runs this on CI and locally, and leaked instances
// accumulate across retries. Runs on normal exit too (kill is idempotent).
process.on('exit', () => { try { edge.kill() } catch {} })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// 30s (120 x 250ms), not 10s: the runner is busy right after `wrangler deploy`
// and a cold Chrome with a fresh profile can take several seconds to open the
// debugging port. An early process exit fails fast below instead of waiting
// the full window.
let cdpUrl = null
for (let i = 0; i < 120; i++) {
  if (browserExit !== null) break
  try {
    const list = await (await fetch(`http://localhost:${DEBUG_PORT}/json`)).json()
    const p = list.find((t) => t.type === 'page')
    if (p) { cdpUrl = p.webSocketDebuggerUrl; break }
  } catch {}
  await sleep(250)
}
if (!cdpUrl) {
  const tail = browserLog.join('').trim().split('\n').slice(-15).join('\n')
  throw new Error(
    `no CDP (browser ${browserExit === null ? 'still running after 30s' : `exited early: ${browserExit}`}` +
    `${tail ? `\n--- browser output ---\n${tail}` : '\n--- browser produced no output ---'})`
  )
}

const ws = new WebSocket(cdpUrl)
await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej) })
let id = 0
const pending = new Map()
const events = []
ws.on('message', (raw) => {
  const m = JSON.parse(raw.toString())
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id) }
  else if (m.method) events.push(m)
})
const send = (method, params = {}) => new Promise((res) => {
  const i = ++id
  pending.set(i, res)
  ws.send(JSON.stringify({ id: i, method, params }))
})
const evaljs = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
  if (r?.exceptionDetails) return { err: r.exceptionDetails.exception?.description || r.exceptionDetails.text }
  return r?.result?.value
}
const waitFor = async (expr, timeout = 10000) => {
  const t0 = Date.now()
  while (Date.now() - t0 < timeout) {
    const v = await evaljs(expr)
    if (v && !v.err) return v
    await sleep(150)
  }
  return null
}

await send('Runtime.enable')
await send('Page.enable')

// ---- home loads ----
await send('Page.navigate', { url: `${APP}/#/` })
const home = await waitFor(`!!document.querySelector('.spirit-grid') || !!document.querySelector('.onboard')`)
ok('home (or onboarding) renders', !!home)
// dismiss onboarding if present
const skipped = await evaljs(`(() => { const b = document.querySelector('.onboard .skip, .onboard [class*=skip], .onboard button'); if (b) { b.click(); return true } return false })()`)
await waitFor(`!!document.querySelector('.spirit-grid')`, 5000)
ok('home grid renders', !!(await evaljs(`!!document.querySelector('.spirit-grid')`)))

// no fatal console errors on load
const errs1 = events.filter((e) => e.method === 'Runtime.exceptionThrown').length
ok('no page exceptions on home', errs1 === 0, `n=${errs1}`)

// ---- service worker registers (prod only) ----
const sw = await waitFor(`navigator.serviceWorker && navigator.serviceWorker.ready.then(() => true).catch(() => false)`, 12000)
ok('service worker registered', sw === true)

// ---- deep link: prayer view ----
await send('Page.navigate', { url: `${APP}/#/pray/buddhism/mani` })
const prayer = await waitFor(`!!document.querySelector('.prayer-stage')`)
ok('prayer view renders via deep link', !!prayer)
// The backdrop is EITHER the live WebGL scene (a canvas) OR the documented
// static fallback when the device is weak: navigator.hardwareConcurrency <= 4
// or no WebGL2 (EarthBackdrop.jsx — the deliberate weak-device path, not a
// failure). GitHub's runner takes that path, so demanding a canvas here made
// this check unpassable on CI while it passed on a desktop. Assert the real
// invariant — the backdrop rendered SOMETHING — and report which mode was
// chosen plus the facts that decide it, so a future failure is self-explaining.
const backdropReady = await waitFor(`(() => {
  const root = document.querySelector('.earth-backdrop')
  return !!root && (!!root.querySelector('canvas') || !!root.querySelector('.earth-fallback'))
})()`)
const backdropInfo = await evaljs(`(() => {
  const root = document.querySelector('.earth-backdrop')
  const mode = !root ? 'missing' : root.querySelector('canvas') ? 'live'
    : root.querySelector('.earth-fallback') ? 'static' : 'blank'
  let webgl2 = false
  try { webgl2 = !!document.createElement('canvas').getContext('webgl2') } catch {}
  return mode + ' cores=' + (navigator.hardwareConcurrency || '?') + ' webgl2=' + webgl2
})()`)
ok('backdrop renders (live scene or static fallback)', !!backdropReady,
  typeof backdropInfo === 'string' ? backdropInfo : 'probe error')
const chips = await evaljs(`document.querySelectorAll('.chooser .chip:not(.chip-all)').length`)
// Expected count comes from the catalog itself: the hardcoded 7 (from the
// commit that introduced this smoke test) went stale as Buddhism grew -
// observed 30 on Oct 26 against the production build.
ok('prayer chips render', chips === buddhism.prayers.length, `chips=${chips} expected=${buddhism.prayers.length}`)

// ---- deep link: full earth view ----
await send('Page.navigate', { url: `${APP}/#/earth` })
const earth = await waitFor(`!!document.querySelector('.earth-view canvas')`, 12000)
ok('full earth view renders via deep link', !!earth)

// ---- hashed assets + vendor chunk actually loaded ----
const hashed = await evaljs(`(() => { const s = performance.getEntriesByType('resource').filter(r => /\\/assets\\/.*\\.(js|css)/.test(r.name)).map(r => r.name); return JSON.stringify({ count: s.length, three: s.filter(n => /three-/.test(n)).length }) })()`)
const { count, three } = JSON.parse(hashed || '{}')
ok('hashed assets loaded', count >= 4, `assets=${count}`)
ok('three vendor chunk loaded', three >= 1, `three=${three}`)

// final: no exceptions anywhere
const errs2 = events.filter((e) => e.method === 'Runtime.exceptionThrown').length
ok('no page exceptions across flow', errs2 === 0, `n=${errs2}`)

edge.kill()
console.log(fails === 0 ? '[prod] ALL CHECKS PASSED' : `[prod] ${fails} check(s) FAILED`)
process.exit(fails === 0 ? 0 : 1)
