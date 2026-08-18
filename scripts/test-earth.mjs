import { spawn } from 'node:child_process'
import WebSocket from 'ws'
import { readFileSync, writeFileSync } from 'node:fs'
import { inflateSync } from 'node:zlib'

// INDUSTRIAL PROOF — Earth rendering + tab-switch auto-pause
//
// Part 1 (earth): the 3D earth view must mount, render a real (non-black)
// globe, clear its loading overlay, and never throw.
// Part 2 (tabs): a prayer playing in the background keeps playing while you
// navigate Home/Earth and while the tab is hidden, and recovers via the
// footer play button after downtime/sleep.
//
// Run: node scripts/test-earth.mjs  (dev server on :5173)

const APP = process.env.APP_URL || 'http://localhost:5173'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const DEBUG_PORT = 9350
const PROFILE = `${process.env.TEMP}\\pe-earthproof-${Date.now()}`
const OUT = `${process.env.TEMP}\\earthproof.png`
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let fails = 0
const ok = (n, c, x = '') => { console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${x ? `  [${x}]` : ''}`); if (!c) fails++ }
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--mute-audio', '--autoplay-policy=no-user-gesture-required', '--no-first-run', `--user-data-dir=${PROFILE}`, `--remote-debugging-port=${DEBUG_PORT}`, 'about:blank'])
let cdpUrl = null
for (let i = 0; i < 50; i++) { try { const l = await (await fetch(`http://localhost:${DEBUG_PORT}/json`)).json(); const p = l.find(t => t.type === 'page'); if (p) { cdpUrl = p.webSocketDebuggerUrl; break } } catch {} await sleep(250) }
const ws = new WebSocket(cdpUrl)
await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej) })
let id = 0; const pending = new Map(); const exc = []
ws.on('message', (raw) => { const m = JSON.parse(raw.toString()); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id) } else if (m.method === 'Runtime.exceptionThrown') exc.push(m) })
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })) })
const evaljs = async (e) => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); return r?.exceptionDetails ? null : r?.result?.value }
const waitFor = async (expr, timeout = 25000) => { const t0 = Date.now(); while (Date.now() - t0 < timeout) { const v = await evaljs(expr); if (v) return v; await sleep(250) } return null }
await send('Runtime.enable'); await send('Page.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false })

// ---------- PART 1: EARTH RENDERS ----------
await send('Page.navigate', { url: `${APP}/#/earth` })
const canvas = await waitFor(`!!document.querySelector('.earth-canvas canvas')`, 30000)
ok('E1 earth canvas mounts', !!canvas)
const size = await evaljs(`(() => { const c = document.querySelector('.earth-canvas canvas'); if (!c) return null; return { w: c.clientWidth, h: c.clientHeight, bufW: c.width, bufH: c.height } })()`)
ok('E2 canvas has real size (not a collapsed 1px strip)', !!size && size.w > 200 && size.h > 200, JSON.stringify(size))
const overlay = await waitFor(`!document.querySelector('.earth-loading-overlay')`, 15000)
ok('E3 loading overlay clears', !!overlay)
await sleep(1200)
const scene = await evaljs(`(() => { const e = window.__earthScene; if (!e) return null; return {
  renderer: !!e.renderer, earth: !!e.earth, lights: !!e.lights,
  triangles: e.renderer ? e.renderer.info.render.triangles : 0,
  dpr: e.renderer ? e.renderer.getPixelRatio() : 0
} })()`)
ok('E4 scene built (renderer + earth + lights)', !!scene && scene.renderer && scene.earth && scene.lights, JSON.stringify(scene))
ok('E5 earth actually draws triangles', !!scene && scene.triangles > 5000, `tri=${scene?.triangles}`)
// the globe must render as a lit planet, not black space — sample INSIDE the
// canvas rect (measured live), not a guessed page region
const rect = await evaljs(`(() => { const r = document.querySelector('.earth-canvas canvas').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height } })()`)
const shot = await send('Page.captureScreenshot', { format: 'png' })
writeFileSync(OUT, Buffer.from(shot.data, 'base64'))
const buf = readFileSync(OUT)
let off = 8, width = 0, height = 0, colorType = 0
const idat = []
while (off < buf.length) { const len = buf.readUInt32BE(off); const type = buf.toString('ascii', off + 4, off + 8); if (type === 'IHDR') { width = buf.readUInt32BE(off + 8); height = buf.readUInt32BE(off + 12); colorType = buf[off + 17] } else if (type === 'IDAT') idat.push(buf.slice(off + 8, off + 8 + len)); else if (type === 'IEND') break; off += 12 + len }
const raw = inflateSync(Buffer.concat(idat))
const bpp = colorType === 6 ? 4 : 3, stride = width * bpp
const px = Buffer.alloc(height * stride)
const paeth = (a, b, c) => { const p = a + b - c; const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c }
let p = 0
for (let y = 0; y < height; y++) { const f = raw[p++]; const row = y * stride; const prev = (y - 1) * stride; for (let x = 0; x < stride; x++) { let v = raw[p++]; const a = x >= bpp ? px[row + x - bpp] : 0; const b = y > 0 ? px[prev + x] : 0; const c = x >= bpp && y > 0 ? px[prev + x - bpp] : 0; if (f === 1) v = (v + a) & 255; else if (f === 2) v = (v + b) & 255; else if (f === 3) v = (v + ((a + b) >> 1)) & 255; else if (f === 4) v = (v + paeth(a, b, c)) & 255; px[row + x] = v } }
let lit = 0, n = 0
const sX = Math.floor(rect.x), sY = Math.floor(rect.y), eX = Math.ceil(rect.x + rect.w), eY = Math.ceil(rect.y + rect.h)
for (let y = sY; y < eY; y += 2) for (let x = sX; x < eX; x += 2) { if (x < 0 || y < 0 || x >= width || y >= height) continue; const i = y * stride + x * bpp; const L = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]; n++; if (L > 26) lit++ }
ok('E6 globe renders lit (not black space)', n > 0 && lit / n > 0.1, `globeLit=${(lit / n * 100).toFixed(0)}%`)
ok('E7 no exceptions on earth', exc.length === 0, `exc=${exc.length}`)

