// Capture a 5-sec demo gif + screenshot for the public README.
// Usage:
//   npm start              # in one terminal (vite on http://localhost:5173)
//   npm run capture:demo   # in another (requires: npx playwright install chromium; npm i -D playwright gif-encoder-2)
// Or without deps: just record your screen with QuickTime/OBS and save to public/demo.gif + public/screenshot.png
//
// This script is best-effort — if playwright is missing it prints manual steps.

import { existsSync } from 'node:fs'
import path from 'node:path'

const url = process.env.URL || 'http://localhost:5173'
const outGif = path.resolve('public/demo.gif')
const outPng = path.resolve('public/screenshot.png')

async function withPlaywright() {
  const { chromium } = await import('playwright')
  const { mkdirSync, existsSync, readdirSync } = await import('node:fs')
  const { execSync } = await import('node:child_process')
  mkdirSync('public', { recursive: true })
  const browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    recordVideo: { dir: 'public', size: { width: 1280, height: 800 } }
  })
  const page = await context.newPage()
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  await page.screenshot({ path: outPng, fullPage: true })
  console.log(`✓ screenshot → ${outPng}`)
  // Interact a bit for the gif
  const tile = page.locator('.tile').first()
  if (await tile.count()) await tile.click().catch(()=>{})
  await page.waitForTimeout(800)
  await page.goBack().catch(()=>{})
  await page.waitForTimeout(500)
  await context.close()
  await browser.close()
  // Find the recorded webm
  const vids = readdirSync('public').filter(f => f.endsWith('.webm') && f.includes('page'))
  const webm = vids.length ? `public/${vids.sort().pop()}` : null
  if (webm && existsSync(webm)) {
    try {
      execSync(`ffmpeg -y -i "${webm}" -t 5 -vf "fps=8,scale=640:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" "${outGif}"`, { stdio: 'inherit' })
      console.log(`✓ gif → ${outGif}`)
      // cleanup webm
      const { unlinkSync } = await import('node:fs')
      try { unlinkSync(webm) } catch {}
    } catch (e) {
      console.log('ffmpeg gif failed, keeping webm at', webm, e.message)
    }
  } else {
    console.log('no video found, gif skipped — check public/*.webm')
  }
}

try {
  if (!existsSync('node_modules/playwright')) throw new Error('playwright not installed')
  await withPlaywright()
} catch (e) {
  console.log(`\n[ capture-demo ] ${e.message}`)
  console.log(`
Manual (no deps):
  1. npm start
  2. Open ${url} in Chrome, pick a prayer, press Pray — watch the Earth glow.
  3. Screenshot: DevTools → Cmd+Shift+P → "Capture full size screenshot" → save as public/screenshot.png
  4. Gif: QuickTime Player → New Screen Recording (5s) → export → convert with https://ezgif.com/video-to-gif → public/demo.gif
  5. git add public/screenshot.png public/demo.gif && git commit -m "docs: add demo media"
`)
}
