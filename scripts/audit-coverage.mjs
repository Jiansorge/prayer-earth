// Which of the things shipped since the last Play release have a test that
// would fail without them?
//
// The point is not to count tests. It is to name every behaviour we shipped,
// name the test that pins it, and fail loudly on anything unpinned - because
// "deletion has never worked on Android" shipped through a fully green suite
// three times over.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// fileURLToPath, not import.meta.url.pathname: the latter yields "/C:/Users/..."
// with percent-encoding intact, which resolves to nothing.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ENG = path.resolve(ROOT, '..', 'sync-engine')

const read = (...p) => fs.readFileSync(path.join(...p), 'utf8')

// [behaviour, file that must mention it, pattern that must match, why it matters]
const ROWS = [
  // --- client: deletion ---
  ['client: delete request targets HTTP(S), never ws/wss',
    'scripts/test-units.mjs', /a wss:\/\/ base is rewritten to https/,
    'the app posted to wss:// and never deleted anything on Android'],
  ['client: the deletion request URL scheme',
    'scripts/test-backup.mjs', /never sent to a WebSocket URL/,
    'same bug, observable at runtime'],
  ['client: deletion never wipes on a refusal',
    'scripts/test-backup.mjs', /not_found|leaves the device data intact|nothing deleted/i,
    'wiping local data on an unconfirmed delete loses the user everything'],
  ['client: offline is not reported as success',
    'scripts/test-backup.mjs', /offline/i,
    'a false success here is the worst outcome in the whole feature'],
  ['client: an offline user can still erase this device',
    'scripts/test-backup.mjs', /erased explicitly while still offline|device only/i,
    'otherwise offline users have no route at all'],
  ['client: a device with no stored token mints one and retries',
    'scripts/test-android-device.mjs', /gets one minted for the attempt/,
    'pre-feature installs had no token and silently did nothing'],
  ['client: a device that never synced reports local_only',
    'scripts/test-android-device.mjs', /never synced/i,
    'otherwise the button reports not_found for an empty account'],
  ['client: local wipe only after server confirmation',
    'src/shared/deletion.js', /forgetIdentity/,
    'forgetIdentity must not be reachable pre-confirmation'],

  // --- server: deletion ---
  ['server: wrong token refused, record intact',
    'test/worker.test.js', /refuses a wrong token/,
    'anyone who saw a recovery code could destroy a stranger history'],
  ['server: unknown id indistinguishable from a wrong token',
    'test/worker.test.js', /so ids cannot be probed/,
    'otherwise the endpoint probes which anonymous ids exist'],
  ['server: the record AND the anonSeen entry are erased',
    'test/worker.test.js', /anonSeen entry from storage/,
    'leaving anonSeen means the identity is still written on disk'],
  ['server: deleting one person does not lower the world total',
    'test/worker.test.js', /does not lower the worldwide total/,
    'the aggregate is not attributable to anyone'],
  ['server: malformed bodies rejected without touching anything',
    'test/worker.test.js', /rejects malformed bodies/,
    'a crash on the destructive path'],
  ['server: delete is rate limited',
    'test/worker.test.js', /rate-limits a flood of delete/,
    'irreversible endpoint, tightest budget in the codebase'],
  ['server: the first token wins across syncs',
    'test/worker.test.js', /keeps the first token/,
    'a replayed sync could otherwise take over deletion'],

  // --- tombstones ---
  ['server: a deleted identity is not resurrected by a stale sync',
    'test/deletion-ordering.test.js', /stale sync lands afterwards/,
    'the user is told it is gone and it comes back'],
  ['server: a device offline at delete time cannot resurrect it',
    'test/deletion-ordering.test.js', /offline at delete time cannot resurrect/,
    'the real multi-device case: no socket existed to be closed'],
  ['server: the legitimate owner is reissued, not dropped',
    'test/deletion-ordering.test.js', /reissued a fresh identity rather than being/,
    'dropping their prayers would be its own data loss'],
  ['server: a wrong token is refused, not silently written',
    'test/deletion-ordering.test.js', /refused outright|without the deleting token/,
    'a silent success would let them think their history is safe'],
  ['server: the tombstone stores a hash, never the token',
    'test/deletion-ordering.test.js', /not\.toBe\('tok-2d'\)|hash, never the token/,
    'a tombstone holding a token could authorise a deletion'],

  // --- presence privacy ---
  ['server: withdrawal retracts an already-broadcast name',
    'test/worker.test.js', /retracts a withdrawn name/,
    'consent withdrawal that only affects future frames'],
  ['server: deletion withdraws the live session immediately',
    'test/worker.test.js', /withdraws a deleted person from the live world/,
    'a deleted person visible for up to 60s'],
  ['server: deleting one person leaves other people alone',
    'test/worker.test.js', /leaves other people in the world alone/,
    'a withdrawal that takes bystanders with it'],
  ['server: a deleted person leaves the state broadcast',
    'test/worker.test.js', /out of the state broadcast/,
    'the globe keeps showing a stranger prayer'],
  ['client: presence is off by default',
    'scripts/test-backup.mjs', /presence is OFF by default/,
    'publishing a location without consent'],
  ['client: no location resolved while sharing is off',
    'scripts/test-backup.mjs', /not resolved while presence is off/,
    'the permission prompt itself is the leak'],
  ['client: withdrawal clears the resolved position',
    'scripts/test-backup.mjs', /withdrawing presence clears/,
    'a marker left on screen after opt-out'],
  ['client: opting out leaves everyone elses lights intact',
    'scripts/test-backup.mjs', /opting out leaves the world/,
    'withdrawal must not take the whole world down'],
  ['client: a late geolocation fix is discarded after opt-out',
    'scripts/test-backup.mjs', /arriving after withdrawal is discarded/,
    'the permission dialog can sit open for minutes'],

  // --- the Android shell, found by device testing ---
  ['app shell: real, allow-listable origin (androidScheme https)',
    'scripts/test-units.mjs', /androidScheme/,
    'capacitor:// is opaque, so the device sent Origin: null and was refused'],
  ['server: admits the app shell origin',
    'test/deletion-ordering.test.js', /admits the WebSocket upgrade from the app shell/,
    'the app could not open its own socket'],
  ['server: refuses Origin:null permanently',
    'test/deletion-ordering.test.js', /REFUSES the opaque origin/,
    'allowing it would let any site hijack the engine'],
  ['server: refuses other opaque schemes',
    'test/deletion-ordering.test.js', /still refuses other opaque schemes/,
    'file:// and capacitor:// are equally unsafe'],
  ['server: the preflight is answered',
    'test/deletion-ordering.test.js', /answers the preflight/,
    'without it the browser never issues the real request'],
  ['server: CORS headers on EVERY delete outcome',
    'test/deletion-ordering.test.js', /EVERY delete outcome/,
    'a missing header on one branch reads as an outage'],
  ['server: no CORS header for an unrecognised origin',
    'test/deletion-ordering.test.js', /no CORS header to an origin/,
    'the default deny must stay a deny'],
  ['server: the real allow-list is what tests bind',
    'vitest.config.js', /wrangler\.toml/,
    'tests once pinned ALLOWED_ORIGINS to a value production never uses'],
  ['server: the bound allow-list admits the app shell',
    'test/deletion-ordering.test.js', /actually receives admits the app shell/,
    'the deployment itself must contain the entry'],

  // --- app rendering ---
  ['no-WebGL globe caps its dots like the WebGL pool',
    'scripts/test-units.mjs', /fallback cap matches the WebGL sprite pool/,
    'thousands of DOM nodes on the weakest hardware'],
  ['ambient fade cannot jump',
    'scripts/test-units.mjs', /click risk/,
    'an audible click on stop'],

  // --- release artefact ---
  ['release AAB carries no test hooks',
    'scripts/audit-aab.mjs', /test hooks are compiled out/,
    'a read/write handle on user data in the public app'],
  ['release AAB ships the current web build',
    'scripts/audit-aab.mjs', /matches the current web build/,
    'uploading a stale artifact'],
  ['release AAB permissions',
    'scripts/audit-aab.mjs', /coarse location only/,
    'fine location would contradict the opt-in claim'],
  ['feature graphic lattice nodes stay on the lattice',
    'scripts/audit-graphic.mjs', /collapsed to a single digit/,
    'a destructuring bug shipped a plausible-looking artifact'],
  ['resilience/commonwealth cannot reach a GitHub remote',
    'scripts/audit-repo-containment.mjs', /cannot reach either GitHub remote/,
    'the user asked for these to stay local']
]

const fileOf = (rel) => (rel.startsWith('test/') || rel.startsWith('vitest') ? path.join(ENG, rel) : path.join(ROOT, rel))

let missing = 0
let unpinned = 0
let checked = 0

const byArea = new Map()
for (const [behaviour, file, pattern, why] of ROWS) {
  const area = behaviour.split(':')[0]
  if (!byArea.has(area)) byArea.set(area, [])
  byArea.get(area).push([behaviour, file, pattern, why])

  let src = null
  const abs = fileOf(file)
  try {
    src = read(abs)
  } catch {
    console.log('  MISSING FILE  ' + file)
    missing++
    continue
  }
  if (!pattern.test(src)) {
    console.log('  UNPINNED      ' + behaviour)
    console.log('               expected ' + pattern + ' in ' + file)
    unpinned++
  }
  checked++
}

console.log('')
for (const [area, rows] of byArea) {
  console.log('  ' + area.padEnd(8) + rows.length + ' behaviours')
}
console.log('')
console.log(`${checked} behaviours checked, ${unpinned} unpinned, ${missing} missing files`)
process.exit(unpinned || missing ? 1 : 0)