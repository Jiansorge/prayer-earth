// Icon-centering pass: every glyph or SVG that sits alone inside a control must
// be vertically centred in its button.
//
// Grid/flex centring aligns line boxes and element boxes, not ink. A "←" in a
// 38px round button reads low when the glyph's ink sits below the middle of its
// line box - the reported back-arrow case (Oct 22) - and no source review of
// `place-items: center` can see it. This measures the ink itself:
//
//   - text glyphs: canvas TextMetrics give the font box (for the half-leading
//     split) and the actual ink box (actualBoundingBox*), which combined with
//     the text node's line rect puts the ink's centre in viewport coordinates;
//   - SVG-only buttons: the element box against the button's content box.
//
// The walk covers home, prayer, earth, the settings sheet, the keys panel
// (PanelShell back), and the legal sheet (its own back + close). Every run
// re-walks every screen; RUNS defaults to 10, and a selector's offset must
// stay within TOL on every single run (variance is its own smell: a glyph that
// lands somewhere different between runs is riding an animation).
//
// Usage: node scripts/test-centering.mjs            (10 runs)
//        RUNS=3 TOL=1.5 REPORT=1 node scripts/test-centering.mjs
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import net from 'node:net'
import { killTree, coldSafePage, COLD_READY_TIMEOUT } from './lib/devserver.mjs'
import { resolveChrome, launchOptions } from './lib/browser.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const RUNS = Math.max(1, parseInt(process.env.RUNS || '10', 10))
const TOL = parseFloat(process.env.TOL || '1.5')
const REPORT = !!process.env.REPORT

async function freePort() {
  return new Promise((res) => {
    const s = net.createServer()
    s.listen(0, '127.0.0.1', () => {
      const p = s.address().port
      s.close(() => res(p))
    })
  })
}

const port = await freePort()
const APP = process.env.APP_URL || `http://127.0.0.1:${port}`
const viteBin = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js')
const server = process.env.APP_URL
  ? null
  : spawn(process.execPath, [viteBin, '--host', '127.0.0.1', '--port', String(port)], {
      cwd: ROOT,
      stdio: 'ignore',
      windowsHide: true
    })

let up = false
for (let i = 0; i < 40; i++) {
  try {
    if ((await fetch(APP)).ok) {
      up = true
      break
    }
  } catch {}
  await new Promise((r) => setTimeout(r, 500))
}
if (!up) {
  killTree(server)
  console.error(`[centering] no app at ${APP} - the dev server never came up`)
  process.exit(2)
}

const { chromium } = await import('playwright')
const browser = await chromium.launch(launchOptions(resolveChrome()))

// Reduced motion so entrance animations cannot move a glyph between runs.
const context = await browser.newContext({
  viewport: { width: 470, height: 900 },
  reducedMotion: 'reduce'
})
const page = await coldSafePage(context)
await page.goto(APP, { waitUntil: 'load' })
await page.waitForFunction(() => !!window.__store, null, { timeout: COLD_READY_TIMEOUT })
await page.evaluate(() => document.querySelector('.onboard-skip, .onboard-begin')?.click())
await page.waitForTimeout(600)

