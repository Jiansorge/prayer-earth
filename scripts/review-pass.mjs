// 20-pass instrumentation of one axis: power, or RAM/data.
//
// Runs against the PRODUCTION build, served statically, not the Vite dev
// server. That is a correctness choice, not just speed: the dev server turns
// one app into hundreds of module requests through an on-the-fly transform, so
// anything measured there is mostly measuring the dev server. It is also what
// made browser navigation unreliable here - the page took long enough to load
// that a 30s goto timed out, which looks like a broken app and is not one.
//
// Why 20 passes rather than one: every question here is a trend question. One
// sample cannot tell you whether a listener accumulates or a heap climbs, only
// whether it happened once. Each pass is a fixed route cycle, measured at the
// same point every time so the series is comparable, with the page open
// throughout rather than reloaded - reloading would reset the very counters
// that accumulate.
//
// Usage: node scripts/review-pass.mjs --axis power|ram --passes 20
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { readFile, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`)
  return i > -1 ? process.argv[i + 1] : d
}
const AXIS = arg('axis', 'power')
const PASSES = Number(arg('passes', 20))

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const DIST = path.join(ROOT, 'dist')

if (!existsSync(path.join(DIST, 'index.html'))) {
  console.error('no dist/ - run `npm run build` first')
  process.exit(1)
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8'
}

// A dependency-free static server. Anything not found falls through to
// index.html, because the app is a hash-routed single page.
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost')
    let rel = decodeURIComponent(url.pathname).replace(/^\/+/, '')
    if (!rel || !(await stat(path.join(DIST, rel))).isFile()) {
      rel = 'index.html'
    }
    const body = await readFile(path.join(DIST, rel))
    res.writeHead(200, { 'content-type': MIME[path.extname(rel)] || 'application/octet-stream' })
    res.end(body)
  } catch {
    res.writeHead(404).end('not found')
  }
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const APP = `http://127.0.0.1:${server.address().port}`

// Installed before any app code runs, so every registration is counted - not
// only the ones that happen after we arrive.
const INSTRUMENT = `
window.__m = { raf: 0, timers: 0, intervals: 0, listeners: 0, ctx: 0, audioCtx: 0 };
(() => {
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => { window.__m.raf++; return raf(cb); };
  const st = window.setTimeout.bind(window);
  window.setTimeout = (fn, ms, ...r) => { window.__m.timers++; return st(fn, ms, ...r); };
  const si = window.setInterval.bind(window);
  window.setInterval = (fn, ms, ...r) => { window.__m.intervals++; return si(fn, ms, ...r); };
  const add = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function (...a) { window.__m.listeners++; return add.apply(this, a); };
  const rem = EventTarget.prototype.removeEventListener;
  EventTarget.prototype.removeEventListener = function (...a) { window.__m.listeners--; return rem.apply(this, a); };
  const gc = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (t, ...r) {
    const c = gc.call(this, t, ...r);
    if (c && /^webgl/.test(t) && !this.__c) { this.__c = 1; window.__m.ctx++; }
    return c;
  };
  const AC = window.AudioContext || window.webkitAudioContext;
  if (AC) {
    const Wrapped = class extends AC {
      constructor(...a) { super(...a); window.__m.audioCtx++; }
      close(...a) { window.__m.audioCtx--; return super.close(...a); }
    };
    window.AudioContext = Wrapped;
    window.webkitAudioContext = Wrapped;
  }
})();
`

const SAMPLE = `(async () => {
  const res = performance.getEntriesByType('resource');
  let heapMB = null;
  try { const m = performance.memory; if (m && m.usedJSHeapSize) heapMB = +(m.usedJSHeapSize / 1048576).toFixed(1); } catch {}
  let storageKB = 0;
  try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); storageKB += k.length + (localStorage.getItem(k) || '').length; } } catch {}
  let cacheKB = 0, audioReqs = 0;
  try { for (const c of await caches.keys()) { const r = await caches.open(c); for (const k of await r.keys()) { const res2 = await r.match(k); if (res2) { const b = await res2.blob(); cacheKB += b.size; } } } } catch {}
  for (const r of res) if (r.name.includes('/audio/')) audioReqs++;
  return {
    heapMB, storageKB: Math.round(storageKB / 1024), cacheKB: Math.round(cacheKB / 1024),
    audioReqs, requests: res.length,
    transferKB: Math.round(res.reduce((a, r) => a + (r.transferSize || 0), 0) / 1024),
    decodedKB: Math.round(res.reduce((a, r) => a + (r.decodedBodySize || 0), 0) / 1024),
    nodes: document.getElementsByTagName('*').length,
    canvases: document.querySelectorAll('canvas').length,
    ...window.__m
  };
})()`

const { resolveChrome, launchOptions } = await import(
  pathToFileURL(path.join(ROOT, 'scripts', 'lib', 'browser.mjs')).href
)
const { chromium } = await import('playwright')

const browser = await chromium.launch(launchOptions(resolveChrome()))
const page = await browser.newPage({ viewport: { width: 412, height: 915 } })
await page.addInitScript(INSTRUMENT)
await page.addInitScript(() => {
  try { localStorage.setItem('pe-onboarded', '1') } catch {}
})

const go = async (hash, sel) => {
  await page.evaluate((h) => { window.location.hash = h }, hash)
  await page.waitForFunction((s) => !!document.querySelector(s), sel, { timeout: 60000 })
}

try {
  await page.goto(APP, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForSelector('.view', { timeout: 60000 })
  await sleep(3000)

  const ROUTES = [['#/', '.view'], ['#/earth', '.earth-view'], ['#/', '.view'], ['#/pray/buddhism/mani', '.prayer-stage'], ['#/', '.view']]
  const rows = []
  for (let pass = 1; pass <= PASSES; pass++) {
    const before = await page.evaluate(SAMPLE)
    const t0 = Date.now()
    for (const [h, s] of ROUTES) { await go(h, s); await sleep(600) }
    const ms = Date.now() - t0
    await sleep(600)
    const after = await page.evaluate(SAMPLE)
    const d = (k) => +(after[k] - before[k]).toFixed(1)
    rows.push({
      pass, ms, d,
      heap: after.heapMB === null || before.heapMB === null ? null : d('heapMB'),
      heapAbs: after.heapMB, nodes: after.nodes,
      listeners: d('listeners'), timers: d('timers'), intervals: d('intervals'),
      raf: d('raf'), ctx: d('ctx'), requests: d('requests'),
      transferKB: d('transferKB'), decodedKB: d('decodedKB'), audioReqs: d('audioReqs'),
      storageKB: after.storageKB, cacheKB: after.cacheKB, audioCtx: after.audioCtx
    })
    const r = rows[rows.length - 1]
    console.log(
      `pass ${String(pass).padStart(2)} ${String(r.ms).padStart(5)}ms ` +
        `heap ${r.heap === null ? ' n/a' : (r.heap >= 0 ? '+' : '') + r.heap + 'MB'} ` +
        `nodes ${r.nodes} lis ${r.listeners >= 0 ? '+' : ''}${r.listeners} ` +
        `tmo ${r.timers >= 0 ? '+' : ''}${r.timers} int ${r.intervals >= 0 ? '+' : ''}${r.intervals} ` +
        `raf ${r.raf} ctx ${r.ctx >= 0 ? '+' : ''}${r.ctx} req ${r.requests >= 0 ? '+' : ''}${r.requests} ` +
        `${r.transferKB >= 0 ? '+' : ''}${r.transferKB}KB`
    )
  }

  const body = rows.slice(1)
  const third = Math.max(1, Math.floor(body.length / 3))
  const early = body.slice(0, third)
  const late = body.slice(-third)
  const mean = (a, k) => a.reduce((s, r) => s + (typeof r[k] === 'number' ? r[k] : 0), 0) / a.length
  const pick = AXIS === 'power'
    ? ['raf', 'timers', 'intervals', 'contexts', 'listeners', 'requests', 'transferKB', 'ms']
    : ['heap', 'heapAbs', 'nodes', 'listeners', 'contexts', 'decodedKB', 'cacheKB', 'storageKB', 'audioReqs']

  console.log('')
  console.log(`=== ${AXIS.toUpperCase()} REVIEW: ${PASSES} passes (${body.length} scored, first pass dropped) ===`)
  for (const k of pick) {
    const e = mean(early, k), l = mean(late, k)
    if (!e && !l) continue
    const d = +(l - e).toFixed(1)
    const verdict = Math.abs(d) < 0.5 ? 'flat' : d > 0 ? `GROWING +${d}` : `shrinking ${d}`
    console.log(`  ${k.padEnd(11)} first third ${String(+e.toFixed(1)).padStart(9)}   last third ${String(+l.toFixed(1)).padStart(9)}   ${verdict}`)
  }
  const last = body[body.length - 1]
  console.log(`  end state:  audioCtx open ${last.audioCtx}, cache ${last.cacheKB}KB, storage ${last.storageKB}KB, nodes ${last.nodes}`)
  console.log('')
} finally {
  await browser.close()
  server.close()
}
process.exit(0)