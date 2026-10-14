// Which JavaScript is holding the main thread while scrolling?
//
// The device numbers say the cost is not the GPU - it renders a frame in 1-2ms -
// but ~41-44% of frames miss their budget on every surface alike, which is the
// signature of JavaScript occupying the main thread. Everything checked so far
// can be green while that is true: the bundle is valid, the rendering is correct,
// the tests pass, and the app still feels sticky. docs/FIREFOX-PERF.md says the
// same thing from the other direction - there is no frame-rate bug to be found
// with the tools on a desktop machine.
//
// So this does not guess. It records a real CPU profile across a real scroll and
// reports where the main-thread time actually went, by function.
//
// The device is the point, because that is where it reproduces. `--device`
// forwards adb to the app's WebView devtools socket - the same connection as
// chrome://inspect, and the one scripts/test-android-device.mjs already uses - and
// profiles the real app on the real phone:
//
//   npm run build:capacitor && npx cap sync android
//   ./gradlew -p android assembleDebug
//   adb install -r android/app/build/outputs/apk/debug/app-debug.apk
//   node scripts/profile-scroll.mjs --device
//
// Without --device it runs the same thing against the production build in a local
// Chromium, which is the control. If the desktop profile is clean and the phone
// profile is not, the cost is device-specific, and this names it rather than
// leaving that to be assumed.
//
// Each surface is measured separately and named, because the two surfaces have
// already disagreed once: a containment change was shipped on the strength of a
// measurement taken on the container nobody was scrolling.
//
// Raw .cpuprofile files land in qa-shots/profiles/ and open in the DevTools
// Performance panel (Load profile) or in Speedscope - the same file
// docs/FIREFOX-PERF.md step 3 asks a Firefox user to send in.
import { execFileSync } from 'node:child_process'
import { createServer } from 'node:http'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIST = path.join(ROOT, 'dist')
const OUT = path.join(ROOT, 'qa-shots', 'profiles')

const argv = process.argv.slice(2)
const flag = (name) => argv.includes(`--${name}`)
const opt = (name) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : ''
}
const AS_DEVICE = flag('device')
const AS_JSON = flag('json')
const ONLY = opt('only')
// Long enough to average over, short enough that a person can watch the phone
// while it runs and see the moment it hurts.
const SECONDS = Number(opt('seconds') || 3)

const ADB = process.env.ADB || (process.platform === 'win32'
  ? path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk', 'platform-tools', 'adb.exe')
  : 'adb')
const PACKAGE = 'app.joiningpalms'
const PORT = Number(opt('port') || process.env.ANDROID_CDP_PORT || 9300 + (process.pid % 400))
const SERIAL = process.env.ANDROID_SERIAL || ''

// 100us rather than the default 1000us. At 1ms the whole budget for one frame is
// a single sample, so a handler that costs 4ms every scroll is indistinguishable
// from noise. 100us makes that handler visible, and still costs far less than the
// main thread does - which matters, because the thing being measured is the main
// thread.
const SAMPLING_INTERVAL_US = 100

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const slug = (s) => s.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
const ms = (us) => Math.round(us / 100) / 10

// ---- CDP --------------------------------------------------------------------

// A four-method client. The device suite has a fuller one; this should not pull
// in a 1300-line file to get evaluate, waitFor and the profiler.
class CDP {
  constructor(url) {
    this.ws = new WebSocket(url)
    this.id = 0
    this.pending = new Map()
    this.ws.on('message', (raw) => {
      const message = JSON.parse(raw.toString())
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id)
        this.pending.delete(message.id)
        if (message.error) reject(new Error(message.error.message))
        else resolve(message.result)
      }
    })
  }
  open() {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('devtools connection timed out')), 8000)
      this.ws.once('open', () => { clearTimeout(timer); resolve() })
      this.ws.once('error', (e) => { clearTimeout(timer); reject(e) })
    })
  }
  send(method, params = {}) {
    const id = ++this.id
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`${method} timed out`)), 60000)
      this.pending.set(id, {
        resolve: (v) => { clearTimeout(timer); resolve(v) },
        reject: (e) => { clearTimeout(timer); reject(e) }
      })
      this.ws.send(JSON.stringify({ id, method, params }))
    })
  }
  close() { try { this.ws.close() } catch {} }
}

