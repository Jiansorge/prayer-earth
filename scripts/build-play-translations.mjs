// Emit the CSV for Play Console -> Store listings -> "Import translations with
// AI".
//
// Play detects the languages present in the upload and attributes each to the
// matching listing, so the file only has to carry one row per language with the
// listing fields. Long format (one row per language) rather than wide, because
// a wide sheet with 24 language columns and multi-line descriptions is the
// format that corrupts on the first comma or newline inside a translation.
//
// The schema below is the one Play's bulk translation import documents:
//   language,title,short_description,full_description
// If the console ever asks for a different header, it is a one-line change here
// rather than a re-translation.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { STORE_LISTING, LISTING_STATS, SHORT_LIMIT } from './store-listing.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'dist-store', 'play-listing-translations.csv')

// Play's language codes for the listings, mapped from our locale codes.
// Only the ones we actually publish; `bo` has translations in-app but no
// Tibetan listing, and adding one would show English on a Tibetan store page.
const PLAY_CODE = {
  en: 'en-US',
  es: 'es-ES',
  fr: 'fr-FR',
  de: 'de-DE',
  pt: 'pt-BR',
  it: 'it-IT',
  ru: 'ru-RU',
  zh: 'zh-CN',
  ar: 'ar',
  ja: 'ja-JP',
  ko: 'ko-KR',
  hi: 'hi-IN',
  vi: 'vi',
  tl: 'fil',
  bo: 'bo'
}

// Play's full-description limit.
const FULL_LIMIT = 4000

const csvCell = (s) => '"' + String(s).replace(/"/g, '""') + '"'

const rows = [['language', 'title', 'short_description', 'full_description']]
const problems = []

for (const [locale, listing] of Object.entries(STORE_LISTING)) {
  const code = PLAY_CODE[locale]
  if (!code) continue

  if (listing.title.length > 30) problems.push(`${code}: title over 30 chars (${listing.title.length})`)
  if (listing.short.length > SHORT_LIMIT) {
    problems.push(`${code}: short description over ${SHORT_LIMIT} (${listing.short.length})`)
  }
  if (listing.full.length > FULL_LIMIT) {
    problems.push(`${code}: full description over ${FULL_LIMIT} (${listing.full.length})`)
  }

  rows.push([code, listing.title, listing.short, listing.full])
}

fs.mkdirSync(path.dirname(OUT), { recursive: true })
// CRLF: Excel on Windows is what people open these in, and a UTF-8 CSV with a
// BOM opens as mojibake there otherwise. Play reads both.
const csv = rows.map((r) => r.map(csvCell).join(',')).join('\r\n')
fs.writeFileSync(OUT, '\uFEFF' + csv)

console.log('play-listing-translations.csv')
console.log('  languages:', rows.length - 1)
console.log('  prayers/traditions stated:', LISTING_STATS.prayers, '/', LISTING_STATS.spirits)
for (const p of problems) console.log('  PROBLEM:', p)
if (problems.length) process.exit(1)
console.log('  all within Play limits')