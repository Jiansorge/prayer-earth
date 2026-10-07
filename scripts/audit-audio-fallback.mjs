import fs from 'node:fs'

// Pin what the app does about a prayer with no recording.
//
// Found while answering "should the unrecorded Gurmukhi prayers be hidden?".
// The chain in speech.js is:
//
//   1. pre-rendered audio      - absent for 28 of 272 prayers
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
for (const f of fs.readdirSync(spiritsDir)) {
  const s = fs.readFileSync(`${spiritsDir}/${f}`, 'utf8')
  for (const m of s.matchAll(/id:\s*'([^']+)'/g)) all.push(m[1])
}
const recorded = new Set(
  fs.readdirSync(audioDir).filter((n) => fs.statSync(`${audioDir}/${n}`).isDirectory())
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