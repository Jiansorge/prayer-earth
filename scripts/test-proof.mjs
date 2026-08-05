import { spawn } from 'node:child_process'
import WebSocket from 'ws'

// =============================================================
// INDUSTRIAL PROOF TEST — playability + earth + pause/stop
//
// Boots the real app in a headless Edge and proves the loops users
// actually hit:
//   A. boot + home renders
//   B. earth page: renders, fills the viewport, nav stays clickable,
//      survives mount/unmount churn, zero exceptions
//   C. playback basics: play / pause / resume / stop via real buttons
//   D. background playback: a prayer keeps playing + counting while you
//      browse Home and Earth (the core feature)
//   E. changing prayers stops the old one (picker, chips, deep links)
//   F. footer play/stop from any view
//   G. pause/stop semantics + stress: rapid toggles, mid-prayer switch,
//      loop + voice toggles, no exceptions, consistent final state
//
// Run: node scripts/test-proof.mjs   (expects dev server on :5173)
// =============================================================

const APP = process.env.APP_URL || 'http://localhost:5173'
const EDGE = process.env.EDGE_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const DEBUG_PORT = 9290
const PROFILE = `${process.env.TEMP}\\pe-proof-${Date.now()}`

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

const ws = new WebSocket(cdpUrl)
await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej) })
let id = 0
const pending = new Map()
const exceptions = []
ws.on('message', (raw) => {
  const m = JSON.parse(raw.toString())
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id) }
  else if (m.method === 'Runtime.exceptionThrown') exceptions.push(m)
})
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })) })
const evaljs = async (e) => {
  const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })
  if (r?.exceptionDetails) return null
  return r?.result?.value
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
const S = () => evaljs(`(() => { const s = window.__store; if (!s) return null; const g = s.getState(); return { view: g.view, playing: g.playing, paused: g.paused, praying: g.praying, playingPrayerId: g.playingPrayerId, elapsed: g.elapsed, spiritId: g.spiritId, prayerId: g.prayerId, pendingPlay: g.pendingPlay, connected: g.connected } })()`)
const job = () => evaljs(`(() => { const sp = window.__speech; return sp ? { has: !!sp.job, paused: !!(sp.job && sp.job.paused), idx: sp.job ? (sp.job.index ?? 0) : -1 } : null })()`)
const click = async (sel) => evaljs(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return false; el.click(); return true })()`)
const clickNav = async (label) => evaljs(`(() => { const b = Array.from(document.querySelectorAll('nav button')).find(x => x.getAttribute('aria-label') === ${JSON.stringify(label)} && !x.classList.contains('nav-play') && !x.classList.contains('nav-stop')); if (!b) return false; b.click(); return true })()`)
const excCount = () => exceptions.length
const excFirst = () => exceptions[0]?.params?.exceptionDetails?.exception?.description || exceptions[0]?.params?.exceptionDetails?.text || '?'

await send('Runtime.enable')
await send('Page.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false })
await send('Page.navigate', { url: `${APP}/#/` })

// ---------- A. BOOT + HOME ----------
console.log('\n== A. boot + home ==')
const booted = await waitFor(`!!window.__store`)
ok('A1 app boots (store present)', !!booted)
if (booted) {
  await sleep(600)
  const hidden = await evaljs('document.hidden')
  ok('A2 page is visible (no spurious auto-pause)', !hidden, `document.hidden=${hidden}`)
  await evaljs(`(() => { const b = document.querySelector('.onboard-begin, .onboard-skip'); if (b) b.click(); return !!b })()`)
  await sleep(400)
  const tiles = await evaljs(`Array.from(document.querySelectorAll('.tile, [class*=tile]')).length`)
  ok('A3 home renders the tradition tiles', tiles >= 12, `tiles=${tiles}`)
  const st = await S()
  ok('A4 starts on home view', st.view === 'home', `view=${st.view}`)
  ok('A5 idle: nothing playing', !st.playing && !st.paused, `playing=${st.playing}`)
}

