// Live multi-user lights test: two real browsers pray against the running
// sync server (ws://localhost:8787) and we assert the server aggregates
// prayer lights at each user's location and drops them when they leave.
// Run: node scripts/test-live.mjs   (start the app first: npm start)

import { spawn } from 'node:child_process'
import WebSocket from 'ws'

const APP = process.env.APP_URL || 'http://localhost:5173'
const WS = process.env.WS_URL || 'ws://localhost:8787'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'

let fails = 0
const log = (...a) => console.log('[live]', ...a)
const ok = (name, cond, extra = '') => {
  if (cond) log(`PASS  ${name}${extra ? ` (${extra})` : ''}`)
  else {
    fails += 1
    log(`FAIL  ${name}${extra ? ` (${extra})` : ''}`)
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function launch(label, debugPort, geo) {
  const profile = `${process.env.TEMP}\\pe-live-${label}-${Date.now()}`
  const edge = spawn(EDGE, [
    '--headless=new', '--disable-gpu', '--mute-audio', '--no-first-run',
    `--user-data-dir=${profile}`, `--remote-debugging-port=${debugPort}`, 'about:blank'
  ])
  edge.stdout.on('data', () => {})
  edge.stderr.on('data', () => {})
  let cdpUrl = null
  for (let i = 0; i < 40; i++) {
    try {
      const list = await (await fetch(`http://localhost:${debugPort}/json`)).json()
      const p = list.find((t) => t.type === 'page')
      if (p) { cdpUrl = p.webSocketDebuggerUrl; break }
    } catch {}
    await sleep(250)
  }
  if (!cdpUrl) throw new Error(`${label}: no CDP`)

  const ws = new WebSocket(cdpUrl)
  await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej) })
  let id = 0
  const pending = new Map()
  ws.on('message', (raw) => {
    const m = JSON.parse(raw.toString())
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id) }
  })
  const send = (method, params = {}) => new Promise((res) => {
    const i = ++id
    pending.set(i, res)
    ws.send(JSON.stringify({ id: i, method, params }))
  })
  const evaljs = async (e) => {
    const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })
    if (r?.exceptionDetails) throw new Error(`${label} eval: ${r.exceptionDetails.exception?.description || r.exceptionDetails.text}`)
    return r?.result?.value
  }
  const waitFor = async (expr, timeout = 12000) => {
    const t0 = Date.now()
    while (Date.now() - t0 < timeout) {
      try { if (await evaljs(expr)) return true } catch {}
      await sleep(150)
    }
    return false
  }

  await send('Page.enable')
  // Stub geolocation BEFORE the app loads so presence carries a known city.
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `navigator.geolocation.getCurrentPosition = (ok) => ok({ coords: { latitude: ${geo.lat}, longitude: ${geo.lon}, accuracy: 100 } })`
  })
  await send('Page.navigate', { url: `${APP}/#/pray/${geo.prayer}` })
  const loaded = await waitFor(`!!document.querySelector('.prayer-stage')`)
  // Actually start praying so the server counts this user.
  if (loaded) {
    const clicked = await evaljs(`(() => { const b = document.querySelector('.ctrl-btn.play'); if (b) { b.click(); return true } return false })()`)
    if (clicked) await sleep(400)
  }
  return { edge, evaljs, waitFor, send }
}

// Read live server broadcasts so we can assert on aggregate state.
async function serverState(port) {
  const sock = new WebSocket(WS)
  await new Promise((res, rej) => { sock.on('open', res); sock.on('error', rej) })
  sock.on('message', () => {})
  sock.on('error', () => {})
  return sock
}

const A = await launch('a', 9241, { lat: 51.5, lon: -0.1, prayer: 'buddhism/mani' })
const B = await launch('b', 9242, { lat: 28.6, lon: 77.2, prayer: 'islam/al-fatiha' })
const probe = await serverState(9243)

const seen = []
const collect = (m) => {
  try {
    const d = JSON.parse(m.toString())
    if (d.type === 'state') seen.push(d)
  } catch {}
}
probe.on('message', collect)

let last = null
const t0 = Date.now()
while (Date.now() - t0 < 15000) {
  const s = seen[seen.length - 1]
  if (s && s.people >= 2) { last = s; break }
  await sleep(200)
}
if (!last) last = seen[seen.length - 1]

ok('server reports 2 praying users', last?.people === 2, `people=${last?.people}`)
ok('London light present (52,0)', !!last?.lights?.['52,0'], `count=${last?.lights?.['52,0']}`)
ok('Delhi light present (28,78)', !!last?.lights?.['28,78'], `count=${last?.lights?.['28,78']}`)
ok('no stray light cells', Object.keys(last?.lights || {}).length === 2, `cells=${Object.keys(last?.lights || {}).length}`)
ok('London light tagged buddhism', last?.lightSpirits?.['52,0'] === 'buddhism', `sp=${last?.lightSpirits?.['52,0']}`)
ok('Delhi light tagged islam', last?.lightSpirits?.['28,78'] === 'islam', `sp=${last?.lightSpirits?.['28,78']}`)

// One user leaves → their light disappears
A.edge.kill()
let left = null
const t1 = Date.now()
while (Date.now() - t1 < 12000) {
  const s = seen[seen.length - 1]
  if (s && s.people === 1) { left = s; break }
  await sleep(200)
}
if (!left) left = seen[seen.length - 1]
ok('people drops to 1 after leave', left?.people === 1, `people=${left?.people}`)
ok('London light gone after leave', !left?.lights?.['52,0'], JSON.stringify(left?.lights))
ok('Delhi light remains', !!left?.lights?.['28,78'], `count=${left?.lights?.['28,78']}`)

probe.close()
B.edge.kill()
console.log(fails === 0 ? '[live] ALL CHECKS PASSED' : `[live] ${fails} check(s) FAILED`)
process.exit(fails === 0 ? 0 : 1)
