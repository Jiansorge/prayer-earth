// Frame-timing and cost measurement for the app shell.
//
// Reports evidence rather than opinion, because the performance complaints
// ("laggy scrolling", "slowing the whole browser down") are exactly the kind of
// claim that is easy to confirm by eye and hard to fix without knowing which
// layer is responsible.
//
// Measures, per scenario:
//   fps / long frames   wall-clock between rAF callbacks, and how many exceeded
//                       50ms (a dropped frame at 60Hz) or 100ms (jank)
//   long tasks          main-thread blocks over 50ms, via PerformanceObserver
//   heap                JS heap in use
//   style/layout cost   time spent in recalculating style and layout
//
// Scenarios: idle (backdrop animating), scrolling, and Earth (WebGL).
//
// A/B: pass --no-blur to strip backdrop-filter before measuring, which is how
// the hypothesis about the blurred nav gets tested instead of assumed.
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
// Node 22 has a global WebSocket, but it is undici's and speaks
// addEventListener, not the `ws` package's EventEmitter API the CDP client here
// is written against.
import WebSocket from 'ws'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const APP = process.env.APP_URL || 'http://localhost:5173'
const EDGE_CANDIDATES = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  process.env.CHROME_PATH
].filter(Boolean)

const NO_BLUR = process.argv.includes('--no-blur')
const NO_CANVAS = process.argv.includes('--no-canvas')
// The honest way to ask "how much does the backdrop animation cost": emulate
// prefers-reduced-motion, which makes the backdrop draw one static frame and stop
// its rAF loop. Hiding the canvas with visibility:hidden does NOT do this - the
// loop keeps drawing, so the measurement was identical to the baseline and
// proved nothing.
const REDUCED = process.argv.includes('--reduced')
// Headless defaults to software rasterisation, which makes a full-viewport canvas
// far more expensive than it is on a real GPU. --gpu lets the browser use the real
// rasteriser so the numbers mean something for a real user's machine.
const GPU = process.argv.includes('--gpu')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

class CDP {
  constructor(url) {
    this.ws = new WebSocket(url)
    this.id = 0
    this.pending = new Map()
  }
  open() {
    return new Promise((res, rej) => {
      this.ws.on('open', res)
      this.ws.on('error', rej)
      this.ws.on('message', (raw) => {
        const m = JSON.parse(raw.toString())
        if (m.id && this.pending.has(m.id)) {
          const { resolve, reject } = this.pending.get(m.id)
          this.pending.delete(m.id)
          if (m.error) reject(new Error(m.error.message))
          else resolve(m.result)
        }
      })
    })
  }
  send(method, params = {}) {
    const id = ++this.id
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.ws.send(JSON.stringify({ id, method, params }))
    })
  }
  async eval(expression) {
    const r = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text)
    return r.result?.value
  }
  async waitFor(expression, timeout = 20000) {
    const t0 = Date.now()
    while (Date.now() - t0 < timeout) {
      try {
        if (await this.eval(expression)) return true
      } catch {}
      await sleep(150)
    }
    return false
  }
}

// Injected into the page: records frame gaps for a window of time, and reports
// the distribution. Kept as one string because it has to survive Runtime.evaluate.
const MEASURE = (ms) => `(async () => {
  const gaps = []
  const longTasks = []
  let po = null
  try {
    po = new PerformanceObserver((list) => {
      for (const e of list.getEntries()) longTasks.push(Math.round(e.duration))
    })
    po.observe({ entryTypes: ['longtask'] })
  } catch {}
  let last = performance.now()
  const t0 = last
  await new Promise((done) => {
    const step = () => {
      const now = performance.now()
      gaps.push(now - last)
      last = now
      if (now - t0 >= ${ms}) return done()
      requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  })
  if (po) po.disconnect()
  const frames = gaps.length
  const total = gaps.reduce((a, b) => a + b, 0)
  const sorted = [...gaps].sort((a, b) => a - b)
  const pct = (p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] || 0
  return {
    frames,
    seconds: Math.round(total),
    fps: Math.round((frames / (total / 1000)) * 10) / 10,
    medianGap: Math.round(pct(0.5) * 10) / 10,
    p95Gap: Math.round(pct(0.95) * 10) / 10,
    worstGap: Math.round(Math.max(...gaps)),
    over50ms: gaps.filter((g) => g > 50).length,
    over100ms: gaps.filter((g) => g > 100).length,
    longTasks: longTasks.length,
    longTaskMs: longTasks.reduce((a, b) => a + b, 0),
    heapMB: performance.memory
      ? Math.round((performance.memory.usedJSHeapSize / 1048576) * 10) / 10
      : null
  }
})()`

