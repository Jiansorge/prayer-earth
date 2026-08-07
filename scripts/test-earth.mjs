import { spawn } from 'node:child_process'
import WebSocket from 'ws'
import { readFileSync, writeFileSync } from 'node:fs'
import { inflateSync } from 'node:zlib'

// INDUSTRIAL PROOF — Earth rendering + tab-switch auto-pause
//
// Part 1 (earth): the 3D earth view must mount, render a real (non-black)
// globe, clear its loading overlay, and never throw.
// Part 2 (tabs): a prayer playing in the background keeps playing while you
// navigate Home/Earth, auto-PAUSES when the browser tab is hidden, and resumes
// from the footer when you return.
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
ok('E6 globe renders lit (not black space)', n > 0 && lit / n > 0.18, `globeLit=${(lit / n * 100).toFixed(0)}%`)
ok('E7 no exceptions on earth', exc.length === 0, `exc=${exc.length}`)

// ---------- PART 2: TAB-SWITCH AUTO-PAUSE ----------
await send('Page.navigate', { url: `${APP}/#/pray/buddhism/mani` })
await waitFor(`!!window.__store`)
await evaljs(`(() => { const b = document.querySelector('.onboard-begin, .onboard-skip'); if (b) b.click() })()`)
await sleep(300)
await evaljs(`document.querySelector('.ctrl-btn.play').click()`)
await waitFor(`window.__store.getState().playing === true`, 8000)
ok('T1 prayer starts', await evaljs(`window.__store.getState().playing === true`))
// navigate to Earth -> background playback continues
await evaljs(`window.__store.getState().go('earth')`)
await waitFor(`window.__store.getState().view === 'earth'`)
await sleep(600)
let s = await evaljs(`(() => { const g = window.__store.getState(); return { playing: g.playing, paused: g.paused, view: g.view } })()`)
ok('T2 prayer keeps playing on Earth (background)', s.playing && !s.paused, JSON.stringify(s))
// simulate the browser tab being hidden -> auto-pause
await evaljs(`(() => { try { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }) } catch {}; document.dispatchEvent(new Event('visibilitychange')); return true })()`)
await sleep(400)
s = await evaljs(`(() => { const g = window.__store.getState(); return { playing: g.playing, paused: g.paused } })()`)
ok('T3 auto-pauses when the browser tab is hidden', s.playing && s.paused, JSON.stringify(s))
// return to the tab (visible) + press the footer play -> resumes
await evaljs(`(() => { try { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }) } catch {}; return true })()`)
await evaljs(`document.querySelector('.nav-play').click()`)
await waitFor(`window.__store.getState().paused === false`, 6000)
s = await evaljs(`(() => { const g = window.__store.getState(); return { playing: g.playing, paused: g.paused } })()`)
ok('T4 footer play resumes after returning', s.playing && !s.paused, JSON.stringify(s))
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
