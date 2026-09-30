// The Play release build.
//
// This is deliberately SEPARATE from `build:capacitor`, which keeps the test
// hooks ON so the on-device smoke test can drive the app. That split is a real
// footgun: the two produce byte-identical pipelines except for the hook flag, so
// shipping the wrong one would put window.__store -- a full read/write handle
// on the user's prayer data and anonymous id -- into the public app. The old
// `?peTest=1` gate shipped in production for exactly this class of reason.
//
// So this script does not trust anyone to remember: it forces the flag off in
// the process environment (which Vite gives precedence over .env files), builds,
// and then treats the hook audit as a hard gate. A release that contains a test
// hook cannot be produced by this script.

import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const run = (args, env = {}) =>
  spawnSync(process.execPath, args, { cwd: ROOT, stdio: 'inherit', env: { ...process.env, ...env } })

const banner = (msg) => console.log(`\n[release] ${msg}`)

banner('building the PUBLIC bundle (test hooks forced OFF)')
// Vite gives real environment variables precedence over .env files, so this
// overrides the VITE_TEST_HOOKS=true in .env.capacitor that the device smoke
// test relies on.
const hooks = process.env.VITE_TEST_HOOKS
process.env.VITE_TEST_HOOKS = 'false'
console.log(`[release] VITE_TEST_HOOKS: ${hooks ?? '(unset)'} -> false`)

if (run([path.join(ROOT, 'scripts', 'build-legal.mjs')]).status !== 0) process.exit(1)
if (run([path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js'), 'build', '--mode', 'capacitor']).status !== 0) {
  process.exit(1)
}
if (run([path.join(ROOT, 'scripts', 'inline-css.mjs')]).status !== 0) process.exit(1)

banner('auditing the built bundle (a test hook here is a hard failure)')
if (run([path.join(ROOT, 'scripts', 'audit-build.mjs')]).status !== 0) {
  console.error('\n[release] REFUSING TO PRODUCE A RELEASE: the bundle failed the build audit.')
  console.error('[release] Fix the failing check, or use `npm run build:capacitor` for local/device builds.')
  process.exit(1)
}

banner('OK - hook-free bundle in dist/. Next:')
console.log('  npx cap sync android')
console.log('  gradlew -p android bundleRelease')
console.log('  upload android/app/build/outputs/bundle/release/app-release.aab to Play')
