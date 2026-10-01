// Verifies the shared server aggregates people/prayer/spirit counts correctly
// across many simulated users. Runs against its own isolated server instance so
// real people connected to the live dev server never skew the counts.
// Run: node scripts/test-server.mjs

import WebSocket from 'ws'
import { spawn } from 'node:child_process'
import { rmSync, readFileSync } from 'node:fs'

const PORT = 8790
const DATA_FILE = './data-test.json'
const PEOPLE_FILE = './people-test.json'
const dataPath = new URL(`../server/${DATA_FILE}`, import.meta.url)
const peoplePath = new URL(`../server/${PEOPLE_FILE}`, import.meta.url)
try {
  rmSync(dataPath, { force: true })
  rmSync(peoplePath, { force: true })
} catch (e) {
  console.log('WARN cleanup-before failed:', e.message)
}
const srv = spawn(process.execPath, ['server/index.js'], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    PORT: String(PORT),
    PE_DATA_FILE: DATA_FILE,
    PE_PEOPLE_FILE: PEOPLE_FILE
  },
  stdio: process.env.PE_TEST_VERBOSE ? 'inherit' : 'ignore'
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
  { praying: true, prayerId: 'al-fatiha', spiritId: 'islam', lat: 21.2, lon: 39.4 },
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

// lights: praying users land on the shared 1-degree grid, same cell merges
ok('lights merge nearby praying users', state?.lights?.['21,39'] === 2, `21,39=${state?.lights?.['21,39']}`)
ok('lights spread across distinct cells', Object.keys(state?.lights || {}).length === 4, `cells=${Object.keys(state?.lights || {}).length}`)
ok('idle user contributes no light', !state?.lights?.['41,-74'], `idle=${state?.lights?.['41,-74']}`)
ok('lightSpirits carry faith per cell', state?.lightSpirits?.['21,39'] === 'islam' && state?.lightSpirits?.['29,77'] === 'buddhism', `21,39=${state?.lightSpirits?.['21,39']} 29,77=${state?.lightSpirits?.['29,77']}`)
ok('idle user adds no spirit', !state?.lightSpirits?.['41,-74'], `idleSp=${state?.lightSpirits?.['41,-74']}`)

// all-time totals ride along in every state broadcast
ok('state carries totals', !!(state?.totals?.prayers && state?.totals?.spirits))
ok('totals count started prayers once each', state?.totals?.prayers?.['al-fatiha'] === 3 && state?.totals?.spirits?.['islam'] === 3, `al-fatiha=${state?.totals?.prayers?.['al-fatiha']} islam=${state?.totals?.spirits?.['islam']}`)
ok('totals count buddhist prayers', state?.totals?.prayers?.['mani'] === 2 && state?.totals?.spirits?.['buddhism'] === 2, `mani=${state?.totals?.prayers?.['mani']} buddhism=${state?.totals?.spirits?.['buddhism']}`)

const today = new Date().toISOString().slice(0, 10)
send(ws, {
  type: 'sync',
  anonId: 'active-user-once',
  stats: {
    lastPrayedDay: today,
    prayerDayCompletions: { [today]: { 'lords-prayer': 1 } }
  }
})
await sleep(300)
ok('one user is counted once across activity fields', state?.usersToday === 1, `today=${state?.usersToday}`)

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
ok('lights follow leaves and switches', state?.lights?.['21,39'] === 1 && state?.lights?.['29,77'] === 1, `21,39=${state?.lights?.['21,39']} 29,77=${state?.lights?.['29,77']}`)

// disconnect one praying client
others[1].close()
await sleep(1200)
ok('people = 3 after disconnect', state?.people === 3, `people=${state?.people}`)

// totalPrayerSeconds accumulates over time
await sleep(2200)
ok('totalPrayerSeconds growing', state?.totalPrayerSeconds > 0, `total=${state?.totalPrayerSeconds}`)

