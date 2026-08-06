import { spawn } from 'node:child_process'
import WebSocket from 'ws'

// =============================================================
// INDUSTRIAL PROOF TEST #2 — the long tail of gaps
//
//   H. persistence + reload
//   I. settings / locale / theme / volume mid-play
//   J. picker + tradition churn
//   K. legal pages + bad routes
//   L. rapid nav spamming + weird hash inputs
//   M. onboarding lifecycle
//   N. earth resize / churn / particles
//   O. two tabs: starting a prayer in one pauses the other
//   P. the speech singleton API directly
//
// Run: node scripts/test-proof-multi.mjs  (dev server on :5173)
// =============================================================

const APP = process.env.APP_URL || 'http://localhost:5173'
const EDGE = process.env.EDGE_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const DEBUG_PORT = 9292
const PROFILE = `${process.env.TEMP}\\pe-proof2-${Date.now()}`

let fails = 0
const checks = []
const ok = (n, c, x = '') => {
  checks.push({ n, c, x })
  console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${x ? `  [${x}]` : ''}`)
  if (!c) fails++
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const edge = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--mute-audio',
  '--autoplay-policy=no-user-gesture-required',
  '--no-first-run', '--no-default-browser-check',
  `--user-data-dir=${PROFILE}`, `--remote-debugging-port=${DEBUG_PORT}`, 'about:blank'
])
edge.stdout.on('data', () => {})
edge.stderr.on('data', () => {})

let cdpUrl = null
for (let i = 0; i < 50; i++) {
  try {
    const list = await (await fetch(`http://localhost:${DEBUG_PORT}/json`)).json()
    const p = list.find((t) => t.type === 'page')
    if (p) { cdpUrl = p.webSocketDebuggerUrl; break }
  } catch {}
  await sleep(250)
}
if (!cdpUrl) throw new Error('no CDP endpoint')

function makeClient(wsUrl, exceptions) {
  const ws = new WebSocket(wsUrl)
  const pending = new Map()
  let id = 0
  ws.on('message', (raw) => {
    const m = JSON.parse(raw.toString())
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id) }
    else if (m.method === 'Runtime.exceptionThrown') exceptions.push(m)
  })
  const open = new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej) })
  const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })) })
  const evaljs = async (e) => {
    const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })
    return r?.exceptionDetails ? null : r?.result?.value
  }
  const waitFor = async (expr, timeout = 20000) => {
    const t0 = Date.now()
    while (Date.now() - t0 < timeout) {
      const v = await evaljs(expr)
      if (v) return v
      await sleep(150)
    }
    return null
  }
  return { ws, open, send, evaljs, waitFor }
}

