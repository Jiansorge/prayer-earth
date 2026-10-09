// Settings-sheet UI regression checks.
//
// These are things that looked fine in the source and were wrong on screen:
//
//   - the donate label and the Ko-fi badge were on separate lines, because
//     .field-btn carries width:100% and the row did not reset it
//   - "Request deletion of my data" rendered as white text on a white button,
//     because .field-report styled the text of a <button> without ever
//     resetting the user-agent chrome
//   - a .field-divider sat directly above a .settings-row, whose own
//     border-top made the pair read as a double rule
//   - Privacy & care opened a sheet with no Back control at the top
//   - the sheet forgot its scroll position between openings
//
// Each is asserted on computed layout in a real browser rather than by reading
// CSS, because every one of them passed a source review.
//
// Usage: node scripts/test-settings-ui.mjs   (needs a dev server on 5173)
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const APP = process.env.APP_URL || 'http://localhost:5173'

let pass = 0
let fail = 0
// Async on purpose, and awaited at every call site. This started out as the
// synchronous shape used by test-units.mjs, which meant these async bodies were
// never awaited at all: every assertion "passed" instantly without running, the
// promises then raced each other, and closing one page tore down the next one's
// navigation. A test harness that does not await its tests reports nothing.
const t = async (name, fn) => {
  try {
    await fn()
    pass++
    console.log(`PASS  ${name}`)
  } catch (e) {
    fail++
    console.log(`FAIL  ${name}\n        ${e.message}`)
  }
}

const exe =
  process.env.CHROME_PATH ||
  ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(
    (p) => existsSync(p)
  )
if (!exe) throw new Error('no chromium binary; set CHROME_PATH')

for (let i = 0; i < 40; i++) {
  try {
    if ((await fetch(APP)).ok) break
  } catch {}
  await new Promise((r) => setTimeout(r, 500))
}

const { chromium } = await import('playwright')
const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] })

// Two widths: the point of the header fix was narrow-viewport behaviour, so
// checking one width would not have caught it. Each width gets its own context,
// because closing a page on the shared default context races the next one's
// first navigation.
for (const width of [470, 520]) {
  const context = await browser.newContext({ viewport: { width, height: 900 } })
  const page = await context.newPage()
  await page.goto(APP, { waitUntil: 'load' })
  await page.waitForTimeout(3000)
  await page.evaluate(() => document.querySelector('.onboard-skip, .onboard-begin')?.click())
  await page.waitForTimeout(800)

  await t(`@${width}px the header actions are right-aligned`, async () => {
    const m = await page.evaluate(() => {
      const a = document.querySelector('.home-head-actions')
      const r = document.querySelector('.home-title')
      if (!a || !r) throw new Error('header elements missing')
      return { right: a.getBoundingClientRect().right, rowRight: r.getBoundingClientRect().right }
    })
    if (m.right < m.rowRight - 2) {
      throw new Error(`actions end at ${Math.round(m.right)}, row ends at ${Math.round(m.rowRight)}`)
    }
  })

  await page.evaluate(() => document.querySelector('.gear-btn')?.click())
  await page.waitForSelector('.sheet-body', { timeout: 15000 })
  await page.waitForTimeout(1000)

  await t(`@${width}px the donate label and Ko-fi badge share one line`, async () => {
    // The badge is an <img loading="lazy">; measuring before it loads gives a
    // zero-width element and reads as "collapsed" when nothing is wrong.
    await page.evaluate(async () => {
      const img = document.querySelector('.donate-row img')
      if (!img) return
      if (img.complete && img.naturalWidth) return
      await new Promise((res) => {
        img.addEventListener('load', res, { once: true })
        img.addEventListener('error', res, { once: true })
        setTimeout(res, 4000)
      })
    })
    const m = await page.evaluate(() => {
      const row = document.querySelector('.donate-row')
      if (!row) throw new Error('.donate-row missing')
      const kids = [...row.children].map((e) => e.getBoundingClientRect())
      const a = kids[0]
      const b = kids[1]
      const overlap = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
      return { overlap: Math.round(overlap), aw: Math.round(a.width), bw: Math.round(b.width) }
    })
    if (m.aw < 60 || m.bw < 60) throw new Error(`collapsed: label ${m.aw}px, badge ${m.bw}px`)
    // Equal tops is the wrong test: the badge is 36px and the label taller, so
    // with align-items:center their tops differ by a few px. Overlap is right.
    if (m.overlap < 20) throw new Error(`only ${m.overlap}px of vertical overlap - they are on separate lines`)
  })

  await t(`@${width}px the external links are not rendered as buttons`, async () => {
    const bad = await page.evaluate(() => {
      const out = []
      for (const el of document.querySelectorAll('.field-report')) {
        const cs = getComputedStyle(el)
        // A default UA button background is opaque; ours must be transparent.
        const opaque = cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && !/^rgba\(.*,\s*0\)$/.test(cs.backgroundColor)
        if (opaque || parseFloat(cs.borderTopWidth) > 0 || cs.padding !== '0px') {
          out.push({ text: el.textContent.trim().slice(0, 30), bg: cs.backgroundColor, border: cs.borderTopWidth, pad: cs.padding })
        }
      }
      return out
    })
    if (bad.length) throw new Error(`still button-chrome: ${JSON.stringify(bad)}`)
  })

  await t(`@${width}px no double rule above a settings row`, async () => {
    const count = await page.evaluate(
      () => document.querySelectorAll('.field-divider + .settings-row').length
    )
    if (count) throw new Error(`${count} divider(s) directly above a settings row`)
  })

  await t(`@${width}px Privacy & care opens a sheet with a Back control`, async () => {
    await page.evaluate(() => document.querySelector('[data-testid="row-privacy"]')?.click())
    await page.waitForTimeout(700)
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('.field-btn')].find((b) => /privacy & care/i.test(b.textContent))
      btn?.click()
    })
    await page.waitForTimeout(900)
    const hasBack = await page.evaluate(() => !!document.querySelector('.legal-sheet .settings-back'))
    if (!hasBack) throw new Error('the legal sheet has no Back button')
    await page.evaluate(() => document.querySelector('.legal-sheet .settings-back')?.click())
    await page.waitForTimeout(600)
  })

  await t(`@${width}px the sheet restores its scroll position`, async () => {
    // Return to the main list first; the previous test navigated into a panel.
    await page.evaluate(() => document.querySelector('.settings-back')?.click())
    await page.waitForTimeout(700)
    await page.evaluate(() => {
      const b = document.querySelector('.sheet-body')
      if (b) b.scrollTop = 400
    })
    await page.waitForTimeout(1200)
    const before = await page.evaluate(() => document.querySelector('.sheet-body').scrollTop)
    await page.evaluate(() => document.querySelector('.sheet-x')?.click())
    await page.waitForTimeout(600)
    await page.evaluate(() => document.querySelector('.gear-btn')?.click())
    await page.waitForSelector('.sheet-body', { timeout: 15000 })
    await page.waitForTimeout(1200)
    const after = await page.evaluate(() => document.querySelector('.sheet-body').scrollTop)
    if (Math.abs(after - before) > 5) throw new Error(`scrolled to ${before}, reopened at ${after}`)
  })

  await context.close()
}

await browser.close()
console.log('')
console.log(`${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)