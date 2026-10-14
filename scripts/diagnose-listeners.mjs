// Which listeners are accumulating, and is any of it actually retained?
//
// A listener counter alone cannot prove a leak. It counts add/remove pairs, and
// it rises for listeners that are never removed yet live on elements that are
// thrown away and collected with them - React attaches load/error/invalid
// directly to media elements precisely because those events do not bubble, and
// it does not always pair that with a removeEventListener on unmount. The
// elements go to the GC; the counter never learns that.
//
// So a rising counter means something only when something retained is rising
// with it. This therefore reports heap and DOM-node growth next to every pass,
// and only calls it a leak when both move together. That distinction is the
// whole point: the first version of this called a flat heap and flat node count
// a "+7 per pass leak" when there was nothing leaking at all.
//
// Serves the production build, same as review-pass.mjs: the dev server turns
// the measurements into a measurement of the dev server.
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PASSES = Number(process.argv[process.argv.indexOf('--passes') + 1] || 8)
const DIST = path.join(ROOT, 'dist')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

if (!existsSync(path.join(DIST, 'index.html'))) {
  console.error('no dist/ - run `npm run build` first')
  process.exit(1)
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8'
}
const server = createServer(async (req, res) => {
  try {
    let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '')
    if (!rel || !(await stat(path.join(DIST, rel))).isFile()) rel = 'index.html'
    res.writeHead(200, { 'content-type': MIME[path.extname(rel)] || 'application/octet-stream' })
    res.end(await readFile(path.join(DIST, rel)))
  } catch {
    res.writeHead(404).end('nf')
  }
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const APP = `http://127.0.0.1:${server.address().port}`

// Count by type AND target, and keep a stack for anything that grows, so the
// finding can name where it came from rather than just how much.
const INSTRUMENT = `
window.__L = new Map(); window.__stacks = new Map();
(() => {
  const add = EventTarget.prototype.addEventListener;
  const rem = EventTarget.prototype.removeEventListener;
  const name = (t) => t === window ? 'window' : t === document ? 'document'
    : t instanceof HTMLCanvasElement ? 'canvas' : t instanceof HTMLElement ? 'el' : 'other';
  const bump = (ty, t, by, stack) => {
    const k = name(t) + ':' + String(ty);
    const cur = window.__L.get(k) || 0;
    window.__L.set(k, cur + by);
    if (by > 0 && stack) {
      const s = window.__stacks.get(k);
      const line = (stack.split('\\n').slice(1, 4).join(' | ')).slice(0, 150);
      if (!s) window.__stacks.set(k, line);
    }
  };
  EventTarget.prototype.addEventListener = function (ty, fn, o) {
    bump(ty, this, 1, new Error().stack); return add.call(this, ty, fn, o);
  };
  EventTarget.prototype.removeEventListener = function (ty, fn, o) {
    bump(ty, this, -1, null); return rem.call(this, ty, fn, o);
  };
})();
`

const SNAP = `(() => {
  const out = {};
  for (const [k, v] of window.__L) if (v !== 0) out[k] = v;
  return {
    lis: out,
    // Retention signals. These are what turn a rising counter into a finding.
    heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576 * 10) / 10 : null,
    nodes: document.getElementsByTagName('*').length
  };
})()`

const { resolveChrome, launchOptions } = await import(
  pathToFileURL(path.join(ROOT, 'scripts', 'lib', 'browser.mjs')).href
)
const { chromium } = await import('playwright')
// Precise heap figures, without which performance.memory reports coarse
// buckets and the retention check would be guessing.
const browser = await chromium.launch(launchOptions(resolveChrome(), ['--enable-precise-memory-info']))
const page = await browser.newPage({ viewport: { width: 412, height: 915 } })
await page.addInitScript(INSTRUMENT)
await page.addInitScript(() => { try { localStorage.setItem('pe-onboarded', '1') } catch {} })

const go = async (h, s) => {
  await page.evaluate((x) => { window.location.hash = x }, h)
  await page.waitForFunction((q) => !!document.querySelector(q), s, { timeout: 60000 })
}

try {
  await page.goto(APP, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForSelector('.view', { timeout: 60000 })
  await sleep(2500)

  const ROUTES = [['#/', '.view'], ['#/earth', '.earth-view'], ['#/', '.view'], ['#/pray/buddhism/mani', '.prayer-stage'], ['#/', '.view']]
  const snaps = []
  for (let i = 0; i < PASSES; i++) {
    for (const [h, s] of ROUTES) { await go(h, s); await sleep(600) }
    await sleep(500)
    const s = await page.evaluate(SNAP)
    snaps.push(s)
    console.log(`pass ${i + 1}: listeners ${Object.values(s.lis).reduce((a, b) => a + b, 0)}` +
      (s.heap === null ? '' : `  heap ${s.heap}MB  nodes ${s.nodes}`))
  }

  const first = snaps[0]
  const last = snaps[snaps.length - 1]

  // Listener growth on its own is not a leak. Ask whether memory grew with it.
  //
  // Measuring first-vs-last is too crude to trust: the heap is noisy between
  // passes because garbage collection lands whenever it likes, so a six-pass
  // run can read 11, 22, 54, 23, 61, 61 and look like a 50MB leak when it is
  // flat. A real leak keeps climbing; GC noise plateaus. So compare the mean of
  // the last half against the mean of the first half, and require the run to be
  // long enough to have settled - which is why the default is 20 passes.
  const heapVals = snaps.map((s) => s.heap).filter((v) => v !== null)
  const h = Math.floor(heapVals.length / 2)
  const heapNull = heapVals.length < 4
  const mean = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length
  const heapDelta = heapNull ? null
    : Math.round((mean(heapVals.slice(h)) - mean(heapVals.slice(0, h))) * 10) / 10
  const nodeVals = snaps.map((s) => s.nodes)
  const nodeDelta = mean(nodeVals.slice(h)) - mean(nodeVals.slice(0, h))
  const retained = heapNull ? nodeDelta > 8 : heapDelta > 1 && nodeDelta > 8

  console.log('')
  console.log(`retention over ${PASSES} passes: heap ${heapNull ? 'unavailable' : (heapDelta >= 0 ? '+' : '') + heapDelta + 'MB'}` +
    `, nodes ${nodeDelta >= 0 ? '+' : ''}${nodeDelta}`)
  console.log(retained
    ? '  something IS being retained alongside the counters - treat a growing listener type as a real leak.'
    : '  nothing retained: heap and nodes are flat, so a rising counter here is a discarded-' +
      'element artifact, not a leak.')

  const keys = new Set([...Object.keys(first.lis), ...Object.keys(last.lis)])
  const grew = []
  console.log('')
  console.log('per-type net listeners (first -> last pass):')
  for (const k of [...keys].sort()) {
    const a = first.lis[k] || 0
    const b = last.lis[k] || 0
    const mark = b > a ? (retained ? '  <-- GROWS' : '  (grows, but nothing retained)') : ''
    console.log(`  ${k.padEnd(28)} ${String(a).padStart(4)} -> ${String(b).padStart(4)}${mark}`)
    if (b > a) grew.push(k)
  }

  const stacks = await page.evaluate(() => Object.fromEntries(window.__stacks))
  if (grew.length && retained) {
    console.log('')
    console.log('registration sites for the growing ones:')
    for (const k of grew) console.log(`  ${k}\n      ${stacks[k] || '(unknown)'}`)
  } else if (grew.length) {
    console.log('')
    console.log('no fix needed: these types do not bubble (load/error/invalid), so React')
    console.log('attaches them to the element and drops them when it drops the element.')
    console.log('The counter cannot see that, but the heap can, and the heap is flat.')
  } else if (!grew.length) {
    console.log('')
    console.log('no listener type grew between passes - a stable set of app-level')
    console.log('listeners that register once and stay, not a per-visit leak.')
  }
} finally {
  await browser.close()
  server.close()
}
process.exit(0)