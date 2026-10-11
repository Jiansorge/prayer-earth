// Can someone who cannot see or cannot use a mouse actually use the app?
//
// Every other check here asserts a specific fact someone chose to be true. None
// of them look at the markup the assistive technology is handed. That left the
// whole surface untested: a control with no accessible name, a heading order
// that skips levels, a touch target too small to hit, a contrast ratio nobody
// can read.
//
// axe-core is not a taste judgement - it encodes the WCAG success criteria that
// are mechanically checkable, which is most of the ones that fail in practice.
// It cannot tell you the flow makes sense, so the keyboard pass below covers
// what it cannot: that focus is somewhere real, that it is visible, and that
// Tab reaches the controls a screen-reader-less keyboard user needs.
//
// Run against the real app in a real browser, on every view a user lands on.
//
// Usage: node scripts/test-a11y.mjs
import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const AXE = readFileSync(path.join(ROOT, 'node_modules/axe-core/axe.min.js'), 'utf8')

let pass = 0
let fail = 0
const notes = []
const t = (name, fn) => {
  try {
    fn()
    pass++
    console.log(`PASS  ${name}`)
  } catch (e) {
    fail++
    console.log(`FAIL  ${name}\n        ${e.message}`)
  }
}
const eq = (actual, expected, msg) => assert.equal(actual, expected, msg)

// Same contract as t(), for assertions that have to await the page. Without this
// an async assertion rejects outside the wrapper and takes the whole run down
// instead of reporting one failure.
const ta = async (name, fn) => {
  try {
    await fn()
    pass++
    console.log(`PASS  ${name}`)
  } catch (e) {
    fail++
    console.log(`FAIL  ${name}\n        ${e.message}`)
  }
}

const describe = (violations) =>
  violations
    .map(
      (v) =>
        `${v.id} (${v.impact}) x${v.nodes.length}` +
        (v.nodes[0]?.target ? ` e.g. ${JSON.stringify(v.nodes[0].target)}` : '')
    )
    .join('\n        ')

async function withBrowser(fn) {
  const chrome =
    process.env.CHROME_PATH ||
    [
      'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
      'C:/Program Files/Google/Chrome/Application/chrome.exe'
    ].find((p) => existsSync(p))
  if (!chrome) throw new Error('no chromium binary found; set CHROME_PATH')
  const { chromium } = await import('playwright')
  const browser = await chromium.launch({
    executablePath: chrome,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox']
  })
  try {
    return await fn(browser)
  } finally {
    await browser.close()
  }
}

const startServer = async () => {
  const proc = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'dev', '--', '--port', '5175'], {
    cwd: ROOT,
    stdio: 'ignore',
    shell: process.platform === 'win32'
  })
  const app = 'http://localhost:5175'
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(app)
      if (r.ok) return { proc, app }
    } catch {}
    await new Promise((r) => setTimeout(r, 500))
  }
  proc.kill()
  throw new Error('dev server did not start')
}

const runAxe = async (page) => {
  // Injected per view rather than as an init script: the app is a single-page
  // surface, so one injection serves every route, and a ~600kB bundle on every
  // document load is a cost the navigation does not need to pay.
  if (!(await page.evaluate(() => !!window.axe))) {
    await page.addScriptTag({ content: AXE })
  }
  return page.evaluate(async () => {
    const r = await window.axe.run(document, {
      resultTypes: ['violations'],
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] }
    })
    return r.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      nodes: v.nodes.slice(0, 3).map((n) => ({ target: n.target, summary: n.failureSummary }))
    }))
  })
}

// Impact levels axe can return, worst first. Serious and critical are the bar:
// below that the finding is a genuine improvement but not a broken path, and a
// gate that fails on every nicety is a gate that gets switched off.
const BLOCKING = new Set(['serious', 'critical'])

