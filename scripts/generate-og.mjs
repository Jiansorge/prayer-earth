import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } })
await page.goto('file:///C:/Users/j/AppData/Local/Temp/og-card.html', { waitUntil: 'networkidle' })
await page.waitForTimeout(500)
await page.screenshot({ path: 'public/icons/og-card.png', fullPage: false })
console.log('done og-card')
await browser.close()
