// Is the web app packaged into the Android project the same web app we built?
//
// `npx cap sync android` is the only thing that copies dist/ into
// android/app/src/main/assets/public/, and Gradle does not know that step exists.
// Skip it and `gradlew assembleDebug` reports BUILD SUCCESSFUL while packaging
// whatever copy happens to be sitting in the assets directory. That is not
// hypothetical: the build said success while shipping web assets two days older
// than the source, and every other signal agreed with it - the merged manifest
// was right, the app installed, it launched. The staleness was only visible by
// opening the APK and looking at a chunk hash.
//
// Nothing downstream can catch this. Gradle has no idea the web build moved
// underneath it, and an APK that is internally perfect can still be last week's
// app. So this compares the two trees by content rather than by timestamp, and
// refuses rather than reporting.
//
// Content, not mtime: a checkout, a restore, or a copied file with a preserved
// timestamp all make timestamps lie, and this gate exists precisely for the case
// where the usual assumption stopped holding.

import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIST = path.join(ROOT, 'dist')
const PACKAGED = path.join(ROOT, 'android', 'app', 'src', 'main', 'assets', 'public')

// Capacitor writes its own bridge scripts into the packaged copy. They are not
// in dist and they are not evidence of a stale sync, so they are not compared.
const CAPACITOR_INJECTED = new Set(['cordova.js', 'cordova_plugins.js'])

const listFiles = (root, dir = root, acc = []) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) listFiles(root, full, acc)
    else acc.push(path.relative(root, full).split(path.sep).join('/'))
  }
  return acc
}

const digest = (file) => createHash('sha256').update(readFileSync(file)).digest('hex')

// The two trees must be the same build: every file in dist present in the
// package with the same bytes, and nothing in the package that dist does not
// have (other than Capacitor's own injected scripts). Checking only the entry
// HTML is not enough - it is the one file that can be identical between two
// different builds, and a stale package that happens to match on it still ships
// the old JavaScript.
export function compareWebAssets() {
  if (!existsSync(DIST)) {
    return { ok: false, reason: `dist/ does not exist - build the web app first: npm run build` }
  }
  if (!existsSync(PACKAGED)) {
    return { ok: false, reason: `no packaged web assets at ${path.relative(ROOT, PACKAGED)} - run npx cap sync android` }
  }

  const built = new Set(listFiles(DIST))
  const packaged = new Set(listFiles(PACKAGED))
  const packagedOnly = [...packaged].filter((f) => !built.has(f) && !CAPACITOR_INJECTED.has(f))

  const missing = []
  const differing = []
  for (const file of built) {
    if (!packaged.has(file)) {
      missing.push(file)
      continue
    }
    if (digest(path.join(DIST, file)) !== digest(path.join(PACKAGED, file))) differing.push(file)
  }

  // Report what a person would act on. The entry chunk and index.html name the
  // build far better than a count of 200 stale lazy chunks does.
  const head = (files) => {
    const interesting = files.filter((f) => /^index\.html$|^sw\.js$|^assets\/[^/]+\.js$/.test(f))
    return (interesting.length ? interesting : files).slice(0, 4).join(', ')
  }

  if (missing.length || differing.length || packagedOnly.length) {
    const parts = []
    if (missing.length) parts.push(`${missing.length} file(s) in dist but not packaged (e.g. ${head(missing)})`)
    if (differing.length) parts.push(`${differing.length} packaged file(s) differ from dist (e.g. ${head(differing)})`)
    if (packagedOnly.length) parts.push(`${packagedOnly.length} packaged file(s) not in dist (e.g. ${head(packagedOnly)})`)
    return {
      ok: false,
      reason:
        `the Android project is packaging a different web build than dist/:\n        ` +
        parts.join('\n        ') +
        `\n        Gradle cannot see this - it will report BUILD SUCCESSFUL and ship the old app.` +
        `\n        Fix: npm run build:release && npx cap sync android`
    }
  }
  return { ok: true, files: built.size }
}

// Run directly: exit code is the gate (Gradle and CI call this).
if (process.argv[1] && process.argv[1].endsWith('check-android-sync.mjs')) {
  const result = compareWebAssets()
  if (result.ok) {
    console.log(`[android-sync] PASS  packaged web assets match dist/ (${result.files} files)`)
  } else {
    console.log(`[android-sync] FAIL  ${result.reason}`)
    process.exit(1)
  }
}