async function rawEvaluate(cdp, expression, arg) {
  // A function needs its arguments spliced in; a bare expression cannot take any.
  // This is the only place the two transports differ, and the reason the scroll
  // driver below is a real function rather than a string of source: a string
  // handed to page.evaluate() with an argument silently evaluates to a function
  // object and returns undefined, which looks like a broken page rather than a
  // broken call.
  const source = arg === undefined
    ? expression
    : `(${expression})(${JSON.stringify(arg)})`
  const r = await cdp.send('Runtime.evaluate', {
    expression: source, returnByValue: true, awaitPromise: true
  })
  if (r.exceptionDetails) {
    throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text)
  }
  return r.result?.value
}

// ---- attaching --------------------------------------------------------------

const adbArgs = (args) => (SERIAL ? ['-s', SERIAL, ...args] : args)
const adb = (args) =>
  execFileSync(ADB, adbArgs(args), { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })

async function attachDevice() {
  if (!existsSync(ADB)) {
    throw new Error(`adb not found at ${ADB} - set ADB=<path>`)
  }
  const rows = adb(['devices']).split(/\r?\n/).slice(1)
    .map((l) => l.trim()).filter((l) => l.endsWith('\tdevice'))
  if (!rows.length) throw new Error('no adb device connected - check `adb devices`')

  const pid = adb(['shell', 'pidof', PACKAGE]).trim().split(/\s+/)[0]
  if (!pid) {
    throw new Error(
      `${PACKAGE} is not running. Launch it on the phone first:\n` +
      `  adb shell am start -n ${PACKAGE}/.MainActivity`
    )
  }
  try { adb(['forward', '--remove', `tcp:${PORT}`]) } catch {}
  adb(['forward', `tcp:${PORT}`, `localabstract:webview_devtools_remote_${pid}`])
  try {
    for (let i = 0; i < 40; i++) {
      try {
        const pages = await (await fetch(`http://127.0.0.1:${PORT}/json`, {
          signal: AbortSignal.timeout(1500)
        })).json()
        const target = pages.find((p) => p.type === 'page')
        if (target) {
          const cdp = new CDP(target.webSocketDebuggerUrl)
          await cdp.open()
          await cdp.send('Runtime.enable')
          return {
            cdp,
            evaluate: (expression, arg) => rawEvaluate(cdp, expression, arg),
            waitFor: async (expression, timeout = 15000) => {
              const t0 = Date.now()
              while (Date.now() - t0 < timeout) {
                try { if (await rawEvaluate(cdp, expression)) return true } catch {}
                await sleep(250)
              }
              return false
            },
            close: () => { try { adb(['forward', '--remove', `tcp:${PORT}`]) } catch {}; cdp.close() }
          }
        }
      } catch {}
      await sleep(250)
    }
  } finally {
    // Fall through: the error below is the useful one.
  }
  throw new Error('the WebView devtools endpoint did not become available')
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8'
}

