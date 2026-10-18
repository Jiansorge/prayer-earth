// Ambient's three failures were each a "where did the sound go" report wearing
// a different costume:
//
//   1. stop() only moved a gain. The oscillators, LFOs, noise loop and
//      Temple's interval kept running at zero from the first prayer onward,
//      forever, on every screen - the silent CPU/memory cost behind "long
//      sessions get staticy". A stop must release the graph, and a rebuild
//      landing inside the teardown window must cancel the pending teardown.
//   2. The settings sheet was not a sandbox: it could start sound nobody asked
//      for, and could leak the audition it did start. Opening must never play;
//      picking a chip must; closing - or stepping into a sub-panel - must end
//      the sheet's own audition while leaving a prayer's running bed alone
//      (dipped to idle and restored on close, never stopped).
//   3. _watchState's bounded resume loop gave up permanently on a refusal,
//      leaving silence until some unrelated tap happened to call ensure(). The
//      idle re-arm restarts the loop when the reader comes back - and must
//      register exactly once, so recovery is not itself a leak.
//
// Everything reads window.__ambient / window.__store, which the dev server
// exposes (TEST_HOOKS is build-gated to DEV/VITE_TEST, never runtime-gated).
// The assertions hold whether or not the headless context actually reaches
// 'running': they pin state on the engine, not audibility.
//
// Usage: node scripts/test-audio-ambient.mjs
import assert from 'node:assert/strict'
import {
  begin, t, eq, note, settle, readLive, goView,
  withBrowser, startDevServer, bootPage, finish, killTree
} from './lib/lifecycle.mjs'

const snap = (page) =>
  page.evaluate(() => {
    const a = window.__ambient
    return {
      running: a.running,
      level: Math.round(a.level * 1000) / 1000,
      bus: !!a.presetBus,
      stops: a.presetStops.length,
      settingsOpen: window.__store.getState().settingsOpen
    }
  })

// stop() schedules teardown 900ms after the fast fade; waiting past it turns
// "the engine says stopped" into "the graph is actually gone".
const waitGone = (page) => settle(page, 1300)

const openSheet = async (page) => {
  await page.evaluate(() => document.querySelector('.gear-btn')?.click())
  await page.waitForSelector('.sheet-body', { timeout: 8000 })
  await settle(page, 450)
}
const closeSheet = async (page) => {
  await page.click('.sheet-close')
  await settle(page, 450)
}

