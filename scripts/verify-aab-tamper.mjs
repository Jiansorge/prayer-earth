// Prove the content check goes red.
//
// "the bundle contains the web app that was packaged" reads the AAB and compares
// it byte for byte with android/app/src/main/assets/public. A check that has only
// ever been seen green has not been shown to work, so this corrupts the packaged
// side by one byte-run, asserts verify-aab rejects the bundle, and puts the file
// back.
//
//   node scripts/verify-aab-tamper.mjs
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const VICTIM = path.join(ROOT, 'android/app/src/main/assets/public/index.html')
const original = fs.readFileSync(VICTIM)
const originalMtime = fs.statSync(VICTIM).mtimeMs
let restored = false
const restore = () => {
  if (restored) return
  fs.writeFileSync(VICTIM, original)
  fs.utimesSync(VICTIM, originalMtime / 1000, originalMtime / 1000)
  restored = true
}

try {
  fs.writeFileSync(VICTIM, original.toString('utf8').replace('</head>', '<!-- tampered --></head>'))
  console.log('corrupted android/app/src/main/assets/public/index.html')
  console.log('running verify:aab against the UNMODIFIED bundle...\n')
  let failed = false
  try {
    execFileSync(process.execPath, [path.join(ROOT, 'scripts/verify-aab.mjs')], {
      cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']
    })
  } catch (e) {
    failed = true
    const out = `${e.stdout || ''}${e.stderr || ''}`
    console.log(out.split('\n').filter((l) => /FAIL|differ|bundle does not contain/.test(l)).join('\n'))
  }
  restore()
  console.log(`\n${failed ? 'GOOD: verify:aab REJECTED the mismatched bundle' : 'BAD: verify:aab accepted it'}`)

  // And confirm it is green again once restored.
  execFileSync(process.execPath, [path.join(ROOT, 'scripts/verify-aab.mjs')], {
    cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']
  })
  console.log('GOOD: verify:aab is green again after restoring the file')
  process.exit(failed ? 0 : 1)
} finally {
  restore()
}