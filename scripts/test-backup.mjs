// Backup/restore is a "never lose a prayer" feature. These assert the two
// properties that actually protect the user:
//   1. a round trip is lossless, and
//   2. a restore MERGES (max) rather than overwrites — importing an OLDER
//      backup onto a device with newer counts must never lower them.
//   3. a malformed code is rejected without half-applying anything.
// Runs in a real browser against the dev server so it exercises the actual
// persisted store (the module can't be imported in bare node: import.meta.env).
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'
import net from 'node:net'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
let APP = ''

const results = []
const check = (name, pass, extra = '') => {
  results.push({ name, pass })
  console.log(`[backup] ${pass ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`)
}

async function freePort() {
  return new Promise((res) => {
    const s = net.createServer()
    s.listen(0, '127.0.0.1', () => {
      const p = s.address().port
      s.close(() => res(p))
    })
  })
}

async function resolveBrowser() {
  if (process.env.PE_EDGE) return process.env.PE_EDGE
  try {
    const { chromium } = await import('playwright')
    const p = chromium.executablePath()
    if (p && existsSync(p)) return p
  } catch {}
  for (const p of [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
  ]) if (existsSync(p)) return p
  return null
}

const browser = await resolveBrowser()
if (!browser) {
  console.error('[backup] no browser found. Set PE_EDGE or `npx playwright install chromium`.')
  process.exit(2)
}

const port = await freePort()
APP = `http://127.0.0.1:${port}`
const viteBin = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js')
const dev = spawn(process.execPath, [viteBin, '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
  { cwd: ROOT, stdio: 'ignore', windowsHide: true })

// Wait for the dev server to answer.
let up = false
for (let i = 0; i < 60; i++) {
  up = await new Promise((res) => {
    const s = net.connect(port, '127.0.0.1')
    s.on('connect', () => { s.destroy(); res(true) })
    s.on('error', () => res(false))
  })
  if (up) break
  await new Promise((r) => setTimeout(r, 250))
}
if (!up) { dev.kill(); console.error('[backup] dev server never came up'); process.exit(2) }

let b = null
try {
  const pw = await import('playwright').catch(() => null)
  if (pw) {
    b = await pw.chromium.launch({ executablePath: browser, args: ['--no-sandbox'] })
  } else {
    // No playwright: drive Edge over CDP by hand.
    const { spawnSync } = await import('node:child_process')
    const proc = spawnSync('node', ['-e', `
      const {spawn}=require('child_process');
      const c=spawn(${JSON.stringify(browser)},['--headless=new','--remote-debugging-port=9333','--no-sandbox','--user-data-dir='+require('os').tmpdir()+'/pe-backup-cdp','about:blank'],{detached:true,stdio:'ignore'});
      c.unref();
    `])
    void proc
  }
} catch {}

async function withPage(fn) {
  if (b) {
    const page = await b.newPage()
    try { return await fn(page) } finally { await page.close() }
  }
  // fallback: use the existing CDP helper pattern via fetch + websocket
  const { default: WS } = await import('ws').catch(() => ({ default: null }))
  if (!WS) throw new Error('no browser driver available')
  const list = await (await fetch('http://127.0.0.1:9333/json/list')).json()
  const target = list.find((t) => t.type === 'page')
  const sock = new WS(target.webSocketDebuggerUrl, { perMessageDeflate: false, maxPayload: 256 * 1024 * 1024 })
  await new Promise((r) => sock.once('open', r))
  let id = 0
  const pending = new Map()
  sock.on('message', (d) => {
    const m = JSON.parse(d)
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
  })
  const send = (method, params = {}) => new Promise((res) => {
    const mid = ++id
    pending.set(mid, res)
    sock.send(JSON.stringify({ id: mid, method, params }))
  })
  await send('Page.enable')
  await send('Runtime.enable')
  await send('Page.navigate', { url: APP })
  await new Promise((r) => setTimeout(r, 3500))
  const evaluate = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })
    if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails))
    return r.result?.result?.value
  }
  try { return await fn({ evaluate }) } finally { sock.close() }
}