// The page-side probe. Returns { sel, kind, off } per glyph-only control, off
// in px: positive means the ink sits BELOW the button's centre.
const probe = () => {
  const rows = []
  const r10 = (v) => Math.round(v * 10) / 10
  const scratch = document.createElement('canvas')
  const ctx = scratch.getContext('2d')
  const label = (el) => {
    const cls =
      typeof el.className === 'string' && el.className.trim()
        ? '.' + el.className.trim().split(/\s+/).join('.')
        : ''
    const txt = (el.textContent || '').replace(/\s+/g, '').trim().slice(0, 4)
    return `button${cls}[${txt}]`
  }
  for (const b of document.querySelectorAll('button')) {
    const r = b.getBoundingClientRect()
    if (r.width < 16 || r.height < 16 || r.width > 90 || r.height > 90) continue
    if (r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth)
      continue
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
    const text = (b.textContent || '').replace(/\s+/g, '').trim()
    if (!text || [...text].length > 3) continue
    const tn = [...b.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim())
    if (!tn) continue
    const range = document.createRange()
    range.selectNodeContents(tn)
    const lr = range.getBoundingClientRect()
    if (!lr.height) continue
    ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
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
}

const settle = async (ms = 550) => {
  // Drain in-flight CSS animations before measuring: an ancestor mid-transform
  // scales the distance between the glyph's line box and the button box, and
  // the same control then reads differently between walks (the home avatar
  // grid landing a cascade tile).
  await page
    .evaluate(() =>
      Promise.all(
        document
          .getAnimations()
          .map((a) => {
            try {
              return a.finished
            } catch {
              return null
            }
          })
          .filter(Boolean)
      )
    )
    .catch(() => {})
  await page.waitForTimeout(ms)
}
// Hash navigation is not a render: a cold PrayerPage chunk arrives late, and
// snapping before it lands measures nothing and calls it a pass.
const go = async (hash, marker) => {
  await page.evaluate((h) => {
    location.hash = h
  }, hash)
  if (marker) await page.waitForSelector(marker, { timeout: COLD_READY_TIMEOUT })
  await settle()
}

// Every screen a glyph-only control appears on, in walk order.
const walk = async () => {
  const stops = []
  const snap = async (name) => {
    const rows = await page.evaluate(probe)
    stops.push({ name, rows })
  }
  await snap('home')
  await go('#/pray/buddhism/mani', '.ctrl-btn.play')
  await snap('prayer')
  await go('#/earth', '.earth-view')
  await snap('earth')
  await go('#/', '.home-title')
  await snap('home again')
  await page.evaluate(() => document.querySelector('.gear-btn')?.click())
  await page.waitForSelector('.sheet-body', { timeout: COLD_READY_TIMEOUT })
  await settle()
  await snap('settings sheet')
  await page.evaluate(() => document.querySelector('[data-testid="row-keys"]')?.click())
  await settle()
  await snap('keys panel (PanelShell back)')
  await page.evaluate(() => document.querySelector('[data-testid="panel-keys"] .settings-back')?.click())
  await settle()
  await page.evaluate(() => document.querySelector('[data-testid="row-privacy"]')?.click())
  await settle()
  const privacyBtn = await page.evaluate(() => {
    const b = [...document.querySelectorAll('.field-btn')].find((x) => /privacy & care/i.test(x.textContent))
    if (b) b.click()
    return !!b
  })
  if (privacyBtn) await settle(800)
  await snap('legal sheet (LegalSheet back + close)')
  await page.evaluate(() => document.querySelector('.legal-sheet .settings-back')?.click())
  await settle()
  return stops
}

// ---- the pass ----------------------------------------------------------------
const worst = new Map() // `${screen} :: ${sel}` -> { off, run }
const runsSeen = []
let offenderRuns = 0

for (let run = 1; run <= RUNS; run++) {
  const stops = await walk()
  const offenders = []
  for (const { name, rows } of stops) {
    for (const row of rows) {
      const key = `${name} :: ${row.sel}`
      const prev = worst.get(key)
      if (!prev || Math.abs(row.off) > Math.abs(prev.off)) {
        worst.set(key, { off: row.off, run, kind: row.kind })
      }
      if (Math.abs(row.off) > TOL) {
        offenders.push(`${name} ${row.sel} off=${row.off > 0 ? '+' : ''}${row.off}px`)
      }
      if (REPORT) console.log(`[centering] run ${run} ${name} ${row.sel} ${row.kind} off=${row.off}px`)
    }
  }
  if (offenders.length) offenderRuns++
  const count = stops.reduce((n, s) => n + s.rows.length, 0)
  runsSeen.push(count)
  console.log(
    `[centering] run ${run}/${RUNS}: ${stops.length} screens, ${count} controls, ` +
      `${offenders.length} over ±${TOL}px${offenders.length ? ` - ${offenders.join(' | ')}` : ''}`
  )
  // Return home so the next run starts from the same state.
  await go('#/')
}

// Variance across runs is judged from the per-run offender list above: a glyph
// that lands differently between runs crosses the tolerance on some run and
// fails there. REPORT=1 prints every reading for a full diff.

// Final verification run: every control within tolerance, reported.
const finalStops = await walk()
const finalRows = finalStops.flatMap((s) => s.rows.map((r) => ({ screen: s.name, ...r })))
const finalOffenders = finalRows.filter((r) => Math.abs(r.off) > TOL)

console.log(`[centering] tolerance ±${TOL}px across ${RUNS} walk(s)`)
if (worst.size === 0) {
  console.log('[centering] FAIL  no glyph-only controls were found - the probe is broken')
  killTree(server)
  process.exit(1)
}
for (const [key, v] of [...worst.entries()].sort()) {
  const flag = Math.abs(v.off) > TOL ? '  <-- OFF' : ''
  console.log(`[centering] ${Math.abs(v.off) > TOL ? 'FAIL' : 'ok  '}  ${key} worst=${v.off > 0 ? '+' : ''}${v.off}px${flag}`)
}

const ok = offenderRuns === 0 && finalOffenders.length === 0
console.log(
  ok
    ? `[centering] PASS  ${worst.size} controls x ${RUNS} runs all within ±${TOL}px`
    : `[centering] FAILED  ${finalOffenders.length} over tolerance on the final walk (offender runs: ${offenderRuns}/${RUNS})`
)

await browser.close()
killTree(server)
process.exit(ok ? 0 : 1)
