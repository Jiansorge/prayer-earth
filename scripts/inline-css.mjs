// Post-build step: inline the entry CSS bundle into index.html.
//
// The PWAs app shell can't paint without the stylesheet, so the external
// render-blocking CSS request sits in the critical path (one extra round trip
// before first paint, flagged by Lighthouse). Inlining it into the document
// removes that request from the chain entirely; the SW and Workers-Static
// Assets cache the (slightly larger) index.html instead.
//
// Only the entry stylesheet is inlined. CSS owned by lazy route chunks stays
// hashed + external (it loads with its chunk, never blocking first paint).
// Run automatically at the end of `vite build`.

import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist')
const htmlPath = path.join(DIST, 'index.html')
const html = readFileSync(htmlPath, 'utf8')

// Only the entry stylesheet link — `<link rel="stylesheet" ... href="/assets/x.css">`
const LINK = /[ \t]*<link[^>]*\brel="stylesheet"[^>]*href="(\/assets\/[^"]+\.css)"[^>]*>\r?\n?/

const m = html.match(LINK)
if (!m) {
  console.log('[inline-css] no entry stylesheet link found — leaving index.html as-is')
  process.exit(0)
}

const cssPath = path.join(DIST, m[1].replace(/^\//, ''))
let css
try {
  css = readFileSync(cssPath, 'utf8')
} catch {
  console.error(`[inline-css] could not read ${m[1]}`)
  process.exit(1)
}

const inlined = html.replace(LINK, `    <style>\n${css}\n    </style>\n`)
writeFileSync(htmlPath, inlined)

console.log(`[inline-css] inlined ${path.basename(m[1])} (${(css.length / 1024).toFixed(1)} KiB) into index.html`)