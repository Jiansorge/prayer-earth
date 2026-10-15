// Shared plumbing for the resource-lifecycle suites.
//
// Split out of test-resource-lifecycle.mjs so the scenarios can run as three
// parallel CI jobs instead of one four-minute serial one. Everything here is
// mechanical - the reasoning lives with the scenarios that use it.
//
// Every suite calls begin(), runs one or more withBrowser() sessions, then
// finish(). finish() prints the notes and the wall-clock time, so a slow suite
// is visible in the log rather than only in the Actions bar.

import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import { killTree, coldSafePage, COLD_READY_TIMEOUT } from './devserver.mjs'
import { resolveChrome, launchOptions } from './browser.mjs'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
export const APP = process.env.APP_URL || 'http://localhost:5173'
export { COLD_READY_TIMEOUT, killTree }

let pass = 0
let fail = 0
let startedAt = 0
const notes = []

export function begin() {
  pass = 0
  fail = 0
  notes.length = 0
  startedAt = Date.now()
}

export const note = (line) => notes.push(line)

export const t = (name, fn) => {
  try {
    fn()
    pass++
    console.log(`PASS  ${name}`)
  } catch (e) {
    fail++
    console.log(`FAIL  ${name}\n        ${e.message}`)
  }
}
export const eq = (actual, expected, msg) => assert.equal(actual, expected, msg)

// ---- in-page instrumentation ------------------------------------------------
export const INSTRUMENT = `
(() => {
  const live = {
    rafArmed: 0, rafCancelled: 0,
    byType: {},
    canvasByType: {},
    contexts: 0, contextsLost: 0,
    errors: []
  }
  window.__pe = live

  const raf = window.requestAnimationFrame.bind(window)
  const caf = window.cancelAnimationFrame.bind(window)
  window.requestAnimationFrame = (cb) => { live.rafArmed++; return raf(cb) }
  window.cancelAnimationFrame = (id) => { live.rafCancelled++; return caf(id) }

  const add = EventTarget.prototype.addEventListener
  const rem = EventTarget.prototype.removeEventListener
  // Per event type, not a single total. An aggregate can be right for the wrong
  // reason - one type leaking can cancel another type's cleanup - and a total
  // also swings while unrelated listeners register late. Per type is the
  // property that actually means "nothing was left behind".
  const bump = (book, ty, by) => { book[ty] = (book[ty] || 0) + by }
  EventTarget.prototype.addEventListener = function (ty, fn, opts) {
    if (this === window || this === document) bump(live.byType, ty, 1)
    else if (this instanceof HTMLCanvasElement) bump(live.canvasByType, ty, 1)
    return add.call(this, ty, fn, opts)
  }
  EventTarget.prototype.removeEventListener = function (ty, fn, opts) {
    if (this === window || this === document) bump(live.byType, ty, -1)
    else if (this instanceof HTMLCanvasElement) bump(live.canvasByType, ty, -1)
    return rem.call(this, ty, fn, opts)
  }

  const getContext = HTMLCanvasElement.prototype.getContext
  HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
    const ctx = getContext.call(this, type, ...rest)
    if (ctx && /^webgl/.test(type) && !this.__peCounted) {
      this.__peCounted = true
      live.contexts++
      const ext = ctx.getExtension('WEBGL_lose_context')
      if (ext && !ext.__peWrapped) {
        ext.__peWrapped = true
        const lose = ext.loseContext.bind(ext)
        ext.loseContext = () => { live.contextsLost++; return lose() }
      }
    }
    return ctx
  }

  window.addEventListener('error', (e) => live.errors.push(String(e.message)))
  window.addEventListener('unhandledrejection', (e) => live.errors.push(String(e.reason)))
})()
`

// Listeners registered since the baseline that are still registered now.
// Compared against the baseline, not against zero: the app legitimately keeps
// error/beforeunload/hashchange listeners for the life of the page, so counting
// those as retained would flag every run.
export const retained = (current, base) => {
  const out = []
  const keys = new Set([...Object.keys(current), ...Object.keys(base)])
  for (const k of keys) {
    const d = (current[k] || 0) - (base[k] || 0)
    if (d > 0) out.push(`${k}=${d}`)
  }
  return out
}
export const describe = (obj) =>
  Object.keys(obj).length ? Object.entries(obj).map(([k, v]) => `${k}=${v}`).join(' ') : 'none'