// ---------- PART 1.5: ORIENTATION + GEOREFERENCING REGRESSIONS ----------
// E8: the globe must render UN-mirrored — west longitude on the LEFT, east on
// the RIGHT when facing Greenwich. We place markers through the app's own
// lat/lon math (setYouLoc), freeze rotation at -1.25, and scan their centroids.
const e8 = await evaljs(`(() => {
  const s = window.__earthScene
  if (!s) return []
  const hidden = [s.lights?.group, s.atmo, s.ether, s.cloudShell, s.corona, s.wisps, s.planets?.group, s.motes, s.moon, s.sparkPts, s.stars, s.nebulae, s.auraRing, s.shootingStar]
  hidden.filter(Boolean).forEach(o => o.visible = false)
  const wasYouVis = s.youMarker?.visible
  const origShader = s.earthMat.fragmentShader
  s.earthMat.fragmentShader = \`
    void main() { gl_FragColor = vec4(0.35, 0.35, 0.35, 1.0); }
  \`
  s.earthMat.needsUpdate = true
  s.rotVel = 0
  s.earthGroup.rotation.set(0, -1.25, 0)
  const pool = s.lights.pool
  const cities = [
    ['NYC', 40.7, -74.0, 'r'], ['London', 51.5, 0.0, 'g'], ['Delhi', 28.6, 77.2, 'b']
  ]
  const colOf = (ch) => ch === 'r' ? 0xff0000 : ch === 'g' ? 0x00ff00 : 0x0000ff
  s.lights.group.visible = true
  const marks = cities.map(([n, la, lo, ch], i) => {
    s.setYouLoc({ lat: la, lon: lo })
    const m = pool[i]
    m.position.copy(s.youMarker.position)
    m.scale.set(0.6, 0.6, 0.6)
    m.material.color.set(colOf(ch))
    m.material.opacity = 1
    m.visible = true
    m.userData.active = true
    return { n, lo, ch, m }
  })
  s.youMarker.visible = false
  s.earthGroup.updateMatrixWorld(true)
  s.renderer.render(s.scene, s.camera)
  const gl = s.renderer.getContext()
  const W = s.renderer.domElement.width, H = s.renderer.domElement.height
  const px = new Uint8Array(W * H * 4)
  gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px)
  // Sprites are AdditiveBlending, so detect channel dominance: a marker's own
  // channel is boosted well above the grey globe's equal channels.
  const find = (ch) => {
    let sx = 0, sy = 0, n = 0
    const dom = (r, g, b) => ch === 'r' ? (r > g + 60 && r > b + 60) : ch === 'g' ? (g > r + 60 && g > b + 60) : (b > r + 60 && b > g + 60)
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = ((H - 1 - y) * W + x) * 4
      if (dom(px[i], px[i + 1], px[i + 2])) { sx += x; sy += y; n++ }
    }
    return n ? { x: Math.round(sx / n) } : null
  }
  const res = marks.map(({ n, lo, ch }) => ({ n, lo, pos: find(ch) }))
  marks.forEach(({ m }) => { m.visible = false; m.userData.active = false })
  s.youMarker.visible = wasYouVis
  s.earthMat.fragmentShader = origShader
  s.earthMat.needsUpdate = true
  hidden.filter(Boolean).forEach(o => o.visible = true)
  s.lights.group.visible = true
  return res
})()`)
const e8vis = e8.filter(r => r.pos)
const e8screen = [...e8vis].sort((a, b) => a.pos.x - b.pos.x).map(r => r.n).join(',')
const e8lon = [...e8vis].sort((a, b) => a.lo - b.lo).map(r => r.n).join(',')
ok('E8 globe renders un-mirrored (west left, east right)', e8vis.length >= 3 && e8screen === e8lon, `screen L->R: ${e8screen} | real: ${e8lon}`)

