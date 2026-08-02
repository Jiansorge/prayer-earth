// Verifies the shared server aggregates people/prayer/spirit counts correctly
// across many simulated users. Runs against its own isolated server instance so
// real people connected to the live dev server never skew the counts.
// Run: node scripts/test-server.mjs

import WebSocket from 'ws'
import { spawn } from 'node:child_process'
import { rmSync } from 'node:fs'

const PORT = 8790
const DATA_FILE = './data-test.json'
const dataPath = new URL(`../server/${DATA_FILE}`, import.meta.url)
try {
  rmSync(dataPath, { force: true })
} catch (e) {
  console.log('WARN cleanup-before failed:', e.message)
}
const srv = spawn(process.execPath, ['server/index.js'], {
  cwd: process.cwd(),
  env: { ...process.env, PORT: String(PORT), PE_DATA_FILE: DATA_FILE },
  stdio: 'ignore'
})
const WS_URL = `ws://localhost:${PORT}`

let fails = 0
const ok = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ` (${extra})` : ''}`)
  if (!cond) fails += 1
}

const clients = []
const makeClient = () =>
  new Promise((res, rej) => {
    const ws = new WebSocket(WS_URL)
    ws.on('open', () => res(ws))
    ws.on('error', rej)
    clients.push(ws)
  })

// wait for the isolated server to come up
let ws
for (let i = 0; i < 30; i++) {
  try {
    ws = await makeClient()
    break
  } catch {
    await new Promise((r) => setTimeout(r, 300))
  }
}
if (!ws) {
  console.log('FAIL  isolated server never came up')
  srv.kill()
  process.exit(1)
}

// 3 praying islam/al-fatiha, 2 praying buddhism/mani, 1 idle (not praying).
// Two of the islam clients share a location cell so their light aggregates.
const spec = [
  { praying: true, prayerId: 'al-fatiha', spiritId: 'islam', lat: 21.4, lon: 39.2 },
  { praying: true, prayerId: 'al-fatiha', spiritId: 'islam', lat: 21.6, lon: 39.0 },
  { praying: true, prayerId: 'al-fatiha', spiritId: 'islam', lat: 30.0, lon: 31.2 },
  { praying: true, prayerId: 'mani', spiritId: 'buddhism', lat: 28.6, lon: 77.2 },
  { praying: true, prayerId: 'mani', spiritId: 'buddhism', lat: 19.1, lon: 72.9 },
  { praying: false, lat: 40.7, lon: -74.0 }
]

let state = null
let feed = null
ws.on('message', (d) => {
  const m = JSON.parse(d.toString())
  if (m.type === 'state') state = m
  else if (m.type === 'feed') feed = m.feed
})

const send = (c, obj) => c.send(JSON.stringify(obj))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const rest = spec.map(async (s, i) => {
  const c = await makeClient()
  send(c, {
    type: 'presence',
    praying: s.praying,
    prayerId: s.prayerId || null,
    spiritId: s.spiritId || null,
    lat: typeof s.lat === 'number' ? s.lat : null,
    lon: typeof s.lon === 'number' ? s.lon : null
  })
  return c
})
const others = await Promise.all(rest)

await sleep(1200)
ok('people = 5', state?.people === 5, `people=${state?.people}`)
ok('al-fatiha = 3', state?.prayers?.['al-fatiha'] === 3, `count=${state?.prayers?.['al-fatiha']}`)
ok('mani = 2', state?.prayers?.['mani'] === 2, `count=${state?.prayers?.['mani']}`)
ok('islam = 3', state?.spirits?.['islam'] === 3, `count=${state?.spirits?.['islam']}`)
ok('buddhism = 2', state?.spirits?.['buddhism'] === 2, `count=${state?.spirits?.['buddhism']}`)

// lights: praying users land on the shared 2-degree grid, same cell merges
ok('lights merge nearby praying users', state?.lights?.['22,40'] === 2, `22,40=${state?.lights?.['22,40']}`)
ok('lights spread across distinct cells', Object.keys(state?.lights || {}).length === 4, `cells=${Object.keys(state?.lights || {}).length}`)
ok('idle user contributes no light', !state?.lights?.['40,-74'], `idle=${state?.lights?.['40,-74']}`)
ok('lightSpirits carry faith per cell', state?.lightSpirits?.['22,40'] === 'islam' && state?.lightSpirits?.['28,78'] === 'buddhism', `22,40=${state?.lightSpirits?.['22,40']} 28,78=${state?.lightSpirits?.['28,78']}`)
ok('idle user adds no spirit', !state?.lightSpirits?.['40,-74'], `idleSp=${state?.lightSpirits?.['40,-74']}`)

// all-time totals ride along in every state broadcast
ok('state carries totals', !!(state?.totals?.prayers && state?.totals?.spirits))
ok('totals count started prayers once each', state?.totals?.prayers?.['al-fatiha'] === 3 && state?.totals?.spirits?.['islam'] === 3, `al-fatiha=${state?.totals?.prayers?.['al-fatiha']} islam=${state?.totals?.spirits?.['islam']}`)
ok('totals count buddhist prayers', state?.totals?.prayers?.['mani'] === 2 && state?.totals?.spirits?.['buddhism'] === 2, `mani=${state?.totals?.prayers?.['mani']} buddhism=${state?.totals?.spirits?.['buddhism']}`)

// live feed: each soul that starts praying appears once, with details
ok('feed has 5 entries', Array.isArray(feed) && feed.length === 5, `feed=${feed?.length}`)
const lastEntry = feed?.at(-1)
ok('feed entry has name/spirit/prayer', !!(lastEntry?.name && lastEntry.spiritId && lastEntry.prayerId))
ok('feed entry has timestamp', typeof lastEntry?.t === 'number' && lastEntry.t > 0)
ok('feed keeps name anonymous label', typeof lastEntry?.name === 'string' && lastEntry.name.length > 0)

// one leaves, one switches prayer
send(others[0], { type: 'presence', praying: false, prayerId: null, spiritId: null })
send(others[4], { type: 'presence', praying: true, prayerId: 'al-fatiha', spiritId: 'islam' })
await sleep(1200)
ok('people = 4 after leave', state?.people === 4, `people=${state?.people}`)
ok('al-fatiha = 3 after leave+switch', state?.prayers?.['al-fatiha'] === 3, `count=${state?.prayers?.['al-fatiha']}`)
ok('mani = 1 after switch', state?.prayers?.['mani'] === 1, `count=${state?.prayers?.['mani']}`)
ok('feed unchanged on switch/leave (still 5)', feed?.length === 5, `feed=${feed?.length}`)
ok('lights follow leaves and switches', state?.lights?.['22,40'] === 1 && state?.lights?.['28,78'] === 1, `22,40=${state?.lights?.['22,40']} 28,78=${state?.lights?.['28,78']}`)

// disconnect one praying client
others[1].close()
await sleep(1200)
ok('people = 3 after disconnect', state?.people === 3, `people=${state?.people}`)

// totalPrayerSeconds accumulates over time
await sleep(2200)
ok('totalPrayerSeconds growing', state?.totalPrayerSeconds > 0, `total=${state?.totalPrayerSeconds}`)

others.forEach((c) => c.close())
ws.close()
srv.kill()
// Wait for the child to actually terminate — on Windows the kill is async and
// a still-running child could re-flush its debounced totals file.
await new Promise((res) => {
  const done = () => res()
  srv.once('exit', done)
  setTimeout(done, 1500)
})
try {
  rmSync(dataPath, { force: true })
} catch (e) {
  console.log('WARN cleanup-after failed:', e.message)
}
console.log('---')
if (fails) {
  console.log(`${fails} check(s) FAILED`)
  process.exitCode = 1
} else {
  console.log('ALL SERVER CHECKS PASSED')
}
process.exit(process.exitCode || 0)