async function attachLocal() {
  if (!existsSync(path.join(DIST, 'index.html'))) {
    throw new Error('no dist/ - run `npm run build` first')
  }
  const server = createServer(async (req, res) => {
    try {
      let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '')
      if (!rel || !(await stat(path.join(DIST, rel))).isFile()) rel = 'index.html'
      res.writeHead(200, { 'content-type': MIME[path.extname(rel)] || 'application/octet-stream' })
      res.end(await readFile(path.join(DIST, rel)))
    } catch { res.writeHead(404).end('nf') }
  })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  const { resolveChrome } = await import(
    pathToFileURL(path.join(ROOT, 'scripts', 'lib', 'browser.mjs')).href
  )
  const { chromium } = await import('playwright')
  // Real GPU rather than software rasterisation. launchOptions() from lib/browser
  // always appends SwiftShader so a headless CI box can still make a WebGL
  // context; appending to that list measures the renderer, not the app, which is
  // how the first run of measure-scroll.mjs put every frame at 150-200ms and read
  // as catastrophic jank.
  const browser = await chromium.launch({
    executablePath: resolveChrome(),
    args: ['--enable-gpu-rasterization', '--enable-gpu-compositing', '--ignore-gpu-blocklist',
      '--disable-background-timer-throttling', '--disable-renderer-backgrounding']
  })
  const page = await browser.newPage({ viewport: { width: 412, height: 915 } })
  await page.addInitScript(() => { try { localStorage.setItem('pe-onboarded', '1') } catch {} })
  await page.goto(`http://127.0.0.1:${server.address().port}`, {
    waitUntil: 'domcontentloaded', timeout: 60000
  })
  await page.waitForSelector('.view', { timeout: 60000 })
  await sleep(2500)
  const cdp = await page.context().newCDPSession(page)
  return {
    cdp,
    evaluate: (expression, arg) => page.evaluate(expression, arg),
    waitFor: (expression, timeout = 15000) =>
      page.waitForFunction(expression, null, { timeout }).then(() => true, () => false),
    close: async () => { await browser.close(); server.close() }
  }
}

// ---- the scroll driver, shared by both paths --------------------------------

// Runs in the page. Measures the frames the browser actually delivered - rAF
// timestamps, so a gap is a dropped frame - while dispatching real wheel events.
//
// The wheel events are synthetic, and that is a real limit: they do not travel
// the compositor's input pipeline the way a finger does. It is still the right
// driver for "what does JavaScript cost while this surface scrolls", which is the
// question being asked, and it is the same driver the existing frame numbers were
// taken with, so the two are comparable.
// One argument, not two: page.evaluate() passes a single argument to the page
// function, so a two-parameter signature silently receives an array in the first
// slot and turns '.picker-list' into '.picker-list,3'.
async function SCROLL({ sel, seconds }) {
  const el = document.querySelector(sel)
  if (!el) return { error: 'not found: ' + sel }
  const frames = []
  let done = false
  const onFrame = (t) => { frames.push(t); if (!done) requestAnimationFrame(onFrame) }
  requestAnimationFrame(onFrame)
  const rect = el.getBoundingClientRect()
  const cx = rect.left + rect.width / 2
  let y = rect.top + 40
  const until = performance.now() + seconds * 1000
  let events = 0
  while (performance.now() < until) {
    el.dispatchEvent(new WheelEvent('wheel', {
      deltaY: 120, deltaMode: 0, clientX: cx, clientY: y,
      bubbles: true, cancelable: true, view: window
    }))
    events++
    y = Math.max(rect.top + 40, y - 40)
    await new Promise((r) => setTimeout(r, 16))
  }
  await new Promise((r) => setTimeout(r, 150))
  done = true
  const gaps = []
  for (let i = 1; i < frames.length; i++) gaps.push(frames[i] - frames[i - 1])
  gaps.sort((a, b) => a - b)
  const q = (p) => gaps.length
    ? Math.round(gaps[Math.min(gaps.length - 1, Math.floor(gaps.length * p))] * 10) / 10 : 0
  return {
    events,
    median: q(0.5), p95: q(0.95), worst: q(1),
    frames: gaps.length,
    stalled: gaps.filter((g) => g > 33).length,
    hitch: gaps.filter((g) => g > 50).length
  }
}

// ---- profile aggregation ----------------------------------------------------

// Buckets that are not our code. Reported rather than dropped: "a third of the
// main thread is garbage collection" is a finding, and silently excluding it
// hides the case where the app above it is what allocates.
const NOT_OURS = /^\((idle|program|garbage collector|system monitor|benchmark|unknown)\)$/i

