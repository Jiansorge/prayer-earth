// Drives the REAL deletion flow against the REAL server, on a real device.
//
// scripts/test-android-device.mjs covers every failure branch, but it stubs
// fetch so it never touches the network. That is the right default - it is fast
// and deterministic - but it means the one thing most likely to differ on a
// phone is untested: the app shell's own HTTPS to our own Worker, and the
// tombstone behaviour the fix in 7596dd3 adds.
//
// The identity is disposable and deleted at the end. It writes nothing to the
// app's own local storage.

import { execFileSync } from 'node:child_process'
import { existsSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import WebSocket from 'ws'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PACKAGE = 'app.joiningpalms'
const SERIAL = process.env.ANDROID_SERIAL || ''
const ADB =
  process.env.ADB ||
  (process.platform === 'win32'
    ? path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk', 'platform-tools', 'adb.exe')
    : 'adb')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let failures = 0
const log = (...a) => console.log('[live-android]', ...a)
const check = (name, ok, detail = '') => {
  log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? '  (' + detail + ')' : ''}`)
  if (!ok) failures++
}

const adbArgs = (args) => (SERIAL ? ['-s', SERIAL, ...args] : args)
const adb = (args) =>
  execFileSync(ADB, adbArgs(args), { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })

// --- CDP plumbing -----------------------------------------------------------
let cdp = null
const PORT = Number(process.env.ANDROID_CDP_PORT || 9500 + (process.pid % 300))
let socket = null

async function connectCdp() {
  try {
    adb(['forward', `tcp:${PORT}`, 'localabstract:webview_devtools_remote_' + adb(['shell', 'pidof', PACKAGE]).trim().split(/\s+/)[0]])
  } catch {
    throw new Error('could not forward the webview devtools socket')
  }
  const res = await fetch(`http://127.0.0.1:${PORT}/json`)
  const targets = await res.json()
  const page = targets.find((t) => t.type === 'page')
  if (!page) throw new Error('no page target')
  const ws = new WebSocket(page.webSocketDebuggerUrl, { maxPayload: 50 * 1024 * 1024 })
  socket = ws
  await new Promise((resolve, reject) => {
    ws.on('open', resolve)
    ws.on('error', reject)
    setTimeout(() => reject(new Error('cdp connect timeout')), 15000)
  })
  return page
}

const evaluate = async (expr) => {
  const id = ++evaluate.id
  const res = await new Promise((resolve, reject) => {
    const onMsg = (raw) => {
      const m = JSON.parse(raw.toString())
      if (m.id !== id) return
      socket.off('message', onMsg)
      if (m.error) reject(new Error(m.error.message))
      else if (m.result?.exceptionDetails) reject(new Error(m.result.exceptionDetails.text))
      else resolve(m.result?.result?.value)
    }
    socket.on('message', onMsg)
    socket.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression: expr, awaitPromise: true, returnByValue: true } }))
    setTimeout(() => reject(new Error('cdp evaluate timeout')), 30000)
  })
  return res
}
evaluate.id = 0

// --- device drive -----------------------------------------------------------
function install(apk) {
  if (!existsSync(apk)) throw new Error('APK missing: ' + apk)
  adb(['install', '-r', apk])
  log('installed ' + path.basename(apk))
}

function launch() {
  adb(['shell', 'am', 'force-stop', PACKAGE])
  adb(['shell', 'monkey', '-p', PACKAGE, '-c', 'android.intent.category.LAUNCHER', '1'])
}

async function waitForPid() {
  for (let i = 0; i < 60; i++) {
    try {
      const pid = adb(['shell', 'pidof', PACKAGE]).trim().split(/\s+/)[0]
      if (pid) return pid
    } catch {}
    await sleep(300)
  }
  throw new Error('app never started')
}

