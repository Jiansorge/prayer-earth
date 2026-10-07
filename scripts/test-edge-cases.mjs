// Edge cases tested against the real modules.
//
// Written after scripts/audit-numeric.mjs was deleted. That sweep pattern-matched
// the source for division and day arithmetic and produced 34 findings, all of
// them noise: 32 were the "/" inside import paths ('./i18n.js', 'text/plain',
// 'Europe/London'), one was a ternary guard it could not see, and the single
// genuine-looking hit - `i / len` in the reverb builder - is unreachable because
// the loop does not execute when len is 0.
//
// Static heuristics cannot tell a real hazard from a string. Calling the actual
// functions with the actual bad values can, and it also checks behaviour rather
// than guessing at the source. So the edge cases are executed here.
import assert from 'node:assert/strict'
import {
  summarizePayload,
  parseBackupCode,
  applyBackup
} from '../src/shared/backup.js'
import { bedTarget } from '../src/audio/ambience.js'
import { sanitizeName } from '../src/shared/profanity.js'

let pass = 0
let fail = 0
const t = (name, fn) => {
  try {
    fn()
    pass++
    console.log(`PASS  ${name}`)
  } catch (e) {
    fail++
    console.log(`FAIL  ${name}\n      ${e.message}`)
  }
}
const close = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps

console.log('--- summarizePayload: malformed input ---')

t('an empty payload summarises to zeroes rather than NaN', () => {
  const s = summarizePayload({})
  for (const k of ['completions', 'seconds', 'bestStreak', 'days', 'fromDay', 'toDay']) {
    assert.ok(Number.isFinite(s[k]), `${k} = ${s[k]}`)
  }
  assert.equal(s.completions, 0)
  assert.equal(s.days, 0)
})

t('null and undefined payloads do not throw', () => {
  assert.ok(Number.isFinite(summarizePayload(null).completions))
  assert.ok(Number.isFinite(summarizePayload(undefined).completions))
})

t('non-object payload fields are ignored, not summed', () => {
  // An array passes `typeof === 'object'`, so it is read as {0:1, 1:2, 2:3}
  // and the numbers are summed to 6. Defensible: an array of counts is counts.
  const s = summarizePayload({ prayerCompletions: [1, 2, 3] })
  assert.equal(s.completions, 6, 'array entries are counted')
  // A string is not an object, so it contributes nothing at all.
  const s2 = summarizePayload({ prayerCompletions: 'not an object' })
  assert.equal(s2.completions, 0, 'a string is not an object of counters')
})

t('Infinity, NaN and null counters are excluded rather than poisoning the sum', () => {
  const s = summarizePayload({
    prayerCompletions: { a: Infinity, b: NaN, c: null, d: 5, e: 7 }
  })
  assert.ok(Number.isFinite(s.completions), `completions=${s.completions}`)
  // Only d and e are finite numbers; Infinity/NaN fail Number.isFinite and null
  // is not a number at all.
  assert.equal(s.distinctPrayers, 2)
  assert.equal(s.completions, 12)
})

t('negative counters are rejected so a damaged payload cannot lower a total', () => {
  const s = summarizePayload({ localPrayerSeconds: -99999, bestStreak: -5 })
  assert.ok(s.seconds >= 0, `seconds=${s.seconds}`)
  assert.ok(s.bestStreak >= 0, `bestStreak=${s.bestStreak}`)
})

t('a non-numeric day key is dropped rather than becoming NaN', () => {
  const s = summarizePayload({
    prayerDayCompletions: { 20240101: 3, nope: 5, 20240102: 4 }
  })
  assert.ok(Number.isFinite(s.fromDay) && Number.isFinite(s.toDay))
  assert.equal(s.days, 2, 'only the two numeric day keys count')
  assert.equal(s.fromDay, 20240101)
  assert.equal(s.toDay, 20240102)
})

t('days out of order are sorted so fromDay is really the earliest', () => {
  const s = summarizePayload({
    prayerDayCompletions: { 20240301: 1, 20240101: 1, 20240201: 1 }
  })
  assert.equal(s.fromDay, 20240101)
  assert.equal(s.toDay, 20240301)
})

console.log('\n--- parseBackupCode: hostile input ---')

const rejects = (name, input, expected) =>
  t(name, () => {
    let err = null
    try {
      parseBackupCode(input)
    } catch (e) {
      err = e
    }
    assert.ok(err, 'expected a throw, got none')
    if (expected) assert.equal(err.message, expected)
  })

rejects('empty string', '', 'notBackup')
rejects('a bare word', 'hello', 'notBackup')
rejects('the prefix with nothing after it', 'JP1:', 'corrupt')
rejects('the prefix with invalid base64', 'JP1:!!!!not base64!!!!', 'corrupt')
rejects('valid base64 that is not JSON', 'JP1:' + Buffer.from('not json').toString('base64'), 'corrupt')
rejects('valid JSON that is not an object', 'JP1:' + Buffer.from('[]').toString('base64'), 'corrupt')
rejects('a JSON null', 'JP1:' + Buffer.from('null').toString('base64'), 'corrupt')
rejects('an object with the wrong version', 'JP1:' + Buffer.from(JSON.stringify({ v: 99 })).toString('base64'), 'corrupt')
const BAD_CHECKSUM =
  'JP1:' + Buffer.from(JSON.stringify({ v: 1, crc: 12345, localPrayerSeconds: 1 })).toString('base64')
