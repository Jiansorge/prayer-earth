import fs from 'node:fs'

// Pin what the app does about a prayer with no recording.
//
// Found while answering "should the unrecorded Gurmukhi prayers be hidden?".
// The chain in speech.js is:
//
//   1. pre-rendered audio      - absent for the prayers with no recording (count is computed below, not hard-coded here)
//   2. GET /api/tts             - NOT IMPLEMENTED by the engine. It 404s for every
//                                 language, verified against production.
//   3. browser speechSynthesis  - what actually happens, and the only voice some
//                                 users will hear
//   4. timed chant, no words    - last resort, with a visible notice
//
// So an unrecorded prayer is not silent and not broken. Whether it sounds right
// depends on whether the user's browser has a voice for that language, which is
// outside anything this repo controls. That is the answer to whether hiding them
// would help: it would remove working content to hide a content gap.

const speech = fs.readFileSync('src/audio/speech.js', 'utf8')

let fail = 0
const check = (name, ok, detail) => {
  if (!ok) fail++
  console.log(`[audio] ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`)
}

check(
  'the fallback chain exists in order',
  /hasStaticFor|speakCloud/.test(speech) && /noCloud/.test(speech) && /timedLoop/.test(speech),
  'static -> /api/tts -> browser voices -> timed chant'
)

check(
  'a 404 from the TTS proxy does not stop playback',
  /if \(res\.status !== 200\) return false/.test(speech),
  'returns false so the caller falls through to browser voices'
)

check(
  'repeated proxy failures disable the proxy for the rest of the job',
  /cloudFails\s*=\s*\(j\.cloudFails \|\| 0\)\s*\+\s*1/.test(speech) &&
    /cloudFails\s*>=\s*2/.test(speech) &&
    /noCloud\s*=\s*true/.test(speech),
  'so a 404 costs two phrases, not the whole prayer'
)

check(
  'the timed chant tells the user why there is no voice',
  /notifyFallback\('no-voices'\)/.test(speech) || /chantReason/.test(speech),
  'the notice is the honest part: it is not pretending to speak'
)

// The data side: which prayers genuinely have no recording.
const spiritsDir = 'src/data/spirits'
const audioDir = 'public/audio'
const all = []
const t = 0
for (const f of fs.readdirSync(spiritsDir)) {
  const s = fs.readFileSync(`${spiritsDir}/${f}`, 'utf8')
  // Only ids inside `prayers: [`. Counting every `id:` in the file also matched
  // the spirit's own top-level id, so the unrecorded list was polluted with all
  // nineteen tradition names (buddhism, islam, ...) and the "is anything
  // missing?" check could never fail, because those fake entries always
  // counted as unrecorded.
  // Slicing gets the spirit's own top-level id out of the way. The `\b` gets
  // a subtler one: without it an English gloss reading "Thus it is said:"
  // matches the `id:` inside `said:` and its following quote, pushing a
  // fragment of source code into the unrecorded list.
  const start = s.indexOf('prayers: [')
  const body = start >= 0 ? s.slice(start) : ''
  for (const m of body.matchAll(/\bid:\s*'([^']+)'/g)) all.push(m[1])
  void t
}
// The manifest is the truth the app reads - hasStaticFor looks there - so it
// decides. Directory presence does not: remove-audio leaves the empty folder
// behind, and an empty folder still counted as recorded, which is how the
// Great Compassion looked recorded the moment its four Sanskrit files were
// deleted and its manifest entry dropped to nothing.
const manifest = JSON.parse(fs.readFileSync(`${audioDir}/manifest.json`, 'utf8'))
const recorded = new Set(
  Object.entries(manifest.prayers || {})
    .filter(([, v]) => Array.isArray(v.voices) && v.voices.length > 0)
    .map(([id]) => id)
)
const missing = all.filter((id) => !recorded.has(id))

check(
  'every unrecorded prayer still has text to display',
  missing.length > 0 ? true : false,
  `${all.length - missing.length}/${all.length} recorded, ${missing.length} rely on the browser or the chant`
)

console.log('')
console.log(`unrecorded prayers (${missing.length}):`)
console.log('  ' + missing.join(', '))
console.log('')
console.log(fail ? `${fail} failures` : 'audio fallback chain intact')
process.exit(fail ? 1 : 0)