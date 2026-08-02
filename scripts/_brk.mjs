import { spawn } from 'node:child_process'
import WebSocket from 'ws'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PROFILE = `${process.env.TEMP}\\pe-brk-${Date.now()}`
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--mute-audio', `--user-data-dir=${PROFILE}`, '--remote-debugging-port=9363', '--window-size=900,1200', 'about:blank'])
edge.stdout.on('data', () => {})
edge.stderr.on('data', () => {})
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let cdpUrl = null
for (let i = 0; i < 40; i++) { try { const l = await (await fetch('http://localhost:9363/json')).json(); const p = l.find((t) => t.type === 'page'); if (p) { cdpUrl = p.webSocketDebuggerUrl; break } } catch {} await sleep(250) }
const ws = new WebSocket(cdpUrl)
await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej) })
let id = 0; const pend = new Map()
ws.on('message', (raw) => { const m = JSON.parse(raw.toString()); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id) } })
const send = (m, p = {}) => new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })) })
const ev = async (e) => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); if (r?.exceptionDetails) console.log('ERR', r.exceptionDetails.exception?.description); return r?.result?.value }
await send('Page.enable')
await send('Page.navigate', { url: 'http://localhost:5173/#/' })
for (let i = 0; i < 40; i++) { if (await ev(`!!window.__store`)) break; await sleep(250) }
await sleep(600)
await ev(`window.__store.getState().go('home')`)
await sleep(400)
await ev(`(() => { const b = document.querySelector('.onboard button, .onboard [class*=skip], .onboard [class*=Begin]'); if (b) b.click() })()`)
await sleep(500)
console.log('nav icons:', await ev(`[...document.querySelectorAll('.nav .nav-icon')].map(e => e.textContent).join(' | ')`))
console.log('first tile emoji:', await ev(`document.querySelector('.tile-emoji')?.textContent`))
console.log('tile count:', await ev(`document.querySelectorAll('.tile').length`))
// open settings → avatars
await ev(`window.__store.getState().setSettingsOpen(true)`)
await sleep(500)
console.log('avatar buttons:', await ev(`[...document.querySelectorAll('.avatar-btn')].map(e => e.textContent).join(' ')`))
console.log('avatar count:', await ev(`document.querySelectorAll('.avatar-btn').length`))
// check for mojibake (replacement char)
console.log('has mojibake (U+FFFD):', await ev(`document.body.innerText.includes('\\uFFFD')`))
// back/forward check
await ev(`window.__store.getState().setSettingsOpen(false)`)
await ev(`window.__store.getState().go('earth')`)
await sleep(300)
console.log('after go(earth), hash:', await ev(`window.location.hash`))
await ev(`window.__store.getState().go('home')`)
await sleep(300)
console.log('after go(home), hash:', await ev(`window.location.hash`))
edge.kill(); process.exit(0)
