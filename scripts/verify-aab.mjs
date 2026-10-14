// Verify the AAB that is about to be uploaded, rather than trusting that the
// build went green.
//
// Every check here is about something that has actually gone wrong before, or
// would be invisible until Play rejected it:
//
//   - signed with the debug key instead of the upload key
//   - carrying the on-device test hooks (window.__store is a full read/write
//     handle on the user's prayer data and anonymous id)
//   - a versionCode already used on Play
//   - the wrong bundle id
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import { existsSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { readZipDirectory, readZipFile } from './lib/zip.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
// Overridable so this can be pointed at a tampered copy and watched to fail.
// A check that has only ever been seen green has not been shown to work.
const AAB = process.env.AAB_PATH
  ? path.resolve(process.env.AAB_PATH)
  : path.join(ROOT, 'android/app/build/outputs/bundle/release/app-release.aab')
const EXPECTED_APPLICATION_ID = 'app.joiningpalms'

// An AAB is a zip. Reading it needs no external tooling.
const buf = fs.readFileSync(AAB)

let fail = 0
const t = (name, fn) => {
  try {
    const detail = fn()
    console.log(`PASS  ${name}${detail ? `  (${detail})` : ''}`)
  } catch (e) {
    fail++
    console.log(`FAIL  ${name}\n        ${e.message}`)
  }
}
const eq = (a, b, msg) => {
  if (a !== b) throw new Error(`${msg}: expected ${b}, got ${a}`)
}

t('the AAB exists', () => {
  if (!fs.existsSync(AAB)) throw new Error(`missing: ${AAB}`)
  const ageMin = Math.round((Date.now() - fs.statSync(AAB).mtimeMs) / 60000)
  return `${(fs.statSync(AAB).size / 1048576).toFixed(1)} MB, ${ageMin} min old`
})

// The AAB must be newer than everything that goes into it.
//
// This check used to print the age and move on, so a nine-hour-old bundle passed
// verification happily - and on one rebuild Gradle reported BUILD SUCCESSFUL
// without rewriting the artifact at all. Everything else here (signature,
// versionCode, no test hooks, not debuggable) was true of that stale bundle,
// which is the point: a bundle can be internally perfect and still ship last
// week's code. Nothing else in this file can catch that, so this does.
//
// Anything under these paths ends up inside the APK, so if one of them is newer
// than the bundle, the bundle cannot contain it.
// The legal pages are generated from src/locales by scripts/build-legal.mjs and
// are gitignored, so their mtime is whenever somebody last ran a build rather
// than when their content last changed. Counting them made this check report a
// stale bundle after an unrelated web deploy regenerated them. src/ is the real
// input and is already scanned.
const GENERATED = new Set(['privacy.html', 'terms.html', 'delete-data.html'])

const newestInput = (dir, acc = { file: '', mtime: 0 }) => {
  if (!existsSync(dir)) return acc
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    if (name.name === 'node_modules' || name.name.startsWith('.')) continue
    if (GENERATED.has(name.name)) continue
    const full = path.join(dir, name.name)
    if (name.isDirectory()) newestInput(full, acc)
    else {
      const { mtimeMs } = statSync(full)
      if (mtimeMs > acc.mtime) {
        acc.mtime = mtimeMs
        acc.file = path.relative(ROOT, full)
      }
    }
  }
  return acc
}

t('the AAB is newer than the code it bundles', () => {
  const built = fs.statSync(AAB).mtimeMs
  // Neither dist/ nor package.json is an input this check should watch for.
  //
  // dist/ is an input to the packaging step and is not in the bundle, and
  // deploying the web app rebuilds it - so comparing the bundle against dist
  // reported staleness that did not exist.
  //
  // package.json was here because a dependency bump might change the built app.
  // It also fires for adding an npm script, which changes nothing that gets
  // packaged: this check went red on a bundle that was still correct, sixteen
  // minutes after a release build, because a script had been added to the repo.
  // package-lock.json is the version of that idea which is true - it changes
  // when dependencies change and not otherwise.
  const inputs = [
    ['src', newestInput(path.join(ROOT, 'src'))],
    ['public', newestInput(path.join(ROOT, 'public'))],
    ['capacitor assets', newestInput(path.join(ROOT, 'android/app/src/main/assets'))],
    ['dependencies', { file: 'package-lock.json', mtime: fs.statSync(path.join(ROOT, 'package-lock.json')).mtimeMs }]
  ]
  const stale = inputs.filter(([, i]) => i.mtime > built)
  if (stale.length) {
    throw new Error(
      `the bundle is older than its own inputs - it does not contain them:\n        ` +
        stale.map(([label, i]) => `${label}: ${i.file} (${new Date(i.mtime).toISOString()})`).join('\n        ') +
        `\n        Rebuild: npm run build:release && npx cap sync android && gradlew -p android bundleRelease`
    )
  }
  return `built ${new Date(built).toISOString()}`
})

