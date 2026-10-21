// Runs the full a11y suite N times and aggregates: a single pass can miss
// state- or timing-dependent violations (mid-animation views, lazy content,
// focus left behind by the previous view), so the pass count IS the test.
// Per-run output goes to temp logs; the console gets one line per run.
//
// Usage: node scripts/review-a11y.mjs --passes 20
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`)
  return i > -1 ? process.argv[i + 1] : d
}
const N = Number(arg('passes', process.env.PASSES || 20))
const LOGDIR = path.join(os.tmpdir(), 'pe-a11y-20x')
mkdirSync(LOGDIR, { recursive: true })

const runOne = (i) =>
  new Promise((resolve) => {
    const out = []
    const p = spawn(process.execPath, [path.join(ROOT, 'scripts', 'test-a11y.mjs')], {
      cwd: ROOT,
      env: { ...process.env }
    })
    p.stdout.on('data', (d) => out.push(d))
    p.stderr.on('data', (d) => out.push(d))
    p.on('close', (code) => {
      const text = Buffer.concat(out.map((b) => Buffer.from(b))).toString('utf8')
      writeFileSync(path.join(LOGDIR, `run-${String(i).padStart(2, '0')}.log`), text)
      const summary = (text.match(/(\d+) passed, (\d+) failed/) || [null, '?', '?'])[0] || 'no summary'
      const fails = text
        .split(/\r?\n/)
        .filter((l) => /^FAIL /.test(l))
        .map((l) => l.slice(0, 160))
      resolve({ i, code, summary, fails })
    })
  })

let bad = 0
for (let i = 1; i <= N; i++) {
  const r = await runOne(i)
  const mark = r.code === 0 ? 'OK  ' : 'BAD '
  console.log(`${mark}run ${String(r.i).padStart(2, '0')}/${N}: ${r.summary}`)
  if (r.code !== 0) {
    bad++
    for (const f of r.fails) console.log(`     FAIL ${f}`)
  }
}
const verdict = bad === 0 ? `ALL ${N} RUNS CLEAN` : `${bad}/${N} RUNS HAD FAILURES`
console.log(`A11Y 20X: ${verdict} (logs: ${LOGDIR})`)
process.exit(bad ? 1 : 0)