const shortFile = (url) => (url ? url.split('/').pop().split('?')[0] : '(no file)')

// Self and inclusive time per function.
//
// Inclusive is computed over the profile's node tree and summed by key only
// afterwards, so a function reached from ten call sites reports the total it cost
// rather than ten fragments of it. Deep recursion under one key can still double
// count, which is why self time is printed next to it.
function aggregate(profile) {
  const byId = new Map(profile.nodes.map((n) => [n.id, n]))
  const self = new Map()
  const total = new Map()

  for (let i = 0; i < profile.samples.length; i++) {
    const id = profile.samples[i]
    self.set(id, (self.get(id) || 0) + (profile.timeDeltas[i] || 0))
  }
  const inclusive = (id) => {
    if (total.has(id)) return total.get(id)
    const node = byId.get(id)
    let sum = self.get(id) || 0
    for (const child of node?.children || []) sum += inclusive(child)
    total.set(id, sum)
    return sum
  }
  for (const node of profile.nodes) inclusive(node.id)

  const rows = new Map()
  for (const node of profile.nodes) {
    const f = node.callFrame || {}
    const name = f.functionName || '(anonymous)'
    const key = `${name} @ ${shortFile(f.url)}:${(f.lineNumber ?? 0) + 1}`
    const row = rows.get(key) || {
      key, name, file: shortFile(f.url), line: (f.lineNumber ?? 0) + 1,
      self: 0, inclusive: 0, notOurs: NOT_OURS.test(name)
    }
    row.self += self.get(node.id) || 0
    row.inclusive += total.get(node.id) || 0
    rows.set(key, row)
  }

  const wall = profile.timeDeltas.reduce((a, b) => a + b, 0)
  const list = [...rows.values()].sort((a, b) => b.self - a.self)
  return {
    rows: list,
    wall,
    appSelf: list.filter((r) => !r.notOurs).reduce((a, b) => a + b.self, 0)
  }
}

// ---- surfaces ---------------------------------------------------------------

const SURFACES = [
  {
    name: 'prayer picker list',
    selector: '.picker-list',
    open: async (s) => {
      await s.evaluate(`location.hash = '#/'`)
      await s.waitFor(`!!document.querySelector('.view')`)
      await sleep(500)
      await s.evaluate(`(() => {
        const b = [...document.querySelectorAll('button')]
          .find((x) => /choose|select|prayer|change/i.test(x.textContent || ''))
        if (b) b.click()
        return !!b
      })()`)
      await s.waitFor(`!!document.querySelector('.picker-list')`, 12000)
    }
  },
  {
    name: 'settings sheet body',
    selector: '.sheet-body',
    open: async (s) => {
      await s.evaluate(`location.hash = '#/'`)
      await s.waitFor(`!!document.querySelector('.view')`)
      await sleep(500)
      await s.evaluate(`document.querySelector('.gear-btn')?.click()`)
      await s.waitFor(`!!document.querySelector('.sheet-body')`, 12000)
    }
  },
  {
    name: 'prayer stage',
    selector: '.prayer-stage',
    open: async (s) => {
      await s.evaluate(`location.hash = '#/pray/buddhism/mani'`)
      await s.waitFor(`!!document.querySelector('.prayer-stage')`, 30000)
      await sleep(1500)
    }
  }
]

// ---- run --------------------------------------------------------------------