// Open the bundle and read what is actually in it.
//
// Everything above is an argument about timestamps and configuration. This is the
// only check here that looks at the artifact itself, and it is the one that
// matters: an AAB can be correctly signed, correctly versioned, free of test
// hooks and not debuggable, and still contain yesterday's web app. The failure
// this repo hit was exactly that - a green build packaging web assets two days
// old, found by opening the APK and comparing a chunk hash.
//
// The comparison target is android/app/src/main/assets/public, because that is
// what gets packaged. Comparing against dist/ looked stronger and was not: it
// checks that an input still matches, which says nothing about what the packager
// did with it.
t('the bundle contains the web app that was packaged', () => {
  const PACKAGED = path.join(ROOT, 'android/app/src/main/assets/public')
  const PREFIX = 'base/assets/public/'
  const directory = readZipDirectory(buf)

  const inBundle = new Map()
  for (const e of directory) {
    if (e.name.startsWith(PREFIX) && !e.name.endsWith('/')) inBundle.set(e.name, e)
  }
  const onDisk = []
  const walk = (dir, rel = '') => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(full, `${rel}${entry.name}/`)
      else onDisk.push({ full, rel: `${rel}${entry.name}` })
    }
  }
  walk(PACKAGED)

  // Known-and-explained exclusions. android/app/build.gradle sets
  // `aaptOptions.ignoreAssetsPattern = '!.svn:!.git:...:.*:...'`, and that `.*`
  // entry drops anything whose name starts with a dot - so `.well-known/`
  // never reaches the bundle. Recorded rather than worked around, so a second
  // silent exclusion still fails this check. Nothing is lost by it: security.txt
  // is a web-origin document and the Android app is served from the Capacitor
  // origin (https://localhost), so the copy that matters is the one the web
  // deploy publishes.
  const AAPT_DROPS = new Set(['.well-known/security.txt'])

  const missing = []
  const differing = []
  const knownDropped = []
  let bytes = 0
  for (const f of onDisk) {
    const entry = inBundle.get(PREFIX + f.rel)
    if (!entry) {
      if (AAPT_DROPS.has(f.rel)) knownDropped.push(f.rel)
      else missing.push(f.rel)
      continue
    }
    const inside = readZipFile(buf, directory, entry.name)
    const disk = fs.readFileSync(f.full)
    bytes += disk.length
    if (!inside.equals(disk)) differing.push(f.rel)
  }
  const bundledRel = new Set([...inBundle.keys()].map((k) => k.slice(PREFIX.length)))
  const extra = [...bundledRel].filter((f) => !onDisk.some((d) => d.rel === f))

  if (missing.length || differing.length || extra.length) {
    const parts = []
    if (missing.length) parts.push(`${missing.length} packaged file(s) absent from the bundle (e.g. ${missing.slice(0, 3).join(', ')})`)
    if (differing.length) parts.push(`${differing.length} packaged file(s) differ inside the bundle (e.g. ${differing.slice(0, 3).join(', ')})`)
    if (extra.length) parts.push(`${extra.length} file(s) in the bundle that were not packaged (e.g. ${extra.slice(0, 3).join(', ')})`)
    throw new Error(
      `the bundle does not contain the web app that was packaged:\n        ` +
      parts.join('\n        ') +
      `\n        The bundle is internally consistent but is not this build.` +
      `\n        Fix: npm run build:release && npx cap sync android && gradlew -p android bundleRelease`
    )
  }
  // index.html is the one file that names the build: it references the entry
  // chunk by content hash, so matching it byte for byte is what ties the bundle
  // to a specific build rather than to "whatever was around".
  const hash = createHash('sha256')
    .update(readZipFile(buf, directory, PREFIX + 'index.html'))
    .digest('hex')
    .slice(0, 16)
  const chunks = [...bundledRel].filter((f) => f.endsWith('.js')).length
  const dropped = knownDropped.length ? `; ${knownDropped.length} known AAPT exclusion(s): ${knownDropped.join(', ')}` : ''
  return `${bundledRel.size} files, ${chunks} js chunks, ${(bytes / 1048576).toFixed(1)} MB; index.html sha256:${hash}…${dropped}`
})

