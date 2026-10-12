// Every check CI runs, in one command.
//
// `npm test` is the server, usage, backup, units and edge cases. It does not run
// the browser tests, and the browser tests are the ones that have found real
// defects: the WebGL context leak, the ReferenceError that broke every spoken
// prayer, a prayer scroller no keyboard could reach, a loading overlay that the
// test was racing rather than the app breaking. So "npm test passed" was never
// evidence about the fragile parts of the app, and it is the phrase that
// invites shipping something that CI is about to catch.
//
// This runs the same list, in the same order, that .github/workflows/test.yml
// runs on the app job. When this is green, CI has nothing new to say.
//
// Deliberately not included: the Android job (Gradle, needs a JDK and takes
// minutes), the device job (needs a connected phone), and the PAT-gated checks.
// Those stay in CI, where the hardware is.
//
// Usage: node scripts/test-all.mjs
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// dist-store/ is gitignored, so the Play CSV exists on a developer machine and
// does not exist in a clean CI checkout. Auditing it here without generating it
// first is how this suite says green while the same check is red on every push.
// Generate before the audit runs, exactly as the workflow now does.
const gen = spawnSync(process.execPath, ['scripts/build-play-translations.mjs'], {
  cwd: ROOT,
  encoding: 'utf8'
})
if (gen.status !== 0) {
  console.error('test-all: could not generate the Play listing CSV')
  process.exit(1)
}

// Kept in step with the `app:` job in .github/workflows/test.yml. A step added
// to one and not the other is a step that only ever runs on one machine.
const STEPS = [
  'scripts/audit-build.mjs',
  'scripts/test-server.mjs',
  'scripts/test-units.mjs',
  'scripts/test-edge-cases.mjs',
  'scripts/audit-i18n.mjs',
  'scripts/audit-i18n-dupes.mjs',
  'scripts/audit-i18n-scripts.mjs',
  'scripts/audit-i18n-deep.mjs',
  'scripts/audit-i18n-quality.mjs',
  'scripts/audit-i18n-pass2.mjs',
  'scripts/audit-i18n-stale.mjs',
  'scripts/audit-prayers.mjs',
  'scripts/audit-prayer-l10n.mjs',
  'scripts/audit-audio-fallback.mjs',
  'scripts/audit-play-translations.mjs',
  'scripts/test-resource-lifecycle.mjs',
  'scripts/test-audio-fallback-runtime.mjs',
  'scripts/test-a11y.mjs',
  'scripts/test-settings-ui.mjs',
  'scripts/audit-counts.mjs',
  'scripts/test-canonical-urls.mjs',
  'scripts/test-backup.mjs',
  'scripts/audit-test-parity.mjs'
]

// Every browser test starts its own dev server. Running them concurrently has
// them fight over the same ports, and a port collision shows up as a timeout
// that looks like a product failure. Serial, and the runtime is honest about it.
const results = []
const started = Date.now()
for (const step of STEPS) {
  const r = spawnSync(process.execPath, [step], { cwd: ROOT, encoding: 'utf8' })
  const out = `${r.stdout || ''}${r.stderr || ''}`
  const lines = out.split('\n').filter((l) => l.trim())
  results.push({
    step,
    code: r.status === null ? 1 : r.status,
    tail: (lines[lines.length - 1] || '').trim(),
    failures: out.split('\n').filter((l) => l.startsWith('FAIL'))
  })
}

const secs = ((Date.now() - started) / 1000).toFixed(0)
for (const r of results) {
  const mark = r.code === 0 ? 'pass' : 'FAIL'
  console.log(`${mark}  ${r.step.padEnd(42)} ${r.tail}`)
  if (r.code !== 0) r.failures.forEach((f) => console.log(`        ${f.trim()}`))
}

const failed = results.filter((r) => r.code !== 0)
console.log('')
console.log(`${results.length - failed.length}/${results.length} passed in ${secs}s`)
if (failed.length) {
  console.log(`failed: ${failed.map((f) => f.step).join(', ')}`)
  process.exit(1)
}