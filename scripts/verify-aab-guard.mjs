import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

// Prove the release audit's two test-hook checks are real, by putting a hook
// INSIDE a copy of the AAB and running the audit against it.
//
// Injecting into .aab-inspect/ does not work: the audit re-extracts from the
// artifact first, so the edit is discarded before any check runs. That is the
// only way to test what the audit actually reads.

const JAVA = process.env.JAVA_HOME
const bin = (n) => path.join(JAVA, 'bin', process.platform === 'win32' ? n + '.exe' : n)
const SRC = path.resolve('android/app/build/outputs/bundle/release/app-release.aab')
const COPY = path.resolve('dist-store/tampered.aab')

fs.mkdirSync('dist-store', { recursive: true })
fs.copyFileSync(SRC, COPY)

const target = 'base/assets/public/assets/'
const list = execFileSync(bin('jar'), ['tf', COPY], { encoding: 'utf8' })
const chunk = list
  .split(/\r?\n/)
  .map((f) => f.trim())
  .find((f) => f.startsWith(target) && /^index-.*\.js$/.test(path.basename(f)))
if (!chunk) throw new Error('no entry chunk found')

const work = path.resolve('dist-store/_tamper')
fs.rmSync(work, { recursive: true, force: true })
fs.mkdirSync(work, { recursive: true })
execFileSync(bin('jar'), ['xf', COPY, chunk], { cwd: work, stdio: 'ignore' })
const p = path.join(work, chunk)
const before = fs.readFileSync(p, 'utf8')
fs.writeFileSync(p, before + '\nwindow.__deletion = { requestDeletion: () => 1 };\n')
execFileSync(bin('jar'), ['uf', COPY, chunk], { cwd: work, stdio: 'ignore' })
fs.rmSync(work, { recursive: true, force: true })
console.log('tampered chunk:', chunk)

let failed = false
let out = ''
try {
  out = execFileSync(process.execPath, ['scripts/audit-aab.mjs'], {
    encoding: 'utf8',
    env: { ...process.env, AAB: COPY }
  })
} catch (e) {
  failed = true
  out = e.stdout || ''
}
const lines = out.split('\n').filter((l) => /FAIL/.test(l))
console.log('audit rejected the tampered artifact:', failed)
for (const l of lines) console.log('   ', l.trim())

fs.rmSync(COPY, { force: true })
console.log(lines.some((l) => /test hook/.test(l)) ? 'PASS the hook checks are real' : 'FAIL the hook checks are vacuous')
process.exit(lines.some((l) => /test hook/.test(l)) ? 0 : 1)