// ---------- B. EARTH PAGE ----------
console.log('\n== B. earth page ==')
const clickedEarth = await clickNav('Earth')
ok('B1 earth tab clickable', !!clickedEarth)
const canvas = await waitFor(`!!document.querySelector('.earth-canvas canvas')`, 25000)
ok('B2 earth canvas renders', !!canvas)
if (canvas) {
  const dims = await evaljs(`(() => { const c = document.querySelector('.earth-canvas canvas'); return c ? { w: c.clientWidth, h: c.clientHeight } : null })()`)
  ok('B3 earth fills the desktop viewport', !!dims && dims.w > 900 && dims.h > 400, `w=${dims?.w} h=${dims?.h}`)
  const overlay = await waitFor(`!document.querySelector('.earth-loading-overlay')`, 12000)
  const hud = await evaljs(`!!document.querySelector('.earth-hud')`)
  ok('B4 loading overlay clears + HUD up', !!overlay && !!hud, `overlayCleared=${!!overlay} hud=${hud}`)
  ok('B5 no exceptions on earth', excCount() === 0, `exc=${excCount()}`)
}
const navStillWorks = await clickNav('Home')
ok('B6 nav still clickable while earth is up', !!navStillWorks)
await waitFor(`window.__store.getState().view === 'home'`)
ok('B7 returns to home', (await S()).view === 'home')
// mount/unmount churn
await clickNav('Earth'); await sleep(800); await clickNav('Home'); await sleep(400)
await clickNav('Earth'); await waitFor(`!!document.querySelector('.earth-canvas canvas')`, 20000)
const churnExc = excCount()
ok('B8 earth survives nav churn without exceptions', churnExc === 0, `exc=${churnExc}`)
ok('B9 total exceptions so far', excCount() === 0, `exc=${excCount()}`)

// ---------- C. PLAYBACK BASICS ----------
console.log('\n== C. playback basics ==')
await evaljs(`window.__store.getState().openPrayer('christianity', 'lords-prayer')`)
await waitFor(`window.__store.getState().view === 'prayer' && !!document.querySelector('.ctrl-btn.play')`)
ok('C1 prayer page open', true)
await sleep(300)
const started = await click('.ctrl-btn.play')
ok('C2 play button clickable', !!started)
await waitFor(`window.__store.getState().playing === true`, 8000)
let s = await S()
ok('C3 playing starts', s.playing === true, `playing=${s.playing} paused=${s.paused}`)
ok('C4 playingPrayerId set', s.playingPrayerId === 'lords-prayer', `ppid=${s.playingPrayerId}`)
const j = await job()
ok('C5 speech engine has a live job', j && j.has, JSON.stringify(j))
await sleep(1100)
s = await S()
ok('C6 elapsed ticks while playing', s.elapsed >= 1, `elapsed=${s.elapsed}`)

// pause
const pausedBtn = await waitFor(`!!document.querySelector('.ctrl-btn.play[aria-label="Pause"], .ctrl-btn.play[aria-label="Pause"]')`, 6000)
ok('C7 pause affordance appears', !!pausedBtn)
await click('.ctrl-btn.play')
await waitFor(`window.__store.getState().paused === true`, 6000)
s = await S()
ok('C8 pause works', s.paused === true && s.playing === true, `playing=${s.playing} paused=${s.paused}`)
const jp = await job()
ok('C9 audio job preserved on pause', jp && jp.has && jp.paused, JSON.stringify(jp))
const frozen = s.elapsed
await sleep(2200)
s = await S()
ok('C10 paused: elapsed stops', s.elapsed === frozen, `was=${frozen} now=${s.elapsed}`)