async function main() {
  const exe = EDGE_CANDIDATES.find((p) => existsSync(p))
  if (!exe) {
    console.log('No Chromium/Edge binary found; set CHROME_PATH.')
    process.exit(2)
  }
  const profile = path.join(ROOT, 'dist-store', 'perf-profile')
  const proc = spawn(exe, [
    '--headless=new',
    '--remote-debugging-port=9333',
    ...(GPU ? [] : ['--disable-gpu']),
    '--no-first-run',
    '--user-data-dir=' + profile,
    '--window-size=1440,900',
    'about:blank'
  ], { stdio: 'ignore' })

  let c = null
  try {
    // Wait for the debugging endpoint.
    let target = null
    for (let i = 0; i < 60; i++) {
      await sleep(300)
      try {
        const list = await (await fetch('http://127.0.0.1:9333/json/list')).json()
        target = list.find((t) => t.type === 'page')
        if (target) break
      } catch {}
    }
    if (!target) throw new Error('no devtools target')
    c = new CDP(target.webSocketDebuggerUrl)
    await c.open()
    await c.send('Page.enable')
    await c.send('Runtime.enable')
    await c.send('Performance.enable')
    await c.send('Page.navigate', { url: APP })
    if (!(await c.waitFor(`!!document.querySelector('.spirit-grid, .nav')`, 30000))) {
      throw new Error('app did not render')
    }
    await sleep(2500)

    if (REDUCED) {
      await c.send('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-reduced-motion', value: 'reduce' }]
      })
      await c.eval(`location.reload()`).catch(() => {})
      await sleep(4000)
      await c.waitFor(`!!document.querySelector('.nav')`, 20000)
      await sleep(1500)
      console.log('prefers-reduced-motion: reduce emulated (backdrops static)')
    }

    if (NO_CANVAS) {
      await c.eval(`(() => {
        const st = document.createElement('style')
        st.id = 'perf-nocanvas'
        st.textContent = 'canvas{visibility:hidden !important}'
        document.head.appendChild(st)
        return 1
      })()`)
      console.log('canvas backdrops hidden')
      await sleep(1000)
    }

    if (NO_BLUR) {
      const n = await c.eval(`(() => {
        const style = document.createElement('style')
        style.id = 'perf-noblur'
        style.textContent = '*{backdrop-filter:none !important;-webkit-backdrop-filter:none !important}'
        document.head.appendChild(style)
        return 1
      })()`)
      console.log('backdrop-filter disabled for the A/B run')
      await sleep(1200)
    }

    const scenarios = []

    // 1. Idle: the backdrop is animating on its own.
    scenarios.push(['home idle', await c.eval(MEASURE(3000))])

    // 2. Scrolling: what the complaint is actually about.
    await c.eval(`(() => { window.scrollTo(0, 0); return 1 })()`)
    await c.eval(`(() => {
      window.__perfScroll = true
      let y = 0
      const tick = () => {
        if (!window.__perfScroll) return
        y += 40
        window.scrollTo(0, y)
        requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
      return 1
    })()`)
    scenarios.push(['home scrolling', await c.eval(MEASURE(3000))])
    await c.eval(`(() => { window.__perfScroll = false; return 1 })()`)

    // 3. Earth: the WebGL path, if it exists in this browser.
    await c.eval(`(() => { location.hash = '#/earth'; return 1 })()`)
    await sleep(3500)
    scenarios.push(['earth', await c.eval(MEASURE(3000))])
    await c.eval(`(() => { location.hash = '#/'; return 1 })()`)
    await sleep(1500)

    // Style/layout cost, straight from the browser's own counters.
    const metrics = await c.send('Performance.getMetrics')
    const pick = (n) => metrics.metrics.find((m) => m.name === n)?.value ?? null
    const styleRecalc = pick('RecalcStyleDuration')
    const layout = pick('LayoutDuration')
    const script = pick('ScriptDuration')
    const tasks = pick('TaskDuration')

    console.log('')
    console.log(NO_BLUR ? '=== WITHOUT backdrop-filter ===' : '=== WITH backdrop-filter (as shipped) ===')
    console.log('scenario        fps   med   p95   worst  >50ms >100ms  longTasks  heapMB')
    for (const [name, m] of scenarios) {
      if (!m) { console.log(`${name.padEnd(14)} (no data)`); continue }
      console.log(
        `${name.padEnd(14)} ${String(m.fps).padStart(4)} ${String(m.medianGap).padStart(5)} ${String(m.p95Gap).padStart(5)} ` +
          `${String(m.worstGap).padStart(6)} ${String(m.over50ms).padStart(7)} ${String(m.over100ms).padStart(7)} ` +
          `${String(m.longTasks).padStart(11)} ${String(m.heapMB ?? '-').padStart(7)}`
      )
    }
    const secs = 0.001
    console.log('')
    console.log(`main-thread totals: script ${Math.round(script * 1000)}ms  style ${Math.round(styleRecalc * 1000)}ms  layout ${Math.round(layout * 1000)}ms  task ${Math.round(tasks * 1000)}ms`)
  } finally {
    try { c?.ws?.close() } catch {}
    try { proc.kill() } catch {}
  }
}

main().catch((e) => {
  console.error('perf harness failed:', e.message)
  process.exit(1)
})