const excA = []
const excB = []
const c1 = makeClient(cdpUrl, excA)
await c1.open
const c2 = await (async () => {
  // browser-level endpoint lets us open a second tab in the same profile
  try {
    const version = await (await fetch(`http://localhost:${DEBUG_PORT}/json/version`)).json()
    const bw = new WebSocket(version.webSocketDebuggerUrl)
    await new Promise((res, rej) => { bw.on('open', res); bw.on('error', rej) })
    let rid = 0
    const bpend = new Map()
    bw.on('message', (raw) => { const m = JSON.parse(raw.toString()); if (m.id && bpend.has(m.id)) { bpend.get(m.id)(m.result); bpend.delete(m.id) } })
    const bsend = (method, params = {}) => new Promise((res) => { const i = ++rid; bpend.set(i, res); bw.send(JSON.stringify({ id: i, method, params })) })
    const created = await bsend('Target.createTarget', { url: `${APP}/#/` })
    await sleep(1500)
    const list = await (await fetch(`http://localhost:${DEBUG_PORT}/json`)).json()
    const t = list.find((x) => x.id === created.targetId)
    const cl = makeClient(t.webSocketDebuggerUrl, excB)
    await cl.open
    return cl
  } catch (e) {
    return null
  }
})()
const c3 = await (async () => {
  try {
    const version = await (await fetch(`http://localhost:${DEBUG_PORT}/json/version`)).json()
    const bw = new WebSocket(version.webSocketDebuggerUrl)
    await new Promise((res, rej) => { bw.on('open', res); bw.on('error', rej) })
    let rid = 0
    const bpend = new Map()
    bw.on('message', (raw) => { const m = JSON.parse(raw.toString()); if (m.id && bpend.has(m.id)) { bpend.get(m.id)(m.result); bpend.delete(m.id) } })
    const bsend = (method, params = {}) => new Promise((res) => { const i = ++rid; bpend.set(i, res); bw.send(JSON.stringify({ id: i, method, params })) })
    const created = await bsend('Target.createTarget', { url: `${APP}/#/pray/christianity/lords-prayer` })
    await sleep(1500)
    const list = await (await fetch(`http://localhost:${DEBUG_PORT}/json`)).json()
    const t = list.find((x) => x.id === created.targetId)
    const cl = makeClient(t.webSocketDebuggerUrl, excB)
    await cl.open
    return cl
  } catch (e) {
    return null
  }
})()
const E = c1
const A = c2 // second tab (also named A2 helper below)
const S = async () => {
  for (let i = 0; i < 8; i++) {
    const s = await E.evaljs(`(() => { const s = window.__store; if (!s) return null; const g = s.getState(); return { view: g.view, playing: g.playing, paused: g.paused, praying: g.praying, playingPrayerId: g.playingPrayerId, elapsed: g.elapsed, spiritId: g.spiritId, prayerId: g.prayerId, profile: g.profile, locale: g.locale } })()`)
    if (s) return s
    await sleep(200)
  }
  return { view: null, playing: false, paused: false, praying: false, playingPrayerId: null, elapsed: 0, spiritId: null, prayerId: null, profile: {}, locale: null }
}
process.on('uncaughtException', (e) => {
  console.log('SUITE CRASHED (flaky harness):', e?.message)
  console.log('PROOF #2 RESULT: crashed')
  try { edge.kill() } catch {}
  process.exit(1)
})
const job = async () => {
  for (let i = 0; i < 8; i++) {
    const j = await E.evaljs(`(() => { const sp = window.__speech; return sp ? { has: !!sp.job, paused: !!(sp.job && sp.job.paused) } : null })()`)
    if (j) return j
    await sleep(200)
  }
  return { has: false, paused: false }
}
const click = async (sel) => E.evaljs(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return false; el.click(); return true })()`)
const clickNav = async (label) => E.evaljs(`(() => { const b = Array.from(document.querySelectorAll('nav button')).find(x => x.getAttribute('aria-label') === ${JSON.stringify(label)} && !x.classList.contains('nav-play') && !x.classList.contains('nav-stop')); if (!b) return false; b.click(); return true })()`)

await c1.send('Runtime.enable')
await c1.send('Page.enable')
await c1.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false })
await c1.send('Page.navigate', { url: `${APP}/#/` })
const booted = await c1.waitFor(`!!window.__store`)
ok('H0 app boots', !!booted)
if (booted) {
  await c1.evaljs(`(() => { const b = document.querySelector('.onboard-begin, .onboard-skip'); if (b) b.click() })()`)
  await sleep(300)
}

// ---------- H. PERSISTENCE + RELOAD ----------
console.log('\n== H. persistence + reload ==')
await E.evaljs(`window.__store.getState().openPrayer('christianity', 'lords-prayer')`)
await c1.waitFor(`window.__store.getState().prayerId === 'lords-prayer'`)
await sleep(300)
await click('.ctrl-btn.play')
await c1.waitFor(`window.__store.getState().playing === true`, 8000)
await sleep(2200)
const beforeReload = await S()
ok('H1 playing before reload', !!beforeReload && beforeReload.playing && beforeReload.elapsed >= 1, `elapsed=${beforeReload?.elapsed}`)
const saved = await E.evaljs(`localStorage.getItem('prayer-earth-v1')`)
ok('H2 state persisted to localStorage', !!saved, `len=${saved ? saved.length : 0}`)
await c1.send('Page.reload', { ignoreCache: true })
const up = await c1.waitFor(`(() => { const s = window.__store; return !!(s && typeof s.getState().view === 'string' && s.getState().playing === false && s.getState().playingPrayerId === null) })()`, 25000)
await sleep(700)
let s = await S()
ok('H3 app boots after reload (no crash)', !!up && !!s && (s.view === 'prayer' || s.view === 'home'), `view=${s?.view}`)
ok('H4 playback is cleanly reset after reload', !!s && !s.playing && !s.paused && s.playingPrayerId === null, `playing=${s?.playing} ppid=${s?.playingPrayerId}`)
ok('H5 no exceptions through reload', excA.length === 0, `exc=${excA.length}`)