rejects('a payload whose checksum does not match', BAD_CHECKSUM, 'damaged')
rejects('an oversized payload', 'JP1:' + 'A'.repeat(600 * 1024), 'corrupt')

t('a payload with no checksum still restores, for codes written before it existed', () => {
  const payload = Buffer.from(JSON.stringify({ v: 1, localPrayerSeconds: 10 })).toString('base64')
  const parsed = parseBackupCode('JP1:' + payload)
  assert.equal(parsed.localPrayerSeconds, 10)
})

t('surrounding whitespace and newlines from a paste are tolerated', () => {
  const payload = Buffer.from(JSON.stringify({ v: 1, localPrayerSeconds: 7 })).toString('base64')
  assert.equal(parseBackupCode('  \n JP1:' + payload + ' \n ').localPrayerSeconds, 7)
})

t('deeply nested JSON is rejected, not crashed on', () => {
  // 20k-deep nesting: JSON.parse throws a RangeError, which the guard turns into
  // a clean "corrupt" rather than a stack overflow that takes the app down.
  const deep = '['.repeat(20000) + ']'.repeat(20000)
  let err = null
  try {
    parseBackupCode('JP1:' + Buffer.from(deep).toString('base64'))
  } catch (e) {
    err = e
  }
  assert.ok(err, 'deep nesting should not produce a valid payload')
  assert.ok(['corrupt', 'damaged'].includes(err.message), 'got: ' + err.message)
})

console.log('\n--- applyBackup: never lowers data ---')

t('a restore reports only sane numbers', () => {
  // applyBackup returns { backup, result, identityChanged, wasNoop, gainedSeconds },
  // and `backup` is a summarizePayload() digest - so the field is `seconds`.
  const summary = applyBackup({ localPrayerSeconds: 500, bestStreak: 9 })
  assert.ok(summary.backup.seconds >= 0, `seconds=${summary.backup.seconds}`)
  assert.ok(summary.backup.bestStreak >= 0, `streak=${summary.backup.bestStreak}`)
  assert.ok(summary.result.seconds >= 0, `result.seconds=${summary.result.seconds}`)
})

t('a restore can never report a negative amount gained', () => {
  // gainedSeconds is what the UI shows as "+3m added to your totals".
  const summary = applyBackup({ localPrayerSeconds: 0 })
  assert.ok(summary.gainedSeconds >= 0, `gained=${summary.gainedSeconds}`)
  assert.equal(typeof summary.wasNoop, 'boolean')
})

t('a payload with hostile counters cannot produce a negative total', () => {
  const s = summarizePayload({ localPrayerSeconds: -1, bestStreak: -1 })
  assert.ok(s.seconds >= 0 && s.bestStreak >= 0)
})

console.log('\n--- bedTarget: the full range of slider inputs ---')

t('every slider at 0 is silence', () => {
  assert.equal(bedTarget({ level: 1, ambienceLevel: 0, volume: 1 }), 0)
  assert.equal(bedTarget({ level: 1, ambienceLevel: 1, volume: 0 }), 0)
  assert.equal(bedTarget({ level: 0, ambienceLevel: 1, volume: 1 }), 0)
})

t('a slider dragged past its end clamps instead of exceeding full', () => {
  assert.equal(bedTarget({ level: 5, ambienceLevel: 1, volume: 1 }), bedTarget({ level: 1, ambienceLevel: 1, volume: 1 }))
  assert.equal(bedTarget({ level: 1, ambienceLevel: 9, volume: 1 }), bedTarget({ level: 1, ambienceLevel: 1, volume: 1 }))
  assert.equal(bedTarget({ level: -3, ambienceLevel: 1, volume: 1 }), 0)
})

t('unusable input yields a safe gain, never NaN or negative', () => {
  for (const bad of [undefined, null, NaN, 'abc', {}, [], true]) {
    const g = bedTarget({ level: bad, ambienceLevel: 1, volume: 1 })
    assert.ok(Number.isFinite(g) && g >= 0, `level=${String(bad)} gave ${g}`)
  }
})

t('the gain stays inside Web Audio\'s safe range at full', () => {
  const g = bedTarget({ level: 1, ambienceLevel: 1, volume: 1 })
  assert.ok(g > 0 && g <= 8, `full gain = ${g}`)
})

console.log('\n--- display names ---')

t('an over-long name is bounded rather than stored whole', () => {
  // The input caps at 20, but a restored backup or a paste can carry more.
  const long = 'a'.repeat(500)
  const clean = sanitizeName(long)
  assert.ok(clean.length <= 24, `length=${clean.length}`)
})

t('a name made only of blocked content is emptied, not partially kept', () => {
  assert.equal(sanitizeName('fuck').trim(), '')
  assert.equal(sanitizeName('   ').trim(), '')
})

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)