begin()
const server = await startDevServer()
try {
  await withBrowser(async (browser) => {
    const page = await bootPage(browser, {
      // Seed the onboarding flag before any app code runs. A fresh profile
      // shows the overlay, and a post-hoc dismiss click can race the mount and
      // leave an .onboard-backdrop intercepting every real pointer click - a
      // flake that reads like a broken sheet.
      initScript: () => {
        try {
          localStorage.setItem('pe-onboarded', '1')
        } catch {}
      }
    })
    // Belt and braces: dismiss if it somehow mounted anyway, and fail fast
    // with a named cause instead of a 30s pointer-intercept timeout later.
    await page.evaluate(() => document.querySelector('.onboard-skip, .onboard-begin')?.click())
    await page.waitForFunction(
      () => !document.querySelector('.onboard-backdrop'),
      null,
      { timeout: 5000 }
    )
    await settle(page, 400)

    // ---- stop releases the graph; restart rebuilds it ----------------------
    let s = await snap(page)
    t('a fresh page has no bed running', () => eq(s.running, false))

    await page.evaluate(() => window.__ambient.ensure())
    await page.evaluate(() => window.__ambient.start())
    s = await snap(page)
    t('start builds a live bed', () => {
      eq(s.running, true)
      eq(s.bus, true)
      assert(s.stops > 0, 'a built preset registers its stop handles')
    })

    await page.evaluate(() => window.__ambient.stop())
    await waitGone(page)
    s = await snap(page)
    t('stop tears the preset down instead of muting forever', () => {
      eq(s.running, false)
      eq(s.bus, false, 'presetBus still holds the graph - muted, not stopped')
      eq(s.stops, 0, 'the stop handles were never released')
    })

    await page.evaluate(() => window.__ambient.start())
    s = await snap(page)
    t('the next start rebuilds the bed', () => {
      eq(s.running, true)
      eq(s.bus, true)
    })

    // ---- a rebuild inside the teardown window survives ---------------------
    await page.evaluate(() => window.__ambient.stop())
    await settle(page, 150) // well inside the 900ms teardown window
    await page.evaluate(() => window.__ambient.start())
    await settle(page, 1200) // past the moment the old timer would have fired
    s = await snap(page)
    t('start within the teardown window is not killed by the pending stop', () => {
      eq(s.running, true, 'the bed came back but stop() still owns the timer')
      eq(s.bus, true, 'the pending teardown fired on the rebuilt bed')
    })

    // ---- preset-switch storm -------------------------------------------------
    for (const id of ['ocean', 'temple', 'rain', 'forest', 'space', 'warm', 'reiki']) {
      await page.evaluate((pid) => window.__ambient.setPreset(pid), id)
      await settle(page, 160)
    }
    await settle(page, 1200)
    s = await snap(page)
    const errsStorm = (await readLive(page)).errors
    t('a seven-preset storm settles on one live bed with no page errors', () => {
      eq(s.running, true)
      eq(s.bus, true)
      eq(errsStorm.length, 0, errsStorm.join('; '))
    })

    // ---- the settings sheet is a sandbox ------------------------------------
    // Start from "not running at open" - the state the spec is about.
    await page.evaluate(() => window.__ambient.stop())
    await waitGone(page)

    await openSheet(page)
    s = await snap(page)
    t('opening settings never starts sound', () => {
      eq(s.settingsOpen, true)
      eq(s.running, false, 'ambient started the moment the sheet opened')
      eq(s.bus, false)
    })

    // Picking a chip is the one explicit request to hear it.
    await page.click('.ambient-chip')
    await page
      .waitForFunction(
        () =>
          window.__ambient.running &&
          Math.abs(window.__ambient.level - 0.4) < 0.001,
        null,
        { timeout: 6000 }
      )
      .catch(() => {})
    s = await snap(page)
    t('picking a bed chip starts the audition at the sheet level 0.4', () => {
      eq(s.running, true)
      eq(s.level, 0.4)
    })

    await closeSheet(page)
    await waitGone(page)
    s = await snap(page)
    t('closing the sheet releases the audition it started', () => {
      eq(s.running, false)
      eq(s.bus, false, 'the preview outlived the sheet')
    })

    // A bed already running when the sheet opens is the prayer's.
    await page.evaluate(() => window.__ambient.start())
    await page.evaluate(() => window.__ambient.setLevel(0.9))
    await openSheet(page)
    s = await snap(page)
    t('the sheet dips a running prayer bed instead of stopping it', () => {
      eq(s.running, true)
      eq(s.level, 0.4)
    })
    await closeSheet(page)
    s = await snap(page)
    t('closing restores the prayer bed it dipped', () => {
      eq(s.running, true)
      eq(s.level, 0.9)
    })

    // With a prayer bed running, another chip is a switch, not a stop.
    await openSheet(page)
    await page.evaluate(() => document.querySelector('[data-preset="ocean"]')?.click())
    await settle(page, 900)
    await closeSheet(page)
    s = await snap(page)
    t('switching chips while a prayer bed runs keeps it running', () => {
      eq(s.running, true, 'the switch path tore the prayer bed down')
      eq(s.level, 0.9)
    })

    // Stepping into a sub-panel exits the same way a close does.
    await page.evaluate(() => window.__ambient.stop())
    await waitGone(page)
    await openSheet(page)
    await page.click('.ambient-chip')
    await page.waitForFunction(() => window.__ambient.running, null, { timeout: 6000 })
    await page.evaluate(() => document.querySelector('[data-testid="row-privacy"]')?.click())
    await waitGone(page)
    s = await snap(page)
    t('stepping into Privacy ends the audition like a close', () => {
      eq(s.running, false)
      eq(s.bus, false, 'the preview outlived the step into a sub-panel')
    })
    // Leave the sheet on its main list and close it, for the sections below.
    await page.evaluate(() => document.querySelector('.settings-back')?.click())
    await settle(page, 300)
    await closeSheet(page)

    // ---- the idle re-arm: exactly one set of listeners, safe to kick --------
    const base = await readLive(page)
    await page.evaluate(() => window.__ambient._armIdleRetry())
    await page.evaluate(() => window.__ambient._armIdleRetry()) // must be a no-op
    const armed = await readLive(page)
    const delta = (k) => (armed.byType[k] || 0) - (base.byType[k] || 0)
    note(`idle re-arm deltas: visibilitychange=${delta('visibilitychange')} focus=${delta('focus')} pointerdown=${delta('pointerdown')}`)
    t('the idle re-arm registers exactly one set of listeners', () => {
      eq(delta('visibilitychange'), 1)
      eq(delta('focus'), 1)
      eq(delta('pointerdown'), 1)
    })
    await page.evaluate(() => window.dispatchEvent(new Event('focus')))
    await settle(page, 300)
    const afterKick = await readLive(page)
    t('the re-arm kick runs without page errors', () => {
      eq(afterKick.errors.length, 0, afterKick.errors.join('; '))
    })

    // ---- rapid multi-action storm: nav, settings, picks, stops --------------
    const ids = ['ocean', 'temple', 'rain', 'forest', 'space', 'warm', 'reiki']
    for (let i = 0; i < 9; i++) {
      await page.evaluate(() => window.__store.getState().setSettingsOpen(true))
      await page.evaluate((id) => window.__ambient.setPreset(id), ids[i % ids.length])
      await page.evaluate(
        (h) => {
          window.location.hash = h
        },
        i % 2 ? '#/pray/christianity/lords-prayer' : '#/'
      )
      // Every third stop starts again 90ms later - inside the teardown
      // window - so the storm also exercises stop/start racing.
      if (i % 3 === 0) await page.evaluate(() => window.__ambient.stop())
      else await page.evaluate(() => window.__ambient.start())
      await page.evaluate(() => window.__store.getState().setSettingsOpen(false))
      await settle(page, 90)
    }
    await page.evaluate(() => window.__store.getState().setSettingsOpen(false))
    await page.evaluate(() => window.__ambient.stop())
    await waitGone(page)
    const storm = await readLive(page)
    s = await snap(page)
    note(`storm end: running=${s.running} bus=${s.bus} errors=${storm.errors.length}`)
    t('the storm ends with the bed released and no page errors', () => {
      eq(s.running, false)
      eq(s.bus, false, 'a bed survived the storm unmuted')
      eq(storm.errors.length, 0, storm.errors.join('; '))
    })

    // Navigation still answers after everything above. The deep link selects
    // the prayer itself; bare '#/prayer' renders only with a prior selection,
    // which a fresh profile does not have.
    await goView(page, '#/pray/christianity/lords-prayer', '.prayer-stage', 15000)
    await goView(page, '#/', '.view', 15000)
    t('navigation still works after the storm', () => eq(s.settingsOpen, false))
  })
} finally {
  killTree(server)
}
finish()
