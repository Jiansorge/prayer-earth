// Production smoke test: drives the built app (vite preview) and checks the
// shell renders, deep links work, the service worker registers, and no console
// errors occur. Unlike test-usage.mjs this does NOT depend on the dev-only
// window.__store handle.
// Run: npm run build && node scripts/test-prod.mjs

import { spawn } from 'node:child_process'
import WebSocket from 'ws'

const APP = process.env.APP_URL || 'http://localhost:4173'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const DEBUG_PORT = 9237
const PROFILE = `${process.env.TEMP}\\pe-prod-${Date.now()}`

let fails = 0
const ok = (name, cond, extra = '') => {
  if (cond) console.log(`[prod] PASS  ${name}${extra ? ` (${extra})` : ''}`)
  else {
    fails += 1
    console.log(`[prod] FAIL  ${name}${extra ? ` (${extra})` : ''}`)
  }
}

const edge = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--mute-audio', '--no-first-run',
  `--user-data-dir=${PROFILE}`, `--remote-debugging-port=${DEBUG_PORT}`, 'about:blank'
])
edge.stdout.on('data', () => {})
edge.stderr.on('data', () => {})
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let cdpUrl = null
for (let i = 0; i < 40; i++) {
  try {
    const list = await (await fetch(`http://localhost:${DEBUG_PORT}/json`)).json()
    const p = list.find((t) => t.type === 'page')
    if (p) { cdpUrl = p.webSocketDebuggerUrl; break }
  } catch {}
  await sleep(250)
}
if (!cdpUrl) throw new Error('no CDP')

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
ok('backdrop canvas present', !!(await waitFor(`!!document.querySelector('.earth-backdrop canvas')`)))
const chips = await evaljs(`document.querySelectorAll('.chooser .chip:not(.chip-all)').length`)
ok('prayer chips render', chips === 7, `chips=${chips}`)

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
