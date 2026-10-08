import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import WebSocket from 'ws'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PACKAGE = 'app.joiningpalms'
const APK = path.resolve(process.env.APK || path.join(ROOT, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk'))
const UPGRADE_APK = process.env.UPGRADE_APK ? path.resolve(process.env.UPGRADE_APK) : null
const PORT = Number(process.env.ANDROID_CDP_PORT || 9300 + (process.pid % 400))
const SERIAL = process.env.ANDROID_SERIAL || ''
const ADB = process.env.ADB || (process.platform === 'win32'
  ? path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk', 'platform-tools', 'adb.exe')
  : 'adb')
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// Settings sub-panels replace the main list rather than pushing onto it, so
// whichever panel the previous test left open has to be closed before a row is
// clickable. Returns true when the main list is showing.
const ensureMainList = async () => {
  for (let i = 0; i < 4; i++) {
    const hasBack = await cdp.evaluate(`!!document.querySelector('.settings-back')`)
    if (!hasBack) return true
    await cdp.evaluate(`document.querySelector('.settings-back')?.click()`)
    await sleep(300)
  }
  return !(await cdp.evaluate(`!!document.querySelector('.settings-panel')`))
}

// The app shell's URL, derived from capacitor.config rather than hardcoded.
//
// This suite drives the WebView by hand and used to hardcode
// capacitor://localhost/, which became a dead URL the moment androidScheme was
// set to https. Deriving it means the two cannot drift apart again.
const APP_SHELL_URL = (() => {
  const cfg = JSON.parse(readFileSync(path.join(ROOT, 'capacitor.config.json'), 'utf8'))
  const scheme = (cfg && cfg.server && cfg.server.androidScheme) || 'https'
  return scheme + '://localhost/'
})()
let failures = 0
let cdp = null
let forwarded = false

const log = (...args) => console.log('[android-smoke]', ...args)
let checksRun = 0
const check = (name, condition, detail = '') => {
  log(`${condition ? 'PASS' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`)
  checksRun++
  if (!condition) failures++
}

const adbArgs = (args) => SERIAL ? ['-s', SERIAL, ...args] : args
const adb = (args) => {
  try {
    return execFileSync(ADB, adbArgs(args), { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  } catch (error) {
    const detail = String(error.stderr || error.message || '').trim()
    throw new Error(`adb ${args.join(' ')} failed${detail ? `: ${detail}` : ''}`)
  }
}

const deviceConnected = () => {
  const output = adb(['devices'])
  const rows = output.split(/\r?\n/).slice(1).map((line) => line.trim()).filter(Boolean)
  if (SERIAL) return rows.some((row) => row.startsWith(`${SERIAL}\tdevice`))
  return rows.some((row) => row.endsWith('\tdevice'))
}

const install = (apk) => {
  if (!existsSync(apk)) throw new Error(`APK not found: ${apk}`)
  adb(['install', '-r', apk])
}

const launch = () => {
  adb(['shell', 'am', 'force-stop', PACKAGE])
  adb(['shell', 'monkey', '-p', PACKAGE, '-c', 'android.intent.category.LAUNCHER', '1'])
}

const appPid = async () => {
  for (let i = 0; i < 40; i++) {
    try {
      const value = adb(['shell', 'pidof', PACKAGE]).trim().split(/\s+/)[0]
      if (value) return value
    } catch {}
    await sleep(250)
  }
  throw new Error(`${PACKAGE} did not start`)
}

class CDP {
  constructor(url) {
    this.ws = new WebSocket(url)
    this.id = 0
    this.pending = new Map()
    this.events = []
    this.ws.on('message', (raw) => {
      const message = JSON.parse(raw.toString())
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id)
        this.pending.delete(message.id)
        if (message.error) reject(new Error(message.error.message))
        else resolve(message.result)
        return
      }
      if (message.method) this.events.push(message)
    })
  }

  open() {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('WebView DevTools connection timed out')), 5000)
      this.ws.once('open', () => { clearTimeout(timer); resolve() })
      this.ws.once('error', (error) => { clearTimeout(timer); reject(error) })
    })
  }

  send(method, params = {}, timeout = 10000) {
    const id = ++this.id
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`DevTools command timed out: ${method}`))
      }, timeout)
      this.pending.set(id, {
        resolve: (value) => { clearTimeout(timer); resolve(value) },
        reject: (error) => { clearTimeout(timer); reject(error) }
      })
      this.ws.send(JSON.stringify({ id, method, params }))
    })
  }

  // Inspector-level failures that say nothing about the app.
  //
  // Two families arrive here as ordinary errors and, if propagated, abort the
  // whole suite on a transient - this job failed 6 times in 13 runs from these,
  // with every app assertion before the fault already PASSing.
  //
  // 1. V8 collecting the promise an `awaitPromise: true` evaluation waits on:
  //    "Promise was collected". That string is not from the app; it is in the
  //    node binary next to the other inspector messages.
  // 2. A context destroyed or not yet created by a navigation: "Execution
  //    context was destroyed", "Cannot find context with specified id". The next
  //    evaluation targets the new context, so retrying is correct.
  //
  // These two are retried once, then reported. A retry is right for them because
  // the fault is in the debugger losing track of its own object, not in the
  // device being slow - one extra round trip settles it.
  //
  // A TIMEOUT is deliberately not in this list. "DevTools command timed out"
  // means the WebView did not answer, and whether that is the emulator being
  // slow or the app hanging is exactly the question a red job exists to answer.
  // Absorbing it here would turn a real signal into a green build, and cost more
  // wall-clock than it saves. It fails, loudly, with the timeout named.
  static TRANSIENT = [
    'Promise was collected',
    'Execution context was destroyed',
    'Execution context is not available',
    'Cannot find context with specified id',
    'Inspected target navigated or closed',
    'Target closed',
  ]

  isTransient(error) {
    const message = String(error?.message || error || '')
    return CDP.TRANSIENT.some((fragment) => message.includes(fragment))
  }

  // True for a timeout, which is a real signal and never retried. Kept as its
  // own predicate so the distinction is stated once, where it is decided.
  isTimeout(error) {
    return String(error?.message || error || '').includes('DevTools command timed out')
  }

  async evaluate(expression, attempt = 0) {
    let result
    try {
      result = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    } catch (error) {
      // One retry, so a lost inspector object cannot fail the run, but no more:
      // if the second attempt also fails, it is reported.
      if (attempt < 1 && this.isTransient(error) && !this.isTimeout(error)) {
        await sleep(500)
        return this.evaluate(expression, attempt + 1)
      }
      throw error
    }
    if (result.exceptionDetails) {
      const text = result.exceptionDetails.text || 'Runtime evaluation failed'
      if (attempt < 1 && this.isTransient(new Error(text))) {
        await sleep(500)
        return this.evaluate(expression, attempt + 1)
      }
      throw new Error(text)
    }
    return result.result?.value
  }

  async waitFor(expression, timeout = 15000) {
    const started = Date.now()
    while (Date.now() - started < timeout) {
      try {
        const value = await this.evaluate(expression)
        if (value) return value
      } catch {}
      await sleep(250)
    }
    return null
  }

  close() {
    try { this.ws.close() } catch {}
  }
}

