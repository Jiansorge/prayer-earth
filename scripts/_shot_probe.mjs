import { spawn } from 'node:child_process'
import WebSocket from 'ws'
import { writeFileSync } from 'node:fs'

const APP = process.env.APP_URL || 'http://localhost:5173'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const DEBUG_PORT = 9355
const PROFILE = `${process.env.TEMP}\\pe-shotprobe-${Date.now()}`
const OUT1 = `${process.env.TEMP}\\pe-earth.png`
const OUT2 = `${process.env.TEMP}\\pe-backdrop.png`
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
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

// --- EARTH VIEW ---
await send('Page.navigate', { url: `${APP}/#/earth` })
await waitFor(`!!window.__earthScene`, 30000)
// force a you-marker in the middle of the Atlantic (-35, 25) to check snapping
await evaljs(`window.__earthScene.setYouLoc({ lat: 25, lon: -35 })`)
await sleep(2000)
let s = await send('Page.captureScreenshot', { format: 'png' })
writeFileSync(OUT1, Buffer.from(s.data, 'base64'))
const earthInfo = await evaljs(`(() => { const e = window.__earthScene; if (!e) return null; return {
  youLat: e.youLoc ? e.youLoc.lat : null,
  youVisible: !!(e.youMarker && e.youMarker.visible),
  deepOcean: e.isDeepOcean(25, -35),
  maskSize: e._maskData ? e._maskData.width + 'x' + e._maskData.height : null
} })()`)
console.log('earth info:', JSON.stringify(earthInfo))

// --- BACKDROP (prayer) VIEW ---
await send('Page.navigate', { url: `${APP}/#/pray/christianity/lords-prayer` })
await waitFor(`!!window.__earthScene`, 30000)
await evaljs(`window.__earthScene.setYouLoc({ lat: 25, lon: -35 })`)
await sleep(2500)
s = await send('Page.captureScreenshot', { format: 'png' })
writeFileSync(OUT2, Buffer.from(s.data, 'base64'))
const bdInfo = await evaljs(`(() => { const e = window.__earthScene; if (!e) return null; return {
  backdrop: e.backdrop === true,
  yLat: e.youLoc ? e.youLoc.lat : null,
  yVisible: !!(e.youMarker && e.youMarker.visible),
  deepOcean: e.isDeepOcean(25, -35),
  maskSize: e._maskData ? e._maskData.width + 'x' + e._maskData.height : null
} })()`)
console.log('backdrop info:', JSON.stringify(bdInfo))
console.log('exceptions:', exc.length)
console.log('SHOTS:', OUT1, OUT2)
ws.close(); edge.kill()