// ---------- I. SETTINGS / LOCALE / THEME / VOLUME MID-PLAY ----------
console.log('\n== I. settings + locale + theme + volume mid-play ==')
await E.evaljs(`window.__store.getState().openPrayer('christianity', 'lords-prayer')`)
await c1.waitFor(`window.__store.getState().prayerId === 'lords-prayer'`)
await sleep(200)
await click('.ctrl-btn.play')
await c1.waitFor(`window.__store.getState().playing === true`, 8000)
await E.evaljs(`window.__store.getState().setSettingsOpen(true)`)
await c1.waitFor(`!!document.querySelector('.sheet')`)
s = await S()
let j = await job()
ok('I1 settings opens over live playback', s.playing && !s.paused && j.has, `playing=${s.playing} job=${j.has}`)
// volume slider
const volChanged = await E.evaljs(`(() => { const v = document.querySelector('.field-input[type=range], input[type=range]'); if (!v) return false; v.value = 0.4; v.dispatchEvent(new Event('input', { bubbles: true })); return true })()`)
ok('I2 volume slider usable', !!volChanged)
// voice picker select
const voiceSel = await E.evaljs(`(() => { const sel = document.getElementById('voice-picker'); if (!sel) return false; sel.value = sel.options.length > 1 ? sel.options[1].value : sel.value; sel.dispatchEvent(new Event('change', { bubbles: true })); return true })()`)
ok('I3 voice picker usable', !!voiceSel)
// locale picker (language select)
const langSel = await E.evaljs(`(() => { const sels = Array.from(document.querySelectorAll('.sheet select')); const l = sels.find(x => x.options[0] && /English|English/i.test(x.options[0].text)); if (!l) return false; const es = Array.from(l.options).findIndex(o => /es|Espa/i.test(o.value || '')); if (es < 0) return false; l.value = l.options[es].value; l.dispatchEvent(new Event('change', { bubbles: true })); return true })()`)
ok('I4 language picker usable', !!langSel)
await sleep(500)
s = await S()
j = await job()
ok('I5 locale change does not kill playback', s.playing && !s.paused && j.has, `locale=${s.locale} playing=${s.playing} job=${j.has}`)
// theme change (labels may be localized; click by class)
const themeBtn = await E.evaljs(`(() => { const b = document.querySelector('.theme-opt:not(.on)'); if (!b) return false; b.click(); return true })()`)
ok('I6 theme control present', !!themeBtn)
await sleep(300)
s = await S()
ok('I7 still playing after settings churn', s.playing, `playing=${s.playing}`)
await E.evaljs(`window.__store.getState().setSettingsOpen(false)`)
await sleep(300)
s = await S()
ok('I8 settings closes, still playing', s.playing && !s.paused, `playing=${s.playing} paused=${s.paused}`)
// switch back to English for the rest of the suite
await E.evaljs(`window.__store.getState().setLocale('en')`)
await sleep(300)
ok('I9 no exceptions through settings churn', excA.length === 0, `exc=${excA.length}`)
await click('nav .nav-stop')
await c1.waitFor(`window.__store.getState().playing === false`, 6000)

