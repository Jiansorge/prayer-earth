// 20-pass style-consistency review: gaps, padding, margins, radii.
//
// One pass cannot call a style inconsistent - it can only show a value. The
// question is always comparative: does the SAME element keep the same spacing
// from pass to pass (variance), and do components that share a name keep the
// same spacing as each other (grouping)? Both answers need the whole app, so
// this walks every view and sheet at a phone viewport (the app's real surface)
// and a desktop viewport (the deployed web), collects the computed spacing of
// every visible element, and reduces the passes to reports:
//
//   1. VARIANCE: one element path, one role, several spacings across passes -
//      a style that depends on load order, focus residue, or content luck.
//   2. GROUPS: elements sharing a first class (the component identity) but
//      carrying different pad/margin/gap/radius signatures - the same-named
//      thing dressed differently.
//   3. HISTOGRAMS: every gap and padding edge value with a count, so a
//      near-miss crowd (10 vs 11 vs 12) is visible as a distribution.
//
// Usage: node scripts/review-style.mjs --passes 20
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveChrome, launchOptions } from './lib/browser.mjs'
import { killTree, COLD_READY_TIMEOUT, coldSafePage } from './lib/devserver.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`)
  return i > -1 ? process.argv[i + 1] : d
}
const PASSES = Number(arg('passes', 20))
const PORT = Number(arg('port', 5177))
const OUT = path.join(os.tmpdir(), 'pe-style-20x')
mkdirSync(OUT, { recursive: true })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const startServer = async () => {
  const proc = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'dev', '--', '--port', String(PORT)], {
    cwd: ROOT,
    stdio: 'ignore',
    shell: process.platform === 'win32'
  })
  const app = `http://localhost:${PORT}`
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(app)
      if (r.ok) return { proc, app }
    } catch {}
    await sleep(500)
  }
  proc.kill()
  throw new Error('dev server did not start')
}

// Collects every visible element's spacing plus a stable identity path.
// The path carries a child index per segment: without it two siblings that
// share classes (legal paragraphs, meter rows) collapse into one key and a
// static layout reads as "variance". The GROUP key is the full class set
// minus transient/state tokens, so .view.prayer-page is not .view, and an
// .on that appears mid-animation does not invent a variant. The token list
// is inlined inside COLLECT: the function is serialized into the page and
// cannot close over module scope.
const COLLECT = () => {
  const pathOf = (el) => {
    const parts = []
    let cur = el
    while (cur && cur !== document.body && cur.tagName) {
      const cls =
        typeof cur.className === 'string' && cur.className.trim() ? '.' + cur.className.trim().replace(/\s+/g, '.') : ''
      let idx = 0
      let sib = cur.previousElementSibling
      while (sib) {
        idx++
        sib = sib.previousElementSibling
      }
      parts.unshift(cur.tagName.toLowerCase() + cls + ':' + idx)
      cur = cur.parentElement
    }
    return parts.join('>')
  }
  const out = []
  const walk = (el) => {
    const cs = getComputedStyle(el)
    if (cs.display !== 'none' && cs.visibility !== 'hidden') {
      const r = el.getBoundingClientRect()
      if (r.width > 0.5 && r.height > 0.5) {
        const cls = typeof el.className === 'string' ? el.className.trim() : ''
        out.push({
          p: pathOf(el),
          c: cls
            ? cls
                .split(/\s+/)
                .filter((x) => !['on', 'active', 'open', 'show', 'visible', 'fade-in', 'in', 'current', 'selected', 'playing', 'paused', 'done', 'hidden'].includes(x))
                .join(' ') || cls.split(/\s+/)[0]
            : el.tagName.toLowerCase(),
          g: cs.gap,
          pad: [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft].join(' '),
          mar: [cs.marginTop, cs.marginRight, cs.marginBottom, cs.marginLeft].join(' '),
          r: cs.borderRadius
        })
      }
    }
    for (const child of el.children) walk(child)
  }
  walk(document.body)
  return out
}

const sig = (e) => `${e.pad}|${e.mar}|${e.g}|${e.r}`

const VIEWS = [
  { name: 'home', hash: '#/', wait: '.view' },
  { name: 'prayer', hash: '#/pray/buddhism/mani', wait: '.view' },
  { name: 'prayer2', hash: '#/pray/hinduism/gayatri', wait: '.view' },
  { name: 'earth', hash: '#/earth', wait: '.earth-view', extra: 3500 },
  { name: 'privacy', hash: '#/privacy', wait: '.view' }
]

const SHEETS = [
  { name: 'settings', on: '#/', open: '.gear-btn', wait: '.sheet, [role="dialog"]' },
  { name: 'tune', on: '#/pray/buddhism/mani', open: '.ctrl-btn.tune', wait: '.voice-chip, .tune-sheet, .sheet' }
]