// E9: shaders must sample longitude un-mirrored (0.5 - atan) and markers must
// use z = -r*cos*sin(lon) — both appear in FRAG/SIL_FRAG and setYouLoc/setLights.
const e9src = await evaljs(`fetch('/src/three/EarthScene.js').then(r => r.text())`)
const negShaders = (e9src.match(/0\.5 - atan\(p\.z, p\.x\)/g) || []).length
const negMarkers = (e9src.match(/-r \* Math\.cos\(lat\) \* Math\.sin\(lon\)/g) || []).length
ok('E9 shaders + markers keep un-mirrored chirality', negShaders >= 2 && negMarkers >= 2, `negEquirect=${negShaders} negMarkers=${negMarkers}`)

// E10: the app's marker math must round-trip lon: any marker placed at (lat,
// lon) must sit at the texel whose longitude is lon (=-atan2(z,x) in degrees).
const e10 = await evaljs(`(() => {
  const s = window.__earthScene
  const cities = [
    ['NYC', 40.7, -74.0], ['London', 51.5, 0.0], ['Delhi', 28.6, 77.2],
    ['Tokyo', 35.7, 139.7], ['Sydney', -33.9, 151.2], ['Honolulu', 21.3, -157.9]
  ]
  const wasYouVis = s.youMarker?.visible
  const res = cities.map(([n, la, lo]) => {
    s.setYouLoc({ lat: la, lon: lo })
    const p = s.youMarker.position
    const lonFromPos = -Math.atan2(p.z, p.x) * 180 / Math.PI
    return { n, lo, lonFromPos: +lonFromPos.toFixed(2), err: +Math.abs(lonFromPos - lo).toFixed(2) }
  })
  s.youMarker.visible = wasYouVis
  return res
})()`)
const e10ok = e10.filter(r => r.err < 0.6).length === e10.length && e10.length >= 5
ok('E10 app marker math is country-accurate (lon round-trips)', e10ok, e10.map(r => `${r.n}:${r.lonFromPos}°`).join(' '))

// E11: land mask georeferencing — real cities sit on LAND, open ocean on water.
const e11 = await evaljs(`(() => {
  const s = window.__earthScene
  if (!s._maskData) return null
  const d = s._maskData, W = d.width, H = d.height
  const sample = (la, lo) => {
    const u = 0.5 + lo / 360
    const x = Math.floor((((u % 1) + 1) % 1) * W) % W
    const y = Math.floor((1 - (0.5 + la / 180)) * H)
    return d.data[(y * W + x) * 4] / 255
  }
  const land = [[40.7, -74], [34, -118.2], [51.5, 0], [35.7, 139.7], [-33.9, 151.2], [28.6, 77.2], [30, 31.2], [21.3, -157.9]].map(([la, lo]) => sample(la, lo))
  const water = [[0, -30], [0, -150], [-45, -120], [41, 29]].map(([la, lo]) => sample(la, lo))
  return { land, water }
})()`)
const e11land = e11 && e11.land.filter(v => v > 0.5).length
const e11water = e11 && e11.water.every(v => v < 0.5)
ok('E11 land mask georeferenced (cities land, ocean water)', !!e11 && e11land >= 6 && e11water, e11 ? `land=${e11land}/8 water=${e11.water.every(v => v < 0.5)}` : 'no mask')