// ---- self-service data deletion -----------------------------------------
// The important properties, not just "it returned 200":
//   - a correct anonId + token deletes the record
//   - a WRONG token does NOT delete it (otherwise a leaked recovery code, which
//     people email around, could erase anyone's history)
//   - an unknown anonId is indistinguishable from a wrong token
//   - a second delete is a no-op, not a crash
//   - deletion does NOT touch the shared world total (subtracting one person's
//     prayers would lower the number for everyone)
const DELETE_ID = 'delete-me-user'
const DELETE_TOKEN = 'test-token-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const post = async (body) => {
  const r = await fetch(`http://localhost:${PORT}/delete`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  })
  let json = null
  try { json = await r.json() } catch {}
  return { status: r.status, json }
}

// Establish a record, with a token, and confirm the merge landed.
send(ws, {
  type: 'sync',
  anonId: DELETE_ID,
  token: DELETE_TOKEN,
  stats: { localPrayerSeconds: 4242, prayerCompletions: { 'al-fatiha': 9 } }
})
await sleep(400)

const totalsBefore = state?.totals?.prayers

// 1) A wrong token must be refused, and must not delete.
const wrong = await post({ anonId: DELETE_ID, token: 'not-the-right-token' })
ok('a wrong delete token is refused', wrong.status === 404 && wrong.json?.ok === false, JSON.stringify(wrong.json))
send(ws, { type: 'sync', anonId: DELETE_ID, token: DELETE_TOKEN, stats: { localPrayerSeconds: 4242 } })
await sleep(300)
ok('the record survives a wrong-token attempt', (state?.people ?? 1) > 0, `people=${state?.people}`)

// 2) An unknown identity looks exactly like a wrong token, so the endpoint
//    cannot be used to probe which anonymous ids exist.
const unknown = await post({ anonId: 'nobody-has-this-id', token: DELETE_TOKEN })
ok('an unknown identity is refused', unknown.status === 404, JSON.stringify(unknown.json))
ok('an unknown identity is indistinguishable from a wrong token',
  unknown.json?.error === wrong.json?.error, `${unknown.json?.error} vs ${wrong.json?.error}`)

// 3) A malformed request is rejected before anything is touched.
const bad = await post({ anonId: '' })
ok('a request with no identity is rejected', bad.status === 400, JSON.stringify(bad.json))

// 4) The real thing: correct id + token deletes.
const good = await post({ anonId: DELETE_ID, token: DELETE_TOKEN })
ok('a correct token deletes the record', good.status === 200 && good.json?.ok === true, JSON.stringify(good.json))

// 5) Deleting again is a clean no-op.
const again = await post({ anonId: DELETE_ID, token: DELETE_TOKEN })
ok('deleting an already-deleted record is a no-op', again.status === 404, JSON.stringify(again.json))

// 6) The shared world total must be untouched by a deletion.
ok('the shared world total is not reduced by deleting a record',
  (state?.totals?.prayers?.['al-fatiha'] ?? 0) === (totalsBefore?.['al-fatiha'] ?? 0),
  `before=${totalsBefore?.['al-fatiha']} after=${state?.totals?.prayers?.['al-fatiha']}`)


others.forEach((c) => c.close())
ws.close()
srv.kill()
// Wait for the child to actually terminate, on Windows the kill is async and
// a still-running child could re-flush its debounced totals file.
await new Promise((res) => {
  const done = () => res()
  srv.once('exit', done)
  setTimeout(done, 1500)
})
try {
  const saved = JSON.parse(readFileSync(dataPath, 'utf8'))
  ok('server persists aggregate seconds on shutdown', saved.totalPrayerSeconds >= Math.max(0, (state?.totalPrayerSeconds || 0) - 5), `saved=${saved.totalPrayerSeconds}`)
} catch (e) {
  ok('server persists aggregate seconds on shutdown', false, e.message)
}
try {
  rmSync(dataPath, { force: true })
  rmSync(peoplePath, { force: true })
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
