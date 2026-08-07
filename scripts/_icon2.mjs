import { spawn } from 'node:child_process'
import WebSocket from 'ws'
import { writeFileSync } from 'node:fs'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const DEBUG_PORT = 9379
const PROFILE = `${process.env.TEMP}\\pe-icon2-${Date.now()}`
const SVG = 'file:///' + 'C:/Users/j/Documents/Default Project/prayer-earth/public/icons/icon.svg'.replace(/ /g, '%20')
const OUT = 'C:/Users/j/Documents/Default Project/prayer-earth/public/icons'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', `--user-data-dir=${PROFILE}`, `--remote-debugging-port=${DEBUG_PORT}`, 'about:blank'])
let cdpUrl = null
for (let i = 0; i < 50; i++) { try { const l = await (await fetch(`http://localhost:${DEBUG_PORT}/json`)).json(); const p = l.find(t => t.type === 'page'); if (p) { cdpUrl = p.webSocketDebuggerUrl; break } } catch {} await sleep(250) }
const ws = new WebSocket(cdpUrl)
await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej) })
let id = 0
const pending = new Map()
ws.on('message', (raw) => { const m = JSON.parse(raw.toString()); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id) } })
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })) })
await send('Runtime.enable'); await send('Page.enable')
await send('Page.navigate', { url: SVG })
await sleep(1500)
for (const px of [512, 192, 180]) {
  await send('Emulation.setDeviceMetricsOverride', { width: px, height: px, deviceScaleFactor: 1, mobile: false })
  await sleep(300)
  const s = await send('Page.captureScreenshot', { format: 'png' })
  const name = px === 180 ? 'apple-touch-icon-180.png' : `icon-${px}.png`
  writeFileSync(`${OUT}/${name}`, Buffer.from(s.data, 'base64'))
  console.log(`wrote ${name} (${Buffer.from(s.data, 'base64').length / 1024 | 0} KB)`)
}
try { edge.kill() } catch {}
process.exit(0)
