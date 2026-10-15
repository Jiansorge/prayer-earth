// Is the Earth's loading overlay honest?
//
// Split out of test-resource-lifecycle.mjs, which held it alongside the mount
// and churn checks and took 160s in CI - long enough that it alone decided how
// long a deploy waited before it could start. This is self-contained: it needs
// neither the Earth warm-up nor the listener baseline, so it stands alone and
// runs beside the rest.
//
// The overlay used to be dismissed on the first rendered frame, which happens
// before the day map arrives - so it vanished while the globe was still an
// untextured green silhouette. It now stays up until the scene is genuinely
// ready, and this checks both halves of that: shown on the way in, gone once
// the Earth is.
//
// Usage: node scripts/test-resource-loading.mjs
import assert from 'node:assert/strict'
import { begin, t, eq, note, settle, readLive, withBrowser, startDevServer, bootPage, finish, killTree, COLD_READY_TIMEOUT } from './lib/lifecycle.mjs'

begin()
const server = await startDevServer()
try {
  await withBrowser(async (browser) => {
    const page = await bootPage(browser)

    await page.evaluate(() => {
      location.hash = '#/home'
    })
    await page.waitForSelector('.home-head', { timeout: 20000 })
    await settle(page, 1200)
    // Observe the overlay from first paint. Reading the DOM after navigation
    // races the load: by the time the read lands the day map may already be
    // in the HTTP cache, `ready` has flipped, and the overlay has gone - which
    // says nothing about whether it was shown. The observer sees every commit.
    await page.evaluate(() => {
      window.__overlaySeen = false
      window.__overlayGone = false
      const check = () => {
        if (document.querySelector('.earth-loading-overlay')) {
          window.__overlaySeen = true
        } else if (window.__overlaySeen) {
          window.__overlayGone = true
        }
      }
      const obs = new MutationObserver(check)
      obs.observe(document.body, { childList: true, subtree: true })
      window.__overlayObs = obs
      location.hash = '#/earth'
    })
    // The hash change above has to stay inside this evaluate, because the observer
    // must be installed before the view mounts. The wait is separated from it
    // so it can still be the race-free one goView uses - and it only needs the
    // node to exist, not to be laid out.
    await page.waitForFunction(() => !!document.querySelector('.earth-view'), null, { timeout: COLD_READY_TIMEOUT })
    const duringLoad = await readLive(page)
    await settle(page, 7000)
    const afterLoad = await readLive(page)
    const overlay = await page.evaluate(() => {
      window.__overlayObs?.disconnect()
      return { seen: !!window.__overlaySeen, gone: !!window.__overlayGone }
    })
    note(
      `earth loading:  overlay seen=${overlay.seen} dismissed=${overlay.gone} on entry=${duringLoad.loadingOverlay} after ready=${afterLoad.loadingOverlay}`
    )

    t('the loading overlay is shown while the Earth is still loading', () => {
      assert(
        overlay.seen,
        'the loading overlay was never rendered at any point during entry'
      )
    })
    t('the loading overlay is dismissed once the Earth is ready', () => {
      assert(
        overlay.gone,
        'the loading overlay was shown but never taken down after the Earth loaded'
      )
    })
    t('the loading overlay is gone once the Earth is ready', () => {
      eq(afterLoad.loadingOverlay, false, 'the loading overlay is still showing after the Earth loaded')
    })
  })
} finally {
  killTree(server)
}
finish()
