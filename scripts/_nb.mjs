import { spawn } from 'node:child_process'
import WebSocket from 'ws'
import { writeFileSync } from 'node:fs'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PROFILE = `${process.env.TEMP}\\pe-nb-${Date.now()}`
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--mute-audio', `--user-data-dir=${PROFILE}`, '--remote-debugging-port=9372', '--window-size=900,1200', 'about:blank'])
edge.stdout.on('data', () => {})
edge.stderr.on('data', () => {})
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let cdpUrl = null
for (let i = 0; i < 40; i++) { try { const l = await (await fetch('http://localhost:9372/json')).json(); const p = l.find((t) => t.type === 'page'); if (p) { cdpUrl = p.webSocketDebuggerUrl; break } } catch {} await sleep(250) }
const ws = new WebSocket(cdpUrl)
await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej) })
let id = 0; const pend = new Map()
ws.on('message', (raw) => { const m = JSON.parse(raw.toString()); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id) } })
const send = (m, p = {}) => new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })) })
const ev = async (e) => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); if (r?.exceptionDetails) console.log('ERR', r.exceptionDetails.exception?.description); return r?.result?.value }
await send('Page.enable')
await send('Page.navigate', { url: 'http://localhost:5173/#/' })
for (let i = 0; i < 40; i++) { if (await ev(`!!window.__store`)) break; await sleep(250) }
await sleep(700)
await ev(`window.__store.getState().go('home')`)
await sleep(400)
await ev(`(() => { const b = document.querySelector('.onboard button, .onboard [class*=skip], .onboard [class*=Begin]'); if (b) b.click() })()`)
await sleep(500)
console.log('nature backdrop canvas:', await ev(`!!document.querySelector('.nature-backdrop')`))
console.log('canvas size:', await ev(`(() => { const c = document.querySelector('.nature-backdrop'); return c ? c.width + 'x' + c.height : 'none' })()`))
console.log('current scene:', await ev(`document.querySelector('.app')?.getAttribute('data-scene')`))
const shot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true })
writeFileSync('C:\\Users\\j\\Documents\\Default Project\\prayer-earth\\qa-shots\\nature-home.png', Buffer.from(shot.data, 'base64'))
console.log('saved nature-home.png')
// force night scene for a second capture
await ev(`document.querySelector('.app').setAttribute('data-scene', 'night')`)
await sleep(700)
const shot2 = await send('Page.captureScreenshot', { format: 'png', fromSurface: true })
writeFileSync('C:\\Users\\j\\Documents\\Default Project\\prayer-earth\\qa-shots\\nature-night.png', Buffer.from(shot2.data, 'base64'))
console.log('saved nature-night.png')
edge.kill(); process.exit(0)
