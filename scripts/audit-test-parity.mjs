// Do the local suite and CI run the same checks?
//
// The failure this exists to prevent already happened. `npm test` covered the
// server, units and edge cases; CI ran those plus eight audits and four browser
// tests. "npm test passed" was therefore not evidence about the fragile parts of
// the app, and the browser tests - the ones that found the ReferenceError, the
// WebGL context leak and the unreachable prayer scroller - were being written
// without any way to run them locally at all.
//
// The fix was `npm run test:all`, but its list is hand-kept in step with the
// workflow by a comment and good intentions. Comments do not fail. This compares
// the two lists for real: a step added to one and not the other is a check that
// only ever runs on one machine, which is how CI ended up red on a thing nobody
// ran locally, and green on a thing nobody ran in CI.
//
// Usage: node scripts/audit-test-parity.mjs
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const yaml = (await import('yaml')).default

const workflow = yaml.parse(
  readFileSync(path.join(ROOT, '.github', 'workflows', 'test.yml'), 'utf8')
)
const all = readFileSync(path.join(ROOT, 'scripts', 'test-all.mjs'), 'utf8')

// Every `node scripts/<x>.mjs` CI runs, across all jobs - some checks live in
// the `usage` job because they need the live sync server, not because they are
// a different kind of check. The secrets-gated ones are excluded: they cannot
// run without a PAT, so requiring them locally would be a step that always
// fails for the wrong reason.
const SECRET_GATED = /test-usage/
const ciSteps = Object.values(workflow.jobs || {})
  .flatMap((job) => job.steps || [])
  .map((s) => s.run || '')
  .filter((r) => /node scripts\/[\w.-]+\.mjs/.test(r))
  .map((r) => r.match(/node (scripts\/[\w.-]+\.mjs)/)[1])
  .filter((p) => !SECRET_GATED.test(p) && !/test-android/.test(p))

// The same list, as declared in test-all.mjs.
const block = all.match(/const STEPS = \[([\s\S]*?)\]/)
if (!block) {
  console.error('audit-test-parity: could not find the STEPS list in test-all.mjs')
  process.exit(1)
}
const localSteps = [...block[1].matchAll(/'(scripts\/[\w.-]+\.mjs)'/g)].map((m) => m[1])

const missingLocally = ciSteps.filter((s) => !localSteps.includes(s))
const missingInCI = localSteps.filter((s) => !ciSteps.includes(s))

if (!missingLocally.length && !missingInCI.length) {
  console.log(`[parity] CI and npm run test:all run the same ${ciSteps.length} checks`)
  process.exit(0)
}

if (missingLocally.length) {
  console.error(
    `[parity] CI runs these but npm run test:all does not:\n        ${missingLocally.join('\n        ')}`
  )
  console.error('        Add them to STEPS in scripts/test-all.mjs.')
}
if (missingInCI.length) {
  console.error(
    `[parity] npm run test:all runs these but CI does not:\n        ${missingInCI.join('\n        ')}`
  )
  console.error('        Add them to the test job in .github/workflows/test.yml.')
}
console.error('')
console.error(`${missingLocally.length + missingInCI.length} check(s) only run in one place.`)
process.exit(1)