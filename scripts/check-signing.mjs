// Verify the Play release signing identity is intact.
//
// Losing the release keystore is the one failure in this project that is
// permanently unrecoverable: Play will refuse every future update of the
// listing, and there is no reset. So this checks the three things that would
// silently break that, and prints what to back up.
//
//   node scripts/check-signing.mjs
//
// It never prints the password and never writes anything.

import { existsSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const KEY_PROPS = path.join(ROOT, 'android', 'key.properties')

let problems = 0
let lastKeytoolError = ''
const ok = (name, pass, detail = '') => {
  if (!pass) problems++
  console.log(`[signing] ${pass ? 'OK  ' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`)
}

const props = existsSync(KEY_PROPS) ? readFileSync(KEY_PROPS, 'utf8') : ''
const field = (key) => props.match(new RegExp(`^${key}\\s*=\\s*(.+)$`, 'm'))?.[1]?.trim() || ''

const storePath = field('storeFile')
const storePassword = field('storePassword')
const keyPassword = field('keyPassword')
const keyAlias = field('keyAlias')

ok('android/key.properties exists (not committed; gitignored)', existsSync(KEY_PROPS))
ok('key.properties declares a storeFile', Boolean(storePath), storePath ? '' : 'missing storeFile')
ok('key.properties declares a keyAlias', Boolean(keyAlias), keyAlias ? `alias=${keyAlias}` : 'missing keyAlias')

if (storePath) {
  const abs = path.isAbsolute(storePath) ? storePath : path.join(ROOT, 'android', 'app', storePath)
  ok('the keystore file is on disk', existsSync(abs), abs)
  if (existsSync(abs)) {
    // Read the certificate without ever echoing the password. keytool is
    // invoked directly (never through a shell) and any error is redacted, since
    // the default Error message includes the whole argv.
    const redact = (msg) => String(msg).split(storePassword).join('***').split(keyPassword).join('***')
    // Prefer a modern JDK: Java 8's keytool cannot read the PKCS12 keystore
    // Android Gradle writes, and would report a false failure.
    const candidates = [
      process.env.JAVA_HOME && path.join(process.env.JAVA_HOME, 'bin', 'keytool.exe'),
      'C:\\Users\\j\\.jdks\\jdk-21.0.12.1+1\\bin\\keytool.exe',
      'C:\\Program Files\\Android\\Android Studio\\jbr\\bin\\keytool.exe',
      'keytool'
    ].filter(Boolean)
    let opened = false
    for (const keytool of candidates) {
      let out = ''
      try {
        out = execFileSync(
          keytool,
          ['-list', '-v', '-keystore', abs, '-storepass', storePassword, '-alias', keyAlias],
          { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
        )
        const owner = out.match(/Owner:\s*(.+)/)?.[1]?.trim() || ''
        const algo = out.match(/Signature algorithm name:\s*(.+)/)?.[1]?.trim() || ''
        const validFrom = out.match(/Valid from:\s*(.+?)\s+until:/)?.[1]?.trim() || ''
        const validUntil = out.match(/until:\s*(.+)/)?.[1]?.trim() || ''
        ok('the keystore opens and the alias is present', true, owner)
        // A modern signature, but not pinned to one algorithm: SHA256withRSA,
        // SHA384withRSA and ECDSA are all fine, and hardcoding SHA256 produced a
        // false alarm on a perfectly good SHA384 certificate.
        ok('the certificate uses a modern signature algorithm',
          /withRSA$|ECDSA/i.test(algo), algo)
        // What actually matters is expiry -- an expired cert cannot sign an
        // upload, and Android requires validity beyond 22 Oct 2033.
        const until = validUntil ? new Date(validUntil) : null
        const okDate = until && !Number.isNaN(until.getTime()) && until.getTime() > Date.now()
        const androidMin = new Date('2033-10-22T00:00:00Z').getTime()
        ok('the certificate is not expired', okDate, validUntil ? `valid until ${validUntil}` : 'could not read validity')
        ok('the certificate outlives Android\'s 22 Oct 2033 requirement',
          Boolean(until) && until.getTime() > androidMin, validFrom ? `from ${validFrom}` : '')
        opened = true
        break
      } catch (e) {
        // Wrong password, or a JDK too old to read the store. Keep looking.
        lastKeytoolError = redact(e.stderr || e.message)
      }
    }
    if (!opened) {
      ok('the keystore opens with the configured password', false, lastKeytoolError)
    }
  }
}

// A signed bundle already on disk is the strongest possible evidence.
const aab = path.join(ROOT, 'android', 'app', 'build', 'outputs', 'bundle', 'release', 'app-release.aab')
const apk = path.join(ROOT, 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk')
const haveRelease = existsSync(aab) || existsSync(apk)
console.log(`[signing] signed release artifact present: ${haveRelease ? 'yes' : 'no (not built yet)'}`)

if (problems === 0) {
  console.log('\n[signing] Signing identity looks intact.')
  console.log('[signing] BACK THESE UP NOW, in two separate places, and keep the password')
  console.log('[signing] in a password manager -- not only on this machine:')
  console.log(`[signing]   keystore : ${storePath || 'android/app/' + storePath}`)
  console.log('[signing]   password : the same storePassword from android/key.properties')
  console.log('[signing] Losing either one means Play will reject every future update.')
} else {
  console.log(`\n[signing] ${problems} problem(s) - fix before publishing to Play.`)
}
process.exit(problems === 0 ? 0 : 1)