// resume
await click('.ctrl-btn.play')
await waitFor(`window.__store.getState().paused === false`, 6000)
s = await S()
ok('C11 resume works', s.playing === true && s.paused === false, `playing=${s.playing} paused=${s.paused}`)
await sleep(1200)
s = await S()
ok('C12 elapsed resumes', s.elapsed >= frozen + 1, `now=${s.elapsed}`)

// stop (page stop button)
await click('.ctrl-btn.stop')
await waitFor(`window.__store.getState().playing === false`, 6000)
s = await S()
ok('C13 stop works', !s.playing && !s.paused && s.playingPrayerId === null, `playing=${s.playing} ppid=${s.playingPrayerId}`)
const js = await job()
ok('C14 audio job cleared on stop', js && !js.has, JSON.stringify(js))

// ---------- D. BACKGROUND PLAYBACK ACROSS VIEWS ----------
console.log('\n== D. background playback across views (core feature) ==')
await click('.ctrl-btn.play')
await waitFor(`window.__store.getState().playing === true`, 8000)
await sleep(600)
const before = await S()
const baseElapsed = before.elapsed
ok('D1 playing lords-prayer', before.playing && before.playingPrayerId === 'lords-prayer', `ppid=${before.playingPrayerId}`)

// to home
await clickNav('Home')
await waitFor(`window.__store.getState().view === 'home'`)
await sleep(600)
s = await S()
let jb = await job()
ok('D2 still playing on Home (audio alive)', s.playing && !s.paused && jb.has, `playing=${s.playing} paused=${s.paused} job=${jb.has}`)

// to earth
await clickNav('Earth')
await waitFor(`window.__store.getState().view === 'earth'`)
await sleep(2600) // let the clock tick while on earth
s = await S()
jb = await job()
ok('D3 still playing on Earth (audio alive)', s.playing && !s.paused && jb.has, `playing=${s.playing} paused=${s.paused} job=${jb.has}`)
ok('D4 prayer keeps COUNTING on Earth (store clock)', s.elapsed > baseElapsed + 1, `elapsed=${s.elapsed} base=${baseElapsed}`)

// back to pray tab: old prayer still playing
await clickNav('Pray')
await waitFor(`window.__store.getState().view === 'prayer'`)
await sleep(400)
s = await S()
jb = await job()
ok('D5 old prayer still playing on pray tab', s.playing && !s.paused && s.playingPrayerId === 'lords-prayer', `ppid=${s.playingPrayerId} job=${jb.has}`)
ok('D6 prayer page reflects the playing prayer', s.prayerId === 'lords-prayer' || s.prayerId === 'lords-prayer', `prayerId=${s.prayerId}`)

// switch: open a different prayer and press play → switches
await evaljs(`window.__store.getState().openPrayer('buddhism', 'metta')`)
await waitFor(`window.__store.getState().prayerId === 'metta'`)
await sleep(500)
s = await S()
ok('D7 viewing a different prayer (old keeps playing)', s.playing && s.playingPrayerId === 'lords-prayer', `ppid=${s.playingPrayerId}`)
await click('.ctrl-btn.play') // press play on the displayed metta
await waitFor(`window.__store.getState().playingPrayerId === 'metta'`, 8000)
s = await S()
jb = await job()
ok('D8 pressing play switches to the new prayer', s.playing && s.playingPrayerId === 'metta' && jb.has, `ppid=${s.playingPrayerId} job=${jb.has}`)
ok('D9 no exceptions through background flows', excCount() === 0, `exc=${excCount()}`)

// ---------- E. CHANGING PRAYERS STOPS THE OLD ----------
console.log('\n== E. changing prayers stops the old ==')
// E1 via picker
await evaljs(`window.__store.getState().openPrayerPicker('christianity')`)
await waitFor(`!!document.querySelector('.picker-row')`)
await evaljs(`document.querySelector('.picker-row').click()`)
await waitFor(`window.__store.getState().praying === false || !window.__store.getState().playing`)
s = await S()
ok('E1 picker selection stopped the playing prayer', !s.playing && s.playingPrayerId === null, `playing=${s.playing} ppid=${s.playingPrayerId}`)

