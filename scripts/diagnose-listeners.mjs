// Which listeners are accumulating, and from where?
//
// The RAM review found a flat +7 net listeners per route cycle. Flat is the
// suspicious part: a per-visit leak would grow pass over pass, so a constant
// net of 7 is something registered once and never removed - or registered and
// removed equally, which is healthy. Counting alone cannot tell those apart, so
// this counts by event type and by target, which can.
//
// Serves the production build, same as review-pass.mjs: the dev server turns
// the measurements into a measurement of the dev server.
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
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
  return out;
})()`

const { resolveChrome, launchOptions } = await import(
  pathToFileURL(path.join(ROOT, 'scripts', 'lib', 'browser.mjs')).href
)
const { chromium } = await import('playwright')
const browser = await chromium.launch(launchOptions(resolveChrome()))
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
    snaps.push(await page.evaluate(SNAP))
    console.log(`pass ${i + 1}: ${Object.values(snaps[i]).reduce((a, b) => a + b, 0)} net listeners`)
  }

  // Growth = the difference between the first and last snapshot. Constant
  // positive values are app-level listeners that legitimately live forever;
  // what matters is whether any key INCREASED between passes.
  const keys = new Set([...Object.keys(snaps[0]), ...Object.keys(snaps[snaps.length - 1])])
  const grew = []
  console.log('')
  console.log('per-type net listeners (first -> last pass):')
  for (const k of [...keys].sort()) {
    const a = snaps[0][k] || 0
    const b = snaps[snaps.length - 1][k] || 0
    const mark = b > a ? '  <-- GROWS' : ''
    console.log(`  ${k.padEnd(28)} ${String(a).padStart(4)} -> ${String(b).padStart(4)}${mark}`)
    if (b > a) grew.push(k)
  }

  const stacks = await page.evaluate(() => Object.fromEntries(window.__stacks))
  if (grew.length) {
    console.log('')
    console.log('registration sites for the growing ones:')
    for (const k of grew) console.log(`  ${k}\n      ${stacks[k] || '(unknown)'}`)
  } else {
    console.log('')
    console.log('no listener type grew between passes - the +7 is a stable set of')
    console.log('app-level listeners that register once and stay, not a per-visit leak.')
  }
} finally {
  await browser.close()
  server.close()
}
process.exit(0)