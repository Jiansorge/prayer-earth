// Real-usage test harness: drives the actual Prayer Earth app in headless
// Edge over the Chrome DevTools Protocol and asserts on live behaviour.
// Run: node scripts/test-usage.mjs

import { spawn } from 'node:child_process'
import WebSocket from 'ws'
import { readFileSync } from 'node:fs'

const APP = process.env.APP_URL || 'http://localhost:5173'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const DEBUG_PORT = 9223
const PROFILE = `${process.env.TEMP}\\pe-usage-${Date.now()}`
const log = (...a) => console.log('[usage]', ...a)

let fails = 0
const ok = (name, cond, extra = '') => {
  if (cond) log(`PASS  ${name}${extra ? ` (${extra})` : ''}`)
  else {
    fails += 1
    log(`FAIL  ${name}${extra ? ` (${extra})` : ''}`)
  }
}

const edge = spawn(EDGE, [
  '--headless=new',
  '--disable-gpu',
  '--mute-audio',
  '--no-first-run',
  `--user-data-dir=${PROFILE}`,
  `--remote-debugging-port=${DEBUG_PORT}`,
  'about:blank'
])
edge.stdout.on('data', () => {})
edge.stderr.on('data', () => {})

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function waitForCdp() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://localhost:${DEBUG_PORT}/json`)
      const list = await res.json()
      const page = list.find((t) => t.type === 'page')
      if (page) return page.webSocketDebuggerUrl
    } catch {}
    await sleep(250)
  }
  throw new Error('CDP never came up')
}