// --- the test ---------------------------------------------------------------
const APK = path.resolve(
  process.env.APK || path.join(ROOT, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk')
)
const ANON = 'device-live-' + Math.random().toString(36).slice(2, 9)
const TOKEN = 'tok-' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
const STATS = { localPrayerSeconds: 29, prayerCompletions: { mani: 2 } }

log('disposable identity:', ANON)

install(APK)
launch()
const pid = await waitForPid()
log('app pid', pid)
await sleep(4000)
await connectCdp()
log('cdp connected')

// The app's own fetch, from inside the WebView, to our own Worker.
const syncThenDelete = `
(async () => {
  const anon = ${JSON.stringify(ANON)}
  const token = ${JSON.stringify(TOKEN)}
  const stats = ${JSON.stringify(STATS)}
  // A real socket so the record is registered the way a real device does it.
  const ws = new WebSocket('wss://joining-palms.app/?cell=11,22')
  const opened = await new Promise((res) => {
    ws.onopen = () => res(true)
    ws.onerror = () => res(false)
    setTimeout(() => res(false), 15000)
  })
  if (!opened) return { error: 'ws open failed' }
  const synced = await new Promise((res) => {
    const to = setTimeout(() => res(null), 15000)
    ws.onmessage = (ev) => {
      try {
        const m = JSON.parse(ev.data)
        if (m.type === 'sync') { clearTimeout(to); res(m) }
      } catch {}
    }
    ws.send(JSON.stringify({ type: 'sync', anonId: anon, token, stats }))
  })
  ws.close()
  if (!synced) return { error: 'sync timed out' }

  // Now the REAL client deletion function, over the app's real HTTPS.
  //
  // requestDeletion reads the identity out of the store, so the store has to
  // hold the disposable identity first. Without this the call deletes the
  // APP's real account instead, and the resurrection probe below then examines
  // a record that was never deleted - which looks exactly like a failure.
  window.__store.setState({ anonId: anon, deleteToken: token, localPrayerSeconds: 29 })
  const out = await window.__deletion.requestDeletion()
  // Leave the store as we found it.
  window.__store.setState({ anonId: '', localPrayerSeconds: 0 })
  return { synced: true, seconds: synced.stats?.localPrayerSeconds, outcome: out }
})()`

const first = await evaluate(syncThenDelete)
log('step 1 (sync then real delete):', JSON.stringify(first))
check('the device registered the identity over a real socket', first && first.synced === true)
check(
  'the device deleted its own record over real HTTPS',
  first && first.outcome === 'deleted',
  'outcome=' + (first && first.outcome)
)

// The resurrection attempt, from the device: a brand new socket, as if a backup
// were restored onto a fresh phone.
const resurrect = `
(async () => {
  const anon = ${JSON.stringify(ANON)}
  const token = ${JSON.stringify(TOKEN)}
  const stats = ${JSON.stringify(STATS)}
  const ws = new WebSocket('wss://joining-palms.app/?cell=11,22')
  const opened = await new Promise((res) => {
    ws.onopen = () => res(true); ws.onerror = () => res(false); setTimeout(() => res(false), 15000)
  })
  if (!opened) return { error: 'ws open failed' }
  const reply = await new Promise((res) => {
    const to = setTimeout(() => res(null), 15000)
    ws.onmessage = (ev) => {
      try { const m = JSON.parse(ev.data); if (m.type === 'sync') { clearTimeout(to); res(m) } } catch {}
    }
    ws.send(JSON.stringify({ type: 'sync', anonId: anon, token, stats }))
  })
  ws.close()
  return { reply }
})()`

const second = await evaluate(resurrect)
log('step 2 (resurrection attempt):', JSON.stringify(second).slice(0, 220))

// Fail LOUDLY if the probe never actually ran. An earlier version of this check
// passed on `reply === undefined`, which is a false pass: if the socket cannot
// open, nothing is proven about resurrection at all.
check(
  'the resurrection probe actually reached the server',
  !!(second && second.reply) && !(second && second.error),
  'no reply: ' + JSON.stringify(second).slice(0, 120)
)

const reply = second && second.reply
const resurrected = reply && reply.stats && reply.stats.localPrayerSeconds === 29 && !reply.reissued
check(
  'a deleted identity did NOT come back from a fresh device',
  !resurrected,
  'reply=' + (reply ? JSON.stringify(reply).slice(0, 120) : 'none')
)
check(
  'the refusal or reissue was reported to the device',
  !!(reply && (reply.reissued === true || reply.error === 'deleted'))
)

// Clean up whatever identity the reissue handed back.
if (second && second.reply && second.reply.anonId && second.reply.reissued) {
  const cleanup = await evaluate(`
    (async () => {
      const r = await fetch('https://joining-palms.app/delete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ anonId: ${JSON.stringify(second.reply.anonId)}, token: ${JSON.stringify(TOKEN)} })
      })
      return { status: r.status }
    })()`)
  log('cleanup of the reissued identity:', JSON.stringify(cleanup))
}

try {
  socket?.close()
} catch {}

log('')
log(failures ? `failures=${failures}` : 'all live device checks passed')
process.exit(failures ? 1 : 0)