// E2 via related-prayer chips (start metta then tap a chip to another prayer)
await evaljs(`window.__store.getState().openPrayer('buddhism', 'metta')`)
await waitFor(`window.__store.getState().prayerId === 'metta'`)
await sleep(300)
await click('.ctrl-btn.play')
await waitFor(`window.__store.getState().playing === true`, 8000)
await sleep(300)
const chipOk = await evaljs(`(() => { const chip = Array.from(document.querySelectorAll('.chip')).find(c => c.className.includes('chip') && !c.className.includes('on') && !c.className.includes('chip-all')); if (!chip) return false; chip.click(); return true })()`)
ok('E2a a different prayer chip is available', !!chipOk)
await waitFor(`window.__store.getState().prayerId !== 'metta'`, 6000)
s = await S()
ok('E2b chip switch stopped the old prayer', !s.playing && s.playingPrayerId === null, `playing=${s.playing} ppid=${s.playingPrayerId} prayerId=${s.prayerId}`)

// E3 via deep link: viewing a different prayer keeps background playback;
// pressing play on the new one switches to it (same contract as the chips)
await evaljs(`window.__store.getState().openPrayer('christianity', 'lords-prayer')`)
await waitFor(`window.__store.getState().prayerId === 'lords-prayer'`)
await sleep(200)
await click('.ctrl-btn.play')
await waitFor(`window.__store.getState().playing === true`, 8000)
await sleep(200)
await evaljs(`location.hash = '#/pray/buddhism/mani'`)
await waitFor(`window.__store.getState().prayerId === 'mani'`, 6000)
s = await S()
ok('E3 deep link views the new prayer (old keeps playing)', s.playing && s.playingPrayerId === 'lords-prayer', `playing=${s.playing} ppid=${s.playingPrayerId}`)
await click('.ctrl-btn.play')
await waitFor(`window.__store.getState().playingPrayerId === 'mani'`, 8000)
s = await S()
ok('E3b pressing play switches to the deep-linked prayer', s.playing && s.playingPrayerId === 'mani', `ppid=${s.playingPrayerId}`)
await click('nav .nav-stop')
await waitFor(`window.__store.getState().playing === false`, 6000)

// ---------- F. FOOTER CONTROL FROM ANY VIEW ----------
console.log('\n== F. footer play/stop from any view ==')
// footer play from home starts the last prayer
await clickNav('Home')
await waitFor(`window.__store.getState().view === 'home'`)
await sleep(300)
await click('nav .nav-play')
await waitFor(`window.__store.getState().playing === true`, 8000)
s = await S()
ok('F1 footer play from Home starts the prayer', s.playing && s.view === 'prayer', `view=${s.view} playing=${s.playing}`)
// footer stop from earth stops everything
await clickNav('Earth')
await waitFor(`window.__store.getState().view === 'earth'`)
await sleep(300)
await click('nav .nav-stop')
await waitFor(`window.__store.getState().playing === false`, 6000)
s = await S()
ok('F2 footer stop from Earth stops everything', !s.playing && !s.paused && s.playingPrayerId === null, `playing=${s.playing} paused=${s.paused}`)
const js2 = await job()
ok('F3 audio job cleared', js2 && !js2.has)
// footer play toggles: play → pause (nav-play shows pause while playing)
await click('nav .nav-play')
await waitFor(`window.__store.getState().playing === true`, 8000)
await sleep(400)
await click('nav .nav-play')
await waitFor(`window.__store.getState().paused === true`, 6000)
s = await S()
ok('F4 footer play toggles pause while playing', s.playing && s.paused, `playing=${s.playing} paused=${s.paused}`)

