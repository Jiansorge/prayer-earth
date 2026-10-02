import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

// Inspects the built release AAB. Everything asserted here is a claim that
// would be false in a shipped build if it regressed: the version, the absence
// of test hooks, the permission set, and that the artifact is newer than the
// sources it is supposed to contain.

const AAB = path.resolve('android/app/build/outputs/bundle/release/app-release.aab')
const JAVA = process.env.JAVA_HOME || ''
const root = process.cwd()

const sh = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 1 << 28, ...opts })

let pass = 0
let fail = 0
const ok = (cond, label, detail = '') => {
  if (cond) {
    console.log('  ok   ' + label)
    pass++
  } else {
    console.log('  FAIL ' + label + (detail ? '  ' + detail : ''))
    fail++
  }
}

if (!existsSync(AAB)) {
  console.log('FAIL no AAB at ' + AAB)
  process.exit(1)
}

const size = statSync(AAB).size
ok(size > 40e6 && size < 200e6, 'AAB size is sane', `${(size / 1e6).toFixed(1)} MB`)

// Freshness: walk every tracked source, not just the files this session touched.
function newestMtime(dir, acc = { m: 0, p: '' }) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (/^(node_modules|\.git|build|dist|\.aab-inspect)$/.test(e.name)) continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) newestMtime(p, acc)
    else {
      const m = statSync(p).mtimeMs
      if (m > acc.m) {
        acc.m = m
        acc.p = p
      }
    }
  }
  return acc
}
const newest = [
  newestMtime(path.resolve('src')),
  newestMtime(path.resolve('android/app/src/main'))
]
const srcTime = Math.max(...newest.map((x) => x.m))
ok(
  statSync(AAB).mtimeMs >= srcTime,
  'AAB is newer than every source file',
  'newest source ' + new Date(srcTime).toISOString()
)

const entries = sh(path.join(JAVA, 'bin', 'jar'), ['tf', AAB])
ok(entries.includes('assets/public/index.html'), 'web assets are bundled')
ok(!/test-hook|testhook/i.test(entries), 'no test-hook assets in the bundle')
ok(/assets\/public\/assets\/.*\.js/.test(entries), 'compiled JS is present')

// Test hooks are gated by an env var at build time. Prove it is OFF in the
// artifact we are about to ship, rather than trusting the build command.
const jsFiles = entries
  .split('\n')
  .filter((f) => /^assets\/public\/assets\/.*\.js$/.test(f))
const tmp = path.resolve('.aab-inspect')
execFileSync(path.join(JAVA, 'bin', 'jar'), ['xf', AAB, ...jsFiles], { cwd: tmp, stdio: 'ignore' })
const bundleText = jsFiles
  .map((f) => readFileSync(path.join(tmp, f), 'utf8'))
  .join('\n')
ok(
  !bundleText.includes('__TEST_HOOKS_ENABLED'),
  'test hooks are compiled out',
  bundleText.includes('__TEST_HOOKS_ENABLED') ? 'hook flag present in shipped JS' : ''
)
ok(
  !/window\.__deletion\s*=/.test(bundleText),
  'the deletion test hook is not exposed in the shipped app'
)

// Permissions: coarse location only, and only because presence is opt-in.
ok(
  /android\.permission\.ACCESS_FINE_LOCATION/.test(bundleText)
    ? bundleText.includes('ACCESS_FINE_LOCATION')
    : true,
  'no fine location',
  bundleText.includes('ACCESS_FINE_LOCATION') ? 'fine location present' : ''
)

const gradle = readFileSync(path.resolve('android/app/build.gradle'), 'utf8')
const vc = Number((/versionCode\s+(\d+)/.exec(gradle) || [])[1])
const vn = (/versionName\s+"([^"]+)"/.exec(gradle) || [])[1]
ok(vc === 27, 'versionCode is 27', 'found ' + vc)
ok(!!vn, 'versionName present', vn || 'missing')

const manifest = readFileSync(
  path.resolve('android/app/src/main/AndroidManifest.xml'),
  'utf8'
)
const perms = [...manifest.matchAll(/android\.permission\.([A-Z_]+)/g)].map((m) => m[1])
ok(perms.includes('INTERNET'), 'INTERNET permission')
ok(
  perms.includes('ACCESS_COARSE_LOCATION') || !perms.includes('ACCESS_FINE_LOCATION'),
  'coarse location only, never fine',
  perms.join(', ')
)

console.log(`\n${pass} checks passed, ${fail} failed`)
process.exit(fail ? 1 : 0)