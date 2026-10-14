// Does interaction block the main thread?
//
// The device measurement said the scroll problem is not the GPU - it renders in
// 1-2ms - but the UI thread, with ~41-44% of frames missing their budget on
// every surface alike. That shape is JavaScript occupying the main thread, and
// it is invisible to every other check here: the bundle can be valid, the
// rendering correct, the tests green, and the app still feel sticky because a
// handler blocks for 80ms every time you touch it.
//
// So this measures the thing the frame stats were pointing at. It drives real
// interactions against the production build and records LongTask entries -
// main-thread work over 50ms - which is the standard signal for exactly this.
// It fails on total blocking time, because one 400ms hitch is felt far more
// than forty 10ms ones, and on the worst single task, because a stall that
// size is felt however rare it is.
//
// Budgets are deliberately loose. They are not a performance goal, they are a
// tripwire: the aim is to catch a change that makes the main thread markedly
// worse, not to enforce a number this machine cannot reproduce.
//
// Serves the production build, because a dev server is a different app.
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
    // Read before writing headers. Reading after writeHead means a failed read
    // lands in the catch and tries to write a 404 onto a response that already
    // has a 200 on it - ERR_HTTP_HEADERS_SENT, thrown from the server, which
    // takes down the run with an error that names none of this.
    const body = await readFile(path.join(DIST, rel))
    res.writeHead(200, { 'content-type': MIME[path.extname(rel)] || 'application/octet-stream' })
    res.end(body)
  } catch {
    if (!res.headersSent) res.writeHead(404)
    res.end('nf')
  }
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const APP = `http://127.0.0.1:${server.address().port}`

// Collect LongTask entries from the moment the document exists, so first-load
// work is counted too - a prayer that stutters on open is as broken as one that
// stutters on the second tap.
const OBSERVE = `
window.__tasks = [];
new PerformanceObserver((list) => {
  for (const e of list.getEntries()) window.__tasks.push({ d: e.duration, n: e.name });
}).observe({ type: 'longtask', buffered: true });
`

const readTasks = () => page.evaluate(() => {
  const t = window.__tasks || []
  const blocking = t.map((x) => Math.max(0, x.d - 50))
  return {
    count: t.length,
    blocking: Math.round(blocking.reduce((a, b) => a + b, 0)),
    worst: Math.round(t.reduce((a, b) => Math.max(a, b.d), 0)),
    tasks: t.map((x) => ({ d: Math.round(x.d), n: x.n }))
  }
})

const go = async (h, s) => {
  await page.evaluate((x) => { window.location.hash = x }, h)
  await page.waitForFunction((q) => !!document.querySelector(q), s, { timeout: 60000 })
}

// Budgets, and why they are this size.
//
// Measured on this machine against this build, same script, both renderers:
//
//                      navigation blocking   worst task
//   real GPU                     553ms          361ms
//   SwiftShader                 3628ms         1035ms
//
// Two things fall out of that. First, the GPU numbers were already over the old
// 600ms/250ms budget on a run that was not a regression - the old limits had no
// headroom for ordinary variance, so they fired on noise. Second, and more
// important, a CI runner has no GPU, so Chromium falls back to SwiftShader and
// rasterisation runs on the main thread. LongTask durations there include paint
// that a real GPU does elsewhere, which is why the same build reads 6x worse.
// That is the renderer, not the app - the trap measure-scroll.mjs already walked
// into, where a forced-software first run put every frame at 150-200ms and read
// as catastrophic jank.
//
// So this now launches with the SAME software flags every other browser test
// uses (lib/browser.mjs launchOptions), which makes the measurement identical on
// this machine and on CI, and the budgets are set from the SwiftShader numbers
// with roughly 2x headroom. It is still a tripwire, not a performance goal: a
// handler that starts blocking shows up as a large multiple of these, and that
// is what it is for.
//
// The honest limit, unchanged: this measures JavaScript plus software paint on a
// machine with no GPU. It cannot tell you what a phone does. For that,
// scripts/profile-scroll.mjs --device is the measurement.
const BUDGET = { navigation: 7000, worstTask: 3000, sheet: 250 }