// ---------- PART 2: BACKGROUND PLAYBACK + WAKE RECOVERY ----------
// A prayer playing in the background keeps playing while you navigate
// Home/Earth and while the tab is hidden (no global pause on visibilitychange).
// After downtime it must always come back: play resumes from the footer.
await send('Page.navigate', { url: `${APP}/#/pray/buddhism/mani` })
await waitFor(`!!window.__store`)
await evaljs(`(() => { const b = document.querySelector('.onboard-begin, .onboard-skip'); if (b) b.click() })()`)
// PrayerPage is a lazy chunk — wait for its play button to actually exist
// before clicking, otherwise the tap is a silent no-op ("nothing happens").
await waitFor(`!!document.querySelector('.ctrl-btn.play')`, 15000)
await evaljs(`document.querySelector('.ctrl-btn.play').click()`)
await waitFor(`window.__store.getState().playing === true`, 8000)
ok('T1 prayer starts', await evaljs(`window.__store.getState().playing === true`))
// navigate to Earth -> background playback continues
await evaljs(`window.__store.getState().go('earth')`)
await waitFor(`window.__store.getState().view === 'earth'`)
await sleep(600)
let s = await evaljs(`(() => { const g = window.__store.getState(); return { playing: g.playing, paused: g.paused, view: g.view } })()`)
ok('T2 prayer keeps playing on Earth (background)', s.playing && !s.paused, JSON.stringify(s))
// simulate the browser tab being hidden -> prayer keeps playing in background
// (the design deliberately has no global pause on visibilitychange)
await evaljs(`(() => { try { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }) } catch {}; document.dispatchEvent(new Event('visibilitychange')); return true })()`)
await sleep(400)
s = await evaljs(`(() => { const g = window.__store.getState(); return { playing: g.playing, paused: g.paused } })()`)
ok('T3 prayer keeps playing while the tab is hidden', s.playing && !s.paused, JSON.stringify(s))
// return to the tab (visible): first footer play toggles to pause, second
// resumes — the wake-recovery path that must work after downtime/sleep
await evaljs(`(() => { try { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }) } catch {}; return true })()`)
await evaljs(`document.querySelector('.nav-play').click()`)
await waitFor(`window.__store.getState().paused === true`, 6000)
s = await evaljs(`(() => { const g = window.__store.getState(); return { playing: g.playing, paused: g.paused } })()`)
ok('T4 footer play pauses after returning', s.playing && s.paused, JSON.stringify(s))
await evaljs(`document.querySelector('.nav-play').click()`)
await waitFor(`window.__store.getState().paused === false`, 6000)
s = await evaljs(`(() => { const g = window.__store.getState(); return { playing: g.playing, paused: g.paused } })()`)
ok('T4b footer play resumes after downtime (wake recovery)', s.playing && !s.paused, JSON.stringify(s))
// navigate Home + then Pray -> still playing; then stop cleanly
await evaljs(`window.__store.getState().go('home')`)
await waitFor(`window.__store.getState().view === 'home'`)
await sleep(400)
s = await evaljs(`(() => { const g = window.__store.getState(); return { playing: g.playing, paused: g.paused } })()`)
ok('T5 still playing on Home', s.playing && !s.paused, JSON.stringify(s))
await evaljs(`document.querySelector('.nav-stop').click()`)
await waitFor(`window.__store.getState().playing === false`, 6000)
s = await evaljs(`(() => { const g = window.__store.getState(); return { playing: g.playing, paused: g.paused, playingPrayerId: g.playingPrayerId } })()`)
ok('T6 footer stop ends everything cleanly', !s.playing && !s.paused && s.playingPrayerId === null, JSON.stringify(s))
ok('T7 no exceptions through the whole proof', exc.length === 0, `exc=${exc.length}`)

console.log('\n----------------------------------------')
console.log(fails === 0 ? 'EARTH + TABS PROOF: ALL PASS' : `FAILS: ${fails}`)
try { edge.kill() } catch {}
process.exit(fails ? 1 : 0)
