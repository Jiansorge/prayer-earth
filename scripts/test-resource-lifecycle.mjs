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
// This suite covers the happy path: mount, unmount, and repeated churn. The
// others run beside it rather than queueing behind it:
//   - test-resource-webgl.mjs    context loss, and no WebGL2 at all
//   - test-resource-motion.mjs   prefers-reduced-motion, and hide/show cycling
//   - test-resource-loading.mjs  the Earth loading overlay
// Shared plumbing is in lib/lifecycle.mjs.
//
// Usage: node scripts/test-resource-lifecycle.mjs
import assert from 'node:assert/strict'
import {
  begin, t, eq, note, settle, readLive, retained, describe, goView,
  withBrowser, startDevServer, warmEarthAndBaseline, bootPage, finish, killTree
} from './lib/lifecycle.mjs'

begin()
const server = await startDevServer()
try {
  await withBrowser(async (browser) => {
    const page = await bootPage(browser)
    const base = await warmEarthAndBaseline(page)

    await goView(page, '#/earth', '.earth-view')
    await settle(page, 4000)
    const onEarth = await readLive(page)
    note(
      `on earth:       canvases=${onEarth.domCanvases} earthCanvas=${onEarth.earthCanvas} fallback=${onEarth.fallback} contexts=${onEarth.contexts}`
    )
    note(`  canvas:        ${describe(onEarth.canvasByType)}`)

    if (!onEarth.earthCanvas || onEarth.fallback) {
      console.log('')
      console.log('The WebGL Earth did not come up here, so every scene test below would')
      console.log('report on nothing. Saying so instead of producing a green tick.')
      note('WebGL unavailable in this environment: scene tests not run')
      return
    }

    // ---- 1. leaving Earth releases everything ----------------------------
    await page.evaluate(() => {
      location.hash = '#/home'
    })
    await settle(page, 3000)
    const afterLeave = await readLive(page)
    const keptWindow = retained(afterLeave.byType, base.byType)
    const keptCanvas = retained(afterLeave.canvasByType, base.canvasByType)
    note(`left earth:     canvases=${afterLeave.domCanvases} contexts=${afterLeave.contexts}`)
    note(`  retained win:  ${keptWindow.length ? keptWindow.join(' ') : 'none'}`)
    note(`  retained cvs:  ${keptCanvas.length ? keptCanvas.join(' ') : 'none'}`)

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
    await goView(page, '#/earth', '.earth-view')
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
    note(`4 round trips:   contexts ${before.contexts} -> ${after.contexts}, canvases ${after.domCanvases}`)
    note(`  retained win:  ${churnWindow.length ? churnWindow.join(' ') : 'none'}`)
    note(`  retained cvs:  ${churnCanvas.length ? churnCanvas.join(' ') : 'none'}`)

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

    const total = await readLive(page)
    note(
      `final:          rafArmed=${total.rafArmed} rafCancelled=${total.rafCancelled} contexts=${total.contexts} lost=${total.contextsLost}`
    )
  })
} finally {
  killTree(server)
}
finish()
