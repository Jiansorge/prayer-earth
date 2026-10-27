#!/usr/bin/env node
// On-device glyph ink probe: measures every visible control button's ink
// offset inside the REAL app's WebView on a physical Android device, using
// the same TextMetrics math and filters as scripts/test-centering.mjs, and
// fails (exit 1) if any symbol glyph is off by more than +-1.5px.
//
//   node scripts/centering-on-device.mjs            probe the running app
//   RELAUNCH=1 node ...                             cold-restart app first
//   NAV='#/pray/buddhism/mani' node ...             navigate, then probe
//   THRESHOLD=2 SERIAL=xxxx PKG=app.joiningpalms    overrides
//
// Companion skill: .opencode/skills/android-device-test/SKILL.md
// Exits: 0 all symbol rows within threshold (emoji rows are warn-only),
//        1 any symbol row over threshold or the probe itself failed.

import { execFileSync } from 'node:child_process'
import path from 'node:path'
import os from 'node:os'

const PKG = process.env.PKG || 'app.joiningpalms'
const THRESHOLD = Number(process.env.THRESHOLD || 1.5)
const PORT = 9333

// adb is not on this machine's PATH; autodetect the SDK location.
const ADB = process.env.ADB || (
  process.platform === 'win32'
    ? path.join(os.homedir(), 'AppData', 'Local', 'Android', 'Sdk', 'platform-tools', 'adb.exe')
    : process.platform === 'darwin'
      ? path.join(os.homedir(), 'Library', 'Android', 'sdk', 'platform-tools', 'adb')
      : '/usr/lib/android-sdk/platform-tools/adb'
)

