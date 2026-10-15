// The two paths where a frame loop can be left running, or left dead.
//
// Split out of test-resource-lifecycle.mjs so it runs beside that suite rather
// than queueing behind it. The reasoning for the instrumentation and the
// baseline lives in lib/lifecycle.mjs and in that file's header.
//
// Scenario 1 - prefers-reduced-motion. With this set the backdrop draws one
// static frame and never starts its loop (useBackdropCanvas.js). That is a
// different branch from the one everything else exercises, and it runs for
// every user who has the setting on - so it was a branch nothing tested.
//
// Scenario 2 - background and foreground cycling. The visibilitychange handler
// is exactly where a requestAnimationFrame loop gets stranded: cancel on hide,
// re-arm on show, and if the two disagree you either burn a core in a hidden
// tab or never resume. Ten cycles is enough to expose a handler that leaks one
// frame or one listener per pass.
//
// document.hidden is overridden rather than the tab really being backgrounded,
// because Playwright cannot hide a tab. What is exercised is the app's own
// handler and its own logic - not the browser's tab lifecycle, which is not
// ours to test.
//
// Usage: node scripts/test-resource-motion.mjs
import assert from 'node:assert/strict'
import {
  begin, t, eq, note, settle, readLive, retained, goView,
  withBrowser, startDevServer, bootPage, finish, killTree
} from './lib/lifecycle.mjs'

begin()
const server = await startDevServer()
try {
  await withBrowser(async (browser) => {
    const page = await bootPage(browser, { reducedMotion: true })

    // Measured on Home, before any navigation, so the frame count is the
    // backdrop's alone.
    const base = await readLive(page)
    note(`reduced motion: baseline rafArmed=${base.rafArmed} canvases=${base.domCanvases}`)
    await settle(page, 4000)
    const idle = await readLive(page)
    note(`reduced motion: armed while idle on Home=${idle.rafArmed - base.rafArmed}`)

    await goView(page, '#/earth', '.earth-view')
    await settle(page, 3500)
    const earth = await readLive(page)
    note(`reduced motion: on earth rafArmed=${earth.rafArmed - base.rafArmed} (Earth renders in 3D regardless)`)
    await page.evaluate(() => {
      location.hash = '#/home'
    })
    await settle(page, 2500)
    const after = await readLive(page)
    const keptWin = retained(after.byType, base.byType)
    const keptCvs = retained(after.canvasByType, base.canvasByType)
    note(`reduced motion: retained win=${keptWin.length ? keptWin.join(' ') : 'none'} cvs=${keptCvs.length ? keptCvs.join(' ') : 'none'}`)

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

  await withBrowser(async (browser) => {
    const page = await bootPage(browser)
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
    note(`visibility: on earth rafArmed=${base.rafArmed}`)

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
    note(`visibility: after 10 cycles rafArmed=${after.rafArmed - base.rafArmed} retained win=${keptWin.length ? keptWin.join(' ') : 'none'} cvs=${keptCvs.length ? keptCvs.join(' ') : 'none'}`)

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
      // frames after the cycles; a dead one arms none.
      //
      // The bar is therefore "more than none", not a frame count. This used to
      // demand 60, which is a 60fps assumption from a machine with a real GPU:
      // the same suite arms 7-14 frames over this window on a software renderer,
      // where a dead loop still reads as exactly 0. Counting frames conflated
      // "the loop resumed" with "this machine renders quickly".
      const armed = after.rafArmed - base.rafArmed
      assert(
        armed > 0,
        `no frames armed after ten cycles (${armed}) - the render loop may not have resumed`
      )
    })
  })
} finally {
  killTree(server)
}
finish()