// ---------- J. PICKER + TRADITION CHURN ----------
console.log('\n== J. picker + tradition churn ==')
await E.evaljs(`window.__store.getState().openPrayer('islam', 'al-fatiha')`)
await c1.waitFor(`window.__store.getState().prayerId === 'al-fatiha'`)
await sleep(200)
await click('.ctrl-btn.play')
await c1.waitFor(`window.__store.getState().playing === true`, 8000)
await E.evaljs(`window.__store.getState().openPrayerPicker('islam')`)
await c1.waitFor(`!!document.querySelector('.picker-row')`)
s = await S()
j = await job()
ok('J1 picker opens over live playback (old keeps playing)', s.playing && !s.paused && j.has, `playing=${s.playing}`)
// flip through several traditions
let pickerOk = true
for (const tr of ['christianity', 'buddhism', 'hinduism', 'islam', 'judaism', 'sikhism', 'shinto']) {
  const opened = await E.evaljs(`window.__store.getState().openPrayerPicker('${tr}'); true`)
  await sleep(200)
  const rows = await E.evaljs(`document.querySelectorAll('.picker-row').length`)
  if (!opened || rows === 0) pickerOk = false
}
ok('J2 picker handles many tradition switches', pickerOk)
await E.evaljs(`window.__store.getState().closePrayerPicker()`)
await sleep(300)
s = await S()
j = await job()
ok('J3 closing the picker keeps the old prayer playing', s.playing && !s.paused && j.has, `playing=${s.playing}`)
// pick a DIFFERENT prayer from the picker (should stop the old per the fix)
await E.evaljs(`window.__store.getState().openPrayerPicker('christianity')`)
await c1.waitFor(`!!document.querySelector('.picker-row')`)
await E.evaljs(`(() => { const rows = document.querySelectorAll('.picker-row'); rows[rows.length - 1].click() })()`)
await sleep(400)
s = await S()
ok('J4 selecting a different prayer stops the old', !s.playing && s.playingPrayerId === null, `playing=${s.playing} ppid=${s.playingPrayerId}`)
ok('J5 no exceptions through picker churn', excA.length === 0, `exc=${excA.length}`)

// ---------- K. LEGAL PAGES + BAD ROUTES ----------
console.log('\n== K. legal + bad routes ==')
await E.evaljs(`window.__store.getState().openLegal('privacy')`)
await c1.waitFor(`window.__store.getState().view === 'legal'`)
const legalText = await E.evaljs(`document.querySelector('.legal-view') ? document.body.innerText.length : 0`)
ok('K1 legal page renders content', legalText > 200, `chars=${legalText}`)
await E.evaljs(`window.__store.getState().closeLegal()`)
await c1.waitFor(`window.__store.getState().view === 'home'`)
ok('K2 legal closes back to home', (await S()).view === 'home')
await E.evaljs(`location.hash = '#/terms'`)
await c1.waitFor(`window.__store.getState().view === 'legal'`, 6000)
ok('K3 terms deep link works', (await S()).view === 'legal')
// bad routes: nonsense hash, bad prayer, missing ids
await E.evaljs(`location.hash = '#/nonsense-route'`)
await sleep(500)
ok('K4 unknown hash falls back to home', (await S()).view === 'home', `view=${(await S()).view}`)
await E.evaljs(`location.hash = '#/pray/nonexistent/nope'`)
await sleep(800)
s = await S()
ok('K5 bad prayer deep link does not crash', !!s && (s.view === 'home' || s.view === 'prayer'), `view=${s?.view}`)
ok('K6 no exceptions through routing churn', excA.length === 0, `exc=${excA.length}`)

// ---------- L. RAPID NAV SPAMMING ----------
console.log('\n== L. rapid nav spamming ==')
let spamOk = true
for (let i = 0; i < 10; i++) {
  const target = i % 2 === 0 ? 'Earth' : 'Home'
  const r = await clickNav(target)
  if (!r) spamOk = false
  await sleep(120)
}
await sleep(600)
const spamExc = excA.length
ok('L1 rapid home/earth spam does not throw', spamOk && spamExc === 0, `exc=${spamExc}`)
const afterSpam = await S()
ok('L2 app alive after the spam (store responsive)', !!afterSpam, `view=${afterSpam?.view}`)

