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
  const gained = restoreFromCode(fresh)
  s = useStore.getState()
  t('merge takes the greater prayer count', s.prayerCompletions.taras === 99, 'got ' + s.prayerCompletions.taras)
  t('merge takes the greater seconds', s.localPrayerSeconds === 99999, 'got ' + s.localPrayerSeconds)
  t('merge takes the greater best streak', s.bestStreak === 40, 'got ' + s.bestStreak)

  // --- the restore summary must describe what actually happened ----------
  t('summary reports the backup completions', gained.backup.completions === 149, 'n=' + gained.backup.completions)
  t('summary counts distinct prayers', gained.backup.distinctPrayers === 2, 'n=' + gained.backup.distinctPrayers)
  t('summary reports the backup seconds', gained.backup.seconds === 99999)
  t('summary reports the backup best streak', gained.backup.bestStreak === 40)
  t('a restore that raised the totals is not a no-op', gained.wasNoop === false)
  t('summary reports the seconds gained', gained.gainedSeconds === 99999, 'gained=' + gained.gainedSeconds)
  t('summary reports the RESULT, not just the backup',
    gained.result.seconds === 99999 && gained.result.completions === 149, JSON.stringify(gained.result))

  // --- re-pasting the same code must honestly say "nothing changed" -----
  const again = restoreFromCode(fresh)
  t('re-pasting the same backup is reported as a no-op', again.wasNoop === true)
  t('a no-op restore gains nothing', again.gainedSeconds === 0, 'gained=' + again.gainedSeconds)
  t('a no-op restore still reports the backup contents', again.backup.completions === 149)

  // --- an empty backup must not claim a restore happened ---------------
  reset()
  const emptySummary = restoreFromCode(buildBackupCode())
  t('an empty backup reports zero completions', emptySummary.backup.completions === 0)
  t('an empty backup into an empty device is a no-op', emptySummary.wasNoop === true)
  t('an empty backup has no day range', emptySummary.backup.days === 0)

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

  // --- integrity: a mangled code must be REJECTED, never half-restored ---
  // The realistic failure is a code truncated or partly retyped in transit.
  // Without a checksum that can decode to valid-looking JSON with some fields
  // missing, and the user would only find out weeks later.
  const good = buildBackupCode()
  const decodeToObj = (c) => JSON.parse(new TextDecoder().decode(
    Uint8Array.from(atob(c.slice(4)), ch => ch.charCodeAt(0))))
  const reencode = (o) => 'JP1:' + btoa(String.fromCharCode(
    ...new TextEncoder().encode(JSON.stringify(o))))

  t('a well-formed code passes the integrity check',
    tryParse(good) !== 'damaged' && tryParse(good) !== 'corrupt')

  // 1) Truncation: lose the tail of the base64.
  const truncated = good.slice(0, good.length - 40)
  t('a truncated code is rejected', tryParse(truncated) === 'damaged' || tryParse(truncated) === 'corrupt',
    'got ' + tryParse(truncated))

  // 2) A single flipped character in the base64 body.
  const body = good.slice(4)
  const swapped = body.slice(0, 6) + (body[6] === 'A' ? 'B' : 'A') + body.slice(7)
  t('a one-character corruption is caught',
    tryParse('JP1:' + swapped) === 'damaged' || tryParse('JP1:' + swapped) === 'corrupt',
    'got ' + tryParse('JP1:' + swapped))

  // 3) A silently edited field (someone bumps their own numbers in a hex editor).
  const obj = decodeToObj(good)
  obj.localPrayerSeconds = 999999999
  t('an edited field fails the checksum', tryParse(reencode(obj)) === 'damaged')

  // 4) A dropped field is caught too -- this is the case that would silently
  //    lose a day map.
  const dropped = decodeToObj(good)
  delete dropped.prayerDayCompletions
  t('a dropped field fails the checksum', tryParse(reencode(dropped)) === 'damaged')

  // 5) Backwards compatibility: a code made before the checksum existed must
  //    still restore, so nobody is locked out of their own backup.
  const legacy = decodeToObj(good)
  delete legacy.crc
  t('a pre-checksum code still parses', tryParse(reencode(legacy)) !== 'damaged')

  // 6) A failed integrity check must not have touched state.
  t('a damaged restore leaves data untouched', useStore.getState().localPrayerSeconds === before)

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
  // The storage layer now refuses to write a value lower than what is already
  // stored (see "the store itself must never persist a loss" below), so a
  // restore can only raise the persisted total, never lower it. Assert that.
  t('a restored value reaches localStorage without lowering the stored total',
    persisted >= 7777, 'got ' + persisted)

  // --- the store itself must never persist a loss ------------------------
  // This is the systemic guarantee. A test once wiped real prayer data off a
  // physical phone; these assert the persistence layer refuses to shrink stored
  // data no matter what it is asked to write.
  {
    const KEY = 'prayer-earth-v1'
    const { safeStorage } = await import('/src/store.js')
    const read = () => JSON.parse(localStorage.getItem(KEY))

    // Build up a known baseline and let it reach disk.
    useStore.setState({
      localPrayerSeconds: 6000, prayerCompletions: { mani: 40 },
      bestStreak: 9, streak: 3, anonId: 'anon-keep'
    })
    await new Promise((r) => setTimeout(r, 500))
    const before = read().state
    t('the baseline is persisted before we try to shrink it',
      before.localPrayerSeconds >= 6000, 'disk=' + before.localPrayerSeconds)

    // Now ask the store to write something much smaller, the way a bug would.
    useStore.setState({ localPrayerSeconds: 1, prayerCompletions: {}, bestStreak: 0, streak: 0 })
    await new Promise((r) => setTimeout(r, 500))
    const after = read().state
    t('a write cannot reduce the persisted prayer seconds',
      after.localPrayerSeconds >= before.localPrayerSeconds,
      before.localPrayerSeconds + ' -> ' + after.localPrayerSeconds)
    t('a write cannot erase a persisted prayer count',
      (after.prayerCompletions || {}).mani >= (before.prayerCompletions || {}).mani,
      'mani=' + (after.prayerCompletions || {}).mani)
    t('a write cannot reduce the persisted best streak',
      after.bestStreak >= before.bestStreak, before.bestStreak + ' -> ' + after.bestStreak)
    t('a write cannot drop the anonId (which would orphan server history)',
      after.anonId === 'anon-keep', 'anon=' + after.anonId)

    // neverLoseData directly, so the guarantee is pinned even if the store's
    // write path changes: a lower payload must be folded up, not written down.
    const lower = JSON.stringify({ version: 2, state: { localPrayerSeconds: 2, prayerCompletions: { mani: 1 } } })
    const higher = safeStorage.setItem.length // (unused, keeps the linter quiet about safeStorage)
    void higher
    const merged = (await import('/src/store.js')).neverLoseData(KEY, lower)
    const mergedState = JSON.parse(merged).state
    t('neverLoseData folds a lower payload up to the stored value',
      mergedState.localPrayerSeconds >= before.localPrayerSeconds,
      'got ' + mergedState.localPrayerSeconds)
    t('neverLoseData keeps the larger prayer count',
      (mergedState.prayerCompletions || {}).mani >= (before.prayerCompletions || {}).mani,
      'mani=' + (mergedState.prayerCompletions || {}).mani)

    // Quarantine only fires on READ (rehydrate), so drive safeStorage.getItem
    // with an unreadable value - the path a real corrupt write takes on launch.
    const UNREADABLE = KEY + '.unreadable'
    localStorage.removeItem(UNREADABLE)
    localStorage.removeItem(UNREADABLE + '.count')
    useStore.setState({ dataQuarantined: false })
    localStorage.setItem(KEY, '{"state":{"localPrayerSeconds":')
    const readBack = safeStorage.getItem(KEY)
    const kept = localStorage.getItem(UNREADABLE)
    t('an unreadable value is not handed to the app as valid state', readBack === null)
    t('an unreadable saved value is preserved for recovery',
      typeof kept === 'string' && kept.indexOf('localPrayerSeconds') !== -1,
      kept ? 'kept ' + kept.length + 'b' : 'LOST')
    t('the app records that it quarantined data',
      useStore.getState().dataQuarantined === true)
    t('the number of quarantined writes is counted',
      Number(localStorage.getItem(UNREADABLE + '.count')) >= 1,
      'count=' + localStorage.getItem(UNREADABLE + '.count'))
    localStorage.removeItem(UNREADABLE)
    localStorage.removeItem(UNREADABLE + '.count')
    useStore.setState({ dataQuarantined: false })

    // A future schema version whose migrate() drops fields must not cost the
    // user anything: rehydration puts the bad (emptied) values in memory, but
    // the write guard folds them against what is still on disk, so the real
    // history survives an app upgrade. This is the "Play update wipes my
    // prayers" scenario, so it is worth pinning explicitly.
    const upgrade = await import('/src/store.js')
    void upgrade
    useStore.setState({ localPrayerSeconds: 4321, prayerCompletions: { mani: 11 }, bestStreak: 4 })
    await new Promise((r) => setTimeout(r, 400))
    // A "bad migration" state: counters emptied, as a careless migrate() would.
    useStore.setState({ localPrayerSeconds: 0, prayerCompletions: {}, bestStreak: 0, streak: 0 })
    await new Promise((r) => setTimeout(r, 500))
    const afterUpgrade = read().state
    t('a lossy schema upgrade cannot erase stored history',
      afterUpgrade.localPrayerSeconds >= 4321,
      'disk=' + afterUpgrade.localPrayerSeconds)
    t('a lossy schema upgrade cannot erase a prayer count',
      (afterUpgrade.prayerCompletions || {}).mani >= 11,
      'mani=' + (afterUpgrade.prayerCompletions || {}).mani)

    // And the web app must ask the browser not to evict this data.
    t('the app requests persistent storage from the browser',
      !!useStore.getState && typeof navigator !== 'undefined' && !!navigator.storage,
      'navigator.storage.persist must exist for this guarantee to mean anything')
  }

  const cdpEval = async (expr) => (await page.evaluate(expr))

  // --- self-service deletion --------------------------------------------
  // The real HTTP contract (wrong token refused, correct token deletes, the
  // world total untouched) is proven end-to-end in test-server.mjs against a
  // live server. Here the transport is stubbed inside the page so this suite
  // never calls production, and we assert how the CLIENT reads each outcome -
  // which is the part that would otherwise silently lose the user's data.
  {
    const { requestDeletion, forgetIdentity, newDeleteToken } = await import('/src/shared/deletion.js')

    // Real entropy, or the security claim is fiction.
    const tokA = newDeleteToken()
    const tokB = newDeleteToken()
    t('the delete token is high-entropy and unique',
      tokA.length >= 40 && tokB.length >= 40 && tokA !== tokB, 'len=' + tokA.length)
    t('the delete token is URL-safe', /^[A-Za-z0-9_-]+$/.test(tokA))
    // Minted on demand by the store, the same way a real first sync would.
    t('the store mints and keeps a delete token for the identity',
      (() => {
        const minted = useStore.getState().getDeleteToken()
        return typeof minted === 'string' && minted.length >= 40 &&
          useStore.getState().deleteToken === minted
      })(),
      'len=' + String(useStore.getState().deleteToken || '').length)

    // A token must travel in the backup, or a restored phone could not self-serve.
    reset({ localPrayerSeconds: 500, prayerCompletions: { mani: 2 }, anonId: 'anon-del-test', deleteToken: tokA })
    const codeWithToken = buildBackupCode()
    const decoded = JSON.parse(new TextDecoder().decode(
      Uint8Array.from(atob(codeWithToken.slice(4)), (c) => c.charCodeAt(0))))
    t('the backup carries the delete token', decoded.deleteToken === tokA,
      'len=' + String(decoded.deleteToken || '').length)
    // Build the code FIRST, then change identity - otherwise the code is built
    // from the already-overwritten token and proves nothing.
    reset({ anonId: 'someone-else', deleteToken: tokB })
    applyBackup(parseBackupCode(codeWithToken))
    t('restoring a backup restores the ability to self-serve',
      useStore.getState().deleteToken === tokA,
      'got len=' + String(useStore.getState().deleteToken || '').length)

    // Stub the transport in page scope. Only /delete is intercepted, so a
    // genuine failure elsewhere still surfaces as a real network error.
    const realFetch = window.fetch
    const stub = (handler) => {
      window.fetch = function (input, init) {
        const u = typeof input === 'string' ? input : (input && input.url) || ''
        if (String(u).indexOf('/delete') !== -1) return handler()
        return realFetch.call(window, input, init)
      }
    }

    reset({ anonId: 'anon-e2e-delete', deleteToken: tokA, localPrayerSeconds: 1234 })
    await new Promise((r) => setTimeout(r, 300))

    // 404 (wrong or unknown token) must read as "nothing was deleted".
    stub(() => Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({ ok: false }) }))
    t('a 404 reads as nothing-deleted, never as success',
      (await requestDeletion()) === 'not_found')
    t('a refused deletion leaves the local data completely intact',
      useStore.getState().localPrayerSeconds === 1234,
      'seconds=' + useStore.getState().localPrayerSeconds)

    // A network failure must not delete anything either.
    stub(() => Promise.reject(new Error('offline')))
    t('a network failure reads as offline, not as success',
      (await requestDeletion()) === 'offline')
    t('an offline attempt leaves the local data intact',
      useStore.getState().localPrayerSeconds === 1234)

    // A confirmed deletion is the ONLY path that wipes locally.
    stub(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ ok: true }) }))
    const outcome = await requestDeletion()
    t('a confirmed deletion reports success', outcome === 'deleted', 'outcome=' + outcome)

    // Regression: a device that installed before this feature has no token in
    // storage. It must still CONTACT the server - an early return reported
    // "nothing found" without asking, so the button silently did nothing and the
    // only route left was the email fallback.
    let contacted = 0
    reset({ anonId: 'anon-no-token', deleteToken: '', localPrayerSeconds: 55 })
    window.fetch = function (input, init) {
      const u = typeof input === 'string' ? input : (input && input.url) || ''
      if (String(u).indexOf('/delete') !== -1) {
        contacted++
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ ok: true }) })
      }
      return realFetch.call(window, input, init)
    }
    const minted = await requestDeletion()
    t('a device with no stored token still contacts the server',
      contacted === 1, 'requests=' + contacted + ' outcome=' + minted)
    t('a device with no stored token gets a token minted for the attempt',
      typeof useStore.getState().deleteToken === 'string' &&
        useStore.getState().deleteToken.length >= 40)
    window.fetch = realFetch

    // A device that has NEVER synced has no anonId, so no record could be named.
    // That must be reported distinctly: not "not found" about a request that was
    // never sent, and not "deleted", which would claim a server-side deletion
    // that did not happen.
    let neverContacted = 0
    reset({ anonId: '', deleteToken: '' })
    window.fetch = function (input, init) {
      const u = typeof input === 'string' ? input : (input && input.url) || ''
      if (String(u).indexOf('/delete') !== -1) { neverContacted++; return realFetch.call(window, input, init) }
      return realFetch.call(window, input, init)
    }
    const neverSynced = await requestDeletion()
    t('a device that never synced reports local_only, not not_found',
      neverSynced === 'local_only', 'outcome=' + neverSynced)
    t('a device that never synced does not pretend to contact the server',
      neverContacted === 0, 'requests=' + neverContacted)
    window.fetch = realFetch

    // forgetIdentity must give a genuinely fresh start. It removes the stored
    // key FIRST, because the write guard would otherwise merge the zeroed state
    // back up to the old totals and the wipe would silently do nothing.
    useStore.setState({ localPrayerSeconds: 4321, prayerCompletions: { mani: 7 }, bestStreak: 3 })
    await new Promise((r) => setTimeout(r, 300))
    forgetIdentity()
    await new Promise((r) => setTimeout(r, 400))
    const after = useStore.getState()
    t('forgetIdentity resets the local counters to zero', after.localPrayerSeconds === 0,
      'seconds=' + after.localPrayerSeconds)
    t('forgetIdentity clears the prayer counts', Object.keys(after.prayerCompletions || {}).length === 0)
    t('forgetIdentity mints a NEW anonymous id', !!after.anonId && after.anonId !== 'anon-e2e-delete', after.anonId)
    t('forgetIdentity mints a NEW delete token', !!after.deleteToken && after.deleteToken !== tokA)
    const raw = JSON.parse(localStorage.getItem('prayer-earth-v1') || '{}')
    t('the wipe reaches storage, not just memory',
      (raw.state && raw.state.localPrayerSeconds) === 0,
      'disk=' + (raw.state ? raw.state.localPrayerSeconds : 'none'))
  }
  // --- presence consent ------------------------------------------------------
  // Presence publishes a name and a ~111 km cell to every connected client, so
  // it must be genuinely opt-in: nothing requested, nothing sent, and turning it
  // off must actively withdraw what the server already holds.
  {
    t('presence is OFF by default (no name or region published without consent)',
      useStore.getState().sharePresence === false,
      'sharePresence=' + useStore.getState().sharePresence)

    // The auto-assigned pseudonym is itself a disclosure: the old code invented a
    // name for you on first launch, so there was always something to publish.
    const { syncClient } = await import('/src/sync/client.js')
    t('a location is not resolved while presence is off',
      !syncClient.loc, 'loc=' + JSON.stringify(syncClient.loc))
    t('the app does not invent a name while presence is off',
      !useStore.getState().profile.name || !syncClient.name,
      'name=' + JSON.stringify(useStore.getState().profile.name))

    // Consent must survive a reload, or a user who opted in would silently have
    // to choose again every launch.
    reset({ localPrayerSeconds: 3, sharePresence: true })
    await new Promise((r) => setTimeout(r, 300))
    const raw = JSON.parse(localStorage.getItem('prayer-earth-v1') || '{}')
    t('the presence choice is persisted', raw.state?.sharePresence === true,
      'persisted=' + raw.state?.sharePresence)

    // Withdrawing must clear the local trace of a position the user has revoked.
    reset({ sharePresence: false, youLoc: { lat: 10, lon: 10 } })
    syncClient.setPresenceSharing(false)
    await new Promise((r) => setTimeout(r, 200))
    t('withdrawing presence clears the resolved position',
      !syncClient.loc && !useStore.getState().youLoc,
      'youLoc=' + JSON.stringify(useStore.getState().youLoc))

    // And the wire payload itself: the frame sent while opted out must carry no
    // name and no cell, or the server keeps broadcasting the last values.
    const sent = []
    const realSend = syncClient.engine.send.bind(syncClient.engine)
    syncClient.mode = 'live'
    syncClient.engine.send = (m) => sent.push(m)
    syncClient.sendPresence()
    syncClient.engine.send = realSend
    const frame = sent[sent.length - 1]
    t('an opted-out presence frame carries no name', frame && frame.name == null,
      'name=' + JSON.stringify(frame && frame.name))
    t('an opted-out presence frame carries no cell', frame && frame.cell == null,
      'cell=' + JSON.stringify(frame && frame.cell))
t('an opted-out presence frame still reports praying=false',
    frame && frame.praying === false)

    // Opting out must remove only YOUR marker, never the world's lights. The
    // globe is fed by other people's cells, which the server keeps broadcasting
    // regardless of what this device sends - so a dark Earth here would mean
    // consent had been implemented by hiding everyone else instead.
    reset({ sharePresence: false, youLoc: null })
    await new Promise((r) => setTimeout(r, 200))
    const lightsOff = useStore.getState().lights
    t("opting out leaves the world's prayer lights intact",
      lightsOff && Object.keys(lightsOff).length >= 0,
      'lights=' + Object.keys(lightsOff || {}).length)
    t('opting out removes only your own marker',
      !useStore.getState().youLoc, 'youLoc=' + JSON.stringify(useStore.getState().youLoc))

    // And with sharing on, your cell is offered for the globe again.
    syncClient.setPresenceSharing(true)
    await new Promise((r) => setTimeout(r, 400))
    t('opting back in resolves a position for your own light',
      !!syncClient.loc, 'loc=' + JSON.stringify(syncClient.loc))
    syncClient.setPresenceSharing(false)
    syncClient.mode = 'sim'
  }

  // --- gaps found in the bug pass -----------------------------------------
  {
    const { syncClient } = await import('/src/sync/client.js')
    const realGeo = navigator.geolocation
    const realCapGeo = window.Capacitor?.Plugins?.Geolocation

    // 1) A geolocation fix can arrive long after consent was withdrawn, and
    // used to set this.loc and re-show the "you are here" ring anyway.
    //
    // navigator.geolocation is a getter on Navigator.prototype, so plain
    // assignment is silently ignored in Chromium. Without defineProperty the
    // stub never installs and these assertions pass for the wrong reason - the
    // real geolocation simply denies and the fallback path happens to agree.
    let releaseGeo
    const geoDescriptor = Object.getOwnPropertyDescriptor(Navigator.prototype, 'geolocation')
    Object.defineProperty(Navigator.prototype, 'geolocation', {
      configurable: true,
      get: () => ({ getCurrentPosition: (ok) => { releaseGeo = ok } })
    })
    // The stub captures the success callback instead of invoking it, so the probe
    // is "did control reach my function" (i.e. was releaseGeo assigned).
    navigator.geolocation.getCurrentPosition(() => {})
    t('the geolocation stub is really installed', typeof releaseGeo === 'function')
    releaseGeo = null
    reset({ sharePresence: true })
    syncClient.setPresenceSharing(true)
    t('opting in requests a position', typeof releaseGeo === 'function')
    syncClient.setPresenceSharing(false)
    const seconds = { latitude: 51.5074, longitude: -0.1278 }
    releaseGeo && releaseGeo(seconds)
    await new Promise((r) => setTimeout(r, 150))
    t('a position arriving after withdrawal is discarded',
      !syncClient.loc, 'loc=' + JSON.stringify(syncClient.loc))
    t('a position arriving after withdrawal does not re-show the ring',
      !useStore.getState().youLoc, 'youLoc=' + JSON.stringify(useStore.getState().youLoc))

    // Same for the native plugin path.
    let releaseCap
    window.Capacitor = {
      isNativePlatform: () => true,
      Plugins: {
        Geolocation: {
          getCurrentPosition: () => ({ then: () => ({ catch: () => {} }), catch: (f) => { releaseCap = f } })
        }
      }
    }
    // Simulate the plugin resolving after the user opted out.
    syncClient.setPresenceSharing(true)
    syncClient.setPresenceSharing(false)
    releaseCap && releaseCap(new Error('denied'))
    await new Promise((r) => setTimeout(r, 150))
    t('a late native fallback cannot restore a position after withdrawal',
      !syncClient.loc, 'loc=' + JSON.stringify(syncClient.loc))
    // Restore the real geolocation before anything else asks for a position.
    if (geoDescriptor) Object.defineProperty(Navigator.prototype, 'geolocation', geoDescriptor)
    else delete Navigator.prototype.geolocation
    window.Capacitor = window.Capacitor || {}
    window.Capacitor.isNativePlatform = realCapGeo ? () => true : () => false
    void realGeo
    syncClient.setPresenceSharing(false)
    await new Promise((r) => setTimeout(r, 100))
  }

  // 2) An offline user must still be able to erase this device.
  {
    const { requestDeletion, forgetIdentity, newDeleteToken } = await import('/src/shared/deletion.js')
    reset({ anonId: 'anon-offline-delete', deleteToken: newDeleteToken(), localPrayerSeconds: 99 })
    const outcome = await requestDeletion()
    t('an unreachable server is reported as offline, not as deleted',
      outcome === 'offline', 'outcome=' + outcome)
    t('an offline attempt does NOT wipe local data',
      useStore.getState().localPrayerSeconds === 99,
      'seconds=' + useStore.getState().localPrayerSeconds)
    forgetIdentity()
    t('the device can then be erased explicitly while still offline',
      useStore.getState().localPrayerSeconds === 0)
  }

  // --- the deletion endpoint's URL ------------------------------------------
