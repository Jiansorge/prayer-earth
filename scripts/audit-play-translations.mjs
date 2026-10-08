// Review the Play store listing translations.
//
// The CSV that goes to the Play Console is machine-translated, and the two
// defects it already produced are instructive: a Korean "Copied link!" that came
// back as 링기됨! (링 is the Sino-Korean reading of "link", which reads like a
// typo to a Korean speaker), and a Vietnamese "Đã đã sao chép liên kết!" with
// Đã doubled. Neither is a contamination problem or a missing key, so every
// shape-based audit passes them straight through.
//
// This looks for the shapes those two bugs shared:
//
//   - a whole word immediately repeated ("Đã đã", "na na"). Accent-insensitive,
//     so "Đã đă" is caught too - same generator, same bug.
//   - Play's field limits, since this is the file that has to satisfy them.
//   - a non-English row byte-identical to English, which is worse than a wrong
//     translation because it looks finished.
//
// It cannot tell you whether a translation is good. It reports only what a human
// should read first.
import fs from 'node:fs'

const LOCALES = 'src/locales'
const CSV = 'dist-store/play-listing-translations.csv'

let fail = 0
const found = []

const hard = (msg) => {
  fail++
  console.log(`[FAIL] ${msg}`)
}
const review = (where, key, text, why) => found.push({ where, key, text, why })

// A repeated WORD, not a repeated letter run. Requiring the whole token to
// repeat is what keeps "the the" in a sentence out of the results when the
// repetition is an artefact of the two copies landing next to each other, and
// it is what "Đã đã" looks like.
const fold = (s) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .replace(/Đ/gi, 'D')
    .toLowerCase()

function repeatedWords(text) {
  // Split on whitespace, so a word straddling a line break cannot match itself.
  const words = fold(text).split(/\s+/).filter(Boolean)
  const hits = []
  for (let i = 1; i < words.length; i++) {
    const w = words[i]
    // Two letters minimum: a single repeated letter is far more often a genuine
    // feature of a script that does not use spaces between every syllable.
    if (w.length < 2) continue
    // Strip surrounding punctuation before comparing.
    const strip = (t) => t.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
    if (strip(w) === strip(words[i - 1])) hits.push(strip(w))
  }
  return hits
}

