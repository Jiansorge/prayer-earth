// Runs the canonical suite (npm test: server, usage, backup, units, edge) N
// times and aggregates. Three purposes a single run cannot give you:
//   1. flakiness - a suite that passes 1/3 or flips between identical runs is
//      not done, even when its one lucky run was green;
//   2. count drift - summaries must be byte-identical across passes, so a test
//      that silently stops asserting (fewer checks than last pass) is caught;
//   3. a stable baseline - a green x3 is the bar for calling the suite done.
//
// test-usage needs the app at :5173, so this wrapper starts `npm start`
// (server + vite) if nothing is serving there and tears the tree down again if
// it started it. If you already have `npm start` running, it is left alone.
//
// Per-suite logs: %TEMP%\pe-tests-3x\pass-N-suite.log
//
// Usage: node scripts/review-tests.mjs --passes 3
import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`)
  return i > -1 ? process.argv[i + 1] : d
}
const N = Number(arg('passes', process.env.PASSES || 3))
const LOGDIR = path.join(os.tmpdir(), 'pe-tests-3x')
mkdirSync(LOGDIR, { recursive: true })

const SUITES = [
  ['server', 'scripts/test-server.mjs', (t) =>
    (/ALL SERVER CHECKS PASSED/.test(t) && 'all passed') ||
    ((t.match(/(\d+) check\(s\) FAILED/) || [])[1] && `${RegExp.$1} failed`) ||
    'no summary'],
  ['usage', 'scripts/test-usage.mjs', (t) =>
    (/ALL CHECKS PASSED/.test(t) && 'all passed') ||
    ((t.match(/(\d+) check\(s\) FAILED/) || [])[1] && `${RegExp.$1} failed`) ||
    'no summary'],
  ['backup', 'scripts/test-backup.mjs', (t) => {
    const m = (t.match(/\b(\d+)\/(\d+) passed\b/g) || []).pop()
    return m ? m.replace(' passed', '') + ' passed' : 'no summary'
  }],
  ['units', 'scripts/test-units.mjs', (t) => {
    const m = (t.match(/\b(\d+)\/(\d+) passed\b/g) || []).pop()
    return m || 'no summary'
  }],
  ['edge', 'scripts/test-edge-cases.mjs', (t) => {
    const m = t.match(/\b(\d+) passed, (\d+) failed\b/)
    return m ? `${m[1]} passed, ${m[2]} failed` : 'no summary'
  }]
]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const reachable = async () => {
  try {
    const r = await fetch('http://localhost:5173/', { signal: AbortSignal.timeout(3000) })
    return r.ok
  } catch {
    return false
  }
}

// --- dev server -------------------------------------------------------------
let startProc = null
if (!(await reachable())) {
  console.log('starting app on :5173 (npm start)...')
  startProc = spawn(process.execPath, [path.join(ROOT, 'scripts', 'start-all.mjs')], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true
  })
  const devlog = []
  startProc.stdout.on('data', (d) => devlog.push(d))
  startProc.stderr.on('data', (d) => devlog.push(d))
  let up = false
  for (let i = 0; i < 120 && !up; i++) {
    await sleep(1000)
    up = await reachable()
  }
  if (!up) {
    writeFileSync(path.join(LOGDIR, 'dev-start.log'), Buffer.concat(devlog.map((b) => Buffer.from(b))))
    console.error(`app did not come up on :5173 - see ${path.join(LOGDIR, 'dev-start.log')}`)
    try {
      spawnSync('taskkill', ['/PID', String(startProc.pid), '/T', '/F'])
    } catch {}
    process.exit(2)
  }
  console.log('app is up')
} else {
  console.log('app already running on :5173 - will not stop it')
}

const runSuite = (script) =>
  new Promise((resolve) => {
    const out = []
    const p = spawn(process.execPath, [path.join(ROOT, script)], {
      cwd: ROOT,
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe']
    })
    p.stdout.on('data', (d) => out.push(d))
    p.stderr.on('data', (d) => out.push(d))
    p.on('close', (code) => {
      resolve({ code, text: Buffer.concat(out.map((b) => Buffer.from(b))).toString('utf8') })
    })
  })

// --- passes -----------------------------------------------------------------
const results = [] // per pass: [{ suite, code, summary, fails }]
try {
  for (let pass = 1; pass <= N; pass++) {
    const row = []
    for (const [name, script, summarize] of SUITES) {
      const t0 = Date.now()
      const r = await runSuite(script)
      const summary = summarize(r.text)
      const fails = r.text
        .split(/\r?\n/)
        .filter((l) => /(^|\]\s)(FAIL)\s/.test(l))
        .map((l) => l.trim().slice(0, 160))
      writeFileSync(path.join(LOGDIR, `pass-${pass}-${name}.log`), r.text)
      // Exit code carries the verdict (every suite exits 1 on failure); the
      // summary only has to EXIST, because edge's green line is
      // "N passed, 0 failed" and would poison a substring test.
      const ok = r.code === 0 && summary !== 'no summary'
      console.log(
        `${ok ? 'OK  ' : 'BAD '}pass ${pass}/${N} [${name}] exit ${r.code} ${summary} (${((Date.now() - t0) / 1000).toFixed(0)}s)`
      )
      for (const f of fails) console.log(`     FAIL ${f}`)
      row.push({ suite: name, code: r.code, summary, fails })
    }
    results.push(row)
  }

  // --- verdict --------------------------------------------------------------
  const green = (r) => r.code === 0 && r.summary !== 'no summary'
  const allGreen = results.flat().every(green)
  const identical = results[0].every((r0, i) => results.every((row) => row[i].summary === r0.summary))

  const lines = []
  lines.push(`TESTS REVIEW - ${N} passes x ${SUITES.length} suites`)
  lines.push('')
  lines.push('suite     ' + results.map((row, i) => `pass ${i + 1}`.padStart(12)).join(''))
  for (let s = 0; s < SUITES.length; s++) {
    lines.push(
      SUITES[s][0].padEnd(9) +
        results.map((row) => `${green(row[s]) ? '' : '!'}${row[s].summary}`.padStart(12)).join('')
    )
  }
  lines.push('')
  lines.push(`all green across every pass: ${allGreen}`)
  lines.push(`summaries identical across passes: ${identical}`)
  if (!identical) {
    lines.push('drift detected:')
    for (let s = 0; s < SUITES.length; s++) {
      const set = results.map((row) => row[s].summary)
      if (new Set(set).size > 1) lines.push(`  ${SUITES[s][0]}: ${set.join(' | ')}`)
    }
  }
  const report = lines.join('\n')
  writeFileSync(path.join(LOGDIR, 'review.txt'), report)
  console.log('')
  console.log(report)
  console.log('')
  const verdict = allGreen && identical
    ? `ALL ${N} PASSES IDENTICAL & GREEN`
    : !allGreen ? 'SUITE FAILURES PRESENT' : 'SUMMARY DRIFT BETWEEN PASSES'
  console.log(`TESTS ${N}X: ${verdict} (logs: ${LOGDIR})`)
  process.exitCode = verdict === `ALL ${N} PASSES IDENTICAL & GREEN` ? 0 : 1
} finally {
  if (startProc) {
    try {
      spawnSync('taskkill', ['/PID', String(startProc.pid), '/T', '/F'])
      console.log('stopped the dev server started by this wrapper')
    } catch {}
  }
}
process.exit(process.exitCode ?? 0)
