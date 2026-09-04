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
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  await page.screenshot({ path: outPng, fullPage: true })
  console.log(`✓ screenshot → ${outPng}`)

  // 5-sec video → gif (playwright video + ffmpeg)
  // For gif: `npx playwright install ffmpeg` or use `ffmpeg -i video.webm public/demo.gif`
  console.log('Tip: record 5s with QuickTime/OBS and save as public/demo.gif, or use playwright video + ffmpeg.')
  await browser.close()
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