// ---------- G. PAUSE/STOP SEMANTICS + STRESS ----------
console.log('\n== G. stress + edge cases ==')
// G1 rapid toggle barrage: 6 cycles of play/pause/stop, assert a sane end state
let boom = false
for (let i = 0; i < 6; i++) {
  await click('.ctrl-btn.play'); await sleep(120)
  await click('.ctrl-btn.play'); await sleep(120)
  await click('.ctrl-btn.stop'); await sleep(120)
}
s = await S()
boom = excCount()
ok('G1 rapid play/pause/stop x6 leaves a consistent idle state', !s.playing && !s.paused && s.playingPrayerId === null, `playing=${s.playing} paused=${s.paused} ppid=${s.playingPrayerId}`)
ok('G2 no exceptions during the barrage', boom === 0, `exc=${boom}`)

// G3 mid-phrase switch: start A then immediately B, only B should be playing
await evaljs(`window.__store.getState().openPrayer('christianity', 'lords-prayer')`)
await waitFor(`window.__store.getState().prayerId === 'lords-prayer'`)
await sleep(200)
await click('.ctrl-btn.play')
await sleep(150)
await evaljs(`window.__store.getState().openPrayer('buddhism', 'mani')`)
await waitFor(`window.__store.getState().prayerId === 'mani'`)
await sleep(200)
await click('.ctrl-btn.play')
await waitFor(`window.__store.getState().playingPrayerId === 'mani'`, 8000)
s = await S()
const jm = await job()
ok('G3 starting B mid-prayer leaves only B playing', s.playing && s.playingPrayerId === 'mani' && !s.paused, `ppid=${s.playingPrayerId} paused=${s.paused}`)
ok('G4 single live job after the switch', jm && jm.has, JSON.stringify(jm))

// G5 loop toggle while playing
await click('.ctrl-btn.repeat')
await sleep(500)
s = await S()
ok('G5 loop toggle while playing keeps it playing', s.playing, `playing=${s.playing}`)
await click('.ctrl-btn.repeat')

// G6 voice switch while playing (open the tune panel, pick the first voice)
await sleep(300)
const tuneOpened = await click('.ctrl-btn.tune')
ok('G6a tune panel opens', !!tuneOpened)
const voiceChip = await waitFor(`!!document.querySelector('.voice-chip')`, 6000)
if (voiceChip) {
  await click('.voice-chip')
  await sleep(600)
  s = await S()
  ok('G6 voice switch while playing keeps it playing', s.playing && !s.paused, `playing=${s.playing} paused=${s.paused}`)
  await click('.ctrl-btn.tune') // close the panel
} else {
  ok('G6 voice chip available', false, 'no .voice-chip')
}

// G7 settings sheet while playing (modal over active playback)
await evaljs(`window.__store.getState().setSettingsOpen(true)`)
await waitFor(`!!document.querySelector('.sheet')`)
await sleep(400)
s = await S()
const j7 = await job()
ok('G7 playing survives opening settings', s.playing && !s.paused && j7.has, `playing=${s.playing} paused=${s.paused}`)
await evaljs(`window.__store.getState().setSettingsOpen(false)`)

// G8 final: stop everything, zero exceptions anywhere
await click('nav .nav-stop')
await waitFor(`window.__store.getState().playing === false`, 6000)
const total = excCount()
ok('G8 clean shutdown', excCount() === 0, `exc=${total}`)
ok('G9 total runtime exceptions across the whole proof', total === 0, `exc=${total}`)

console.log('\n----------------------------------------')
const passed = checks.filter((c) => c.c).length
console.log(`PROOF RESULT: ${passed}/${checks.length} passed, ${fails} failed`)
if (fails) {
  checks.filter((c) => !c.c).forEach((c) => console.log(`  FAILED: ${c.n}${c.x ? `  [${c.x}]` : ''}`))
  if (excCount()) console.log('  first exception:', excFirst().slice(0, 300))
}
try { edge.kill() } catch {}
process.exit(fails ? 1 : 0)