const { proc, app } = await startServer()
let browser
try {
  const { chromium } = await import('playwright')
  browser = await chromium.launch(launchOptions(resolveChrome()))

  // view|viewport|path -> sig -> times seen
  const variance = new Map()
  // viewport -> firstClass -> sig -> { n, ex }
  const groups = { phone: new Map(), desktop: new Map() }
  // viewport -> value -> count
  const gapHist = { phone: new Map(), desktop: new Map() }
  const padHist = { phone: new Map(), desktop: new Map() }
  // view|viewport -> [elementCount per pass]
  const counts = new Map()

  const bump = (m, k, n = 1) => m.set(k, (m.get(k) || 0) + n)

  const record = (els, viewName, vpName) => {
    const key = `${viewName}|${vpName}`
    if (!counts.has(key)) counts.set(key, [])
    counts.get(key).push(els.length)
    for (const e of els) {
      const s = sig(e)
      const vk = `${key}|${e.p}`
      if (!variance.has(vk)) variance.set(vk, new Map())
      bump(variance.get(vk), s)
      if (e.c) {
        const gm = groups[vpName]
        if (!gm.has(e.c)) gm.set(e.c, new Map())
        const sm = gm.get(e.c)
        if (!sm.has(s)) sm.set(s, { n: 0, ex: `${viewName}: ${e.p.slice(0, 110)}` })
        sm.get(s).n++
      }
      if (e.g && e.g !== 'normal' && !/^0px( 0px)*$/.test(e.g)) bump(gapHist[vpName], e.g)
      const [pt, pr, pb, pl] = e.pad.split(' ')
      bump(padHist[vpName], `top ${pt}`)
      bump(padHist[vpName], `right ${pr}`)
      bump(padHist[vpName], `bottom ${pb}`)
      bump(padHist[vpName], `left ${pl}`)
    }
  }

  for (let pass = 1; pass <= PASSES; pass++) {
    for (const vp of [
      { name: 'phone', width: 390, height: 844 },
      { name: 'desktop', width: 1280, height: 720 }
    ]) {
      const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } })
      await context.addInitScript(() => {
        try {
          localStorage.setItem('pe-onboarded', '1')
        } catch {}
      })
      const page = await coldSafePage(context)

      for (const v of VIEWS) {
        await page.goto(`${app}/${v.hash}`, { waitUntil: 'domcontentloaded' })
        await page.waitForSelector(v.wait, { timeout: COLD_READY_TIMEOUT })
        await page.waitForTimeout(1200)
        if (v.extra) await page.waitForTimeout(v.extra)
        record(await page.evaluate(COLLECT), v.name, vp.name)
      }

      for (const s of SHEETS) {
        if (s.on) {
          await page.goto(`${app}/${s.on}`, { waitUntil: 'domcontentloaded' })
          await page.waitForSelector('.view', { timeout: COLD_READY_TIMEOUT })
          await page.waitForTimeout(800)
        }
        await page.click(s.open)
        await page.waitForSelector(s.wait, { timeout: COLD_READY_TIMEOUT })
        await page.waitForTimeout(1100)
        record(await page.evaluate(COLLECT), `sheet-${s.name}`, vp.name)
        await page.keyboard.press('Escape')
        await page.waitForTimeout(400)
      }

      await context.close()
    }
    if (pass % 5 === 0 || pass === 1) console.log(`pass ${pass}/${PASSES} done`)
  }

  // ---- report ---------------------------------------------------------------
  const lines = []
  const varianceFindings = []
  for (const [vk, sigs] of variance) {
    if (sigs.size > 1) {
      const [view, vp, ...rest] = vk.split('|')
      varianceFindings.push({ view, vp, path: rest.join('|'), sigs: [...sigs.entries()] })
    }
  }
  lines.push(`== VARIANCE: same element, different spacing across ${PASSES} passes (${varianceFindings.length}) ==`)
  for (const f of varianceFindings.slice(0, 80)) {
    lines.push(`[${f.vp}/${f.view}] ${f.path}`)
    for (const [s, n] of f.sigs) lines.push(`    x${n}  ${s}`)
  }

  const groupFindings = []
  for (const vp of ['phone', 'desktop']) {
    for (const [cls, sigs] of groups[vp]) {
      if (sigs.size > 1) groupFindings.push({ vp, cls, sigs: [...sigs.entries()] })
    }
  }
  groupFindings.sort((a, b) => b.sigs.length - a.sigs.length)
  lines.push('')
  lines.push(`== GROUPS: one component name, several spacings (${groupFindings.length}) ==`)
  for (const f of groupFindings.slice(0, 100)) {
    lines.push(`[${f.vp}] .${f.cls} -> ${f.sigs.length} variants`)
    for (const [s, v] of f.sigs) {
      lines.push(`    x${v.n}  ${s}`)
      lines.push(`         e.g. ${v.ex}`)
    }
  }

  for (const vp of ['phone', 'desktop']) {
    lines.push('')
    lines.push(`== GAP histogram (${vp}) ==`)
    for (const [v, n] of [...gapHist[vp]].sort((a, b) => b[1] - a[1])) lines.push(`  ${String(n).padStart(5)}  ${v}`)
    lines.push(`== PADDING histogram (${vp}, by edge) ==`)
    for (const [v, n] of [...padHist[vp]].sort((a, b) => b[1] - a[1]).slice(0, 80)) {
      lines.push(`  ${String(n).padStart(5)}  ${v}`)
    }
  }

  lines.push('')
  lines.push('== DOM element counts per pass (stability) ==')
  for (const [k, arr] of counts) {
    const min = Math.min(...arr)
    const max = Math.max(...arr)
    lines.push(`  ${k}: ${min === max ? `stable ${min}` : `VARIES ${min}..${max}`}`)
  }

  const text = lines.join('\n')
  writeFileSync(path.join(OUT, 'review.txt'), text)
  writeFileSync(
    path.join(OUT, 'review.json'),
    JSON.stringify(
      {
        passes: PASSES,
        variance: varianceFindings,
        groups: groupFindings.map((f) => ({
          vp: f.vp,
          cls: f.cls,
          sigs: f.sigs.map(([s, v]) => ({ sig: s, n: v.n, ex: v.ex }))
        })),
        counts: [...counts.entries()]
      },
      null,
      1
    )
  )
  console.log('')
  console.log(text.split('\n').slice(0, 100).join('\n'))
  console.log(`\nfull report: ${path.join(OUT, 'review.txt')}`)
  console.log(`variance findings: ${varianceFindings.length}, group findings: ${groupFindings.length}`)
} finally {
  if (browser) await browser.close().catch(() => {})
  killTree(proc)
}
