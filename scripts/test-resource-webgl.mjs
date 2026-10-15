// The two ways the Earth fails to be 3D, and what is left behind afterwards.
//
// Split out of test-resource-lifecycle.mjs so it runs beside that suite rather
// than queueing behind it. The reasoning for the instrumentation and the
// baseline lives in lib/lifecycle.mjs and in that file's header.
//
// Both of these are real user paths, not exotic ones. A lost context is exactly
// what a driver failure or a GPU reset produces, and it drives
// onContextLost -> setWebglFail(true) -> <StaticEarth/>. Before the fix that
// left a 60fps renderer running on a canvas no longer in the tree. And on a
// machine where WebGL is blocked or unavailable, supportsWebGL2() returns false
// and the static Earth renders from the first paint - a different branch in the
// same file, taken by every such visit.
//
// Usage: node scripts/test-resource-webgl.mjs
import assert from 'node:assert/strict'
import {
  begin, t, eq, note, settle, readLive, retained, goView,
  withBrowser, startDevServer, warmEarthAndBaseline, bootPage, finish, killTree
} from './lib/lifecycle.mjs'

begin()
const server = await startDevServer()
try {
  // ---- 1. the failover path, where the real leak was ---------------------
  await withBrowser(async (browser) => {
    const page = await bootPage(browser)
    const base = await warmEarthAndBaseline(page)

    // The churn-free session above leaves us on Home, so go to Earth first:
    // there is no Earth canvas to lose a context on otherwise.
    await page.evaluate(() => {
      location.hash = '#/earth'
    })
    await page.waitForSelector('.earth-canvas canvas', { timeout: 20000 })
    await settle(page, 3000)
    const beforeLoss = await readLive(page)
    note(`before loss:    earthCanvas=${beforeLoss.earthCanvas} canvases=${beforeLoss.domCanvases} contexts=${beforeLoss.contexts}`)

    await page.evaluate(() => {
      const c = document.querySelector('.earth-canvas canvas')
      if (c) c.dispatchEvent(new Event('webglcontextlost', { cancelable: true }))
    })
    await settle(page, 4000)
    const failover = await readLive(page)
    const failWindow = retained(failover.byType, base.byType)
    const failCanvas = retained(failover.canvasByType, base.canvasByType)
    note(
      `after ctx loss: canvases=${failover.domCanvases} fallback=${failover.fallback} lost=${failover.contextsLost}/${failover.contexts}`
    )
    note(`  retained win:  ${failWindow.length ? failWindow.join(' ') : 'none'}`)
    note(`  retained cvs:  ${failCanvas.length ? failCanvas.join(' ') : 'none'}`)

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
  })

  // ---- 2. no WebGL2 at all ----------------------------------------------
  // A separate browser: refusing webgl2 has to be in place before the page's
  // first paint, so this cannot share a session with the failover run above.
  await withBrowser(async (browser) => {
    const page = await bootPage(browser, {
      // Installed after the instrumentation so it wraps the counting getContext,
      // and scopes to the probe only by refusing every webgl2 request.
      initScript: `
        (() => {
          const orig = HTMLCanvasElement.prototype.getContext
          HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
            if (/^webgl2$/.test(type)) return null
            return orig.call(this, type, ...rest)
          }
        })()
      `
    })
    const base = await readLive(page)

    await goView(page, '#/earth', '.earth-view')
    await settle(page, 3000)
    const earth = await readLive(page)
    note(
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
    note(`no webgl2:      retained win=${keptWin.length ? keptWin.join(' ') : 'none'} cvs=${keptCvs.length ? keptCvs.join(' ') : 'none'}`)

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
  killTree(server)
}
finish()
