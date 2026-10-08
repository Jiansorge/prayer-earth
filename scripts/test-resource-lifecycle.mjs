// Does the app actually release what it allocates?
//
// This exists because the largest GPU leak in the app was invisible to every
// check we had. EarthPage created its scene in a useEffect with `[]` deps and
// disposed it in that effect's cleanup. Written down, that reads correctly. But
// when WebGL failed, the effect called setWebglFail(true), which swapped the
// scene for a static image - and a state change is not an unmount, so the
// cleanup never ran. The scene kept a live GL context, a self-rescheduling
// requestAnimationFrame calling renderer.render() on a detached canvas at 60fps,
// and every geometry still uploaded, for as long as the user sat on that page.
//
// No source scan can catch that, and reading dispose() does not prove it is
// called on every path. So this drives the real app in a real browser and counts
// what is still alive afterwards.
//
// Listeners are counted on window, document and canvases ONLY. React 18 attaches
// roughly 160 listeners to the root container for its synthetic event system and
// those live for the life of the page regardless of what any component does, so
// counting everything turned a real signal into an unusable absolute number.
// EarthScene and the backdrop hook attach to exactly these three target types,
// which is where a leak can actually hide.
//
// Usage: node scripts/test-resource-lifecycle.mjs
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const APP = process.env.APP_URL || 'http://localhost:5173'

let pass = 0
let fail = 0
const notes = []
const t = (name, fn) => {
  try {
    fn()
    pass++
    console.log(`PASS  ${name}`)
  } catch (e) {
    fail++
    console.log(`FAIL  ${name}\n        ${e.message}`)
  }
}
const eq = (actual, expected, msg) => assert.equal(actual, expected, msg)

// ---- in-page instrumentation ------------------------------------------------
const INSTRUMENT = `
(() => {
  const live = {
    rafArmed: 0, rafCancelled: 0,
    byType: {},
    canvasByType: {},
    contexts: 0, contextsLost: 0,
    errors: []
  }
  window.__pe = live

  const raf = window.requestAnimationFrame.bind(window)
  const caf = window.cancelAnimationFrame.bind(window)
  window.requestAnimationFrame = (cb) => { live.rafArmed++; return raf(cb) }
  window.cancelAnimationFrame = (id) => { live.rafCancelled++; return caf(id) }

  const add = EventTarget.prototype.addEventListener
  const rem = EventTarget.prototype.removeEventListener
  // Per event type, not a single total. An aggregate can be right for the wrong
  // reason - one type leaking can cancel another type's cleanup - and a total
  // also swings while unrelated listeners register late. Per type is the
  // property that actually means "nothing was left behind".
  const bump = (book, ty, by) => { book[ty] = (book[ty] || 0) + by }
  EventTarget.prototype.addEventListener = function (ty, fn, opts) {
    if (this === window || this === document) bump(live.byType, ty, 1)
    else if (this instanceof HTMLCanvasElement) bump(live.canvasByType, ty, 1)
    return add.call(this, ty, fn, opts)
  }
  EventTarget.prototype.removeEventListener = function (ty, fn, opts) {
    if (this === window || this === document) bump(live.byType, ty, -1)
    else if (this instanceof HTMLCanvasElement) bump(live.canvasByType, ty, -1)
    return rem.call(this, ty, fn, opts)
  }

  const getContext = HTMLCanvasElement.prototype.getContext
  HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
    const ctx = getContext.call(this, type, ...rest)
    if (ctx && /^webgl/.test(type) && !this.__peCounted) {
      this.__peCounted = true
      live.contexts++
      const ext = ctx.getExtension('WEBGL_lose_context')
      if (ext && !ext.__peWrapped) {
        ext.__peWrapped = true
        const lose = ext.loseContext.bind(ext)
        ext.loseContext = () => { live.contextsLost++; return lose() }
      }
    }
    return ctx
  }

  window.addEventListener('error', (e) => live.errors.push(String(e.message)))
  window.addEventListener('unhandledrejection', (e) => live.errors.push(String(e.reason)))
})()
`

// Listeners registered since the baseline that are still registered now.
// Compared against the baseline, not against zero: the app legitimately keeps
// error/beforeunload/hashchange listeners for the life of the page, so counting
// those as retained would flag every run.
const retained = (current, base) => {
  const out = []
  const keys = new Set([...Object.keys(current), ...Object.keys(base)])
  for (const k of keys) {
    const d = (current[k] || 0) - (base[k] || 0)
    if (d > 0) out.push(`${k}=${d}`)
  }
  return out
}
const describe = (obj) =>
  Object.keys(obj).length ? Object.entries(obj).map(([k, v]) => `${k}=${v}`).join(' ') : 'none'