const { proc, app } = await startServer()
try {
  await withBrowser(async (browser) => {
    const page = await browser.newPage()
    // Most users are past the first-run prompt, and it is modal by design, so
    // seeding the flag is what puts the app in the state the rest of the sweep
    // describes. The prompt gets its own check below.
    await page.addInitScript(() => {
      try {
        localStorage.setItem('pe-onboarded', '1')
      } catch {}
    })

    const goto = async (hash, waitFor) => {
      await page.goto(`${app}/${hash}`, { waitUntil: 'domcontentloaded' })
      await page.waitForSelector(waitFor, { timeout: 20000 })
      await page.waitForTimeout(1200)
      // A view that animates in can be mid-transition when axe reads it.
      await page.waitForTimeout(300)
    }

    // ---- Home ---------------------------------------------------------------
    await goto('#/', '.view')
    const home = await runAxe(page)
    notes.push(`home:            ${home.length ? describe(home) : 'clean'}`)
    t('Home has no blocking accessibility violations', () => {
      const blocking = home.filter((v) => BLOCKING.has(v.impact))
      assert.equal(
        blocking.length,
        0,
        `Home:\n        ${describe(blocking)}`
      )
    })

    // ---- Prayer -------------------------------------------------------------
    await goto('#/pray/buddhism/mani', '.view')
    const prayer = await runAxe(page)
    notes.push(`prayer:          ${prayer.length ? describe(prayer) : 'clean'}`)
    t('a prayer has no blocking accessibility violations', () => {
      const blocking = prayer.filter((v) => BLOCKING.has(v.impact))
      assert.equal(blocking.length, 0, `Prayer:\n        ${describe(blocking)}`)
    })

    // ---- Earth --------------------------------------------------------------
    await goto('#/earth', '.earth-view')
    await page.waitForTimeout(3500)
    const earth = await runAxe(page)
    notes.push(`earth:           ${earth.length ? describe(earth) : 'clean'}`)
    t('Earth has no blocking accessibility violations', () => {
      const blocking = earth.filter((v) => BLOCKING.has(v.impact))
      assert.equal(blocking.length, 0, `Earth:\n        ${describe(blocking)}`)
    })

    // ---- Settings sheet ------------------------------------------------------
    // Opened the way a user opens it rather than by route: the sheet traps
    // focus and hides the rest of the page, and that behaviour only exists when
    // it is genuinely open.
    await goto('#/', '.view')
    await page.click('.gear-btn')
    await page.waitForSelector('.sheet, [role="dialog"]', { timeout: 10000 })
    await page.waitForTimeout(900)
    const sheet = await runAxe(page)
    notes.push(`settings sheet:  ${sheet.length ? describe(sheet) : 'clean'}`)
    t('the settings sheet has no blocking accessibility violations', () => {
      const blocking = sheet.filter((v) => BLOCKING.has(v.impact))
      assert.equal(blocking.length, 0, `Settings sheet:\n        ${describe(blocking)}`)
    })

    // ---- First-run prompt ----------------------------------------------------
    // Checked on a clean profile: it is the first thing a new user meets, it is
    // a modal that traps focus, and it is the one surface that cannot be
    // reached from any route once dismissed.
    const fresh = await browser.newContext()
    const first = await fresh.newPage()
    await first.goto(`${app}/#/`, { waitUntil: 'domcontentloaded' })
    await first.waitForSelector('.onboard-backdrop', { timeout: 20000 })
    await first.waitForTimeout(900)
    const onboarding = await runAxe(first)
    notes.push(`first-run prompt: ${onboarding.length ? describe(onboarding) : 'clean'}`)
    t('the first-run prompt has no blocking accessibility violations', () => {
      const blocking = onboarding.filter((v) => BLOCKING.has(v.impact))
      assert.equal(blocking.length, 0, `First-run prompt:\n        ${describe(blocking)}`)
    })
    await ta('the first-run prompt can be dismissed from the keyboard', async () => {
      // A modal you can only leave by touching the screen is a modal some people
      // can never leave. Escape is wired in the component; this proves it.
      await first.bringToFront()
      await first.keyboard.press('Escape')
      await first.waitForSelector('.onboard-backdrop', { state: 'detached', timeout: 5000 })
    })
    await fresh.close()

    // ---- Keyboard -----------------------------------------------------------
    // What axe cannot see: whether Tab actually reaches the controls, and
    // whether focus lands somewhere a person could see.
    await goto('#/', '.view')
    await page.evaluate(() => document.body.focus())
    const walked = []
    for (let i = 0; i < 24; i++) {
      await page.keyboard.press('Tab')
      walked.push(
        await page.evaluate(() => {
          const a = document.activeElement
          if (!a || a === document.body) return null
          const style = getComputedStyle(a)
          const r = a.getBoundingClientRect()
          return {
            tag: a.tagName.toLowerCase(),
            name:
              a.getAttribute('aria-label') ||
              (a.textContent || '').trim().slice(0, 24) ||
              a.getAttribute('placeholder') ||
              '',
            w: Math.round(r.width),
            h: Math.round(r.height),
            outline: style.outlineStyle !== 'none' || style.boxShadow !== 'none'
          }
        })
      )
    }
    const reached = walked.filter(Boolean)
    const controls = reached.filter((f) => f.tag === 'button' || f.tag === 'a' || f.tag === 'input')
    notes.push(
      `keyboard:        ${reached.length}/24 focus stops, ${controls.length} controls, ${reached.filter((f) => !f.outline).length} without a visible focus ring`
    )
    t('Tab reaches the app controls', () => {
      assert.ok(controls.length >= 3, `only ${controls.length} focus stops were controls`)
    })
    t('focused controls are large enough to hit', () => {
      // 24x24 is the WCAG 2.2 AA minimum for a target size.
      const small = controls.filter((f) => f.w < 24 || f.h < 24)
      assert.equal(
        small.length,
        0,
        `too small to tap: ${small.map((f) => `${f.tag}"${f.name}" ${f.w}x${f.h}`).join(', ')}`
      )
    })
    t('focus is visible wherever it lands', () => {
      const invisible = reached.filter((f) => !f.outline)
      assert.equal(
        invisible.length,
        0,
        `no visible focus indicator: ${invisible.map((f) => `${f.tag}"${f.name}"`).join(', ')}`
      )
    })
  })
} finally {
  proc.kill()
}

console.log('')
notes.forEach((n) => console.log(`  ${n}`))
console.log('')
console.log(`${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)