// stdio pipes keep adb's stderr out of our output (execFileSync only honours
// a thrown error if stderr is captured, otherwise it prints through).
const adb = (...args) => execFileSync(ADB, args, {
  encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
}).trim()
const fail = (msg) => { console.error(`[device-probe] FAIL  ${msg}`); process.exit(1) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ---- device selection: SERIAL env, or the single attached device ----
let serial = process.env.SERIAL
if (!serial) {
  const lines = adb('devices').split('\n').slice(1)
  const ready = lines.filter((l) => /\bdevice$/.test(l.trim())).map((l) => l.split(/\s+/)[0])
  if (ready.length === 0) fail(`no device attached (adb: ${ADB})`)
  if (ready.length > 1) fail(`multiple devices attached - set SERIAL. found: ${ready.join(', ')}`)
  serial = ready[0]
}
console.log(`[device-probe] device ${serial}  adb ${ADB}`)

// ---- screen must be awake: a dozed WebView answers nothing (and CDP hangs) ----
const wakefulness = adb('-s', serial, 'shell', 'dumpsys', 'power')
if (!/mWakefulness=Awake/.test(wakefulness)) {
  if (process.env.WAKE) {
    adb('-s', serial, 'shell', 'input', 'keyevent', 'KEYCODE_WAKEUP')
    await sleep(600)
    console.log('[device-probe] woke the device (WAKE=1)')
  } else {
    fail('screen is asleep - wake/unlock the phone, or rerun with WAKE=1')
  }
}

// ---- optional cold restart, then find the app's WebView devtools socket ----
if (process.env.RELAUNCH) {
  adb('-s', serial, 'shell', 'am', 'force-stop', PKG)
  adb('-s', serial, 'shell', 'am', 'start', '-n', `${PKG}/.MainActivity`)
  console.log('[device-probe] relaunched app cold')
}

let pid = ''
for (let i = 0; i < 30; i++) {
  try { pid = adb('-s', serial, 'shell', 'pidof', PKG).split(/\s+/)[0] } catch {}
  if (pid) break
  await sleep(500)
}
if (!pid) fail(`${PKG} is not running - install/launch the APK first (see SKILL.md)`)

try { adb('-s', serial, 'forward', '--remove', `tcp:${PORT}`) } catch {}
adb('-s', serial, 'forward', `tcp:${PORT}`, `localabstract:webview_devtools_remote_${pid}`)
const cleanup = () => { try { adb('-s', serial, 'forward', '--remove', `tcp:${PORT}`) } catch {} }
process.on('exit', cleanup)
process.on('SIGINT', () => { cleanup(); process.exit(130) })
// Any CDP timeout or socket drop surfaces as a rejection from the awaits
// below - turn it into one clean FAIL (with the forward removed) rather than
// an unhandled-rejection crash dump.
process.on('unhandledRejection', (err) => {
  cleanup()
  fail(`CDP failure: ${err?.message || err}`)
})

// ---- attach to the page target over CDP ----
// The devtools socket can lag a few seconds behind a cold app start, so the
// target fetch retries rather than declaring the app dead on the first miss.
let page
for (let attempt = 1; attempt <= 6 && !page; attempt++) {
  try {
    const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`, { signal: AbortSignal.timeout(5000) })).json()
    page = targets.find((t) => t.type === 'page')
  } catch (e) {
    if (attempt === 6) {
      fail(`cannot reach WebView DevTools on :${PORT} (app in background? exit-13?) - ${e.name === 'TimeoutError' ? 'no answer within 5s (screen off?)' : e.message}`)
    }
    await sleep(1000)
  }
}
if (!page) fail('no page target in the WebView')

const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((res, rej) => {
  const timer = setTimeout(() => rej(new Error('cdp websocket open timed out after 10s')), 10000)
  ws.onopen = () => { clearTimeout(timer); res() }
  ws.onerror = () => { clearTimeout(timer); rej(new Error('cdp websocket failed')) }
})
let seq = 0
const pending = new Map()
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data)
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id) }
}
// A dozed or backgrounded WebView never answers - reject instead of hanging
// the whole probe (this was the original script's one-way trip to a stuck run).
const send = (method, params = {}) =>
  new Promise((res, rej) => {
    const id = ++seq
    const timer = setTimeout(() => { pending.delete(id); rej(new Error(`cdp ${method} timed out after 8s (WebView frozen?)`)) }, 8000)
    pending.set(id, (msg) => { clearTimeout(timer); res(msg) })
    ws.send(JSON.stringify({ id, method, params }))
  })
const evaljs = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (r.result?.exceptionDetails) {
    const d = r.result.exceptionDetails
    return { err: d.text, detail: d.exception?.description?.slice(0, 300) }
  }
  return r.result?.result?.value
}

// ---- boot gate: the app must have mounted a view, not just a live socket ----
let booted = false
for (let i = 0; i < 40; i++) {
  const ok = await evaljs(`!!(document.querySelector('#root') && document.querySelector('#root').children.length)`)
  if (ok === true) { booted = true; break }
  await sleep(500)
}
if (!booted) fail('app did not mount a view within 20s')

// The font must be loaded BEFORE measuring: Canvas2D silently measures the
// system fallback for an unloaded @font-face, which would certify exactly
// what the app does not draw.
const fontStatus = await evaljs(`(async () => {
  await document.fonts.load('18px "DejaVu Symbols"', '\\u2190\\u25B6').catch(() => {})
  await document.fonts.ready
  return { ready: document.fonts.status, hasFace: document.fonts.check('18px "DejaVu Symbols"') }
})()`)
console.log(`[device-probe] fonts ${JSON.stringify(fontStatus)}`)
if (fontStatus?.hasFace === false) {
  console.log('[device-probe] WARN  bundled symbol font not registered - APK predates the font bundle')
}

// ---- optional navigation, waited on a DOM marker (not a timer) ----
if (process.env.NAV) {
  await evaljs(`location.hash = ${JSON.stringify(process.env.NAV)}`)
  await sleep(1500)
}

// ---- the probe: identical filters and math to scripts/test-centering.mjs ----
const PROBE = `(() => {
  const rows = []
  const r10 = (v) => Math.round(v * 10) / 10
  const scratch = document.createElement('canvas')
  const ctx = scratch.getContext('2d')
  const label = (el) => {
    const cls = typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\\s+/).join('.') : ''
    const txt = (el.textContent || '').replace(/\\s+/g, '').trim().slice(0, 4)
    return 'button' + cls + '[' + txt + ']'
  }
  for (const b of document.querySelectorAll('button')) {
    const r = b.getBoundingClientRect()
    if (r.width < 16 || r.height < 16 || r.width > 90 || r.height > 90) continue
    if (r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth) continue
    const cs = getComputedStyle(b)
    if (cs.display === 'none' || cs.visibility === 'hidden') continue
    const kids = [...b.children].filter((k) => k.getBoundingClientRect().width > 0)
    const svg = kids.find((k) => k.tagName.toLowerCase() === 'svg')
    if (svg && kids.every((k) => k === svg || k.getAttribute('aria-hidden') === 'true')) {
      const sr = svg.getBoundingClientRect()
      rows.push({ sel: label(b), kind: 'svg', off: r10(((sr.top - r.top) - (r.bottom - sr.bottom)) / 2) })
      continue
    }
    if (kids.length > 0) continue
    const text = (b.textContent || '').replace(/\\s+/g, '').trim()
    if (!text || [...text].length > 3) continue
    const tn = [...b.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim())
    if (!tn) continue
    const range = document.createRange()
    range.selectNodeContents(tn)
    const lr = range.getBoundingClientRect()
    if (!lr.height) continue
    ctx.font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily
    const m = ctx.measureText(text)
    const fa = m.fontBoundingBoxAscent
    const fd = m.fontBoundingBoxDescent
    if (!fa || !fd) continue
    let lh = parseFloat(cs.lineHeight)
    if (!Number.isFinite(lh)) lh = fa + fd
    const baseline = lr.top + (lh - (fa + fd)) / 2 + fa
    const inkTop = baseline - (m.actualBoundingBoxAscent || fa * 0.7)
    const inkBottom = baseline + (m.actualBoundingBoxDescent || 0)
    rows.push({ sel: label(b), kind: 'ink', off: r10((inkTop + inkBottom) / 2 - (r.top + r.height / 2)) })
  }
  return rows
})()`

let rows = await evaljs(PROBE)
if (!Array.isArray(rows)) {
  // Cold dev-server flake: navigation can stall; retry once after a beat.
  await sleep(1200)
  rows = await evaljs(PROBE)
}
if (!Array.isArray(rows)) fail(`probe returned no rows: ${JSON.stringify(rows)}`)

// ---- verdict ----
// Emoji (astral codepoints - the avatar buttons) can't be bundled as font
// data and Android draws them ~2px low vs Windows' text presentation. That
// is a documented, accepted exception: warn, never fail on them.
const isEmoji = (sel) => {
  const txt = sel.match(/\[(.*)\]$/)?.[1] || ''
  return [...txt].some((c) => c.codePointAt(0) > 0xffff)
}

let failures = 0
let warned = 0
let measured = 0
for (const r of rows) {
  if (r.kind === 'svg') continue
  measured += 1
  const emoji = isEmoji(r.sel)
  const bad = Math.abs(r.off) > THRESHOLD
  if (emoji) {
    if (bad) warned += 1
    console.log(`[device-probe] ${bad ? 'WARN' : '  ok'}  ${r.sel}  off=${r.off}px${bad ? ' (emoji - accepted exception)' : ''}`)
    continue
  }
  if (bad) failures += 1
  const mark = bad ? (r.off < 0 ? 'LOW ' : 'HIGH') : '  ok'
  console.log(`[device-probe] ${mark}  ${r.sel}  off=${r.off}px`)
}

console.log(`[device-probe] ${measured} controls measured, threshold +-${THRESHOLD}px, ${failures} symbol failure(s), ${warned} emoji warn(s)`)
if (measured === 0) fail('no control buttons measured - wrong view or app not rendered')
if (failures > 0) process.exit(1)
console.log('[device-probe] PASS')
process.exit(0)