export const readLive = (page) =>
  page.evaluate(() => ({
    ...window.__pe,
    domCanvases: document.querySelectorAll('canvas').length,
    earthCanvas: !!document.querySelector('.earth-canvas canvas'),
    fallback: !!document.querySelector('.earth-fallback'),
    loadingOverlay: !!document.querySelector('.earth-loading-overlay')
  }))

export const settle = (page, ms = 1200) => page.waitForTimeout(ms)

// Navigating by setting location.hash races the router. If the hash changes
// before the app has mounted and installed its hashchange listener, nothing
// observes the change and no view ever appears - a timeout that reads exactly
// like a broken view and is not one. Waiting on the node existing covers both
// orders, with room for a software renderer rather than a wall-clock guess.
//
// Every scenario runs its own withBrowser() and so has its own page; a closure
// over one page cannot serve the others, which is why this takes the page.
export const goView = async (page, hash, selector, timeout = COLD_READY_TIMEOUT) => {
  await page.evaluate((h) => {
    window.location.hash = h
  }, hash)
  await page.waitForFunction((sel) => !!document.querySelector(sel), selector, { timeout })
}

export async function withBrowser(fn) {
  const { chromium } = await import('playwright')
  const browser = await chromium.launch(launchOptions(resolveChrome()))
  try {
    return await fn(browser)
  } finally {
    await browser.close()
  }
}

export const startDevServer = async () => {
  const proc = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'dev', '--', '--port', '5173'], {
    cwd: ROOT,
    stdio: 'ignore',
    shell: process.platform === 'win32'
  })
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(APP)
      if (r.ok) return proc
    } catch {}
    await new Promise((r) => setTimeout(r, 500))
  }
  killTree(proc)
  throw new Error('dev server did not start')
}

// Load the app and settle it. `initScript` runs after the instrumentation, so a
// scenario can wrap a counted API (scenario 4 wraps getContext to refuse
// webgl2) and still be measured.
export async function bootPage(browser, { reducedMotion = false, initScript } = {}) {
  const page = await coldSafePage(browser)
  if (reducedMotion) await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(INSTRUMENT)
  if (initScript) await page.addInitScript(initScript)
  await page.goto(APP, { waitUntil: 'load' })
  await settle(page, 2000)
  await page.mouse.move(2, 2)
  await page.waitForSelector('.view', { timeout: 15000 })
  // The backdrop paints a canvas once it is mounted, and that is the moment the
  // app is actually ready - not a wall-clock guess. Waiting on it matters: the
  // reduced-motion suite took its baseline before this and got canvases=0, so
  // the backdrop's own visibilitychange/keydown/resize were registered after
  // the baseline and read as listeners an Earth visit had retained. The
  // original suite did not fail only because its sleep happened to be long
  // enough.
  await page.waitForSelector('canvas', { timeout: 15000 }).catch(() => {})
  await settle(page, 1500)
  return page
}

// Warm up Playwright's own window input listeners, and the Earth itself, then
// take the baseline.
//
// Playwright installs pointer/mouse/touch handlers on window the first time it
// drives the page, and one of them is literally named
// __playwright_global_listeners_check__. Without this warm-up those show up as
// a leak the app never created.
//
// The app registers some window listeners once, on the first Earth visit, and
// keeps them for the life of the page - a global keydown for the shortcuts, the
// visibility and resize handlers the scene needs. They are the app working, not
// a leak, but they register *after* a baseline taken at page load, so every
// later comparison reported them as retained. The tell is that the counts do not
// grow: four more round trips show exactly the same
// visibilitychange=1 keydown=2 resize=1. A real per-visit leak accumulates.
//
// Visiting once and coming back makes the baseline honest, and what is left
// after that really is something an Earth visit failed to clean up.
//
// The baseline is taken here, immediately before the measured first Earth
// visit, not at page load, for the same reason.
export async function warmEarthAndBaseline(page) {
  await goView(page, '#/earth', '.earth-view')
  await settle(page, 3000)
  await goView(page, '#/', '.view')
  await settle(page, 3000)
  const base = await readLive(page)
  note(`baseline home:  canvases=${base.domCanvases} contexts=${base.contexts}`)
  note(`  window/doc:    ${describe(base.byType)}`)
  note(`  canvas:        ${describe(base.canvasByType)}`)
  return base
}

export function finish() {
  const secs = ((Date.now() - startedAt) / 1000).toFixed(1)
  console.log('')
  for (const line of notes) console.log('  ' + line)
  console.log('')
  console.log(`${pass} passed, ${fail} failed  (${secs}s)`)
  if (fail) process.exit(1)
}