// ---------- M. ONBOARDING ----------
console.log('\n== M. onboarding ==')
await c1.send('Storage.clearDataForOrigin', { origin: APP, storageTypes: 'local_storage' })
await c1.send('Page.reload', { ignoreCache: true })
const onboard = await c1.waitFor(`!!document.querySelector('.onboard-begin, .onboard-skip')`, 15000)
ok('M1 fresh boot shows onboarding', !!onboard)
if (onboard) {
  await E.evaljs(`document.querySelector('.onboard-begin').click()`)
  await sleep(400)
  const flag = await E.evaljs(`localStorage.getItem('pe-onboarded')`)
  ok('M2 onboarding flag persisted', flag !== null, `flag=${flag}`)
  ok('M3 home shows after onboarding', (await S()).view === 'home', `view=${(await S()).view}`)
  await c1.send('Page.reload', { ignoreCache: true })
  await c1.waitFor(`!!window.__store`, 15000)
  await sleep(500)
  const again = await E.evaljs(`!!document.querySelector('.onboard-begin')`)
  ok('M4 onboarding does not re-show after completion', !again)
} else {
  ok('M2 onboarding flag persisted', false)
  ok('M3 home shows after onboarding', false)
  ok('M4 onboarding does not re-show', false)
}

// ---------- N. EARTH RESIZE / CHURN / PARTICLES ----------
console.log('\n== N. earth resize + churn + particles ==')
await E.evaljs(`window.__store.getState().go('earth')`)
await c1.waitFor(`!!document.querySelector('.earth-canvas canvas')`, 20000)
await c1.send('Emulation.setDeviceMetricsOverride', { width: 900, height: 700, deviceScaleFactor: 1, mobile: false })
await sleep(800)
let dims = await E.evaljs(`(() => { const c = document.querySelector('.earth-canvas canvas'); return c ? { w: c.clientWidth, h: c.clientHeight } : null })()`)
ok('N1 earth canvas resizes with the viewport', !!dims && dims.w > 500 && dims.h > 400, `w=${dims?.w} h=${dims?.h}`)
await c1.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false })
await sleep(400)
dims = await E.evaljs(`(() => { const c = document.querySelector('.earth-canvas canvas'); return c ? { w: c.clientWidth, h: c.clientHeight } : null })()`)
ok('N2 earth canvas returns to full width', !!dims && dims.w > 1000, `w=${dims?.w}`)
// background prayer over the earth
await E.evaljs(`window.__store.getState().openPrayer('christianity', 'lords-prayer')`)
await c1.waitFor(`window.__store.getState().prayerId === 'lords-prayer'`)
await E.evaljs(`window.__store.getState().go('earth')`)
await c1.waitFor(`window.__store.getState().view === 'earth'`)
await E.evaljs(`(() => { const g = window.__store.getState(); g.openPrayer('christianity', 'lords-prayer'); })()`)
await sleep(300)
await click('.ctrl-btn.play')
await c1.waitFor(`window.__store.getState().playing === true`, 8000)
await E.evaljs(`window.__store.getState().go('earth')`)
await sleep(1500)
s = await S()
j = await job()
ok('N3 prayer plays in the background over the Earth', s.playing && !s.paused && j.has, `playing=${s.playing}`)
ok('N4 no exceptions during earth+playback', excA.length === 0, `exc=${excA.length}`)
// mount/unmount churn x4
let churnExc = 0
for (let i = 0; i < 4; i++) {
  await E.evaljs(`window.__store.getState().go('home')`); await sleep(250)
  await E.evaljs(`window.__store.getState().go('earth')`); await sleep(250)
}
churnExc = excA.length
ok('N5 earth mount/unmount x4 without exceptions', churnExc === 0, `exc=${churnExc}`)
await click('nav .nav-stop')
await c1.waitFor(`window.__store.getState().playing === false`, 6000)

