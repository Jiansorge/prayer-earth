import { spawn } from 'node:child_process'
import WebSocket from 'ws'
import { writeFileSync } from 'node:fs'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const DEBUG_PORT = 9323
const PROFILE = `${process.env.TEMP}\\pe-icons2-${Date.now()}`
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', `--user-data-dir=${PROFILE}`, `--remote-debugging-port=${DEBUG_PORT}`, 'about:blank'])
let cdpUrl = null
for (let i = 0; i < 50; i++) { try { const l = await (await fetch(`http://localhost:${DEBUG_PORT}/json`)).json(); const p = l.find(t => t.type === 'page'); if (p) { cdpUrl = p.webSocketDebuggerUrl; break } } catch {} await sleep(250) }
const ws = new WebSocket(cdpUrl)
await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej) })
let id = 0; const pending = new Map()
ws.on('message', (raw) => { const m = JSON.parse(raw.toString()); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id) } })
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })) })
const evaljs = async (e) => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); return r?.result?.value }
await send('Runtime.enable'); await send('Page.enable')
// navigate directly to the 512 icon (same-origin http, canvas is clean)
await send('Page.navigate', { url: 'http://localhost:5173/icons/icon-512.png' })
await sleep(1500)
const result = await evaljs(`(() => {
  const img = document.images[0]
  if (!img || !img.naturalWidth) return { err: 'no image', w: img && img.naturalWidth }
  const out = {}
  for (const size of [192, 180]) {
    const c = document.createElement('canvas')
    c.width = size; c.height = size
    const ctx = c.getContext('2d')
    ctx.drawImage(img, 0, 0, size, size)
    out[size] = c.toDataURL('image/png')
  }
  return out
})()`)
if (result.err) { console.log('ERROR', JSON.stringify(result)); try { edge.kill() } catch {}; process.exit(1) }
for (const size of [192, 180]) {
  const b64 = result[size].split(',')[1]
  const path = `${process.cwd()}/public/icons/${size === 192 ? 'icon-192.png' : 'apple-touch-icon-180.png'}`
  writeFileSync(path, Buffer.from(b64, 'base64'))
  console.log('wrote', size, Buffer.from(b64, 'base64').length, 'bytes')
}
try { edge.kill() } catch {}
process.exit(0)
