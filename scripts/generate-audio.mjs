// One-time render of the entire prayer library to static MP3s using free
// neural voices (msedge-tts, Microsoft Edge's TTS service via Node, no card).
//
// Output: public/audio/<prayerId>/<phraseIndex>-<voiceId>.mp3
// plus public/audio/manifest.json describing which voices each prayer has.
// Prayers whose language has no Edge voice are skipped, the app falls back
// to on-device browser voices for those.
//
// Env:
//   AUDIO_LIMIT=n            render only the first n prayers (for testing)
//   AUDIO_PRAYERS=a,b,c      render only these prayer ids (for testing)
//   MAX_VOICES=n             max voice options per prayer (default 8)
//
// Run:  node scripts/generate-audio.mjs

import { writeFileSync, mkdirSync, existsSync, renameSync } from 'node:fs'
import { join } from 'node:path'
import { SPIRITUALITIES } from '../src/data/prayers.js'
import edgePkg from 'msedge-tts'

const { MsEdgeTTS, OUTPUT_FORMAT } = edgePkg
const OUT = join(process.cwd(), 'public', 'audio')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Never die silently on a stray rejection, log and keep going.
process.on('unhandledRejection', (e) => console.log('UNHANDLED:', e?.message || e))
process.on('uncaughtException', (e) => console.log('UNCAUGHT:', e?.message || e))
const MAX_VOICES = process.env.MAX_VOICES ? parseInt(process.env.MAX_VOICES, 10) : 8

// Languages Edge has no voice for are spoken by the closest major neighbour
// (Hindi reads Devanagari, so it voices Sanskrit/Prakrit; English voices the
// romanised Pāli/Māori and Latin-script Avestan/Lakota/Hawaiian/Yoruba/Akan).
// Gurmukhi (Punjabi) is left to device voices, no free engine reads it.
const FALLBACK_LANG = {
  sa: 'hi',
  pi: 'en',
  pra: 'hi',
  mi: 'en',
  la: 'en',
  ae: 'en',
  lkt: 'en',
  haw: 'en',
  yo: 'en',
  ak: 'en'
}

const LIMIT = process.env.AUDIO_LIMIT ? parseInt(process.env.AUDIO_LIMIT, 10) : 0
const ONLY = process.env.AUDIO_PRAYERS
  ? new Set(process.env.AUDIO_PRAYERS.split(',').map((s) => s.trim()))
  : null

// Escape SSML-sensitive characters so the prayer text never breaks the XML.
function escapeXml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

// Keep the best standard neural voices only (drop multilingual/expressive
// variants), then cap per language so the library stays lean.
function pickVoices(list, max) {
  const seen = new Set()
  const good = list.filter((v) => {
    const n = v.ShortName || ''
    if (seen.has(n)) return false
    seen.add(n)
    return n.endsWith('Neural') && !/Multilingual|Expressive|Dragonfly/.test(n)
  })
  // alternate male/female, falling back to any unused voice, never duplicating
  const male = good.filter((v) => v.Gender === 'Male')
  const female = good.filter((v) => v.Gender === 'Female')
  const used = new Set()
  const merged = []
  const take = Math.min(max, good.length)
  for (let i = 0; i < take; i++) {
    const pool = i % 2 === 0 ? female : male
    const chosen = pool.find((v) => !used.has(v.ShortName)) || good.find((v) => !used.has(v.ShortName))
    if (!chosen) break
    used.add(chosen.ShortName)
    merged.push(chosen.ShortName)
  }
  return merged
}

const tts = new MsEdgeTTS()
const all = await tts.getVoices()
const voices = all.voices || all
const byLang = {}
for (const v of voices) {
  const code = (v.locale || v.Locale || '').split('-')[0]
  ;(byLang[code] = byLang[code] || []).push(v)
}
tts.close()

// Render every phrase of one prayer in one voice with a fresh connection.
async function renderPrayerVoice(p, dir, voice) {
  const t = new MsEdgeTTS()
  try {
    await withTimeout(t.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3, {}), 20000, 'setMetadata')
  } catch (e) {
    t.close()
    throw new Error(`setMetadata ${voice}: ${e.message}`)
  }
  let count = 0
  try {
    for (const [i, ph] of (p.phrases || []).entries()) {
      const text = ph.t || ph.s || ''
      if (!text) continue
      const file = join(dir, `${i}-${voice}.mp3`)
      if (existsSync(file)) {
        count++
        continue
      }
      const { audioFilePath } = await withTimeout(t.toFile(dir, escapeXml(text)), 30000, `toFile ${p.id}/${i}-${voice}`)
      renameSync(audioFilePath, file)
      count++
      await sleep(200)
    }
  } finally {
    t.close()
  }
  return count
}

// A promise that rejects instead of hanging forever on a stalled request.
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out`)), ms))
  ])
}

const prayers = []
for (const s of SPIRITUALITIES) {
  for (const p of s.prayers) prayers.push({ ...p, spirit: s.id })
}
const targets = prayers.filter((p) => !ONLY || ONLY.has(p.id))

const manifest = { generated: new Date().toISOString(), prayers: {} }
let generated = 0
let skipped = 0
let failed = 0

for (const [n, p] of targets.entries()) {
  if (LIMIT && n >= LIMIT) break
  try {
    await renderPrayer(p, n, targets.length)
  } catch (e) {
    console.log(`  PRAYER ERROR ${p.id}: ${e?.message || e}`)
    skipped++
  }
}

// One prayer: pick voices, render each, write progress.
async function renderPrayer(p, n, total) {
  const lang = p.lang || 'en'
  const vs = pickVoices(byLang[lang] || byLang[FALLBACK_LANG[lang]] || [], MAX_VOICES)
  if (!vs.length) {
    console.log(`[${n + 1}/${total}] ${p.id} (${lang}), no Edge voice, skipped`)
    skipped++
    return
  }
  const dir = join(OUT, p.id)
  mkdirSync(dir, { recursive: true })
  for (const voice of vs) {
    let attempts = 0
    while (attempts < 3) {
      try {
        generated += await renderPrayerVoice(p, dir, voice)
        break
      } catch (e) {
        attempts++
        failed++
        if (attempts >= 3) console.log(`  FAIL ${p.id}/${voice}: ${e.message}`)
        else {
          console.log(`  RETRY ${p.id}/${voice} (${attempts})`)
          await sleep(2000 * attempts)
        }
      }
    }
  }
  manifest.prayers[p.id] = { lang: FALLBACK_LANG[lang] || lang, voices: vs, phrases: (p.phrases || []).length }
  // write progress after each prayer so an interrupted run keeps what it did
  writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2))
  console.log(`[${n + 1}/${total}] ${p.id} (${lang}), ${vs.length} voices`)
}

writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2))
console.log(`DONE, ${generated} files, ${skipped} prayers skipped (no voice), ${failed} failed`)