async function run() {
  const session = AS_DEVICE ? await attachDevice() : await attachLocal()
  const { cdp } = session
  const results = []
  mkdirSync(OUT, { recursive: true })

  try {
    await cdp.send('Profiler.enable')
    await cdp.send('Profiler.setSamplingInterval', { interval: SAMPLING_INTERVAL_US })

    for (const surface of SURFACES) {
      if (ONLY && !surface.name.includes(ONLY)) continue
      await surface.open(session)
      await sleep(800)

      if (!await session.evaluate(`!!document.querySelector(${JSON.stringify(surface.selector)})`)) {
        console.log(`[profile] ${surface.name}: ${surface.selector} is not on screen - skipped`)
        continue
      }

      await cdp.send('Profiler.start')
      const frames = await session.evaluate(SCROLL, { sel: surface.selector, seconds: SECONDS })
      const { profile } = await cdp.send('Profiler.stop')
      if (frames?.error) {
        console.log(`[profile] ${surface.name}: ${frames.error}`)
        continue
      }

      const file = path.join(OUT, `${slug(surface.name)}.cpuprofile`)
      writeFileSync(file, JSON.stringify(profile))
      results.push({ surface: surface.name, selector: surface.selector, frames, agg: aggregate(profile), file })
    }
  } finally {
    await session.close()
  }
  return results
}

// ---- report -----------------------------------------------------------------

const results = await run()

const summarise = (r) => ({
  surface: r.surface,
  selector: r.selector,
  frames: r.frames,
  wallMs: ms(r.agg.wall),
  appSelfMs: ms(r.agg.appSelf),
  top: r.agg.rows.filter((x) => !x.notOurs).slice(0, 15).map((x) => ({
    fn: x.key, selfMs: ms(x.self), inclusiveMs: ms(x.inclusive)
  }))
})

if (AS_JSON) {
  console.log(JSON.stringify(results.map(summarise), null, 2))
  process.exit(results.length ? 0 : 1)
}

if (!results.length) {
  console.error('[profile] nothing was measured - no surface was on screen')
  process.exit(1)
}

console.log(
  `\nmain-thread time while scrolling${AS_DEVICE ? ' ON THE DEVICE' : ' - desktop baseline'}\n` +
  '='.repeat(76)
)

let mangled = 0
let named = 0
for (const r of results) {
  const f = r.frames
  const pct = r.agg.wall ? Math.round((r.agg.appSelf / r.agg.wall) * 100) : 0
  console.log(`\n${r.surface}   [${r.selector}]`)
  console.log(
    `  frames   median ${String(f.median).padStart(6)}ms   p95 ${String(f.p95).padStart(6)}ms` +
    `   worst ${String(f.worst).padStart(6)}ms   >33ms ${String(f.stalled).padStart(4)}` +
    `   >50ms ${String(f.hitch).padStart(4)}   (${f.frames} frames, ${f.events} wheel events)`
  )
  console.log(`  main thread: ${ms(r.agg.appSelf)}ms of ${ms(r.agg.wall)}ms is app JavaScript (${pct}%)`)
  console.log('')
  console.log('      self       incl  function')
  for (const row of r.agg.rows.slice(0, 12)) {
    if (row.notOurs) continue
    // Count how readable the names are, so the closing note is based on what was
    // actually recorded rather than on an assumption about the build.
    if (/^[A-Za-z_$][\w$]{0,2}$/.test(row.name)) mangled++
    else named++
    console.log(`  ${String(ms(row.self)).padStart(8)}ms ${String(ms(row.inclusive)).padStart(8)}ms  ${row.key}`)
  }
  console.log(`\n  raw profile: ${path.relative(ROOT, r.file)}`)
}

console.log('\n' + '='.repeat(76))
const hottest = results.map((r) => ({
  name: r.surface,
  self: r.agg.rows.filter((x) => !x.notOurs).reduce((a, b) => a + b.self, 0)
})).sort((a, b) => b.self - a.self)[0]
console.log(`most JavaScript spent scrolling: ${hottest.name}`)

if (mangled > named) {
  console.log(
    '\nMost function names came back mangled, so this is a minified build: the\n' +
    'file:line still points into a named chunk, which is enough to tell WHICH part\n' +
    'of the app costs the time. Open the raw profile in DevTools or Speedscope for\n' +
    'the flame graph.'
  )
}
console.log(
  '\nA large (garbage collector) row is not noise - it means whatever is listed\n' +
  'above it is allocating on every frame.'
)
process.exit(0)