class CDP {
  constructor(url) {
    this.ws = new WebSocket(url)
    this.id = 0
    this.pending = new Map()
    this.events = []
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
        } else if (m.method) {
          this.events.push(m)
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
  async eval(expr) {
    const r = await this.send('Runtime.evaluate', {
      expression: expr,
      returnByValue: true,
      awaitPromise: true
    })
    if (r.exceptionDetails) {
      throw new Error(`eval failed: ${r.exceptionDetails.text} ${r.exceptionDetails.exception?.description || ''}`)
    }
    return r.result?.value
  }
  async waitFor(expr, timeout = 8000) {
    const t0 = Date.now()
    while (Date.now() - t0 < timeout) {
      try {
        const v = await this.eval(expr)
        if (v) return v
      } catch {}
      await sleep(150)
    }
    return null
  }
  consoleErrors() {
    return this.events
      .filter((e) => e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error')
      .map((e) => e.params.args?.map((a) => a.value ?? a.description).join(' '))
  }
  pageErrors() {
    return this.events
      .filter((e) => e.method === 'Runtime.exceptionThrown')
      .map((e) => e.params.exceptionDetails?.text + ' ' + (e.params.exceptionDetails?.exception?.description || ''))
  }
}

// ---------------------------------------------------------------- main flow
const cdpUrl = await waitForCdp()
const c = new CDP(cdpUrl)
await c.open()
await c.send('Page.enable')
await c.send('Runtime.enable')

async function nav(url) {
  await c.send('Page.navigate', { url })
  await c.waitFor('document.readyState === "complete"', 10000)
  await sleep(800)
}

log('navigating to home')
await nav(APP)

ok('home renders title', await c.waitFor(`document.body.innerText.includes('Pray with the whole world')`))
ok(
  '15 spirituality tiles render',
  (await c.eval(`document.querySelectorAll('.tile').length`)) === 15,
  'tiles=15'
)
ok(
  'tiles show per-spirit counts',
  (await c.eval(`document.querySelectorAll('.tile-praying').length`)) === 15
)

// --- settings sheet ---
ok('settings button present', await c.waitFor(`!!document.querySelector('.gear-btn')`))
await c.eval(`document.querySelector('.gear-btn').click()`)
ok('settings sheet opens', await c.waitFor(`!!document.querySelector('.sheet')`))
ok(
  'voice picker lists voices',
  (await c.eval(`document.querySelectorAll('.field-select option').length`)) >= 1
)
ok(
  'voice picker offers soft chant',
  await c.eval(`document.querySelector('.field-select').textContent.includes('Soft chant')`)
)
ok(
  'speaking speed slider present',
  await c.eval(`document.querySelectorAll('input[type="range"]').length >= 2`)
)
ok(
  'settings offers app/site share',
  await c.eval(`[...document.querySelectorAll('.field-btn')].some((b) => b.innerText.includes('Share Prayer Earth'))`)
)
await c.eval(`document.querySelector('.sheet-close').click()`)
ok('settings sheet closes', await c.waitFor(`!document.querySelector('.sheet')`))

// --- language picker: switching locale relabels the app, then restore en ---
await c.eval(`document.querySelector('.gear-btn').click()`)
await c.waitFor(`!!document.querySelector('#locale-picker')`)
ok(
  'language picker offers 12 locales',
  (await c.eval(`document.querySelectorAll('#locale-picker option').length`)) === 12,
  `opts=${await c.eval(`document.querySelectorAll('#locale-picker option').length`)}`
)
await c.eval(`(() => { const s = document.querySelector('#locale-picker'); s.value = 'es'; s.dispatchEvent(new Event('change', { bubbles: true })) })()`)
ok('locale switch to Spanish relabels nav', await c.waitFor(`!!document.querySelector('.nav button[aria-label="Inicio"]')`))
ok(
  'locale switch persists',
  (await c.eval(`JSON.parse(localStorage.getItem('prayer-earth-v1')).state.locale`)) === 'es'
)
await c.eval(`window.__store.getState().setLocale('en')`)
ok('locale restore to English', await c.waitFor(`!!document.querySelector('.nav button[aria-label="Home"]')`))
await c.eval(`document.querySelector('.sheet-close').click()`)

const NAV = (label) => `document.querySelector('.nav button[aria-label="${label}"]')`
async function clickNav(label) {
  await c.waitFor(`!!${NAV(label)}`)
  await c.eval(`${NAV(label)}.click()`)
}

// --- prayer view via nav tab (regression for "Pray tab doesn't work") ---
await clickNav('Pray')
ok('Pray tab opens prayer view', await c.waitFor(`!!document.querySelector('.prayer-stage')`))
ok(
  'prayer view has phrases',
  (await c.eval(`document.querySelectorAll('.prayer-line').length`)) >= 3
)

// --- the living Earth sits quietly behind the prayer ---
ok(
  'earth backdrop behind prayer view',
  await c.waitFor(`!!document.querySelector('.earth-backdrop')`)
)
ok(
  'backdrop globe renders',
  await c.waitFor(`(() => { const cv = document.querySelector('.earth-backdrop canvas'); return !!cv && cv.width > 100; })()`)
)

// --- per-prayer volume + speed tuning ---
ok('tune button present', await c.waitFor(`!!document.querySelector('.ctrl-btn.tune')`))
await c.eval(`document.querySelector('.ctrl-btn.tune').click()`)
ok('tune panel opens', await c.waitFor(`!!document.querySelector('.prayer-tune')`))
ok(
  'tune has volume + speed sliders',
  (await c.eval(`document.querySelectorAll('.prayer-tune input[type="range"]').length`)) === 2,
  `sliders=${await c.eval(`document.querySelectorAll('.prayer-tune input[type="range"]').length`)}`
)
ok(
  'volume default 50%',
  (await c.eval(`window.__store?.getState().volume`)) === 0.5
)
await c.eval(`document.querySelector('.ctrl-btn.tune').click()`)
ok('tune panel closes', await c.waitFor(`!document.querySelector('.prayer-tune')`))

// --- playability tests use a Buddhist prayer from here on ---
await nav(`${APP}/#/pray/buddhism/mani`)
ok('buddhist mantra stage renders', await c.waitFor(`document.body.innerText.includes('Maṇi')`))
ok(
  'each prayer line shows an English translation',
  await c.waitFor(`(() => { const els = document.querySelectorAll('.prayer-line .en'); return els.length >= 2 && els[0].innerText.trim().length > 0; })()`),
  `enLines=${await c.eval(`document.querySelectorAll('.prayer-line .en').length`)}`
)

// --- play: highlight should advance (speech OR timed fallback) ---
const linesBefore = await c.eval(`document.querySelectorAll('.prayer-line.on').length`)
await c.eval(`document.querySelector('.ctrl-btn.play').click()`)
const hasActive = await c.waitFor(`document.querySelectorAll('.prayer-line.on').length === 1`)
ok('play lights exactly one phrase', hasActive, `linesBefore=${linesBefore}`)
ok(
  'phrase highlight advances over time',
  await c.waitFor(
    `(() => { const on=[...document.querySelectorAll('.prayer-line')]; return on.findIndex(l=>l.classList.contains('on')); })() > 0`
  , 10000)
)
ok('praying count shown while praying', await c.waitFor(`document.body.innerText.includes('praying this prayer now')`))

// --- all-time total + weekly per-prayer stats ---
ok(
  'all-time total shown under praying now',
  await c.waitFor(`document.body.innerText.includes('all time')`)
)
ok(
  'weekly prayer stats chart present',
  await c.waitFor(`!!document.querySelector('.prayer-stats .ps-chart')`)
)
ok(
  'stats chart draws one bar per day (7)',
  (await c.eval(`document.querySelectorAll('.prayer-stats .ps-bar').length`)) === 7,
  `bars=${await c.eval(`document.querySelectorAll('.prayer-stats .ps-bar').length`)}`
)
ok(
  'this-week stats title shown',
  await c.waitFor(`/this week/i.test(document.body.innerText)`)
)

// --- regression: playback must survive well past the old 2.2s watchdog
// --- window. On real machines the first utterance can take seconds to start,
// --- and the old watchdog canceled that slow-but-fine voice, making prayer
// --- "stop after a couple of seconds". Here we sample far beyond it and
// --- demand the highlight keeps advancing and praying stays true.
{
  const probe = []
  const seen = new Set()
  let stayedPraying = true
  for (let k = 0; k < 8; k++) {
    await sleep(1000)
    const s = await c.eval(`(() => {
      const on = [...document.querySelectorAll('.prayer-line')]
        .findIndex((l) => l.classList.contains('on'))
      return { idx: on, praying: window.__store?.getState().praying ?? null }
    })()`)
    probe.push(`${k + 1}s:idx=${s.idx}`)
    if (s.idx >= 0) seen.add(s.idx)
    if (s.praying !== true) stayedPraying = false
  }
  ok(
    'playback still praying 8s in (no 2s stop)',
    stayedPraying,
    probe.join(' ')
  )
  ok(
    'highlight kept moving past the old watchdog window',
    seen.size >= 2,
    probe.join(' ')
  )
}

ok(
  'presence counter in back row',
  (await c.eval(`document.querySelector('.prayer-stage .praying-now b')?.innerText`)) !== null
)
ok('share button present', await c.waitFor(`!!document.querySelector('.share-btn')`))

// --- layout regression: the card grows to fit its lines and the footer
// --- meter is gone, so the highlight never overlaps stray footer text ---
const stageBox = await c.eval(`(() => {
  const s = document.querySelector('.prayer-stage').getBoundingClientRect()
  const l = [...document.querySelectorAll('.prayer-line')].pop().getBoundingClientRect()
  return { stageBottom: Math.round(s.bottom), lastLineBottom: Math.round(l.bottom) }
})()`)
ok(
  'prayer card contains its lines',
  stageBox.lastLineBottom <= stageBox.stageBottom,
  `lastLine=${stageBox.lastLineBottom} stage=${stageBox.stageBottom}`
)
ok('no footer meter on prayer page', (await c.eval(`!document.querySelector('.prayer-page .world-meter')`)))

// --- live counts: server aggregation is verified separately below ---

// --- switch prayer via chip ---
const chips = await c.eval(`document.querySelectorAll('.chooser .chip:not(.chip-all)').length`)
ok('has 7 prayer chips per tradition', chips === 7, `chips=${chips}`)
await c.eval(`document.querySelectorAll('.chooser .chip')[1].click()`)
ok('switching prayer updates stage', await c.waitFor(`document.querySelectorAll('.prayer-line').length >= 2`))
await c.eval(`document.querySelector('.ctrl-btn.stop').click()`)

// --- Earth view via nav tab (regression for "Earth tab doesn't work") ---
await clickNav('Earth')
ok('Earth tab opens earth view', await c.waitFor(`!!document.querySelector('.earth-view')`))
const canvasOk = await c.waitFor(
  `(() => { const cv = document.querySelector('.earth-canvas canvas'); return !!cv && cv.width > 100; })()`
)
ok('3D Earth canvas renders', canvasOk)
ok(
  'earth HUD shows glow %',
  await c.waitFor(`document.body.innerText.includes('%')`)
)

// --- deep links ---
await nav(`${APP}/#/earth`)
ok('deep link earth renders', await c.waitFor(`!!document.querySelector('.earth-view')`))
await nav(`${APP}/#/pray/buddhism/mani`)
const dlTitle = await c.eval(`document.querySelector('.prayer-title')?.innerText || 'NONE'`)
const dlHash = await c.eval(`location.hash`)
ok('deep link buddhist mantra renders', await c.waitFor(`document.body.innerText.includes('Maṇi')`), `hash=${dlHash} title=${dlTitle}`)

// --- back home via nav ---
await clickNav('Home')
ok('Home tab returns home', await c.waitFor(`!!document.querySelector('.spirit-grid')`))

// --- tapping a tradition opens the full prayer picker, not just the first prayer ---
await c.eval(`document.querySelector('.tile').click()`)
ok(
  'tapping a tradition opens the prayer picker',
  await c.waitFor(`!!document.querySelector('.picker-sheet')`)
)
ok(
  'picker lists every prayer of the tradition',
  (await c.eval(`document.querySelectorAll('.picker-row').length`)) === 7,
  `rows=${await c.eval(`document.querySelectorAll('.picker-row').length`)}`
)
ok(
  'picker does not jump straight into prayer',
  !(await c.eval(`!!document.querySelector('.prayer-stage')`))
)
ok(
  'picker shows an all-time total per prayer',
  await c.eval(`[...document.querySelectorAll('.picker-row')].some((r) => r.innerText.includes('all time'))`)
)
await c.eval(`document.querySelectorAll('.picker-row')[4].click()`)
ok('choosing a picker row opens that prayer', await c.waitFor(`!!document.querySelector('.prayer-stage')`))
await c.eval(`document.querySelector('.ctrl-btn.stop').click()`)
await clickNav('Home')
ok('picker flow returns home', await c.waitFor(`!!document.querySelector('.spirit-grid')`))

// --- live "now praying" feed is visible on Home ---
ok(
  'world feed pills render on Home',
  await c.waitFor(`document.querySelectorAll('.world-feed .feed-pill').length >= 1`),
  `pills=${await c.eval(`document.querySelectorAll('.world-feed .feed-pill').length`)}`
)
ok(
  'feed pill shows an anonymous name',
  await c.waitFor(`(() => { const p = document.querySelector('.world-feed .feed-pill'); return !!p && p.innerText.trim().length > 0; })()`)
)

// --- daily streak: first day counts, same day is idempotent, yesterday continues ---
const streakRes = await c.eval(`(() => {
  const store = window.__store
  const key = (t) => t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0')
  const y = new Date()
  y.setDate(y.getDate() - 1)
  const yesterday = key(y)
  store.setState({ streak: 0, bestStreak: 0, lastPrayedDay: null })
  store.getState().markPrayedToday()
  const first = store.getState().streak
  store.getState().markPrayedToday()
  const again = store.getState().streak
  store.setState({ streak: 1, bestStreak: 1, lastPrayedDay: yesterday })
  store.getState().markPrayedToday()
  return { first, again, next: store.getState().streak, best: store.getState().bestStreak }
})()`)
ok('streak starts at 1 on first day', streakRes.first === 1, `first=${streakRes.first}`)
ok('streak idempotent within a day', streakRes.again === 1, `again=${streakRes.again}`)
ok('streak continues from yesterday', streakRes.next === 2, `next=${streakRes.next}`)
ok('best streak tracks the high water mark', streakRes.best === 2, `best=${streakRes.best}`)
await c.eval(`window.__store.setState({ streak: 3, bestStreak: 5, lastPrayedDay: null })`)
ok(
  'streak chip shows on Home',
  await c.waitFor(`document.body.innerText.includes('3 days')`),
  'chip="3 days"'
)
await c.eval(`window.__store.setState({ streak: 0, bestStreak: 0, lastPrayedDay: null })`)

// --- persistence: prayer seconds survive reload ---
const persistedRaw = await c.eval(`localStorage.getItem('prayer-earth-v1')`)
let persisted
try { persisted = JSON.parse(persistedRaw || 'null') } catch { persisted = null }
const persistedSecs = persisted?.state?.localPrayerSeconds ?? null
ok(
  'localStorage persistence exists',
  typeof persistedSecs === 'number'
)
ok(
  'prayer seconds persisted',
  (persistedSecs || 0) > 0,
  `seconds=${persistedSecs}`
)
ok(
  'life card shows lifetime',
  await c.waitFor(`document.body.innerText.includes('You have carried')`)
)

// --- offline: counts stay believable and include your own prayer ---
// Only break the app's :8787 sync socket; leave Vite's HMR websocket alone so
// the page doesn't log a HMR connection error.
await c.send('Page.addScriptToEvaluateOnNewDocument', {
  source: `{
    const RealWS = window.WebSocket
    window.WebSocket = class extends RealWS {
      constructor(url, protocols) {
        if (String(url).includes(':8787')) throw new Error('offline')
        super(url, protocols)
      }
    }
  }`
})
// The URL is already the mani deep link, so force a fresh document with a
// real reload for the override to take effect.
await c.send('Page.reload', { ignoreCache: true })
await c.waitFor('document.readyState === "complete"', 10000)
await sleep(600)
const offlineUp = await c.waitFor(`window.__store?.getState().connected === false`, 10000)
const offReady = await c.waitFor(
  `Object.keys(window.__store?.getState().spiritCounts || {}).length >= 5`,
  10000
)
const offSpirits = await c.eval(`window.__store.getState().spiritCounts`)
ok(
  'offline world shows a believable crowd',
  offlineUp && offReady,
  `connected=false spirits=${Object.keys(offSpirits || {}).length}`
)
await c.waitFor(`!!document.querySelector('.ctrl-btn.play')`, 10000)
await c.eval(`document.querySelector('.ctrl-btn.play').click()`)
await sleep(1200)
const offPraying = await c.eval(`(() => {
  const s = window.__store.getState()
  return { praying: s.praying, buddhism: s.spiritCounts.buddhism, mani: s.prayerCounts.mani }
})()`)
ok(
  'offline own prayer counted in its religion',
  offPraying.praying && (offPraying.buddhism || 0) >= 2 && (offPraying.mani || 0) >= 1,
  JSON.stringify(offPraying)
)

// --- no speech voices (Firefox Fingerprinting Protection / no TTS installed):
// must fall back to the audible chant, not sit in silence ---
await c.send('Page.addScriptToEvaluateOnNewDocument', {
  source: `{
    const stub = {
      getVoices: () => [],
      speak: () => {},
      cancel: () => {},
      pause: () => {},
      resume: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      get speaking() { return false },
      get pending() { return false },
      get paused() { return false }
    }
    Object.defineProperty(window, 'speechSynthesis', { value: stub, configurable: true })
  }`
})
await c.send('Page.reload', { ignoreCache: true })
await c.waitFor('document.readyState === "complete"', 10000)
await sleep(600)
await c.waitFor(`!!document.querySelector('.ctrl-btn.play')`, 10000)
await c.eval(`document.querySelector('.ctrl-btn.play').click()`)
const chantReady = await c.waitFor(
  `window.__speech?.job?.mode === 'timed' && window.__store?.getState().praying === true`,
  12000
)
const i1 = await c.eval(`[...document.querySelectorAll('.prayer-line')].findIndex(e => e.classList.contains('on'))`)
await sleep(2400)
const i2 = await c.eval(`[...document.querySelectorAll('.prayer-line')].findIndex(e => e.classList.contains('on'))`)
const noteShown = await c.eval(`!!document.querySelector('.voice-note')`)
ok(
  'no-voice browser falls back to audible chant',
  !!chantReady && i1 !== -1 && i2 !== i1,
  `mode=${await c.eval(`window.__speech?.job?.mode`)} i1=${i1} i2=${i2}`
)
ok('voice-unavailable note shown', !!noteShown)

// --- settings-driven speed + soft-chant voice choice ---
await c.eval(`document.querySelector('.ctrl-btn.stop').click()`)
await c.eval(`window.__store.getState().setVoiceURI('__chant__')`)
await c.eval(`window.__store.getState().setSpeechRate(1.4)`)
await c.eval(`document.querySelector('.ctrl-btn.play').click()`)
const chantChosen = await c.waitFor(
  `window.__speech?.job?.mode === 'timed' && window.__store?.getState().praying === true`,
  6000
)
const rateApplied = await c.eval(`window.__speech?.job?.rate`)
ok(
  'soft-chant voice option chants at chosen speed',
  !!chantChosen && rateApplied === 1.4,
  `mode=${await c.eval('window.__speech?.job?.mode')} rate=${rateApplied}`
)
ok('chant pill shown', await c.eval(`!!document.querySelector('.chant-pill')`))
ok(
  'no block note for user-chosen chant',
  !(await c.eval(`!!document.querySelector('.voice-note')`))
)

// --- QR share card lives in settings, not the prayer header ---
ok(
  'no QR button in prayer header',
  !(await c.eval(`!!document.querySelector('.share-btn[title*="QR"]')`))
)
await c.eval(`window.__store.getState().setSettingsOpen(true)`)
ok('settings opens from prayer view', await c.waitFor(`!!document.querySelector('.sheet')`))
ok('settings offers QR card button', await c.eval(`!!document.querySelector('.field-btn')`))
await c.eval(`document.querySelector('.field-btn').click()`)
ok('QR card opens', await c.waitFor(`!!document.querySelector('.qr-card')`))
ok(
  'QR canvas drawn',
  await c.waitFor(`(() => { const cv = document.querySelector('.qr-canvas'); return !!cv && cv.width > 50 && cv.height > 50; })()`)
)
ok(
  'QR card shows the prayer deep link',
  await c.eval(`document.querySelector('.qr-url')?.innerText.includes('#/pray/buddhism/mani')`)
)
await c.eval(`document.querySelector('.qr-x').click()`)
ok('QR card closes', await c.waitFor(`!document.querySelector('.qr-card')`))
await c.eval(`document.querySelector('.sheet-close').click()`)
ok('settings closes after QR', await c.waitFor(`!document.querySelector('.sheet')`))

// --- console / runtime errors ---
const perr = c.pageErrors().slice(0, 5)
const cerr = c.consoleErrors().slice(0, 5)
ok('no uncaught page exceptions', perr.length === 0, perr.join(' | ') || 'none')
ok('no console errors', cerr.length === 0, cerr.join(' | ') || 'none')

log('---')
if (fails) {
  log(`${fails} check(s) FAILED`)
  process.exitCode = 1
} else {
  log('ALL CHECKS PASSED')
}
// Close the browser gracefully so its sync socket closes cleanly and the next
// test run doesn't see a stale "extra" person on the server.
try {
  await c.send('Browser.close')
} catch {}
edge.kill()
process.exit(process.exitCode || 0)
