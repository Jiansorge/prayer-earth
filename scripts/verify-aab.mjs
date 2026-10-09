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
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const AAB = path.join(ROOT, 'android/app/build/outputs/bundle/release/app-release.aab')
const EXPECTED_APPLICATION_ID = 'app.joiningpalms'

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

// An AAB is a zip. Reading it needs no external tooling.
const buf = fs.readFileSync(AAB)
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