const { resolveChrome, launchOptions } = await import(
  pathToFileURL(path.join(ROOT, 'scripts', 'lib', 'browser.mjs')).href
)
const { chromium } = await import('playwright')
const browser = await chromium.launch(launchOptions(resolveChrome()))
const page = await browser.newPage({ viewport: { width: 412, height: 915 } })
await page.addInitScript(OBSERVE)
await page.addInitScript(() => { try { localStorage.setItem('pe-onboarded', '1') } catch {} })

let pass = 0
let fail = 0
const t = async (name, fn) => {
  try {
    await fn()
    pass++
    console.log(`PASS  ${name}`)
  } catch (e) {
    fail++
    console.log(`FAIL  ${name}\n      ${e.message}`)
  }
}
const must = (cond, msg) => { if (!cond) throw new Error(msg) }

try {
  await page.goto(APP, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForSelector('.view', { timeout: 60000 })
  await sleep(3000)

  // Route changes are the most common interaction in the app and each one
  // mounts a view, so they are where a blocking handler would show up.
  const ROUTES = [
    ['#/', '.view'], ['#/earth', '.earth-view'], ['#/earth', '.earth-view'],
    ['#/pray', '.view'], ['#/pray/buddhism/mani', '.prayer-stage'],
    ['#/pray/buddhism/mani', '.prayer-stage'], ['#/pause', '.view'], ['#/', '.view']
  ]

  await t('navigating every route stays inside the main-thread budget', async () => {
    await page.evaluate(() => { window.__tasks = [] })
    for (const [h, s] of ROUTES) { await go(h, s); await sleep(700) }
    const r = await readTasks()
    must(r.blocking <= BUDGET.navigation,
      `total blocking ${r.blocking}ms across ${ROUTES.length} navigations ` +
      `(${r.count} long tasks, budget ${BUDGET.navigation}ms)`)
    console.log(`      total blocking ${r.blocking}ms, ${r.count} long tasks, worst ${r.worst}ms`)
  })

  await t('no single navigation stalls the main thread past the worst-task budget', async () => {
    await page.evaluate(() => { window.__tasks = [] })
    for (const [h, s] of ROUTES) { await go(h, s); await sleep(700) }
    const r = await readTasks()
    const worst = r.tasks.reduce((a, b) => Math.max(a, b.d), 0)
    must(worst <= BUDGET.worstTask, `worst single task ${worst}ms (budget ${BUDGET.worstTask}ms)`)
    console.log(`      worst single task ${worst}ms`)
  })

  // Opening and scrolling a sheet is the interaction reported as laggy, so it
  // gets its own budget rather than hiding inside the route total.
  await t('opening and scrolling the settings sheet stays responsive', async () => {
    await go('#/', '.view')
    await sleep(400)
    await page.evaluate(() => document.querySelector('.gear-btn')?.click())
    await page.waitForSelector('.sheet-body', { timeout: 15000 }).catch(() => {})
    await sleep(600)
    await page.evaluate(() => { window.__tasks = [] })
    for (let i = 0; i < 12; i++) {
      await page.evaluate(() => {
        const el = document.querySelector('.sheet-body')
        if (!el) return
        el.dispatchEvent(new WheelEvent('wheel', {
          deltaY: 140, deltaMode: 0, bubbles: true, cancelable: true, view: window
        }))
      })
      await sleep(40)
    }
    await sleep(400)
    const r = await readTasks()
    must(r.blocking <= BUDGET.sheet, `sheet interaction blocked ${r.blocking}ms (budget ${BUDGET.sheet}ms)`)
    console.log(`      sheet blocking ${r.blocking}ms, ${r.count} long tasks`)
  })

  console.log('')
  console.log('  measured under software rasterisation (no GPU), so these are not')
  console.log('  comparable to a phone. For that: scripts/profile-scroll.mjs --device')
  console.log('')
  console.log(`${pass}/${pass + fail} passed`)
  if (fail) {
    console.log('')
    console.log('A regression here is main-thread work, not rendering: the GPU was')
    console.log('measured at 1-2ms per frame on device, so the cost is JS. Profile')
    console.log('with chrome://inspect against the device to find the handler.')
  }
} finally {
  await browser.close()
  server.close()
}
process.exit(fail ? 1 : 0)