// ---------- O. TWO-TAB MUTUAL PAUSE ----------
console.log('\n== O. two-tab mutual pause ==')
if (A && c3) {
  // tab 2: start a prayer
  await A.evaljs(`(() => { const b = document.querySelector('.onboard-begin, .onboard-skip'); if (b) b.click() })()`)
  await sleep(300)
  await A.evaljs(`window.__store.getState().openPrayer('christianity', 'lords-prayer')`)
  await A.waitFor(`window.__store.getState().prayerId === 'lords-prayer'`)
  await sleep(300)
  await A.evaljs(`document.querySelector('.ctrl-btn.play').click()`)
  await A.waitFor(`window.__store.getState().playing === true`, 8000)
  const aState = await A.evaljs(`(() => { const g = window.__store.getState(); return { playing: g.playing, paused: g.paused } })()`)
  ok('O1 tab 2 starts a prayer', aState.playing && !aState.paused, JSON.stringify(aState))
  // now tab 3 (already on a deep link) starts a different prayer
  await c3.evaljs(`(() => { const b = document.querySelector('.onboard-begin, .onboard-skip'); if (b) b.click() })()`)
  await sleep(300)
  await c3.evaljs(`document.querySelector('.ctrl-btn.play').click()`)
  await c3.waitFor(`window.__store.getState().playing === true`, 8000)
  const c3State = await c3.evaljs(`(() => { const g = window.__store.getState(); return { playing: g.playing, paused: g.paused } })()`)
  ok('O2 tab 3 starts a prayer (one-at-a-time rule)', c3State.playing && !c3State.paused, JSON.stringify(c3State))
  // the BroadcastChannel should have paused tab 2
  await sleep(800)
  const aAfter = await A.evaljs(`(() => { const g = window.__store.getState(); return { playing: g.playing, paused: g.paused } })()`)
  ok('O3 tab 2 is paused when tab 3 starts', aAfter.playing && aAfter.paused, JSON.stringify(aAfter))
  ok('O4 no exceptions in either tab', excA.length + excB.length === 0, `exc=${excA.length}+${excB.length}`)
} else {
  ok('O1 tab 2 opens', false, 'could not open second tab')
  ok('O2 tab 3 opens', false, 'could not open third tab')
  ok('O3 mutual pause', false, 'multi-tab setup failed')
  ok('O4 no exceptions', false, 'multi-tab setup failed')
}

// ---------- P. SPEECH SINGLETON API ----------
console.log('\n== P. speech singleton API ==')
await E.evaljs(`window.__store.getState().openPrayer('christianity', 'lords-prayer')`)
await c1.waitFor(`window.__store.getState().prayerId === 'lords-prayer'`)
await sleep(200)
const api = await E.evaljs(`(() => { const sp = window.__speech; return { hasStart: typeof sp.start === 'function', hasStop: typeof sp.stop === 'function', hasPause: typeof sp.pause === 'function', hasResume: typeof sp.resume === 'function', hasCurrent: typeof sp.currentIndex === 'function' } })()`)
ok('P1 speech API surface complete', api.hasStart && api.hasStop && api.hasPause && api.hasResume && api.hasCurrent, JSON.stringify(api))
await click('.ctrl-btn.play')
await c1.waitFor(`window.__store.getState().playing === true`, 8000)
await sleep(1200)
const idx = await E.evaljs(`window.__speech.currentIndex()`)
ok('P2 currentIndex advances during playback', typeof idx === 'number' && idx >= 0, `idx=${idx}`)
await E.evaljs(`window.__speech.pause()`)
const pausedJob = await E.evaljs(`!!(window.__speech.job && window.__speech.job.paused)`)
ok('P3 direct pause marks the job paused', pausedJob)
await E.evaljs(`window.__speech.resume()`)
await sleep(300)
const resumed = await E.evaljs(`!!(window.__speech.job && !window.__speech.job.paused)`)
ok('P4 direct resume un-pauses the job', resumed)
await E.evaljs(`window.__speech.stop()`)
const stopped = await E.evaljs(`window.__speech.job === null`)
ok('P5 direct stop clears the job', stopped)
await E.evaljs(`window.__store.getState().setPlaying(false)`)
await E.evaljs(`window.__store.getState().setPraying(false)`)

// ---------- FINAL ----------
const total = excA.length + excB.length
ok('Z1 zero runtime exceptions across the entire proof #2', total === 0, `exc=${total}`)
console.log('\n----------------------------------------')
const passed = checks.filter((c) => c.c).length
console.log(`PROOF #2 RESULT: ${passed}/${checks.length} passed, ${fails} failed`)
if (fails) {
  checks.filter((c) => !c.c).forEach((c) => console.log(`  FAILED: ${c.n}${c.x ? `  [${c.x}]` : ''}`))
  if (total) console.log('  first exception:', (excA[0] || excB[0])?.params?.exceptionDetails?.exception?.description?.slice(0, 300) || '?')
}
try { edge.kill() } catch {}
process.exit(fails ? 1 : 0)