console.log('--- locale files ---')
let localeCount = 0
for (const file of fs.readdirSync(LOCALES).filter((f) => f.endsWith('.js'))) {
  const loc = file.replace(/\.js$/, '')
  const src = fs.readFileSync(`${LOCALES}/${file}`, 'utf8')
  for (const m of src.matchAll(/'([^']+)':\s*'((?:[^'\\]|\\.)*)'/g)) {
    const [, key, text] = m
    for (const w of repeatedWords(text)) review(`locale:${loc}`, key, text, `"${w}" appears twice in a row`)
    localeCount++
  }
}
console.log(`checked ${localeCount} strings across the locale files`)

console.log('')
console.log('--- play store CSV ---')
if (!fs.existsSync(CSV)) {
  hard(`${CSV} missing - run: npm run build:play-translations`)
} else {
  // Strip the BOM. Play accepts it, but it makes "language" become
  // "\uFEFFlanguage" and every column lookup silently misses.
  const csv = fs.readFileSync(CSV, 'utf8').replace(/^\uFEFF/, '')

  const rows = []
  let row = []
  let field = ''
  let quoted = false
  for (let i = 0; i < csv.length; i++) {
    const c = csv[i]
    if (quoted) {
      if (c === '"') {
        if (csv[i + 1] === '"') { field += '"'; i++ } else quoted = false
      } else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\r') { /* ignore */ }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = '' }
    else field += c
  }
  if (field || row.length) { row.push(field); rows.push(row) }

  const header = rows[0]
  const idx = Object.fromEntries(header.map((h, i) => [h, i]))
  for (const need of ['language', 'title', 'short_description', 'full_description']) {
    if (!(need in idx)) hard(`CSV is missing the "${need}" column (header: ${JSON.stringify(header)})`)
  }
  if (fail) {
    console.log('')
    console.log('columns did not line up, so the text checks below would be meaningless - stopping')
    process.exit(1)
  }

  const data = rows.slice(1).filter((r) => r.length === header.length)
  console.log(`${data.length} languages, columns: ${header.join(', ')}`)

  for (const r of data) {
    const lang = r[idx.language]
    for (const col of ['title', 'short_description', 'full_description']) {
      const text = r[idx[col]]
      if (!text) { hard(`${lang} ${col} is empty`); continue }
      for (const w of repeatedWords(text)) review(`csv:${lang}`, col, text, `"${w}" appears twice in a row`)
    }
    const t = r[idx.title].length
    const s = r[idx.short_description].length
    const f = r[idx.full_description].length
    if (t > 30) hard(`${lang} title is ${t} chars, Play allows 30`)
    if (s > 80) hard(`${lang} short_description is ${s} chars, Play allows 80`)
    if (f > 4000) hard(`${lang} full_description is ${f} chars, Play allows 4000`)
  }

  const en = data.find((r) => r[idx.language] === 'en-US')
  if (!en) hard('CSV has no en-US row to compare against')
  else {
    for (const r of data) {
      if (r === en) continue
      if (r[idx.full_description] === en[idx.full_description]) {
        hard(`${r[idx.language]} full_description is byte-identical to en-US`)
      }
    }
  }
}

// Placeholder text that survived translation. es.js shipped
// "para que personas unknown oren a tu lado" for months and every shape-based
// audit passed it, because "unknown" is a real English word in a real sentence.
// Only a human reading the sentence catches it, so it is named here explicitly.
console.log('')
console.log('--- placeholder text in locale files ---')
// Words that mean "I did not translate this". Matched per locale file so the
// report says which one, and case-insensitively because the generator varies.
// TODO/FIXME stay case-sensitive on purpose: Spanish "todo" and Portuguese
// "todo" are ordinary words meaning "all", and a case-insensitive TODO would
// flag seven perfectly good strings.
const MARKER = /\b(TODO|FIXME|PLACEHOLDER)\b/g
// Real English words that mean "untranslated".
//
// Checked in EVERY locale, including English: a Spanish string containing
// "unknown" is the bug this exists for, and excluding Latin-script locales from
// the check is exactly how it survived in the first place. es.js shipped
// "personas unknown oren a tu lado" and the first version of this script skipped
// it for being Latin script, which found nothing and reported success.
const UNTRANSLATED = /\b(unknown|undefined|NaN|Lorem ipsum|translation missing|your text here)\b/g

let placeholderHits = 0
for (const file of fs.readdirSync(LOCALES).filter((f) => f.endsWith('.js'))) {
  const loc = file.replace(/\.js$/, '')
  const src = fs.readFileSync(`${LOCALES}/${file}`, 'utf8')
  for (const m of src.matchAll(/'([^']+)':\s*'((?:[^'\\]|\\.)*)'/g)) {
    const [, key, text] = m
    for (const hit of text.matchAll(MARKER)) {
      placeholderHits++
      hard(`${loc} ${key} contains the dev marker "${hit[1]}"`)
    }
    for (const hit of text.matchAll(UNTRANSLATED)) {
      placeholderHits++
      hard(`${loc} ${key} contains the untranslated placeholder "${hit[1]}"`)
    }
  }
}
if (!placeholderHits) console.log('none found')

console.log('')
if (found.length) {
  console.log(`${found.length} string(s) to read:`)
  console.log('')
  for (const f of found) {
    const text = f.text.length > 90 ? f.text.slice(0, 90) + '...' : f.text
    console.log(`  ${f.where} ${f.key}`)
    console.log(`      ${f.text}`)
    console.log(`      -> ${f.why}`)
  }
  console.log('')
  console.log('These have the shape of a machine-translation error. They may be fine.')
  console.log('A native speaker decides, not this script.')
} else {
  console.log('no repeated-word shapes found')
}
console.log('')
console.log(`${fail} hard failure(s)`)
process.exit(fail ? 1 : 0)