const readLive = (page) =>
  page.evaluate(() => ({
    ...window.__pe,
    domCanvases: document.querySelectorAll('canvas').length,
    earthCanvas: !!document.querySelector('.earth-canvas canvas'),
    fallback: !!document.querySelector('.earth-fallback')
  }))

const settle = (page, ms = 1200) => page.waitForTimeout(ms)

async function withBrowser(fn) {
  const chrome =
    process.env.CHROME_PATH ||
    [
      'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
      'C:/Program Files/Google/Chrome/Application/chrome.exe'
    ].find((p) => existsSync(p))
  if (!chrome) throw new Error('no chromium binary found; set CHROME_PATH')
  const { chromium } = await import('playwright')
  const browser = await chromium.launch({
    executablePath: chrome,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox']
  })
  try {
    return await fn(browser)
  } finally {
    await browser.close()
  }
}

const startServer = async () => {
  const proc = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'dev', '--', '--port', '5173'], {
    cwd: ROOT,
    stdio: 'ignore',
    shell: process.platform === 'win32'
  })
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(APP)
      if (r.ok) return proc
    } catch {}
    await new Promise((r) => setTimeout(r, 500))
  }
  proc.kill()
  throw new Error('dev server did not start')
}

const server = await startServer()
try {
  await withBrowser(async (browser) => {
    const page = await browser.newPage()
    await page.addInitScript(INSTRUMENT)

    await page.goto(APP, { waitUntil: 'load' })
    await settle(page, 2000)
    // Warm up Playwright's own window input listeners before the baseline.
    // Playwright installs pointer/mouse/touch handlers on window the first time
    // it drives the page, and one of them is literally named
    // __playwright_global_listeners_check__. Without this warm-up those show up
    // as a leak the app never created.
    await page.mouse.move(2, 2)
    await page.waitForSelector('.view', { timeout: 15000 })
    await settle(page, 2000)
    // Baseline is taken here, immediately before the first Earth visit, not at
    // page load, for the same reason.
    const base = await readLive(page)
    notes.push(`baseline home:  canvases=${base.domCanvases} contexts=${base.contexts}`)
    notes.push(`  window/doc:    ${describe(base.byType)}`)
    notes.push(`  canvas:        ${describe(base.canvasByType)}`)

    await page.evaluate(() => {
      location.hash = '#/earth'
    })
    await page.waitForSelector('.earth-view', { timeout: 20000 })
    await settle(page, 4000)
    const onEarth = await readLive(page)
    notes.push(
      `on earth:       canvases=${onEarth.domCanvases} earthCanvas=${onEarth.earthCanvas} fallback=${onEarth.fallback} contexts=${onEarth.contexts}`
    )
    notes.push(`  canvas:        ${describe(onEarth.canvasByType)}`)

    if (!onEarth.earthCanvas || onEarth.fallback) {
      console.log('')
      console.log('The WebGL Earth did not come up here, so every scene test below would')
      console.log('report on nothing. Saying so instead of producing a green tick.')
      notes.push('WebGL unavailable in this environment: scene tests not run')
    } else {
      // ---- 1. leaving Earth releases everything ----------------------------
      await page.evaluate(() => {
        location.hash = '#/home'
      })
      await settle(page, 3000)
      const afterLeave = await readLive(page)
      const keptWindow = retained(afterLeave.byType, base.byType)
      const keptCanvas = retained(afterLeave.canvasByType, base.canvasByType)
      notes.push(`left earth:     canvases=${afterLeave.domCanvases} contexts=${afterLeave.contexts}`)
      notes.push(`  retained win:  ${keptWindow.length ? keptWindow.join(' ') : 'none'}`)
      notes.push(`  retained cvs:  ${keptCanvas.length ? keptCanvas.join(' ') : 'none'}`)

      t('leaving Earth retains no window/document listener', () => {
        eq(keptWindow.length, 0, `left attached: ${keptWindow.join(', ')}`)
      })
      t('leaving Earth retains no canvas listener', () => {
        eq(keptCanvas.length, 0, `left attached: ${keptCanvas.join(', ')}`)
      })
      t('leaving Earth releases its canvas', () => {
        assert(
          afterLeave.domCanvases <= base.domCanvases,
          `canvases grew from ${base.domCanvases} to ${afterLeave.domCanvases}`
        )
      })

      // ---- 2. route churn --------------------------------------------------
      await page.evaluate(() => {
        location.hash = '#/earth'
      })
      await page.waitForSelector('.earth-view', { timeout: 20000 })
      await settle(page, 3000)
      const before = await readLive(page)
      for (let i = 0; i < 4; i++) {
        await page.evaluate(() => {
          location.hash = '#/home'
        })
        await settle(page, 600)
        await page.evaluate(() => {
          location.hash = '#/earth'
        })
        await settle(page, 900)
      }
      // Measure on Home, not on Earth. A live scene legitimately holds its own
      // resize/visibilitychange/contextlost listeners, so sampling while it is
      // mounted counts the one scene that is supposed to exist.
      await page.evaluate(() => {
        location.hash = '#/home'
      })
      await settle(page, 3000)
      const after = await readLive(page)
      const churnWindow = retained(after.byType, base.byType)
      const churnCanvas = retained(after.canvasByType, base.canvasByType)
      notes.push(`4 round trips:   contexts ${before.contexts} -> ${after.contexts}, canvases ${after.domCanvases}`)
      notes.push(`  retained win:  ${churnWindow.length ? churnWindow.join(' ') : 'none'}`)
      notes.push(`  retained cvs:  ${churnCanvas.length ? churnCanvas.join(' ') : 'none'}`)

      t('four Earth round trips retain no window/document listener', () => {
        eq(churnWindow.length, 0, `retained after four visits: ${churnWindow.join(', ')}`)
      })
      t('four Earth round trips retain no canvas listener', () => {
        eq(churnCanvas.length, 0, `retained after four visits: ${churnCanvas.join(', ')}`)
      })
      t('four Earth round trips do not accumulate canvases', () => {
        assert(
          after.domCanvases <= before.domCanvases,
          `canvases grew ${before.domCanvases} -> ${after.domCanvases}`
        )
      })
      t('every WebGL context created is released', () => {
        eq(after.contextsLost, after.contexts, `${after.contexts} contexts created, ${after.contextsLost} released`)
      })

      // ---- 3. the failover path, where the real leak was --------------------
      // A lost context is exactly what a driver failure produces, and it drives
      // onContextLost -> setWebglFail(true) -> <StaticEarth/>. Before the fix
      // that left a 60fps renderer running on a canvas no longer in the tree.
      // The churn loop above leaves us on Home, so go back to Earth first:
      // there is no Earth canvas to lose a context on otherwise.
      await page.evaluate(() => {
        location.hash = '#/earth'
      })
      await page.waitForSelector('.earth-canvas canvas', { timeout: 20000 })
      await settle(page, 3000)
      const beforeLoss = await readLive(page)
      notes.push(`before loss:    earthCanvas=${beforeLoss.earthCanvas} canvases=${beforeLoss.domCanvases} contexts=${beforeLoss.contexts}`)

      await page.evaluate(() => {
        const c = document.querySelector('.earth-canvas canvas')
        if (c) c.dispatchEvent(new Event('webglcontextlost', { cancelable: true }))
      })
      await settle(page, 4000)
      const failover = await readLive(page)
      const failWindow = retained(failover.byType, base.byType)
      const failCanvas = retained(failover.canvasByType, base.canvasByType)
      notes.push(
        `after ctx loss: canvases=${failover.domCanvases} fallback=${failover.fallback} lost=${failover.contextsLost}/${failover.contexts}`
      )
      notes.push(`  retained win:  ${failWindow.length ? failWindow.join(' ') : 'none'}`)
      notes.push(`  retained cvs:  ${failCanvas.length ? failCanvas.join(' ') : 'none'}`)

      t('WebGL failure removes the scene canvas', () => {
        assert(
          failover.domCanvases < beforeLoss.domCanvases,
          `expected the Earth canvas to be released on failover, still ${failover.domCanvases}`
        )
      })
      t('WebGL failure retains no listener', () => {
        eq(failCanvas.length, 0, `canvas listeners left: ${failCanvas.join(', ')}`)
        eq(failWindow.length, 0, `window listeners left: ${failWindow.join(', ')}`)
      })
      t('the page survives WebGL failure without uncaught errors', () => {
        const real = failover.errors.filter((e) => !/context lost|WebGL/i.test(e))
        eq(real.length, 0, `uncaught errors after failover: ${real.join(' | ')}`)
      })
      t('WebGL failure still releases the GL context', () => {
        eq(failover.contextsLost, failover.contexts, `${failover.contexts} created, ${failover.contextsLost} released`)
      })

      const total = await readLive(page)
      notes.push(
        `final:          rafArmed=${total.rafArmed} rafCancelled=${total.rafCancelled} contexts=${total.contexts} lost=${total.contextsLost}`
      )
    }
  })

  // ==========================================================================
  // Scenario 2: prefers-reduced-motion.
  //
  // With this set the backdrop draws one static frame and never starts its loop
  // (useBackdropCanvas.js). That is a different branch from the one everything
  // else here exercises, and it runs for every user who has the setting on - so
  // it was a branch nothing tested.
  // ==========================================================================
  await withBrowser(async (browser) => {
    const page = await browser.newPage()
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.addInitScript(INSTRUMENT)
    await page.goto(APP, { waitUntil: 'load' })
    await settle(page, 2500)
    await page.mouse.move(2, 2)
    await page.waitForSelector('.view', { timeout: 15000 })
    await settle(page, 1500)

    // Measured on Home, before any navigation, so the frame count is the
    // backdrop's alone.
    const base = await readLive(page)
    notes.push(`reduced motion: baseline rafArmed=${base.rafArmed} canvases=${base.domCanvases}`)
    await settle(page, 4000)
    const idle = await readLive(page)
    notes.push(`reduced motion: armed while idle on Home=${idle.rafArmed - base.rafArmed}`)

    await page.evaluate(() => {
      location.hash = '#/earth'
    })
    await page.waitForSelector('.earth-view', { timeout: 20000 })
    await settle(page, 3500)
    const earth = await readLive(page)
    notes.push(`reduced motion: on earth rafArmed=${earth.rafArmed - base.rafArmed} (Earth renders in 3D regardless)`)
    await page.evaluate(() => {
      location.hash = '#/home'
    })
    await settle(page, 2500)
    const after = await readLive(page)
    const keptWin = retained(after.byType, base.byType)
    const keptCvs = retained(after.canvasByType, base.canvasByType)
    notes.push(`reduced motion: retained win=${keptWin.length ? keptWin.join(' ') : 'none'} cvs=${keptCvs.length ? keptCvs.join(' ') : 'none'}`)

    t('reduced motion: no listener survives an Earth visit', () => {
      eq(keptWin.length, 0, `window listeners left: ${keptWin.join(', ')}`)
      eq(keptCvs.length, 0, `canvas listeners left: ${keptCvs.join(', ')}`)
    })
    t('reduced motion: the static backdrop does not run a frame loop', () => {
      // Measured in two steps on purpose. base is taken on Home with the
      // backdrop already settled, then `after` is taken on Home again after a
      // fixed wait. The difference is therefore only frames armed while sitting
      // still on Home, with no navigation in between to muddy it.
      //
      // A looping backdrop arms ~24 frames a second at its MIN_FRAME_MS cap, so
      // over the waits below that is hundreds. The static path arms nothing
      // after the single initial draw.
      //
      // Verified non-vacuous: replacing `if (reduced) draw(...)` with an
      // unconditional `raf = requestAnimationFrame(loop)` makes this red.
      const armedWhileIdle = idle.rafArmed - base.rafArmed
      assert(
        armedWhileIdle < 40,
        `${armedWhileIdle} frames armed in 4s while idle on Home - the reduced-motion path is animating`
      )
    })
  })

  // ==========================================================================
  // Scenario 3: background and foreground cycling.
  //
  // The visibilitychange handler is exactly where a requestAnimationFrame loop
  // gets stranded: cancel on hide, re-arm on show, and if the two disagree you
  // either burn a core in a hidden tab or never resume. Ten cycles is enough to
  // expose a handler that leaks one frame or one listener per pass.
  //
  // document.hidden is overridden rather than the tab really being backgrounded,
  // because Playwright cannot hide a tab. What is exercised is the app's own
  // handler and its own logic - not the browser's tab lifecycle, which is not
  // ours to test.
  // ==========================================================================
  await withBrowser(async (browser) => {
    const page = await browser.newPage()
    await page.addInitScript(INSTRUMENT)
    await page.goto(APP, { waitUntil: 'load' })
    await settle(page, 2500)
    await page.mouse.move(2, 2)
    await page.waitForSelector('.view', { timeout: 15000 })
    await page.evaluate(() => {
      let hidden = false
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => (hidden ? 'hidden' : 'visible')
      })
      window.__setHidden = (v) => {
        hidden = v
        document.dispatchEvent(new Event('visibilitychange'))
      }
    })

    await page.evaluate(() => {
      location.hash = '#/earth'
    })
    await page.waitForSelector('.earth-canvas canvas', { timeout: 20000 })
    await settle(page, 3000)
    const base = await readLive(page)
    notes.push(`visibility: on earth rafArmed=${base.rafArmed}`)

    for (let i = 0; i < 10; i++) {
      await page.evaluate(() => window.__setHidden(true))
      await page.waitForTimeout(120)
      await page.evaluate(() => window.__setHidden(false))
      await page.waitForTimeout(120)
    }
    await settle(page, 2000)
    const after = await readLive(page)
    const keptWin = retained(after.byType, base.byType)
    const keptCvs = retained(after.canvasByType, base.canvasByType)
    notes.push(`visibility: after 10 cycles rafArmed=${after.rafArmed - base.rafArmed} retained win=${keptWin.length ? keptWin.join(' ') : 'none'} cvs=${keptCvs.length ? keptCvs.join(' ') : 'none'}`)

    t('ten hide/show cycles retain no listener', () => {
      eq(keptWin.length, 0, `window listeners left: ${keptWin.join(', ')}`)
      eq(keptCvs.length, 0, `canvas listeners left: ${keptCvs.join(', ')}`)
    })
    t('ten hide/show cycles keep exactly one canvas', () => {
      eq(after.domCanvases, 1, `expected the one Earth canvas, found ${after.domCanvases}`)
    })
    t('the Earth is still rendering after ten hide/show cycles', () => {
      // The failure mode this guards is a loop that never resumes, which looks
      // identical to a healthy idle scene from the outside. A live scene arms
      // frames continuously; a dead one stops.
      const armed = after.rafArmed - base.rafArmed
      assert(armed > 60, `only ${armed} frames armed after ten cycles - the loop may not have resumed`)
    })
  })

  // ==========================================================================
  // Scenario 4: no WebGL2 at all.
  //
  // Scenario 1 covers the scene failing *after* it started. This covers the
  // scene never starting: supportsWebGL2() returns false and <StaticEarth/>
  // renders from the first paint. Different branch, same file, and on a machine
  // with WebGL blocked or unavailable every visit takes it.
  // ==========================================================================
  await withBrowser(async (browser) => {
    const page = await browser.newPage()
    await page.addInitScript(INSTRUMENT)
    // Installed after the instrumentation so it wraps the counting getContext,
    // and scopes to the probe only by refusing every webgl2 request.
    await page.addInitScript(`
      (() => {
        const orig = HTMLCanvasElement.prototype.getContext
        HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
          if (/^webgl2$/.test(type)) return null
          return orig.call(this, type, ...rest)
        }
      })()
    `)
    await page.goto(APP, { waitUntil: 'load' })
    await settle(page, 2500)
    await page.mouse.move(2, 2)
    await page.waitForSelector('.view', { timeout: 15000 })
    await settle(page, 1500)
    const base = await readLive(page)

    await page.evaluate(() => {
      location.hash = '#/earth'
    })
    await page.waitForSelector('.earth-view', { timeout: 20000 })
    await settle(page, 3000)
    const earth = await readLive(page)
    notes.push(
      `no webgl2:      earthCanvas=${earth.earthCanvas} fallback=${earth.fallback} contexts=${earth.contexts} canvases=${earth.domCanvases}`
    )

    t('with no WebGL2 the static Earth renders and no context is created', () => {
      eq(earth.earthCanvas, false, 'a WebGL canvas was created even though webgl2 is unavailable')
      eq(earth.fallback, true, 'the static Earth fallback did not render')
      eq(earth.contexts, 0, `${earth.contexts} WebGL contexts created on a device without WebGL2`)
    })

    await page.evaluate(() => {
      location.hash = '#/home'
    })
    await settle(page, 2500)
    const after = await readLive(page)
    const keptWin = retained(after.byType, base.byType)
    const keptCvs = retained(after.canvasByType, base.canvasByType)
    notes.push(`no webgl2:      retained win=${keptWin.length ? keptWin.join(' ') : 'none'} cvs=${keptCvs.length ? keptCvs.join(' ') : 'none'}`)

    t('with no WebGL2 the fallback leaves nothing behind', () => {
      eq(keptWin.length, 0, `window listeners left: ${keptWin.join(', ')}`)
      eq(keptCvs.length, 0, `canvas listeners left: ${keptCvs.join(', ')}`)
    })
    t('with no WebGL2 no uncaught error is raised', () => {
      const real = (after.errors || []).filter((e) => !/webgl|context/i.test(e))
      eq(real.length, 0, `uncaught errors: ${real.join(' | ')}`)
    })
  })
} finally {
  server.kill()
}

console.log('')
for (const line of notes) console.log('  ' + line)
console.log('')
console.log(`${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)