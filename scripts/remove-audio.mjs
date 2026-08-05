// prayer-earth — safely remove/replace recordings.
//
//   node scripts/remove-audio.mjs <prayerId> [voiceId] [phraseIndex] [--yes]
//
// Deletes the matching MP3 files under public/audio/<prayerId>/ AND keeps
// public/audio/manifest.json in sync (removes the voice/prayer from the
// manifest), so the app never lists a recording that no longer exists and a
// prayer with no recordings left cleanly falls back to device voices.
//
// Examples:
//   node scripts/remove-audio.mjs lords-prayer                  # remove the whole prayer's recordings
//   node scripts/remove-audio.mjs lords-prayer en-US-AriaNeural # remove one voice for a prayer
//   node scripts/remove-audio.mjs lords-prayer en-US-AriaNeural 0 # remove just phrase 0 of that voice
//
// Replacing: overwrite the file at the same name, or re-run
//   node scripts/generate-audio.mjs  (AUDIO_PRAYERS=<ids> to scope it).

import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, existsSync } from 'node:fs'
import { join, basename } from 'node:path'

const ROOT = process.cwd()
const AUDIO = join(ROOT, 'public', 'audio')
const MANIFEST = join(AUDIO, 'manifest.json')

const args = process.argv.slice(2)
const yes = args.includes('--yes')
const pos = args.filter((a) => !a.startsWith('--'))
const prayerId = (pos[0] || '').trim().toLowerCase()
const voiceId = (pos[1] || '').trim()
const phraseIndex = pos[2]

// Only sane ids — never a path.
const SAFE = /^[a-z0-9][a-z0-9-]{0,63}$/
if (!SAFE.test(prayerId)) {
  console.error(`usage: node scripts/remove-audio.mjs <prayerId> [voiceId] [phraseIndex] [--yes]`)
  console.error(`bad prayerId: ${JSON.stringify(prayerId)}`)
  process.exit(1)
}

if (!existsSync(MANIFEST)) {
  console.error('No manifest at public/audio/manifest.json — nothing to update.')
  process.exit(1)
}

const dir = join(AUDIO, prayerId)
if (!existsSync(dir)) {
  console.error(`No recordings for "${prayerId}" at public/audio/${prayerId}/`)
  process.exit(1)
}

// Figure out which files to delete.
const files = readdirSync(dir).filter((f) => f.endsWith('.mp3'))
let targets = files
let label = `all recordings for "${prayerId}"`
if (voiceId) {
  targets = files.filter((f) => f.endsWith(`-${voiceId}.mp3`))
  label = `voice "${voiceId}" for "${prayerId}"`
  if (phraseIndex !== undefined) {
    targets = targets.filter((f) => f.startsWith(`${phraseIndex}-`))
    label += ` phrase ${phraseIndex}`
  }
}
if (!targets.length) {
  console.log(`Nothing matches — no files to remove for ${label}.`)
  process.exit(0)
}

if (!yes && targets.length === files.length) {
  console.error(
    `This would remove ALL ${files.length} recordings for "${prayerId}" ` +
      `(the app will fall back to device voices for it). Re-run with --yes to confirm.`
  )
  process.exit(1)
}

for (const f of targets) rmSync(join(dir, f))
if (targets.length === files.length) {
  // Folder is now empty — remove it entirely.
  rmSync(dir, { recursive: true, force: true })
}
console.log(`Removed ${targets.length} file(s): ${targets.join(', ')}`)

// Keep the manifest consistent.
const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'))
const p = manifest.prayers && manifest.prayers[prayerId]
if (p) {
  if (voiceId) {
    p.voices = (p.voices || []).filter((v) => v !== voiceId)
  } else {
    delete manifest.prayers[prayerId]
  }
  if (!p.voices || !p.voices.length) delete manifest.prayers[prayerId]
}
manifest.generated = new Date().toISOString()
writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2))
console.log(`Updated public/audio/manifest.json (${Object.keys(manifest.prayers || {}).length} prayers remain).`)

console.log('\nNext: rebuild + redeploy so the change ships:')
console.log('  npm run build            # in prayer-earth')
console.log('  cd ../sync-engine && npm run deploy:app')