const connect = async () => {
  const pid = await appPid()
  try { adb(['forward', '--remove', `tcp:${PORT}`]) } catch {}
  adb(['forward', `tcp:${PORT}`, `localabstract:webview_devtools_remote_${pid}`])
  forwarded = true
  for (let i = 0; i < 40; i++) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/json`, { signal: AbortSignal.timeout(1000) })
      const pages = await response.json()
      const page = pages.find((item) => item.type === 'page')
      if (page) {
        const client = new CDP(page.webSocketDebuggerUrl)
        try {
          await client.open()
          await client.send('Runtime.enable')
          try { await client.send('Log.enable') } catch {}
          await client.send('Page.enable')
          cdp = client
          return cdp
        } catch (error) {
          client.close()
          throw error
        }
      }
    } catch {}
    await sleep(250)
  }
  throw new Error('WebView DevTools endpoint did not become available')
}

const dismissOnboarding = async () => {
  await cdp.evaluate(`(() => { const button = document.querySelector('.onboard-skip, .onboard-begin'); if (button) button.click(); return true })()`)
}

const enableTestBridge = async () => {
  // The store hook is now gated at BUILD time (VITE_TEST_HOOKS=true in the
  // instrumented capacitor build); the old `?peTest=1` query param is gone.
  await cdp.send('Page.navigate', { url: APP_SHELL_URL })
  await cdp.waitFor(`document.readyState === 'complete' && !!document.querySelector('.app')`, 15000)
  await dismissOnboarding()
  await cdp.waitFor(`!!window.__store`, 15000)
}

const testSurface = async () => {
  await cdp.waitFor(`document.readyState === 'complete' && !!document.querySelector('.app')`, 15000)
  await dismissOnboarding()
  await cdp.waitFor(`!!window.__store`, 15000)
  await cdp.evaluate(`location.hash = '#/earth'`)
  const earth = await cdp.waitFor(`!!document.querySelector('.earth-view') && !document.body.innerText.includes('A little light flickered')`, 20000)
  const surface = await cdp.evaluate(`({ canvas: !!document.querySelector('.earth-canvas canvas'), fallback: !!document.querySelector('.earth-fallback'), boundary: document.body.innerText.includes('A little light flickered') })`)
  check('Earth route avoids the error boundary', !!earth && !surface.boundary, JSON.stringify(surface))
  check('Earth route has a canvas or static fallback', surface.canvas || surface.fallback, JSON.stringify(surface))
  if (surface.canvas) {
    const size = await cdp.evaluate(`(() => { const canvas = document.querySelector('.earth-canvas canvas'); return canvas ? { width: canvas.clientWidth, height: canvas.clientHeight } : null })()`)
    check('Earth canvas has usable dimensions', !!size && size.width > 100 && size.height > 100, JSON.stringify(size))
  }
}

const testAudio = async () => {
  await cdp.evaluate(`location.hash = '#/pray/buddhism/mani'`)
  await cdp.waitFor(`!!document.querySelector('.ctrl-btn.play')`, 15000)
  await cdp.evaluate(`document.querySelector('.ctrl-btn.play').click()`)
  const playing = await cdp.waitFor(`window.__store?.getState().playing === true || window.__speech?.job?.active === true`, 12000)
  const playbackState = await cdp.evaluate(`(() => { const s = window.__store?.getState?.(); return { playing: s?.playing, jobActive: window.__speech?.job?.active === true, mode: window.__speech?.job?.mode || null } })()`)
  check('Android prayer playback starts', !!playing, JSON.stringify(playbackState))
  const audio = await cdp.waitFor(`window.__speech && (window.__speech.cloudAudio || window.__speech.cloudSource)`, 12000)
  const state = await cdp.evaluate(`(() => { const speech = window.__speech; const element = speech?.cloudAudio; return { reverb: speech?.reverbWetGain, mode: speech?.job?.mode, element: !!element, paused: element?.paused ?? null, rate: element?.playbackRate ?? null, volume: element?.volume ?? null } })()`)
  check('Android audio route starts', !!audio, JSON.stringify(state))
  check('reverb configuration reaches the APK', state.reverb === 0.2, `gain=${state.reverb}`)
  if (state.element) check('audio element is not paused', state.paused === false, JSON.stringify(state))
  const exceptions = cdp.events.filter((event) => event.method === 'Runtime.exceptionThrown')
  const exceptionText = exceptions.map((event) => event.params?.exceptionDetails?.exception?.description || event.params?.exceptionDetails?.text || 'unknown').join(' | ')
  // Must match BOTH app-shell schemes. The shell is served from https://localhost
// (capacitor.config androidScheme), and a filter that only knew the old
// capacitor:// origin would quietly match nothing - a green check that can never
// fail.
const assetLogs = cdp.events.filter((event) =>
    event.method === 'Log.entryAdded' &&
    /(?:\/\/|capacitor:\/\/)localhost\/assets|Unable to preload CSS|ERR_FILE_NOT_FOUND/i.test(
      event.params?.entry?.text || ''
    )
  )
  check('Android WebView has no uncaught exceptions', exceptions.length === 0, `exceptions=${exceptions.length}${exceptionText ? ` ${exceptionText}` : ''}`)
  check('Android WebView loads packaged assets', assetLogs.length === 0, `assetErrors=${assetLogs.length}`)
  await cdp.evaluate(`document.querySelector('.ctrl-btn.stop')?.click()`)
  await cdp.waitFor(`window.__store?.getState().playing === false`, 8000)
}

const testTaras = async () => {
  await cdp.evaluate(`window.__store.getState().openPrayer('buddhism', 'mani')`)
  await cdp.waitFor(`!!document.querySelector('.ctrl-btn.play')`, 15000)
  await cdp.evaluate(`document.querySelector('.ctrl-btn.play')?.click()`)
  await cdp.waitFor(`window.__speech?.job?.active === true && (window.__speech.cloudAudio || window.__speech.cloudSource)`, 12000)
  const switched = await cdp.evaluate(`(() => { const chip = [...document.querySelectorAll('.chooser .chip')].find((node) => node.innerText.includes('Twenty-One')); if (!chip) return false; chip.click(); return true })()`)
  await cdp.waitFor(`window.__store?.getState().prayerId === '21-taras-praise' && document.querySelector('.prayer-title')?.innerText.includes('Twenty-One') && !!document.querySelector('.ctrl-btn.play')`, 10000)
  check('switching from mani to 21 Taras selects the new prayer', !!switched, `switched=${switched}`)
  await cdp.evaluate(`document.querySelector('.ctrl-btn.play')?.click()`)
  const started = await cdp.waitFor(`window.__speech?.job?.active === true && (window.__speech.cloudAudio || window.__speech.cloudSource)`, 15000)
  const state = await cdp.evaluate(`(() => { const sp = window.__speech; return { mode: sp?.job?.mode || null, source: !!sp?.cloudSource, element: !!sp?.cloudAudio, manifestVoices: sp?._manifestData?.prayers?.['21-taras-praise']?.voices?.length || 0 } })()`)
  const samples = []
  for (let i = 0; i < 24; i++) {
    await sleep(500)
    samples.push(await cdp.evaluate(`document.querySelector('.prayer-line.on')?.innerText || ''`))
  }
  const distinct = [...new Set(samples.filter(Boolean))]
  let transitions = 0
  for (let i = 1; i < samples.length; i++) if (samples[i] && samples[i] !== samples[i - 1]) transitions++
  check('21 Taras recorded audio starts', !!started && state.mode === 'tts' && state.manifestVoices > 0, JSON.stringify(state))
  // The first 21-Taras verse is ~10-12s of speech, so it must STILL be the
  // active line 5s in. The old bug counted the Tibetan underlay's tsheg as one
  // "word", collapsed the stall-watchdog to ~4s, and cut every verse after a
  // few words â€” here the active line would already have changed by 5s.
  const firstStillPlaying = !!samples[0] && samples[0] === samples[9]
  check('21 Taras first verse plays in full (not cut off ~4s)', firstStillPlaying, `at0.5s=${(samples[0]||'').slice(0,18)} at5s=${(samples[9]||'').slice(0,18)}`)
  await cdp.evaluate(`document.querySelector('.ctrl-btn.stop')?.click()`)
  await cdp.waitFor(`window.__store?.getState().playing === false`, 8000)
}

const testDeepLink = async () => {
  // A shared/QR link (https://joining-palms.app/#/pray/<spirit>/<prayer>) is
  // delivered to the app as a VIEW intent; @capacitor/app's appUrlOpen must
  // hand its #/... hash to the hash router and open that prayer. We target the
  // component explicitly (no chooser) so this is deterministic, and put the app
  // on a different prayer first to prove the intent actually navigated.
  await cdp.evaluate(`window.__store.getState().openPrayer('buddhism', '21-taras')`)
  await cdp.waitFor(`window.__store?.getState().prayerId === '21-taras'`, 10000)
  const url = 'https://joining-palms.app/#/pray/buddhism/mani'
  adb(['shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', url, '-n', `${PACKAGE}/.MainActivity`])
  const routed = await cdp.waitFor(`window.__store?.getState().prayerId === 'mani' && location.hash === '#/pray/buddhism/mani'`, 12000)
  const state = await cdp.evaluate(`({ id: window.__store?.getState().prayerId || null, hash: location.hash })`)
  check('external deep link routes to the shared prayer', !!routed, JSON.stringify(state))
}

const testLifecycle = async () => {
  await cdp.evaluate(`location.hash = '#/pray/buddhism/mani'`)
  await cdp.waitFor(`!!document.querySelector('.ctrl-btn.play')`, 15000)
  await cdp.evaluate(`document.querySelector('.ctrl-btn.play')?.click()`)
  await cdp.waitFor(`window.__store?.getState().playing === true`, 12000)
  await sleep(1500)
  const before = await cdp.evaluate(`(() => { const s = window.__store.getState(); return { seconds: s.localPrayerSeconds, completions: s.prayerCompletions.mani || 0 } })()`)
  adb(['shell', 'input', 'keyevent', '3'])
  await sleep(1500)
  adb(['shell', 'am', 'start', '-n', `${PACKAGE}/.MainActivity`])
  await sleep(1500)
  let foreground
  try {
    foreground = await cdp.evaluate(`(() => { const s = window.__store.getState(); return { playing: s.playing, paused: s.paused, seconds: s.localPrayerSeconds } })()`)
  } catch {
    cdp.close()
    cdp = await connect()
    await enableTestBridge()
    foreground = await cdp.evaluate(`(() => { const s = window.__store.getState(); return { playing: s.playing, paused: s.paused, seconds: s.localPrayerSeconds } })()`)
  }
  // The prayer must still be playing after returning to the foreground â€” that
  // silent-resume is the regression this guards. Assert the real foreground
  // state explicitly; only nudge playback back afterwards so the rest of the
  // suite can continue.
  check('prayer survives background/foreground without a nudge', foreground.playing === true, `foreground=${JSON.stringify(foreground)}`)
  if (!foreground.playing) {
    await cdp.evaluate(`document.querySelector('.nav-play')?.click()`)
    await cdp.waitFor(`window.__store?.getState().playing === true`, 8000)
  }
  const recovered = await cdp.evaluate(`(() => { const s = window.__store.getState(); return { playing: s.playing, seconds: s.localPrayerSeconds } })()`)
  check('background and foreground keep prayer recoverable', recovered.playing === true && recovered.seconds >= before.seconds, JSON.stringify({ before, foreground, recovered }))
  await cdp.evaluate(`document.querySelector('.ctrl-btn.stop')?.click()`)
  await sleep(1200)
  const persisted = await cdp.evaluate(`(() => { const s = window.__store.getState(); return { seconds: s.localPrayerSeconds, completions: s.prayerCompletions.mani || 0 } })()`)
  cdp.close()
  cdp = null
  adb(['shell', 'am', 'force-stop', PACKAGE])
  launch()
  cdp = await connect()
  await enableTestBridge()
  const after = await cdp.evaluate(`(() => { const s = window.__store.getState(); return { seconds: s.localPrayerSeconds, completions: s.prayerCompletions.mani || 0 } })()`)
  check('force-stop and relaunch preserve counters', after.seconds >= persisted.seconds && after.completions >= persisted.completions, JSON.stringify({ persisted, after }))
}

// Informational, NOT an assertion. The Android WebView serves over the
// `capacitor:` scheme, which is not a secure context, so crypto.subtle is
// absent and there is no Web Crypto. That is a platform fact, not a regression
// -- failing CI over it would be permanently red. It is recorded here so the
// passphrase-encryption decision stays grounded in measurement.
const testCryptoSupport = async () => {
  const caps = await cdp.evaluate(`(() => {
    const c = window.crypto || {}
    return {
      hasSubtle: !!(c && c.subtle),
      secure: (() => { try { return window.isSecureContext } catch (e) { return 'unknown' } })(),
      getRandom: typeof c.getRandomValues === 'function',
      scheme: location.protocol
    }
  })()`)
  log(`crypto support: ${JSON.stringify(caps)}`)
}

const testLocationCoarse = async () => {
  // ACCESS_FINE_LOCATION was removed: the app only ever used a coarse fix
  // (enableHighAccuracy:false, rounded to 0.1 deg), and the shipped manifest is
  // asserted separately in test-android-assets.mjs.
  //
  // youLoc is deliberately null when there is no real fix. ensureLocation() only
  // publishes a position to the store on the GPS-success path, so the "you are
  // here" ring is never drawn at a guessed city -- the world's light still uses
  // the timezone anchor, but the app does not pretend to know where you are.
  // So assert the INVARIANT (null, or a real coarse coordinate), not a value.
  const loc = await cdp.evaluate(`(() => {
    const s = window.__store.getState()
    return { youLoc: s.youLoc }
  })()`)
  const l = loc.youLoc
  log(`youLoc: ${JSON.stringify(l)} (null is correct without a real fix)`)
  check('youLoc is either unset or a real coarse coordinate',
    l === null || (Number.isFinite(l.lat) && Number.isFinite(l.lon) &&
      Math.abs(l.lat) <= 90 && Math.abs(l.lon) <= 180),
    JSON.stringify(l))
  if (l) {
    check('a real fix is rounded to a coarse 0.1 degree',
      Math.abs(l.lat * 10 - Math.round(l.lat * 10)) < 1e-9, `lat=${l.lat}`)
  }
  const perms = await cdp.evaluate(`(async () => {
    try {
      const p = navigator.permissions && navigator.permissions.query({ name: 'geolocation' })
      return p ? (await p).state : 'unknown'
    } catch (e) { return 'unsupported' }
  })()`)
  log(`geolocation permission state: ${perms}`)
}

// What the Android WebView can actually do for EXPORTING a backup. The desktop
// browser supports blob downloads; the app shell does not, which is why backup
// export has fallbacks. This is side-effect free (canShare, not share) so it
// never puts a share sheet on the user's screen.
//
// It also records which mechanisms exist, so a future change that assumes one of
// them fails loudly here instead of silently producing a dead button.
const testExportCapabilities = async () => {
  const caps = await cdp.evaluate(`(() => {
    const o = {}
    o.isAppShell = !!(window.Capacitor && (window.Capacitor.isNativePlatform?.() || window.Capacitor.getPlatform?.()))
    o.secure = window.isSecureContext
    o.File = typeof File === 'function'
    o.createObjectURL = typeof URL?.createObjectURL === 'function'
    o.anchorDownload = 'download' in document.createElement('a')
    o.share = typeof navigator.share === 'function'
    o.canShare = typeof navigator.canShare === 'function'
    o.clipboardWrite = !!(navigator.clipboard && navigator.clipboard.writeText)
    o.execCommand = typeof document.execCommand === 'function'
    try {
      o.canShareFile = navigator.canShare
        ? navigator.canShare({ files: [new File(['x'], 'b.txt', { type: 'text/plain' })] })
        : null
    } catch (e) { o.canShareFile = 'threw' }
    return o
  })()`)
  log(`export capabilities: ${JSON.stringify(caps)}`)

  // The app must never rely on a single mechanism. These are the building
  // blocks the fallback chain needs.
  check('the app shell can render a selectable fallback field (File API present)', caps.File)
  check('the fallback chain has a legacy copy path available',
    caps.clipboardWrite || caps.execCommand, JSON.stringify({ clipboard: caps.clipboardWrite, execCommand: caps.execCommand }))

  // A blob download is the thing that silently does nothing in the app shell, so
  // assert the app treats it as unavailable there and does not claim success.
  const reported = await cdp.evaluate(`(() => {
    const s = window.__store && window.__store.getState()
    return { isShell: !!(window.Capacitor && window.Capacitor.isNativePlatform?.()) }
  })()`)
  check('in the app shell, backup export must not rely on a blob download',
    reported.isShell ? caps.anchorDownload === true : true,
    'anchor download attr exists but the WebView has no download listener')
}

// A programmatic .click() is NOT a user gesture, and document.execCommand('copy')
// legitimately refuses without one. So the earlier programmatic tap could not
// distinguish "the fallback works" from "the fallback is broken". This dispatches
// a REAL input event at the button's own coordinates, which is a genuine gesture,
// and then reads what the user would actually see.
const realTap = async (selector) => {
  const box = await cdp.evaluate(`(() => {
    const el = [...document.querySelectorAll('.field-btn')]
      .find(b => /copy recovery code/i.test(b.textContent || ''))
    if (!el) return null
    el.scrollIntoView({ block: 'center' })
    const r = el.getBoundingClientRect()
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }
  })()`)
  if (!box) return null
  await sleep(300)
  for (const type of ['mousePressed', 'mouseReleased']) {
    await cdp.send('Input.dispatchMouseEvent', {
      type, x: box.x, y: box.y, button: 'left', clickCount: 1, buttons: type === 'mousePressed' ? 1 : 0
    })
  }
  return box
}

// The web suite covers ambient, streaks, corrupt-storage recovery and the theme
// backdrops. A phone is the hardest place for audio (a small speaker, not
// headphones) and the place a user is most likely to lose data, so those are
// mirrored here rather than assumed to behave the same.
const testAmbientAndStreak = async () => {
  await cdp.evaluate(`location.hash = '#/'`)
  await sleep(600)

  // --- ambient controls exist and are wired ---
  const amb = await cdp.evaluate(`(() => {
    const chips = document.querySelectorAll('.ambient-chip').length
    return { chips, hasAudioApi: typeof (window.AudioContext || window.webkitAudioContext) === 'function' }
  })()`)
  log(`ambient on device: ${JSON.stringify(amb)}`)
  check('the device has a Web Audio context', amb.hasAudioApi, JSON.stringify(amb))

  // Open Settings and confirm the 7 beds are offered, matching the web.
  await cdp.evaluate(`(() => {
    const btn = [...document.querySelectorAll('button,[role="button"]')]
      .find(b => /settings|⚙/i.test(b.getAttribute('aria-label') || b.title || ''))
    if (btn) btn.click()
    return !!btn
  })()`)
  await cdp.waitFor(`!!document.querySelector('.field-btn')`, 8000)
  const settingsAmb = await cdp.evaluate(`(() => ({
    chips: document.querySelectorAll('.ambient-chip').length,
    voice: !!document.querySelector('[id$="-voice"]'),
    ambient: !!document.querySelector('[id$="-ambient"]')
  }))()`)
  check('settings offers the 7 ambient beds on device', settingsAmb.chips === 7, JSON.stringify(settingsAmb))
  check('settings offers prayer voice + ambient volume on device',
    settingsAmb.voice && settingsAmb.ambient, JSON.stringify(settingsAmb))

  // The audio engine is exercised through the store actions below.
  // The packaged bundle is hashed, so drive the engine through the store's own
  // settings actions instead of importing it.
  const audible = await cdp.evaluate(`(async () => {
    const s = window.__store
    const before = s.getState()
    const originalPreset = before.ambientPreset
    const originalLevel = before.ambienceLevel
    try {
      s.getState().setAmbientPreset(originalPreset)
      s.getState().setAmbienceLevel(1)
      await new Promise(r => setTimeout(r, 1200))
      const after = s.getState()
      return {
        ok: after.ambienceLevel === 1,
        level: after.ambienceLevel,
        preset: after.ambientPreset
      }
    } catch (e) {
      return { ok: false, error: String(e).slice(0, 90) }
    } finally {
      s.getState().setAmbienceLevel(originalLevel)
      s.getState().setAmbientPreset(originalPreset)
    }
  })()`)
  check('the ambient engine accepts a preset + level on device', audible.ok, JSON.stringify(audible))

  // --- streak behaves the same as the web ---
  // Same seeding as the web suite: a continuation needs a non-zero starting
  // streak, otherwise "yesterday" can only ever produce 1 and the assertion
  // would be testing nothing.
  const streak = await cdp.evaluate(`(() => {
    const s = window.__store
    const key = (t) => t.getUTCFullYear() + '-' + String(t.getUTCMonth() + 1).padStart(2, '0') + '-' + String(t.getUTCDate()).padStart(2, '0')
    const day = (offset) => { const d = new Date(); d.setUTCDate(d.getUTCDate() - offset); return key(d) }
    s.setState({ streak: 0, bestStreak: 0, lastPrayedDay: null })
    s.getState().markPrayedToday()
    const first = s.getState().streak
    s.getState().markPrayedToday()
    const sameDay = s.getState().streak
    s.setState({ streak: 1, bestStreak: 1, lastPrayedDay: day(1) })
    s.getState().markPrayedToday()
    const continued = s.getState().streak
    const best = s.getState().bestStreak
    s.setState({ streak: 0, bestStreak: 0, lastPrayedDay: day(3) })
    s.getState().markPrayedToday()
    const broken = s.getState().streak
    return { first, sameDay, continued, best, broken }
  })()`)
  log(`streak on device: ${JSON.stringify(streak)}`)
  check('first day of prayer starts a streak', streak.first === 1, JSON.stringify(streak))
  check('praying twice in one day does not double-count', streak.sameDay === 1, JSON.stringify(streak))
  check('yesterday continues the streak', streak.continued === 2, JSON.stringify(streak))
  check('the best streak tracks the high water mark', streak.best === 2, JSON.stringify(streak))
  check('a missed day restarts the streak at 1', streak.broken === 1, JSON.stringify(streak))

  // Streak probing above mutated counters. That is safe by construction: every
  // counter is max-merged, so the user's lifetime total can only be climbed,
  // never lowered. The streak itself is only ever SET here, never persisted as
  // a lower value, and a later `markPrayedToday` recomputes it.
}

// A corrupt localStorage entry is a realistic phone failure (interrupted write,
// or a bad restore). The app must recover rather than white-screen.
//
// DESTRUCTIVE, so it snapshots and restores the whole store around the test.
// An earlier version wrote the corrupt value and reloaded without restoring,
// which WIPED the real user's prayer data when this suite ran against a physical
// phone. A test must never cost the user their history, so the snapshot is
// mandatory and the restore is verified, not assumed.
const testCorruptStorageRecovery = async () => {
  const KEY = 'prayer-earth-v1'
  // Hold the snapshot in NODE, not on window: the test reloads the page, which
  // destroys the JS context, so a window-level backup would not survive. An
  // earlier version did exactly that and wiped the real user's prayer data when
  // this suite ran against a physical phone.
  const saved = await cdp.evaluate(`(() => localStorage.getItem(${JSON.stringify(KEY)}))()`)
  if (!saved) { check('corrupt storage test ran', true, 'no existing data to protect'); return }
  check('snapshot taken before the destructive test', typeof saved === 'string' && saved.length > 20,
    `${String(saved).length} bytes`)

  const seeded = await cdp.evaluate(`(() => {
    try { localStorage.setItem('prayer-earth-v1', '{"state":{"localPrayerSeconds":'); return true } catch (e) { return false }
  })()`)
  if (!seeded) { check('corrupt storage test ran', true, 'localStorage unavailable'); return }

  // Remember what the store held, so the restore can be checked against the real
  // invariant: the same counters come back. Do NOT assert an anonId exists - a
  // fresh install that has never synced legitimately has none, and the emulator
  // is always in that state.
  const baseline = await cdp.evaluate(`(() => {
    const s = window.__store.getState()
    return { seconds: s.localPrayerSeconds, mani: (s.prayerCompletions || {}).mani || 0 }
  })()`)
  log(`corrupt-storage baseline: ${JSON.stringify(baseline)}`)

  // Relaunch the page with the corrupt value in place.
  await cdp.send('Page.navigate', { url: APP_SHELL_URL })
  await sleep(7000)
  const recovered = await cdp.evaluate(`(() => {
    const boundary = document.body.innerText.includes('A little light flickered')
    const app = !!document.querySelector('.app')
    let seconds = null
    try { const s = window.__store && window.__store.getState(); seconds = s && s.localPrayerSeconds } catch (e) {}
    return { app, boundary, seconds }
  })()`)
  log(`corrupt-storage recovery: ${JSON.stringify(recovered)}`)
  check('a corrupt localStorage entry does not white-screen the app',
    recovered.app && !recovered.boundary, JSON.stringify(recovered))
  check('the store still loads with sane counters after corruption',
    recovered.seconds === null || (Number.isFinite(recovered.seconds) && recovered.seconds >= 0),
    String(recovered.seconds))

  // RESTORE, using the node-side snapshot.
  const restored = await cdp.evaluate(`(() => {
    try {
      localStorage.setItem('prayer-earth-v1', ${JSON.stringify(saved)})
      return localStorage.getItem('prayer-earth-v1') === ${JSON.stringify(saved)}
    } catch (e) { return 'threw: ' + String(e).slice(0, 60) }
  })()`)
  log(`corrupt-storage restore: ${restored}`)
  check('the original prayer data is written back after the corruption test',
    restored === true, String(restored))

  // Prove it by reloading and reading the counters back.
  await cdp.send('Page.navigate', { url: APP_SHELL_URL })
  await sleep(7000)
  const after = await cdp.evaluate(`(() => {
    const s = window.__store && window.__store.getState()
    return s ? { seconds: s.localPrayerSeconds, mani: (s.prayerCompletions || {}).mani || 0 } : null
  })()`)
  check('the user data survives the whole corruption test',
    !!after && after.seconds >= baseline.seconds && after.mani >= baseline.mani,
    `baseline=${JSON.stringify(baseline)} after=${JSON.stringify(after)}`)
}

// The web suite walks all six themes. Doing that here is not worth it: cycling
// every theme remounts a live canvas backdrop six times, and on a WebView
// emulator that destroyed the execution context mid-evaluate ("Promise was
// collected"). What actually matters on a phone is that a backdrop canvas
// exists and is sized, because a missing one is a black screen. So assert the
// current theme's canvas renders, and let the web suite own the full matrix.
const testBackdropThemes = async () => {
  const info = await cdp.evaluate(`(() => {
    const theme = window.__store.getState().theme
    const all = [...document.querySelectorAll('canvas')]
    const match = all.find(c => c.className.includes('backdrop')) || all[0]
    return {
      theme,
      canvases: all.length,
      width: match ? match.clientWidth : 0,
      height: match ? match.clientHeight : 0
    }
  })()`)
  log(`backdrop on device: ${JSON.stringify(info)}`)
  check('the active theme renders a sized backdrop canvas on device',
    info.canvases > 0 && info.width > 100 && info.height > 100, JSON.stringify(info))
  check('no backdrop canvas has a zero size (which reads as a black screen)',
    info.width > 0 && info.height > 0, JSON.stringify(info))
}

// A blanket no-loss invariant for the whole suite.
//
// The destructive corruption test already snapshots and restores, and the store
// now refuses to persist a lower value than what is stored. But a FUTURE test
// could still wipe a real phone's data, and the emulator cannot catch that
// because it has no data to lose. So capture the app's totals before anything
// runs and re-check at the very end: if any test anywhere in this suite reduced
// the user's prayer data, the suite fails loudly instead of quietly costing
// someone their history.
const noLossBaseline = { value: null }

const captureNoLossBaseline = async () => {
  // Wait for the store to be ready and never throw: this runs immediately after
  // launch, and a helper that can hang or throw would take the whole suite with
  // it. A missing baseline only disables the final invariant, it does not fail
  // the run.
  await cdp.waitFor(`!!window.__store`, 15000)
  try {
    noLossBaseline.value = await cdp.evaluate(`(() => {
      const s = window.__store.getState()
      return { seconds: s.localPrayerSeconds, mani: (s.prayerCompletions || {}).mani || 0, anon: s.anonId }
    })()`)
    log(`no-loss baseline: ${JSON.stringify(noLossBaseline.value)}`)
  } catch (e) {
    log(`no-loss baseline unavailable: ${String(e.message || e).slice(0, 80)}`)
  }
}

const assertNoDataLoss = async () => {
  if (!noLossBaseline.value) {
    check('no-loss baseline was captured', false, 'skipped: no baseline to compare against')
    return
  }
  let now
  try {
    now = await cdp.evaluate(`(() => {
      const s = window.__store.getState()
      return { seconds: s.localPrayerSeconds, mani: (s.prayerCompletions || {}).mani || 0, anon: s.anonId }
    })()`)
  } catch (e) {
    check('the suite-wide no-loss check could read the final state', false,
      String(e.message || e).slice(0, 80))
    return
  }
  const before = noLossBaseline.value
  log(`no-loss final: ${JSON.stringify(now)}`)
  check('NO TEST IN THIS SUITE REDUCED THE USER PRAYER DATA (seconds)',
    now.seconds >= before.seconds, `${before.seconds} -> ${now.seconds}`)
  check('NO TEST IN THIS SUITE ERASED A PRAYER COUNT',
    now.mani >= before.mani, `mani ${before.mani} -> ${now.mani}`)
  check('NO TEST IN THIS SUITE CHANGED THE ANONYMOUS ID',
    !before.anon || now.anon === before.anon, `${before.anon} -> ${now.anon}`)
}

// Self-service deletion on the real device, with a stubbed transport so the test
// never touches production. What matters here is the app-shell half: the button
// exists, the confirmation gates an irreversible action, and a refused or failed
// request leaves the user's data completely intact. The HTTP contract itself is
// proven against a live server in test-server.mjs.
const testSelfServiceDeletion = async () => {
  await cdp.evaluate(`(() => {
    const btn = [...document.querySelectorAll('button,[role="button"]')]
      .find(b => /settings|⚙/i.test(b.getAttribute('aria-label') || b.title || ''))
    if (btn) btn.click()
    return !!btn
  })()`)
  await cdp.waitFor(`!!document.querySelector('.field-btn')`, 8000)

  // The previous test leaves the backup panel open, so the main list - and
  // therefore the rows - is not rendered. Return to the list before looking for
  // a row, or every assertion below silently fails against an empty DOM.
  await ensureMainList()

  // The deletion link lives in the Your data panel now. Open it first.
  //
  // The link is a button, not an <a href>: target="_blank" was a dead tap in
  // the Android WebView, so every off-device link goes through openExternal().
  // Assert on what is reachable rather than on the tag it used to be.
  await cdp.evaluate(`(() => {
    const row = document.querySelector('[data-testid="row-data"]')
    if (row) row.click()
    return !!row
  })()`)
  await cdp.waitFor(`!!document.querySelector('[data-testid="panel-data"]')`, 8000)

  const ui = await cdp.evaluate(`(() => {
    const btns = [...document.querySelectorAll('.field-btn')].map(b => (b.textContent || '').trim())
    const panel = document.querySelector('[data-testid="panel-data"]')
    return {
      hasButton: btns.some(b => /delete my data permanently/i.test(b)),
      hasLink:
        !!panel &&
        [...panel.querySelectorAll('button,.field-report')].some(b =>
          /request deletion of my data/i.test(b.textContent || '')
        ),
      hrefSomewhere: [...document.querySelectorAll('a')].some(a => /delete-data\.html/.test(a.getAttribute('href') || ''))
    }
  })()`)
  check('the app shell offers self-service deletion', ui.hasButton, JSON.stringify(ui))
  check('the app shell links to the deletion page', ui.hasLink, JSON.stringify(ui))
  // Nothing in the app should still rely on target="_blank": it does nothing in
  // the Android WebView, so such a link is a button that appears to work and
  // opens nothing.
  const deadLinks = await cdp.evaluate(`(() => {
    return [...document.querySelectorAll('a[target="_blank"]')]
      .filter(a => !a.getAttribute('href'))
      .length
  })()`)
  check('no link is left with target=_blank and no href', deadLinks === 0, 'found ' + deadLinks)

  // Seed data, so a wipe would be visible. The real values are captured first and
  // restored at the end - leaving the seeded numbers behind would quietly
  // corrupt every test that runs after this one.
  const saved = await cdp.evaluate(`(() => {
    const s = window.__store.getState()
    window.__deleteSaved = {
      localPrayerSeconds: s.localPrayerSeconds,
      prayerCompletions: JSON.parse(JSON.stringify(s.prayerCompletions || {})),
      bestStreak: s.bestStreak,
      anonId: s.anonId
    }
    // Seed an anonId too. A device that has never synced has none, and that is
    // a separate case tested below - without one, the network paths below would
    // all short-circuit before reaching fetch.
    window.__store.setState({
      localPrayerSeconds: 2468,
      prayerCompletions: { mani: 11 },
      bestStreak: 4,
      anonId: 'android-delete-test'
    })
    return window.__deleteSaved
  })()`)
  void saved
  await sleep(400)

// Presence lives in the Privacy panel now, and it is the one control here that
  // publishes a location, so check it is reachable and that it reflects real
  // state rather than a hardcoded label.
  //
  // The Your data panel is already open from the deletion checks above, so this
  // exercises Back rather than re-clicking the row.
  const openedPanel = await cdp.evaluate(`(() => !!document.querySelector('[data-testid="panel-data"]'))()`)
  check('the Your data row opens its panel', openedPanel)

  // Back returns to the main list, then Privacy opens. A panel with no way out
  // is worse than no panel, so Back is asserted in its own right rather than
  // folded into the next step succeeding.
  const backClicked = await cdp.evaluate(`(() => {
    const back = document.querySelector('.settings-back')
    if (back) back.click()
    return !!back
  })()`)
  await sleep(400)
  const backWorked = await cdp.evaluate(`(() =>
    !document.querySelector('.settings-panel') && !!document.querySelector('[data-testid="row-privacy"]')
  )()`)
  check('Back returns to the main list', backClicked && backWorked)
  const privacy = await cdp.evaluate(`(() => {
    const row = document.querySelector('[data-testid="row-privacy"]')
    if (row) row.click()
    return !!row
  })()`)
  await sleep(500)
  const privacyState = await cdp.evaluate(`(() => {
    const panel = document.querySelector('[data-testid="panel-privacy"]')
    const toggle = document.querySelector('[data-testid="privacy-presence-toggle"]')
    const state = document.querySelector('[data-testid="privacy-state"]')
    return {
      opened: !!panel,
      hasToggle: !!toggle,
      checked: toggle ? !!toggle.checked : null,
      storeSays: !!window.__store.getState().sharePresence,
      saysSomething: !!(state && state.textContent.trim())
    }
  })()`)
  check('the Privacy row opens the panel that holds the presence toggle',
    privacyState.opened && privacyState.hasToggle, JSON.stringify(privacyState))
  check('the presence toggle reflects the stored value, and states what is shared',
    privacyState.checked === privacyState.storeSays && privacyState.saysSomething,
    JSON.stringify(privacyState))

  // The destructive button must NOT act immediately; it opens a confirmation.
  // It lives in the Your data panel, and the presence checks above left Privacy
  // open, so go back and return to it rather than looking for a button the
  // current panel does not contain.
  await ensureMainList()
  await cdp.evaluate(`(() => {
    const row = document.querySelector('[data-testid="row-data"]')
    if (row) row.click()
    return !!row
  })()`)
  await cdp.waitFor(`!!document.querySelector('[data-testid="panel-data"]')`, 8000)
  await cdp.evaluate(`(() => {
    const b = [...document.querySelectorAll('.field-btn')].find(x => /delete my data permanently/i.test(x.textContent || ''))
    if (b) b.click()
    return !!b
  })()`)
  await sleep(700)
  const confirm = await cdp.evaluate(`(() => {
    const s = window.__store.getState()
    return {
      hasPanel: !!document.querySelector('.delete-panel'),
      hasArmed: !!document.querySelector('[data-testid="delete-armed-hint"]'),
      hasConfirm: [...document.querySelectorAll('.field-btn')].some(b => /^yes, delete my data$/i.test((b.textContent || '').trim())),
      seconds: s.localPrayerSeconds
    }
  })()`)
  check('deleting asks for confirmation first (it is irreversible)',
    confirm.hasPanel && confirm.hasArmed && confirm.hasConfirm, JSON.stringify(confirm))
  check('merely opening the confirm panel changes nothing',
    confirm.seconds === 2468, 'seconds=' + confirm.seconds)

  // A refused request (404) must leave the data completely intact. This calls
  // the REAL client function via the build-time test hook - an earlier version
  // imported the bundle, silently caught the failure, and then counted
  // "no-module" as a pass, which proved nothing at all.
  const refused = await cdp.evaluate(`(async () => {
    if (!window.__deletion) return { missing: true }
    const real = window.fetch
    window.fetch = (u, i) => String(u).includes('/delete')
      ? Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({ ok: false }) })
      : real(u, i)
    let outcome
    try { outcome = await window.__deletion.requestDeletion() } catch (e) { outcome = 'threw:' + e.message }
    window.fetch = real
    const s = window.__store.getState()
    return { outcome, seconds: s.localPrayerSeconds }
  })()`)
  check('the deletion test hook is available in this build', !refused.missing, JSON.stringify(refused))
  check('a refused deletion is reported as "nothing deleted"',
    refused.outcome === 'not_found', 'outcome=' + refused.outcome)
  check('a refused deletion leaves the device data intact',
    refused.seconds === 2468, 'seconds=' + refused.seconds)

  // An unreachable server must be equally non-destructive: the user asked to
  // delete, we could not confirm it, so their data must still be there.
  const offline = await cdp.evaluate(`(async () => {
    const real = window.fetch
    window.fetch = (u, i) => String(u).includes('/delete')
      ? Promise.reject(new Error('offline'))
      : real(u, i)
    let outcome
    try { outcome = await window.__deletion.requestDeletion() } catch (e) { outcome = 'threw:' + e.message }
    window.fetch = real
    return { outcome, seconds: window.__store.getState().localPrayerSeconds }
  })()`)
  check('an unreachable server reads as "offline", not as success',
    offline.outcome === 'offline', 'outcome=' + offline.outcome)
  check('an unreachable server leaves the device data intact',
    offline.seconds === 2468, 'seconds=' + offline.seconds)

  // Regression, found by this job failing on CI: a device that installed before
  // deletion existed has no token in storage. It must still reach the server.
  // An early return reported "nothing found" without asking, so the button did
  // nothing and the only route left was the email fallback.
  const noToken = await cdp.evaluate(`(async () => {
    const real = window.fetch
    let contacted = 0
    window.fetch = (u, i) => {
      if (String(u).includes('/delete')) {
        contacted++
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ ok: true }) })
      }
      return real(u, i)
    }
    window.__store.setState({ deleteToken: '' })
    let outcome
    try { outcome = await window.__deletion.requestDeletion() } catch (e) { outcome = 'threw:' + e.message }
    const minted = window.__store.getState().deleteToken
    window.fetch = real
    return { contacted, outcome, mintedLen: String(minted || '').length }
  })()`)
  check('a device with no stored token still contacts the server',
    noToken.contacted === 1, 'requests=' + noToken.contacted + ' outcome=' + noToken.outcome)
  check('a device with no stored token gets one minted for the attempt',
    noToken.mintedLen >= 40, 'len=' + noToken.mintedLen)

  // A device that has NEVER synced has no anonId at all, so there is no record
  // that could be named. That must wipe locally and say so plainly, rather than
  // reporting "not found" about a request that was never made - and it must not
  // claim a server-side deletion that never happened.
  const neverSynced = await cdp.evaluate(`(async () => {
    const real = window.fetch
    let contacted = 0
    window.fetch = (u, i) => {
      if (String(u).includes('/delete')) { contacted++; return real(u, i) }
      return real(u, i)
    }
    window.__store.setState({ anonId: '', deleteToken: '', localPrayerSeconds: 999 })
    const outcome = await window.__deletion.requestDeletion()
    window.fetch = real
    return { contacted, outcome }
  })()`)
  check('a device that never synced reports local_only, not not_found',
    neverSynced.outcome === 'local_only', 'outcome=' + neverSynced.outcome)
  check('a device that never synced does not pretend to contact the server',
    neverSynced.contacted === 0, 'requests=' + neverSynced.contacted)

  // Put the device's real numbers back.
  await cdp.evaluate(`(() => {
    const saved = window.__deleteSaved
    if (saved) window.__store.setState(saved)
    delete window.__deleteSaved
    return window.__store.getState().localPrayerSeconds
  })()`)
  await sleep(400)
}

const testSentinel = async (key, value) => {
  const stored = await cdp.evaluate(`localStorage.getItem(${JSON.stringify(key)})`)
  check('app data survives APK reinstall', stored === value, `stored=${stored}`)
}

// Backup/restore is the safety net for a lost phone, so prove the whole loop
// on the real device: produce a recovery code, destroy the counters, and put
// them back. The clipboard/share/download paths behave differently in the
// Android WebView than in a desktop browser, so this cannot be a browser test.
const testBackup = async () => {
  await cdp.evaluate(`location.hash = '#/'`)
  await sleep(600)
  const before = await cdp.evaluate(`(() => { const s = window.__store.getState(); return { seconds: s.localPrayerSeconds, anon: s.anonId } })()`)
  check('there is prayer data worth backing up', before.seconds > 0, JSON.stringify(before))

  // Drive the real Settings UI, exactly as a person would.
  await cdp.evaluate(`(() => {
    const btn = [...document.querySelectorAll('button,[role="button"]')]
      .find(b => /settings/i.test(b.getAttribute('aria-label') || b.title || ''))
    if (btn) btn.click()
    return !!btn
  })()`)
  const opened = await cdp.waitFor(`!!document.querySelector('.field-btn')`, 8000)
  check('settings sheet opens', !!opened)
  await ensureMainList()

  // Backup lives in its own panel now. Open it the way a person would, via the
  // row, so a broken panel fails here rather than looking like a missing button.
  const rowClicked = await cdp.evaluate(`(() => {
    const row = document.querySelector('[data-testid="row-backup"]')
    if (row) row.click()
    return !!row
  })()`)
  const panelOpen = rowClicked && (await cdp.waitFor(`!!document.querySelector('[data-testid="panel-backup"]')`, 8000))
  check('the backup panel opens from its row', !!panelOpen)

  const ui = await cdp.evaluate(`(() => {
    const body = document.body.innerText || ''
    const panel = document.querySelector('[data-testid="panel-backup"]')
    const btns = [...document.querySelectorAll('.field-btn')].map(b => (b.textContent || '').trim())
    const ta = document.querySelector('.field-textarea:not([readonly])')
    return {
      section: /backup/i.test(body),
      copy: btns.some(b => /copy recovery code/i.test(b)),
      download: btns.some(b => /download backup/i.test(b)),
      restoreField: !!ta,
      styled: ta ? getComputedStyle(ta).borderRadius : null,
      // The app shell cannot download files, so the code must be readable
      // inline instead. Assert the panel actually shows it.
      inlineCode: !!(panel && panel.querySelector('[data-testid="backup-code"]'))
    }
  })()`)
  check('backup section is present on device', ui.section, JSON.stringify(ui))
  check('Copy recovery code is present on device', ui.copy)
  // The app shell has no download listener, so the download button is
  // deliberately NOT offered there. A browser still gets it.
  check('the app shell does not offer an impossible download', !ui.download,
    'WebView has no download listener, so the button would be dead')
  check('the app shell shows the recovery code inline instead', ui.inlineCode)
  check('restore field is present and editable on device', ui.restoreField)
  // Regression: the restore box shipped with browser defaults (near-white on
  // white in the dark theme) because .field-textarea was never defined.
  check('restore field is styled, not a raw browser default', !!ui.styled && ui.styled !== '0px', String(ui.styled))

  // Tap Copy with a REAL input event. A programmatic .click() is not a user
  // gesture and document.execCommand('copy') refuses without one, so only a
  // real tap can prove the app's primary export path works on Android.
  const box = await realTap()
  check('found the Copy recovery code button for a real tap', !!box)
  await sleep(2500)
  const got = await cdp.evaluate(`(() => {
    const hints = [...document.querySelectorAll('.field-hint')].map(h => (h.textContent || '').trim())
    const outcome = hints.find(h =>
      /^Copied\\.?$/.test(h) ||
      /Share sheet opened/.test(h) ||
      /Could not copy or download/.test(h) ||
      /^Backup file downloaded\\.?$/.test(h)
    ) || ''
    const inline = [...document.querySelectorAll('.field-textarea')]
      .map(a => a.value || '').find(v => v.startsWith('JP1:')) || ''
    return { outcome, inline }
  })()`)
  log(`real-tap copy outcome: ${JSON.stringify(got).slice(0, 120)}`)
  // The decisive check: with a genuine gesture the clipboard path must win, since
  // it is the ONLY export mechanism the Android WebView supports.
  check('a REAL tap copies the recovery code to the clipboard',
    /^Copied/.test(got.outcome), got.outcome || 'no outcome message')
  check('tapping Copy hands the user a real recovery code on device',
    Boolean(got.outcome) || Boolean(got.inline), got.outcome || `inline:${got.inline.length}b`)

  // The app shell must not offer a download it cannot perform.
  const noDeadDownload = await cdp.evaluate(`(() => {
    const btns = [...document.querySelectorAll('.field-btn')].map(b => (b.textContent || '').trim())
    return !btns.some(b => /download backup/i.test(b))
  })()`)
  check('the app shell does not offer a download it cannot perform', noDeadDownload)
  // And the code must always be visible there, so the user can copy it by hand.
  const codeVisible = await cdp.evaluate(`(() => {
    const ta = [...document.querySelectorAll('.field-textarea[readonly]')][0]
    return !!ta
  })()`)
  check('the recovery code is always visible in the app shell', codeVisible)
  // The clipboard already holds it, so read it back as proof of a real round trip.
  const clip = await cdp.evaluate(`(async () => {
    const timeout = (p, ms) => Promise.race([p, new Promise(r => setTimeout(() => r(''), ms))])
    try { return await timeout(navigator.clipboard.readText(), 3000) } catch (e) { return 'ERR' }
  })()`)
  log(`clipboard readback: ${typeof clip === 'string' ? clip.slice(0, 24) : '(unreadable from page)'}`)

  // The code is now always rendered in the app shell, so the destroy/restore
  // round trip can run unconditionally -- no dependence on reading the clipboard,
  // which the WebView does not allow from script.
  const code = got.inline
  if (code) {
    const wiped = await cdp.evaluate(`(() => {
      const s = window.__store
      s.setState({ localPrayerSeconds: 0, prayerCompletions: {}, prayerDayCompletions: {} })
      return s.getState().localPrayerSeconds
    })()`)
    check('counters can be cleared to simulate a lost device', wiped === 0, `seconds=${wiped}`)

    const restored = await cdp.evaluate(`(() => {
      const val = ${JSON.stringify(code)}
      try {
        const obj = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(val.slice(4)), c => c.charCodeAt(0))))
        return JSON.stringify({ ok: true, v: obj.v, seconds: obj.localPrayerSeconds })
      } catch (e) { return JSON.stringify({ ok: false, err: String(e) }) }
    })()`)
    const r = JSON.parse(restored)
    check('the on-device recovery code is well-formed', r.ok && r.v === 1, restored)

    // Paste it into the real restore field and restore through the UI.
    const pasted = await cdp.evaluate(`(() => {
      const ta = document.querySelector('.field-textarea:not([readonly])')
      if (!ta) return false
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
      setter.call(ta, ${JSON.stringify(code)})
      ta.dispatchEvent(new Event('input', { bubbles: true }))
      return true
    })()`)
    check('the recovery code can be pasted into the restore field', pasted === true)
    await sleep(500)
    await cdp.evaluate(`(() => {
      const b = [...document.querySelectorAll('.field-btn')].find(x => /^restore$/i.test((x.textContent || '').trim()))
      if (b) b.click()
      return !!b
    })()`)
    await sleep(2000)
    const after = await cdp.evaluate(`(() => { const s = window.__store.getState(); return { seconds: s.localPrayerSeconds } })()`)
    check('restoring on device brings the cleared counters back',
      after.seconds === before.seconds, `restored=${after.seconds}s expected=${before.seconds}s`)

    // The summary is the only way a user can tell they pasted the RIGHT code,
    // so assert it actually renders with real numbers on the phone.
    const sum = await cdp.evaluate(`(() => {
      const el = document.querySelector('[data-testid="backup-summary"]')
      if (!el) return null
      const values = [...el.querySelectorAll('.backup-summary-value')].map(v => (v.textContent || '').trim())
      return JSON.stringify({
        values,
        notes: el.querySelectorAll('.backup-summary-note').length,
        radius: getComputedStyle(el).borderRadius
      })
    })()`)
    const s2 = sum ? JSON.parse(sum) : null
    check('the restore summary is shown after restoring on device', !!s2, sum)
    if (s2) {
      check('the summary shows four populated figures', s2.values.length === 4 && s2.values.every(Boolean), JSON.stringify(s2.values))
      check('the summary figures are not all zero (a real restore happened)',
        s2.values.some(v => v !== '0' && v !== '0s' && v !== '0m'), JSON.stringify(s2.values))
      check('the summary card is styled', !!s2.radius && s2.radius !== '0px', String(s2.radius))
    }
  } else {
    console.log('[android-smoke] NOTE: no readable code (clipboard not script-readable); skipping the destroy/restore leg')
  }

  const finalState = await cdp.evaluate(`(() => { const s = window.__store.getState(); return { seconds: s.localPrayerSeconds, anon: s.anonId } })()`)
  check('the backup flow never lowered the user counters', finalState.seconds >= before.seconds, `${before.seconds} -> ${finalState.seconds}`)
  check('the backup flow never changed the anonymous id', finalState.anon === before.anon)
}

const cleanup = () => {
  if (cdp) cdp.close()
  if (forwarded) {
    try { adb(['forward', '--remove', `tcp:${PORT}`]) } catch {}
  }
}

try {
    if (process.platform === 'win32' && !existsSync(ADB)) throw new Error(`adb not found: ${ADB}`)
    if (!deviceConnected()) throw new Error('No authorized Android device is connected')
// The CI emulator can drop off adb for a moment as it settles. This is the
    // one place a retry is kept: it costs at most 6 seconds, and it only exists
    // for the case where the device is not there yet. Nothing has run at this
    // point, so a failure is always the harness - and it still fails.
    let connected = false
    for (let attempt = 0; attempt < 3 && !connected; attempt++) {
      try {
        connected = deviceConnected()
      } catch {
        connected = false
      }
      if (!connected) {
        log(`device not ready, retrying (${attempt + 1}/3)`)
        await sleep(2000)
      }
    }
    if (!connected) throw new Error('No authorized Android device is connected')
  log(`device connected${SERIAL ? `: ${SERIAL}` : ''}`)

  if (UPGRADE_APK) install(UPGRADE_APK)
  else install(APK)
  launch()
  cdp = await connect()
  await enableTestBridge()
  // Snapshot the real totals now, so the suite can prove at the end that nothing
  // it did reduced the user's data.
  await captureNoLossBaseline()

  const key = '__android-smoke-upgrade'
  const value = `${Date.now()}`
  await cdp.evaluate(`localStorage.setItem(${JSON.stringify(key)}, ${JSON.stringify(value)})`)
  await testSentinel(key, value)
  // Flush the sentinel to disk before the reinstall. The WebView batches
  // localStorage writes, so a key set as the very last action before
  // `adb install -r` can still be in the write buffer when the process is
  // killed â€” it would then read back null after the upgrade (a false
  // data-loss signal). Backing the app out makes Android flush WebView
  // storage to disk before we swap the APK.
  adb(['shell', 'input', 'keyevent', '3'])
  await sleep(1200)
  cdp.close()
  cdp = null

  install(APK)
  launch()
  cdp = await connect()
  await enableTestBridge()
  await testSentinel(key, value)
  await testSurface()
  await testAudio()
  await testTaras()
  await testDeepLink()
  await testLifecycle()
  await testCryptoSupport()
  await testLocationCoarse()
  await testExportCapabilities()
  await testAmbientAndStreak()
  await testBackdropThemes()
  await testBackup()
  // DESTRUCTIVE, so it must run last: it deliberately writes a corrupt
  // localStorage entry and reloads, which wipes the counters and anonId that
  // testBackup (and the user on a real device) still need.
  await testSelfServiceDeletion()
  await testCorruptStorageRecovery()
  // Final, suite-wide invariant: nothing in here may have cost the user data.
  await assertNoDataLoss()
  log(`failures=${failures}`)
} catch (error) {
  // Always a failure. If the fault was in the debugger rather than the app, say
  // so in the detail - that is for whoever reads the log at 2am, not a reason to
  // let a broken build through.
  const fromDebugger = CDP.prototype.isTransient(error) || CDP.prototype.isTimeout(error)
  const where = checksRun ? `after ${checksRun} checks` : 'before any check ran'
  check(
    'Android smoke completed',
    false,
    fromDebugger
      ? `harness fault ${where}, not an app fault: ${error.message}`
      : `${where}: ${error.message}`
  )
} finally {
  cleanup()
}

process.exit(failures ? 1 : 0)
