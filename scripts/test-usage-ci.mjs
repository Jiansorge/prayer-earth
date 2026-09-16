// CI wrapper for the real-usage browser suite (scripts/test-usage.mjs).
//
// The suite needs a Vite dev server on :5173, the sync server on :8787 (the
// app in dev connects to ws://localhost:8787), and a headless Chromium-family
// browser. GitHub's ubuntu runners don't ship Edge at the Windows path the
// suite defaults to, so this script boots both servers, resolves a browser
// (PE_EDGE → Playwright's bundled Chromium → a standard `chromium`/`chrome`
// binary), runs the suite, then cleans up and mirrors its exit code.
// Run: node scripts/test-usage-ci.mjs

import { spawn } from 'node:child_process'
import { rmSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const APP = process.env.APP_URL || 'http://localhost:5173'
const SERVER_PORT = process.env.SERVER_PORT || '8787'

const log = (...a) => console.log('[usage-ci]', ...a)

// ---- resolve a headless browser -------------------------------------------------
async function resolveBrowser() {
  if (process.env.PE_EDGE) return process.env.PE_EDGE
  try {
    const { chromium } = await import('playwright')
    const p = chromium.executablePath()
    if (p && existsSync(p)) return p
  } catch {}
  const winEdge = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
  ]
  for (const p of winEdge) {
    if (existsSync(p)) return p
  }
  const names = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge', 'msedge']
  for (const n of names) {
    try {
      const { spawnSync } = await import('node:child_process')
      const r = spawnSync(n, ['--version'], { stdio: 'ignore' })
      if (r.status === 0) return n
    } catch {}
  }
  return null
}

const browser = await resolveBrowser()
if (!browser) {
  console.error('[usage-ci] no browser found. Run `npx playwright install chromium`, or set PE_EDGE.')
  process.exit(2)
}
log('browser:', browser)

// ---- boot the two servers -------------------------------------------------------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const viteBin = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js')
const children = [
  spawn(process.execPath, ['server/index.js'], { cwd: ROOT, stdio: 'inherit', env: { ...process.env, PORT: SERVER_PORT }, windowsHide: true }),
  spawn(process.execPath, [viteBin, '--host', '127.0.0.1', '--port', '5173', '--strictPort'], { cwd: ROOT, stdio: 'inherit', windowsHide: true })
]
const killAll = () => { for (const c of children) { try { c.kill() } catch {} } }

// ---- wait for both to come up ---------------------------------------------------
let appUp = false
for (let i = 0; i < 60; i++) {
  try {
    const r = await fetch(APP)
    if (r.ok) { appUp = true; break }
  } catch {}
  await sleep(500)
}
let srvUp = false
for (let i = 0; i < 30; i++) {
  // The app never fetches the Node server's static shell in dev — it connects
  // to ws://localhost:8787 for sync. Probe the WebSocket directly so the usage
  // job doesn't need a `dist/` build just to prove the sync server is up.
  try {
    const { default: WebSocket } = await import('ws')
    await new Promise((res, rej) => {
      const ws = new WebSocket(`ws://127.0.0.1:${SERVER_PORT}/`)
      ws.on('open', () => { ws.close(); res() })
      ws.on('error', rej)
      setTimeout(rej, 1500)
    })
    srvUp = true
    break
  } catch {}
  await sleep(500)
}
if (!appUp) {
  console.error('[usage-ci] vite dev server never responded on 5173')
  killAll()
  process.exit(2)
}
if (!srvUp) {
  console.error('[usage-ci] sync server never responded on 8787')
  killAll()
  process.exit(2)
}
log('servers up — app + sync ready')

// ---- run the suite ---------------------------------------------------------------
const child = spawn(process.execPath, ['scripts/test-usage.mjs'], {
  cwd: ROOT,
  stdio: 'inherit',
  env: { ...process.env, APP_URL: APP, PE_EDGE: browser },
  windowsHide: true
})

const code = await new Promise((res) => {
  child.on('exit', res)
  child.on('error', (e) => { console.error('[usage-ci] failed to run suite:', e.message); res(2) })
})

killAll()
try {
  const dataFile = path.join(ROOT, 'server', 'data-test.json')
  if (existsSync(dataFile)) rmSync(dataFile, { force: true })
} catch {}

process.exit(code || 0)