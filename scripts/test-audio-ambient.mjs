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
//   4. A periodic click with no trigger at all: the shared noise loop wrapped
//      with a hard step once every 3 seconds, on every bed. State cannot see
//      a sample discontinuity, so the last section renders the real generator
//      (and a whole preset) through an OfflineAudioContext and reads the
//      output for steps far beyond their neighbours.
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
  // 30s, not 8s: SettingsSheet is a lazy chunk, and this machine's first
  // read of that file inside a fresh dev server measured anywhere from
  // 0.1s to 149s (measured: vite:load 5354ms while vite:transform itself
  // was 60ms) - a green test failing on a server that was working
  // perfectly, the same class as the cold-navigation timeouts in
  // devserver.mjs. The prewarm in boot below pays that stall once; this
  // budget covers the case where it was paid there instead.
  await page.waitForSelector('.sheet-body', { timeout: 30000 })
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

    // Pay the SettingsSheet chunk's one-time first read here, with retries
    // and no sheet budget riding on it. The first read of that file inside a
    // fresh dev server is exactly where this machine stalls for seconds to
    // minutes (vite's [fs] load, not its transform), and after one completed
    // fetch vite serves it from its module graph in single-digit
    // milliseconds - so the sheet open later runs against a warm chunk.
    for (let i = 0; i < 3; i++) {
      const warmed = await page
        .evaluate(async () => {
          try {
            const r = await fetch('/src/components/SettingsSheet.jsx')
            await r.text()
            return r.ok
          } catch {
            return false
          }
        })
        .catch(() => false)
      if (warmed) break
    }

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

    // ---- the rendered graph contains no click ------------------------------
    // Everything above pins state; a click lives in samples. Render the real
    // generator - and then a whole preset - through an OfflineAudioContext and
    // read the output the way an ear does: a click is a sample-to-sample step
    // far beyond its neighbours. Math.random is seeded so the buffer is the
    // same on every machine and the wrap points are reproducible.
    const render = await page.evaluate(async () => {
      const { makeNoiseBuffer, AmbientEngine } = await import('/src/audio/ambience.js')
      let lcg = 42
      const real = Math.random
      Math.random = () => {
        lcg = (lcg * 1664525 + 1013904223) >>> 0
        return lcg / 4294967296
      }
      try {
        const sr = 44100
        const len = sr * 3
        const ctx = new OfflineAudioContext(1, sr * 7, sr)
        const buf = makeNoiseBuffer(ctx)
        const src = ctx.createBufferSource()
        src.buffer = buf
        src.loop = true
        const g = ctx.createGain()
        g.gain.value = 0.5
        src.connect(g)
        g.connect(ctx.destination)
        src.start(0)
        const out = await ctx.startRendering()
        const d = out.getChannelData(0)
        let maxStep = 0
        for (let i = 1; i < d.length; i++) {
          // The wrap pairs (len-1->len and 2len-1->2len) are the seams under
          // test; including them in the baseline would let a click certify
          // itself, since the max step would then BE the seam.
          if (i === len || i === 2 * len) continue
          maxStep = Math.max(maxStep, Math.abs(d[i] - d[i - 1]))
        }
        const seam1 = Math.abs(d[len] - d[len - 1])
        const seam2 = Math.abs(d[2 * len] - d[2 * len - 1])

        // A whole preset end to end: any builder that starts or stops a
        // source without a ramp lands here as a gross step.
        const e = new AmbientEngine()
        const octx = new OfflineAudioContext(2, sr * 7, sr)
        e.ctx = octx
        e.master = octx.createGain()
        e.master.gain.value = 1.6
        e.master.connect(octx.destination)
        e.buildPreset('reiki')
        const full = await octx.startRendering()
        const fd = full.getChannelData(0)
        let fullMax = 0
        for (let i = 1; i < fd.length; i++) {
          fullMax = Math.max(fullMax, Math.abs(fd[i] - fd[i - 1]))
        }
        return { maxStep, seam1, seam2, fullMax }
      } finally {
        Math.random = real
      }
    })
    note(`render: loopMaxStep=${render.maxStep.toFixed(4)} seams=${render.seam1.toFixed(4)}/${render.seam2.toFixed(4)} presetMaxStep=${render.fullMax.toFixed(4)}`)
    t('the rendered noise loop clicks at neither wrap point', () => {
      // The walk's own consecutive samples land near 0.037 at gain 0.5. A
      // wrap twice that is the periodic click; a crossfaded seam stays inside
      // the walk's own step distribution, so 2x plus an absolute floor holds
      // the fix with margin while still failing the hard wrap by ~50%.
      const bound = Math.max(render.maxStep * 2, 0.05)
      assert(render.seam1 <= bound, `wrap 1: ${render.seam1.toFixed(4)} > ${bound.toFixed(4)}`)
      assert(render.seam2 <= bound, `wrap 2: ${render.seam2.toFixed(4)} > ${bound.toFixed(4)}`)
    })
    t('a full preset renders without a gross discontinuity', () => {
      // Generous on purpose: this is the net for a hard start/stop of the
      // whole graph, not a tone check. Healthy builders stay well under 0.5;
      // a source cut at full master gain lands near 1.0.
      assert(render.fullMax < 0.5, `preset max step ${render.fullMax.toFixed(4)}`)
    })

    // ---- all seven beds are equally loud ---------------------------------
    // The builders hand-tune their own pad/air gains, and nothing ever
    // equalized the result: measured raw, Space ran 1.54x the median and
    // Temple 0.67x - a 2.3x spread ("some are louder than others"). The fix
    // is PRESET_TRIM on the preset bus; this renders every preset through
    // the real graph and asserts the levels land inside one band, so a
    // generator retune that re-unbalances the rack fails here rather than
    // in someone's headphones. Offline renders are deterministic (seeded
    // Math.random, fixed length), so the band can be tight.
    const loudness = await page.evaluate(async () => {
      const { AmbientEngine } = await import('/src/audio/ambience.js')
      let lcg = 42
      const real = Math.random
      Math.random = () => {
        lcg = (lcg * 1664525 + 1013904223) >>> 0
        return lcg / 4294967296
      }
      try {
        const sr = 44100
        const ids = ['reiki', 'ocean', 'temple', 'rain', 'forest', 'space', 'warm']
        const out = {}
        for (const id of ids) {
          const octx = new OfflineAudioContext(2, sr * 6, sr)
          const e = new AmbientEngine()
          e.ctx = octx
          e.master = octx.createGain()
          e.master.gain.value = 1
          e.master.connect(octx.destination)
          e.buildPreset(id)
          const rendered = await octx.startRendering()
          const d = rendered.getChannelData(0)
          const skip = Math.floor(sr * 1.1) // past the crossfade
          let sum = 0
          let n = 0
          for (let i = skip; i < d.length; i++) {
            sum += d[i] * d[i]
            n++
          }
          out[id] = Math.sqrt(sum / n)
        }
        return out
      } finally {
        Math.random = real
      }
    })
    const levels = Object.entries(loudness)
    const rmsList = levels.map(([, v]) => v)
    const lo = Math.min(...rmsList)
    const hi = Math.max(...rmsList)
    note(`loudness: ` + levels.map(([k, v]) => `${k}=${v.toFixed(4)}`).join(' ') +
      ` spread=${(hi / lo).toFixed(3)}x`)
    t('all seven ambient beds render at the same loudness', () => {
      assert(lo > 0, 'a bed rendered silent: ' + JSON.stringify(loudness))
      assert(hi / lo <= 1.15,
        `bed spread ${(hi / lo).toFixed(2)}x > 1.15x - a preset drifted off the rack: ` +
        JSON.stringify(Object.fromEntries(levels.map(([k, v]) => [k, +v.toFixed(4)]))))
    })

    // ---- the footer's vertical fader moves voice and bed the same way ------
    // Reported: "the vertical sound toggle seems to disproportionately affect
    // voice and ambient sound volumes".
    //
    // The steady-state balance is locked by construction: one store volume
    // reaches both engines (applyVolumes), the voice applies it linearly,
    // bedTarget is linear in volume, and both share one limiter - so the ratio
    // cannot drift with the fader. What is NOT symmetric is how each engine
    // gets to the new value:
    //
    //   voice  setVolume -> ~0.03 s ramp, either direction
    //   bed    setVolume -> _rampMaster, whose RISING constant is 0.8 s - the
    //          "a prayer arrives gently" swell meant for LEVEL changes. So
    //          dragging up: the voice jumps, the bed follows over seconds;
    //          dragging down: 0.07 s vs 0.03 s, near parity. A discrepancy
    //          that depends on drag direction is what "disproportionate" is.
    //
    // So this section pins scheduling decisions instead of impressions: it
    // wraps AudioParam.setTargetAtTime to record the constants the engines
    // actually schedule, and drives the real footer slider to prove one move
    // reaches both engines as the same number. Recording the schedule rather
    // than sampling the gain over wall-clock is deliberate: a suspended
    // headless context never advances its clock, and a running one only lets
    // you chase a moving target.
    await goView(page, '#/pray/christianity/lords-prayer', '.prayer-stage', 15000)
    await page.waitForSelector('.vol-slider-vert', { timeout: 15000 })

    const wire = await page.evaluate(async () => {
      const store = window.__store
      // Known, audible volume so every key step is a real move off the floor,
      // and unmuted so the mute-seed branch in the control can't reroute it.
      store.setState({ muted: false, volume: 0.8 })
      await window.__ambient.ensure()
      window.__faderGot = { voice: [], bed: [] }
      const sp = window.__speech
      const am = window.__ambient
      const v0 = sp.setVolume
      const a0 = am.setVolume
      // Delegating wrappers, left installed: read once here, and the page is
      // discarded at the end of the run.
      sp.setVolume = function (v) { window.__faderGot.voice.push(v); return v0.call(this, v) }
      am.setVolume = function (v) { window.__faderGot.bed.push(v); return a0.call(this, v) }
      window.__faderTc = []
      const orig = AudioParam.prototype.setTargetAtTime
      AudioParam.prototype.setTargetAtTime = function (value, startTime, timeConstant) {
        try {
          const m = window.__ambient.master
          if (m && this === m.gain) window.__faderTc.push({ value, timeConstant })
        } catch {}
        return orig.call(this, value, startTime, timeConstant)
      }
      return { has: !!document.querySelector('.vol-slider-vert') }
    })
    t('the prayer footer exposes its vertical fader', () => eq(wire.has, true))

    // Move it the way a thumb does. usePrayerKeys may also answer the arrows
    // (a separate +/-0.08 alongside the control's own 0.05 step); every
    // assertion below is written against the invariant - the same number
    // everywhere - so either path, or both, has to agree.
    await page.focus('.vol-slider-vert')
    for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowLeft')
    await settle(page, 300)
    const parity = await page.evaluate(() => ({
      voice: window.__faderGot.voice,
      bed: window.__faderGot.bed,
      store: window.__store.getState().volume,
      slider: Number(document.querySelector('.vol-slider-vert').value)
    }))
    note(`fader: steps=${parity.voice.length} voice=[${parity.voice.join(', ')}] bed=[${parity.bed.join(', ')}] store=${parity.store}`)
    t('one footer fader move pushes the same level into voice and bed', () => {
      assert(parity.voice.length > 0, 'the slider never reached either engine - no step fired')
      assert(parity.voice.length === parity.bed.length,
        `the engines saw different update counts: voice=${parity.voice.length} bed=${parity.bed.length}`)
      for (let i = 0; i < parity.voice.length; i++) {
        assert(parity.voice[i] === parity.bed[i],
          `update ${i} split: voice=${parity.voice[i]} bed=${parity.bed[i]} - one slider, two levels`)
      }
      eq(parity.voice[parity.voice.length - 1], parity.store,
        'the engines were not left at the store volume')
      eq(Math.round(parity.store * 100) / 100, parity.slider,
        'the slider position and the store volume disagree')
    })

    // The ramp constants. _rampMaster classifies rise-vs-fall from the live
    // parameter, so a mid-ramp read (or a frozen suspended clock) would decide
    // the classification for us. Pinning first makes every step below
    // unambiguous: a setValueAtTime hold is constant however far the clock has
    // moved, and nulling _lastRampTarget stops the skip check from swallowing
    // the probe. The probe drives the engine API directly (not the store) so
    // its values cannot be perturbed by UI state; it leaves the engine silent.
    const ramps = await page.evaluate(() => {
      const a = window.__ambient
      if (!a.ctx || !a.master) return { error: 'no graph to schedule against' }
      const rec = window.__faderTc
      const take = () => { const out = rec.slice(); rec.length = 0; return out }
      const pin = (at) => {
        const t = a.ctx.currentTime
        a.master.gain.cancelScheduledValues(t)
        a.master.gain.setValueAtTime(at, t)
        a._lastRampTarget = null
      }
      a.setVolume(0.5)          // a known volume; discarded
      take()
      pin(0)
      a.setLevel(0.9)           // prayer arrival: must stay a GENTLE rise
      const gentle = take()
      pin(0)
      a.setVolume(0.9)          // fader path, rising from the pinned 0
      const up = take()
      pin(10)
      a.setVolume(0.1)          // fader path, falling from the pinned 10
      const down = take()
      pin(0)                    // leave the parameter where a stop would
      return { gentle, up, down }
    })
    const lastTc = (r) => (r && r.length ? r[r.length - 1].timeConstant : null)
    note(`ramps: gentle=${lastTc(ramps.gentle)} up=${lastTc(ramps.up)} down=${lastTc(ramps.down)}` +
      (ramps.error ? ` (${ramps.error})` : ''))
    t('the prayer-arrival swell keeps its gentle rise', () => {
      if (ramps.error) throw new Error(ramps.error)
      const tc = lastTc(ramps.gentle)
      assert(tc !== null, 'setLevel scheduled no master ramp at all')
      assert(tc >= 0.5, `arrival ramp tau ${tc}s < 0.5s - the swell was fast-tracked away`)
    })
    t('a fader rise ramps as fast as the voice, not like an arrival', () => {
      if (ramps.error) throw new Error(ramps.error)
      const tc = lastTc(ramps.up)
      assert(tc !== null, 'setVolume scheduled no master ramp at all')
      assert(tc <= 0.15,
        `fader rise tau ${tc}s > 0.15s while the voice moves in ~0.03s - ` +
        'the bed lags seconds behind on every upward drag (the reported disproportion)')
    })
    t('a fader fall is fast too', () => {
      if (ramps.error) throw new Error(ramps.error)
      const tc = lastTc(ramps.down)
      assert(tc !== null, 'setVolume(fall) scheduled no master ramp at all')
      assert(tc <= 0.15, `fader fall tau ${tc}s > 0.15s - down-drags lag the voice too`)
    })

    // The bed's side of "the same factor": bedTarget must be exactly
    // proportional in volume, so the fader scales the bed the way it scales
    // the voice (which is linear by construction).
    const prop = await page.evaluate(async () => {
      const { bedTarget } = await import('/src/audio/ambience.js')
      const base = bedTarget({ level: 0.9, ambienceLevel: 0.5, volume: 1 })
      const out = {}
      for (const v of [0.2, 0.5, 0.8]) {
        out[v] = bedTarget({ level: 0.9, ambienceLevel: 0.5, volume: v }) / base
      }
      return out
    })
    t('the bed scales in exact proportion to the fader', () => {
      for (const [v, ratio] of Object.entries(prop)) {
        assert(Math.abs(ratio - Number(v)) < 1e-9,
          `volume ${v} gives bed ratio ${ratio} - not proportional`)
      }
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
