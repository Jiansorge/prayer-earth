import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
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
let failures = 0
let cdp = null
let forwarded = false

const log = (...args) => console.log('[android-smoke]', ...args)
const check = (name, condition, detail = '') => {
  log(`${condition ? 'PASS' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`)
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

  send(method, params = {}) {
    const id = ++this.id
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`DevTools command timed out: ${method}`))
      }, 10000)
      this.pending.set(id, {
        resolve: (value) => { clearTimeout(timer); resolve(value) },
        reject: (error) => { clearTimeout(timer); reject(error) }
      })
      this.ws.send(JSON.stringify({ id, method, params }))
    })
  }

  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'Runtime evaluation failed')
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
  await cdp.send('Page.navigate', { url: 'capacitor://localhost/?peTest=1' })
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
  check('reverb configuration reaches the APK', state.reverb === 0.15, `gain=${state.reverb}`)
  if (state.element) check('audio element is not paused', state.paused === false, JSON.stringify(state))
  const exceptions = cdp.events.filter((event) => event.method === 'Runtime.exceptionThrown')
  const exceptionText = exceptions.map((event) => event.params?.exceptionDetails?.exception?.description || event.params?.exceptionDetails?.text || 'unknown').join(' | ')
  const assetLogs = cdp.events.filter((event) => event.method === 'Log.entryAdded' && /capacitor:\/\/localhost\/assets|Unable to preload CSS|ERR_FILE_NOT_FOUND/i.test(event.params?.entry?.text || ''))
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
  // few words — here the active line would already have changed by 5s.
  const firstStillPlaying = !!samples[0] && samples[0] === samples[9]
  check('21 Taras first verse plays in full (not cut off ~4s)', firstStillPlaying, `at0.5s=${(samples[0]||'').slice(0,18)} at5s=${(samples[9]||'').slice(0,18)}`)
  await cdp.evaluate(`document.querySelector('.ctrl-btn.stop')?.click()`)
  await cdp.waitFor(`window.__store?.getState().playing === false`, 8000)
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

const testSentinel = async (key, value) => {
  const stored = await cdp.evaluate(`localStorage.getItem(${JSON.stringify(key)})`)
  check('app data survives APK reinstall', stored === value, `stored=${stored}`)
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
  log(`device connected${SERIAL ? `: ${SERIAL}` : ''}`)

  if (UPGRADE_APK) install(UPGRADE_APK)
  else install(APK)
  launch()
  cdp = await connect()
  await enableTestBridge()

  const key = '__android-smoke-upgrade'
  const value = `${Date.now()}`
  await cdp.evaluate(`localStorage.setItem(${JSON.stringify(key)}, ${JSON.stringify(value)})`)
  await testSentinel(key, value)
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
  await testLifecycle()
  log(`failures=${failures}`)
} catch (error) {
  check('Android smoke completed', false, error.message)
} finally {
  cleanup()
}

process.exit(failures ? 1 : 0)