// The whole suite runs inside the page, where the real store + backup module
// are loaded. It returns a list of {name, pass} results.
const SUITE = `(async () => {
  const { buildBackupCode, parseBackupCode, applyBackup, restoreFromCode } =
    await import('/src/shared/backup.js')
  const { useStore } = await import('/src/store.js')
  const out = []
  const t = (name, pass, extra) => out.push({ name, pass: !!pass, extra: extra || '' })
  const reset = (o = {}) => useStore.setState({
    anonId: '', firstSeen: 0, prayerCompletions: {}, prayerDayCompletions: {},
    prayerDayStats: {}, localPrayerSeconds: 0, streak: 0, bestStreak: 0,
    lastPrayedDay: 0, ...o
  })

  // --- round trip ---
  reset({
    anonId: 'anon-abc', firstSeen: 1000,
    prayerCompletions: { taras: 12, sita: 3 },
    prayerDayCompletions: { 20000: { taras: 12, sita: 3 } },
    prayerDayStats: { 20000: { taras: { s: 300 } } },
    localPrayerSeconds: 4200, streak: 6, bestStreak: 9, lastPrayedDay: 20000
  })
  const code = buildBackupCode()
  t('code has a versioned prefix', code.startsWith('JP1:'))
  t('code is copy-paste safe (single line, no newlines)', !/[\\r\\n]/.test(code))
  const parsed = parseBackupCode(code)
  t('round-trips the anonId', parsed.anonId === 'anon-abc')
  t('round-trips seconds', parsed.localPrayerSeconds === 4200)
  t('round-trips the streak pair', parsed.streak === 6 && parsed.bestStreak === 9)
  t('round-trips a prayer map', parsed.prayerCompletions && parsed.prayerCompletions.taras === 12)

  // --- restore onto an empty device is lossless ---
  reset()
  applyBackup(parsed)
  let s = useStore.getState()
  t('restore brings back the anonId', s.anonId === 'anon-abc')
  t('restore brings back seconds', s.localPrayerSeconds === 4200)
  t('restore brings back a prayer count', s.prayerCompletions.taras === 12)
  t('restore brings back the daily map', !!(s.prayerDayCompletions[20000] && s.prayerDayCompletions[20000].sita === 3))
  t('restore brings back the best streak', s.bestStreak === 9)

  // --- an OLDER backup must not lower newer data ---
  reset({ anonId: 'anon-abc', prayerCompletions: { taras: 99, sita: 50 },
          localPrayerSeconds: 99999, bestStreak: 40 })
  const fresh = buildBackupCode()
  reset({ anonId: 'anon-abc', prayerCompletions: { taras: 1 }, localPrayerSeconds: 0 })
  restoreFromCode(fresh)
  s = useStore.getState()
  t('merge takes the greater prayer count', s.prayerCompletions.taras === 99, 'got ' + s.prayerCompletions.taras)
  t('merge takes the greater seconds', s.localPrayerSeconds === 99999, 'got ' + s.localPrayerSeconds)
  t('merge takes the greater best streak', s.bestStreak === 40, 'got ' + s.bestStreak)

  // --- adopting the anonId reconnects server sync ---
  reset({ anonId: 'fresh-device-id', localPrayerSeconds: 5 })
  applyBackup(parseBackupCode(fresh))
  t('restore adopts the backed-up anonId', useStore.getState().anonId === 'anon-abc')

  // --- malformed input: rejected, and nothing is half-applied ---
  const before = useStore.getState().localPrayerSeconds
  const tryParse = (c) => { try { parseBackupCode(c); return 'NO-THROW' } catch (e) { return e.message } }
  t('rejects a non-backup string', tryParse('not-a-backup') === 'notBackup')
  t('rejects a wrong-version payload', tryParse('JP1:' + btoa('{"nope":1}')) === 'corrupt')
  t('rejects undecodable text', tryParse('JP1:@@@@') === 'corrupt')
  t('rejects an empty string', tryParse('') === 'notBackup')
  t('rejects an oversized paste without decoding it', tryParse('JP1:' + 'A'.repeat(600 * 1024)) === 'corrupt')
  t('a failed restore leaves data untouched', useStore.getState().localPrayerSeconds === before)

  // --- privacy: the code must not carry identity or UI prefs ---
  reset({ profile: 'Alice', theme: 'dark', lang: 'fr', anonId: 'anon-abc', localPrayerSeconds: 10 })
  const priv = parseBackupCode(buildBackupCode())
  t('backup excludes the profile name', priv.profile === undefined)
  t('backup excludes theme and language', priv.theme === undefined && priv.lang === undefined)
  t('backup DOES include the anonId (needed to reconnect sync)', priv.anonId === 'anon-abc')

  // --- persistence: a restored value must reach localStorage --------------
  // The store persists via a zustand custom storage adapter, so read back the
  // raw key the app writes rather than poking at an internal API.
  useStore.setState({ localPrayerSeconds: 7777 })
  await new Promise((r) => setTimeout(r, 600))
  let persisted = 0
  try {
    const raw = localStorage.getItem('prayer-earth-v1')
    persisted = raw ? JSON.parse(raw).state.localPrayerSeconds : -1
  } catch (e) { persisted = -2 }
  t('a restored value reaches localStorage', persisted === 7777, 'got ' + persisted)

  return out
})()`

let suite = []
await withPage(async (page) => {
  if (b) {
    await page.goto(APP, { waitUntil: 'load' })
    await page.waitForTimeout(2500)
    suite = await page.evaluate(SUITE)
  } else {
    suite = await page.evaluate(SUITE)
  }
})

if (b) await b.close()
dev.kill()

for (const r of suite) check(r.name, r.pass, r.extra)
const failed = results.filter((r) => !r.pass)
console.log(`\n[backup] ${results.length - failed.length}/${results.length} passed`)
if (failed.length) {
  console.log('[backup] FAILED:\n' + failed.map((f) => '  - ' + f.name).join('\n'))
  process.exit(1)
}