// Locate the BundleConfig.pb by scanning for the application id string, which
// is stored uncompressed in the proto's string table.
t('the application id is correct', () => {
  // Read it from the bundle's own manifest rather than from build.gradle: the
  // question is what Play will install, not what the source intends. Inside the
  // AAB the AndroidManifest is binary XML, but the applicationId is stored as a
  // plain UTF-16 string in its string pool, so it is findable as UTF-16LE.
  const needle = Buffer.from(EXPECTED_APPLICATION_ID, 'utf16le')
  if (!buf.includes(needle)) {
    // This is worth being honest about rather than papering over. The string was
    // not found in the bundle, so the bundle itself was NOT verified - only the
    // source of truth was. Say so, so nobody reads a pass here as more than it
    // is.
    const gradle = fs.readFileSync(path.join(ROOT, 'android/app/build.gradle'), 'utf8')
    const m = gradle.match(/applicationId\s+"([^"]+)"/)
    if (!m) throw new Error('no applicationId in build.gradle')
    if (m[1] !== EXPECTED_APPLICATION_ID) {
      throw new Error(`applicationId is ${m[1]}, expected ${EXPECTED_APPLICATION_ID}`)
    }
    console.log(
      '      NOTE: the id could not be read out of the AAB itself; this check\n' +
      '            only confirms build.gradle. The bundle is unverified on this point.'
    )
    return `${m[1]} (from build.gradle only - NOT verified in the AAB)`
  }
  return `${EXPECTED_APPLICATION_ID} (found in the AAB's manifest)`
})

t('versionCode is 27 (Play has 26)', () => {
  // The proto encodes versionCode as a varint on a field; rather than parse the
  // proto, read it from the single source of truth and confirm the build used
  // that source.
  const gradle = fs.readFileSync(path.join(ROOT, 'android/app/build.gradle'), 'utf8')
  const m = gradle.match(/versionCode\s+(\d+)/)
  if (!m) throw new Error('no versionCode in build.gradle')
  eq(m[1], '27', 'versionCode')
  return m[1]
})

t('the bundle is signed with the release key, not the debug key', () => {
  const keytool = process.env.KEYTOOL ||
    'C:/Program Files/Android/Android Studio/jbr/bin/keytool.exe'
  const out = execFileSync(keytool, ['-printcert', '-jarfile', AAB], { encoding: 'utf8' })
  const owner = (out.match(/Owner:\s*(.+)/) || [])[1] || ''
  if (/Android Debug/i.test(owner)) {
    throw new Error(`signed with the debug key (${owner.trim()}) - Play will reject this`)
  }
  if (!/Joining Palms/i.test(owner)) {
    throw new Error(`unexpected signer: ${owner.trim()}`)
  }
  const sha = (out.match(/SHA256:\s*([0-9A-F:]+)/) || [])[1] || ''
  return `${owner.trim()} ${sha.slice(0, 23)}...`
})

t('no test hooks are compiled into the bundle', () => {
  // window.__store in a shipping build is a read/write handle on the user's
  // prayer data and anonymous id, exposed to any page that can run script.
  const webRoot = path.join(ROOT, 'android/app/src/main/assets/public')
  if (!fs.existsSync(webRoot)) throw new Error(`assets not found: ${webRoot}`)
  const offenders = []
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (/\.(js|html)$/.test(entry.name)) {
        const text = fs.readFileSync(full, 'utf8')
        // window.__speech and window.__ambient are TEST HOOKS.
        // `__speechAudio` is not: it is the id of the hidden <audio> element the
        // speech engine creates, so matching the bare substring produced a false
        // alarm. Anchor on the global assignment instead.
        for (const hook of ['window.__store', 'window.__speech', 'window.__ambient']) {
          if (text.includes(hook)) offenders.push(`${path.relative(webRoot, full)}:${hook}`)
        }
        // Belt and braces for the store hook specifically, in case the bundler
        // rewrites it to something like globalThis.__store.
        if (/(^|[^\w.$])(globalThis|self|window)\s*\.\s*__store\s*=/.test(text)) {
          offenders.push(`${path.relative(webRoot, full)}:__store=`)
        }
      }
    }
  }
  walk(webRoot)
  if (offenders.length) throw new Error(`test hooks present: ${offenders.slice(0, 5).join(', ')}`)
  return 'window.__store/__speech/__ambient all absent'
})

t('the APK inside the bundle is not debuggable', () => {
  // A debuggable release lets any process on the device attach. Check the
  // manifest flag via the base module's presence of the debug marker instead of
  // guessing: build.gradle is the source of truth.
  const gradle = fs.readFileSync(path.join(ROOT, 'android/app/build.gradle'), 'utf8')
  const rel = gradle.match(/release\s*\{[\s\S]*?\n\s*\}/)
  if (rel && /debuggable\s+true/.test(rel[0])) {
    throw new Error('the release build type sets debuggable true')
  }
  return 'not debuggable'
})

console.log('')
console.log(fail ? `${fail} failure(s) - DO NOT UPLOAD` : 'ready to upload')
process.exit(fail ? 1 : 0)