// Where is scrolling actually expensive, and by how much?
//
// The reported symptom is laggy scrolling in the prayer list and the settings
// sheet on Android and in Firefox. "Too much is happening" is the right guess
// but it names no culprit, and I have already been wrong about scroll once today
// by measuring a container that was not the one being reported. So this measures
// each surface separately, and - the part that makes it useful - repeats every
// measurement with backdrop-filter stripped, so the result names a cause rather
// than a cost.
//
// Serves the production build. A dev server changes what is being measured.
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
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

const { resolveChrome } = await import(
  pathToFileURL(path.join(ROOT, 'scripts', 'lib', 'browser.mjs')).href
)
const { chromium } = await import('playwright')
// Real GPU, not software rendering. launchOptions() always appends SwiftShader
// so a headless CI box can still make a WebGL context, and passing my own args
// to it only appends to that list - the first run of this script therefore
// measured software rasterisation. It put every frame at a uniform 150-200ms,
// which reads as catastrophic jank but is just the renderer, and it would have
// cost a real fix based on a number that measured the wrong thing entirely.
// So args are built here instead.
const browser = await chromium.launch({
  executablePath: resolveChrome(),
  args: [
    '--enable-gpu-rasterization',
    '--enable-gpu-compositing',
    '--ignore-gpu-blocklist',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding'
  ]
})
const page = await browser.newPage({ viewport: { width: 412, height: 915 } })
await page.addInitScript(() => { try { localStorage.setItem('pe-onboarded', '1') } catch {} })

async function measureScroll(selector) {
  // Frames, while scrolling a given element with real wheel events. rAF
  // timestamps are what the browser actually delivered, so gaps here are
  // dropped frames.
  return await page.evaluate(async (sel) => {
    const el = document.querySelector(sel);
    if (!el) return { error: 'not found: ' + sel };
    const frames = [];
    let done = false;
    const onFrame = (t) => { frames.push(t); if (!done) requestAnimationFrame(onFrame); };
    requestAnimationFrame(onFrame);

    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    let y = rect.top + 40;
    for (let i = 0; i < 60; i++) {
      el.dispatchEvent(new WheelEvent('wheel', {
        deltaY: 120, deltaMode: 0, clientX: cx, clientY: y,
        bubbles: true, cancelable: true, view: window
      }));
      y = Math.max(rect.top + 40, y - 40);
      await new Promise((r) => setTimeout(r, 16));
    }
    await new Promise((r) => setTimeout(r, 200));
    done = true;

    const gaps = [];
    for (let i = 1; i < frames.length; i++) gaps.push(frames[i] - frames[i - 1]);
    gaps.sort((a, b) => a - b);
    const q = (p) => gaps.length
      ? Math.round(gaps[Math.min(gaps.length - 1, Math.floor(gaps.length * p))] * 10) / 10 : 0;
    return {
      median: q(0.5), p95: q(0.95), worst: q(1),
      frames: gaps.length,
      stalled: gaps.filter((g) => g > 33).length,
      hitch: gaps.filter((g) => g > 50).length
    };
  }, selector)
}

const go = async (h, s) => {
  await page.evaluate((x) => { window.location.hash = x }, h)
  await page.waitForFunction((q) => !!document.querySelector(q), s, { timeout: 60000 })
}

// Strip every backdrop-filter so the second run can only differ by that cost.
const STRIP = `
for (const el of document.querySelectorAll('*')) {
  const b = getComputedStyle(el).backdropFilter;
  if (b && b !== 'none') el.style.setProperty('backdrop-filter', 'none', 'important');
}
`
const RESTORE = `
for (const el of document.querySelectorAll('*')) el.style.removeProperty('backdrop-filter');
`

const fmt = (r) => r.error ? r.error
  : `median ${String(r.median).padStart(6)}ms   p95 ${String(r.p95).padStart(6)}ms` +
    `   worst ${String(r.worst).padStart(6)}ms   frames>33ms ${String(r.stalled).padStart(3)}   hitches ${String(r.hitch).padStart(3)}`

const results = []
async function ab(name, open, selector) {
  await open()
  await sleep(1200)
  await page.evaluate(RESTORE)
  const withBlur = await measureScroll(selector)
  await page.evaluate(STRIP)
  await sleep(200)
  const noBlur = await measureScroll(selector)
  await page.evaluate(RESTORE)
  results.push({ name, withBlur, noBlur })
  console.log(`\n${name}   [${selector}]`)
  console.log(`  as shipped: ${fmt(withBlur)}`)
  console.log(`  no filter : ${fmt(noBlur)}`)
  if (!withBlur.error && !noBlur.error && withBlur.median > 0) {
    const d = Math.round((withBlur.median - noBlur.median) * 10) / 10
    const pct = Math.round((d / withBlur.median) * 100)
    const verdict = pct >= 15 ? 'material' : pct >= 5 ? 'minor' : 'not the cause'
    console.log(`  backdrop-filter costs ${d >= 0 ? '+' : ''}${d}ms median (${pct}%) -> ${verdict}`)
  }
}

try {
  await page.goto(APP, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForSelector('.view', { timeout: 60000 })
  await sleep(2500)

  const openPicker = async () => {
    await go('#/', '.view')
    await sleep(400)
    const opened = await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')]
        .find((b) => /choose|select|prayer|change/i.test(b.textContent || ''))
      if (!btn) return false
      btn.click()
      return true
    })
    if (opened) await page.waitForSelector('.picker-overlay', { timeout: 8000 }).catch(() => {})
    return opened
  }

  const openSheet = async () => {
    await go('#/', '.view')
    await sleep(400)
    const opened = await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')]
        .find((b) => /settings|gear|menu/i.test(b.getAttribute('aria-label') || b.textContent || ''))
      if (!btn) return false
      btn.click()
      return true
    })
    if (opened) await page.waitForSelector('.sheet', { timeout: 8000 }).catch(() => {})
    return opened
  }

  await ab('prayer picker list', openPicker, '.picker-list')
  await ab('settings sheet body', openSheet, '.sheet-body')

  await go('#/pray/buddhism/mani', '.prayer-stage')
  await sleep(1200)
  await ab('prayer stage', async () => { await go('#/pray/buddhism/mani', '.prayer-stage') }, '.prayer-stage')

  console.log('')
  console.log('summary:')
  for (const r of results) {
    if (r.withBlur.error || r.noBlur.error) { console.log(`  ${r.name}: ${r.withBlur.error || r.noBlur.error}`); continue }
    const pct = Math.round(((r.withBlur.median - r.noBlur.median) / (r.withBlur.median || 1)) * 100)
    console.log(`  ${r.name.padEnd(22)} ${String(r.withBlur.median).padStart(6)}ms -> ${String(r.noBlur.median).padStart(6)}ms   backdrop-filter ${pct >= 0 ? '' : '+'}${-pct}%`)
  }
} finally {
  await browser.close()
  server.close()
}
process.exit(0)