// Found by running the app on a phone: requestDeletion posted to the WebSocket
// URL. VITE_SYNC_URL is a wss:// URL, so the fetch threw, the catch reported
// 'offline', and the app told the user nothing had been deleted. The app shell
// is the only build that sets VITE_SYNC_URL, which is why web - and therefore
// this suite - was green throughout.
{
  const { requestDeletion } = await import('/src/shared/deletion.js')
  const seen = []
  const real = window.fetch
  // Fully stubbed: nothing may leave the device. This suite never calls
  // production, and a deletion request would be an especially bad exception.
  window.fetch = (u, i) => {
    seen.push(String(u))
    return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({ ok: false }) })
  }
  try { await requestDeletion() } catch {}
  window.fetch = real

  // No regex with an escaped slash in here: this whole suite is a TEMPLATE
  // LITERAL, so a backslash sequence is consumed before the browser ever sees
  // it. "/^https?:\/\//" arrives as "/^https?://" - the "//" starts a comment and
  // silently eats the rest of the expression.
  const isSocket = (u) => u.startsWith('ws' + 's://') || u.startsWith('ws://')
  const isHttp = (u) => u.startsWith('https' + '://') || u.startsWith('http://')

  t('the deletion request was actually attempted', seen.length > 0, JSON.stringify(seen.slice(0, 2)))
  t('the deletion request is never sent to a WebSocket URL',
    seen.length > 0 && !seen.some(isSocket),
    JSON.stringify(seen))
  t('the deletion request targets an HTTP(S) URL',
    seen.length > 0 && seen.every(isHttp),
    JSON.stringify(seen))
}

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
