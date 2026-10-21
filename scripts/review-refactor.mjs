// 10-pass refactoring/componentization review: deterministic structural
// metrics over first-party source, re-derived from scratch every pass.
//
// The pass count buys exactly what review-style's does: findings that repeat
// 10/10 are properties of the tree (stable, safe to prioritize), and any
// difference between passes is reported as variance and fails the run - a
// reviewer that disagrees with itself cannot be trusted to be acted on.
//
// In scope: src/**/*.{js,jsx} minus content dirs (locales, data, assets) -
// those are translated/generated material, not refactor targets.
//
// Findings (all advisory - variance, not findings, is the failure condition):
//   - file-size:         file >= 500 lines
//   - component-size:    component file >= 300 lines
//   - hook-density:      >= 15 React hook calls in one file
//   - inline-style-blocks: >= 10 style={{ }} blocks in one file
//   - dup-blocks:        identical 8-line runs present in two different files
//                        (the copy-paste extraction candidate)
//   - dead-export:       export with no word-boundary use in any other
//                        first-party file (src, server, scripts)
//
// Usage: node scripts/review-refactor.mjs --passes 10
import { readFileSync, readdirSync, existsSync, writeFileSync, mkdirSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`)
  return i > -1 ? process.argv[i + 1] : d
}
const N = Number(arg('passes', process.env.PASSES || 10))
const LOGDIR = path.join(os.tmpdir(), 'pe-refactor-10x')
mkdirSync(LOGDIR, { recursive: true })

const SKIP_DIRS = ['locales', 'data', 'assets']
const K = 8 // duplicate window height in lines

// src/sync/protocol.js mirrors the sync-engine protocol file byte-for-byte on
// purpose (see its header): its exports are the wire-format documentation
// surface, not app API. Dead-export findings there would ask for a change that
// breaks the mirror, so they are suppressed - only real drift counts.
const DEAD_EXPORT_EXEMPT = ['src/sync/protocol.js']

const walk = (dir, out = []) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (dir === path.join(ROOT, 'src') && SKIP_DIRS.includes(e.name)) continue
      walk(p, out)
    } else if (/\.(js|jsx)$/.test(e.name)) out.push(p)
  }
  return out
}

const files = walk(path.join(ROOT, 'src')).sort()
const rel = (p) => path.relative(ROOT, p).replace(/\\/g, '/')
const norm = (l) => l.trim().replace(/\s+/g, ' ')

// Texts of every first-party consumer, for dead-export detection.
const consumerTexts = []
const addTree = (dir, exts) => {
  if (!existsSync(dir)) return
  const stack = [dir]
  while (stack.length) {
    const d = stack.pop()
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) stack.push(p)
      else if (exts.test(e.name)) consumerTexts.push({ file: p, text: readFileSync(p, 'utf8') })
    }
  }
}

function collect() {
  const findings = []
  const add = (id, where, detail) => findings.push({ id, where, detail })

  const perFile = files.map((p) => {
    const text = readFileSync(p, 'utf8')
    return { p, rel: rel(p), text, lines: text.split(/\r?\n/) }
  })

  // --- size / density -------------------------------------------------------
  for (const f of perFile) {
    const n = f.lines.length
    const dir = f.rel.split('/')[1] || ''
    if (n >= 500) add('file-size', f.rel, `${n} lines`)
    if ((dir === 'components' || dir === 'pages') && n >= 300) add('component-size', f.rel, `${n} lines`)
    const hooks = (f.text.match(/\buse(?:State|Effect|Memo|Callback|Ref|Context|Reducer)\s*\(/g) || []).length
    if (hooks >= 15) add('hook-density', f.rel, `${hooks} hook calls`)
    const styles = (f.text.match(/style=\{\{/g) || []).length
    if (styles >= 10) add('inline-style-blocks', f.rel, `${styles} style={{}} blocks`)
  }

  // --- cross-file duplicate blocks ------------------------------------------
  const sigs = new Map() // signature -> [{rel, line}]
  for (const f of perFile) {
    for (let i = 0; i + K <= f.lines.length; i++) {
      const win = f.lines.slice(i, i + K).map(norm)
      if (win.some((l) => l.length === 0)) continue
      const joined = win.join('\n')
      // Content qualification: skip brace/indent-only scaffolding, which would
      // otherwise flag every paired { } block in the codebase.
      const words = (joined.match(/[A-Za-z]{3,}/g) || []).length
      if (words < 12 || joined.length < 160) continue
      if (!sigs.has(joined)) sigs.set(joined, [])
      const list = sigs.get(joined)
      const last = list[list.length - 1]
      if (last && last.rel === f.rel && last.line === i) continue
      list.push({ rel: f.rel, line: i + 1 })
    }
  }
  let dupWindows = 0
  for (const [, locs] of sigs) {
    const fileSet = new Set(locs.map((l) => l.rel))
    if (fileSet.size < 2) continue
    dupWindows++
    const [a, b] = locs
    add('dup-blocks', `${a.rel}:${a.line} <-> ${b.rel}:${b.line}`, `${K} identical lines (block #${dupWindows})`)
  }

  // --- dead exports ---------------------------------------------------------
  addTree(path.join(ROOT, 'server'), /\.(js|mjs)$/)
  addTree(path.join(ROOT, 'scripts'), /\.mjs$/)
  // "Anyone else who could use this name" = every other in-scope src file,
  // plus server/ and scripts/ (a module only tests import is not dead).
  const others = [
    ...perFile.map((f) => ({ file: f.p, text: f.text })),
    ...consumerTexts
  ]
  const ownText = new Map(perFile.map((f) => [f.p, f.text]))
  for (const f of perFile) {
    if (DEAD_EXPORT_EXEMPT.includes(f.rel)) continue
    const names = []
    for (const m of f.text.matchAll(/export\s+(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/g)) {
      names.push({ name: m[1], line: f.text.slice(0, m.index).split(/\r?\n/).length })
    }
    for (const m of f.text.matchAll(/export\s*\{([^}]+)\}/g)) {
      for (const part of m[1].split(',')) {
        const name = (part.split(/\s+as\s+/).pop() || '').trim()
        if (/^[A-Za-z_$][\w$]*$/.test(name)) names.push({ name, line: f.text.slice(0, m.index).split(/\r?\n/).length })
      }
    }
    for (const { name, line } of names) {
      const re = new RegExp(`\\b${name.replace(/\$/g, '\\$')}\\b`)
      let used = false
      for (const c of others) {
        if (c.file === f.p) continue
        if (re.test(c.text)) {
          used = true
          break
        }
      }
      if (!used) {
        // Used only inside its own file is still "alive" for a module's
        // internals, but the export keyword is then dead weight. (Global
        // regex: a non-global match returns one match entry regardless of
        // how many occurrences exist, which would count every file-local
        // export as appearing exactly once.)
        const ownCount = (ownText.get(f.p).match(new RegExp(re.source, 'g')) || []).length
        if (ownCount <= 1) add('dead-export', `${f.rel}:${line}`, name)
        else add('dead-export', `${f.rel}:${line}`, `${name} (export unused elsewhere; file-local only)`)
      }
    }
  }

  findings.sort((a, b) => a.id.localeCompare(b.id) || a.where.localeCompare(b.where))
  return findings
}

let variance = 0
let first = null
for (let pass = 1; pass <= N; pass++) {
  const findings = collect()
  const key = JSON.stringify(findings)
  if (pass === 1) first = findings
  else if (key !== JSON.stringify(first)) variance++
  console.log(`pass ${String(pass).padStart(2)}/${N} done: ${findings.length} findings`)
}

const groups = new Map()
for (const f of first) {
  if (!groups.has(f.id)) groups.set(f.id, [])
  groups.get(f.id).push(f)
}
const lines = []
lines.push(`REFACTOR / COMPONENTIZATION REVIEW - ${N} passes, ${files.length} files in scope`)
lines.push('')
lines.push(`== VARIANCE: findings differ across passes: ${variance} ==`)
lines.push('')
lines.push(`== FINDINGS: ${first.length} (advisory) ==`)
for (const [id, list] of [...groups].sort()) {
  lines.push('')
  lines.push(`${id} (${list.length})`)
  for (const f of list) lines.push(`  ${f.where} - ${f.detail}`)
}
lines.push('')
lines.push('== 10 largest in-scope files ==')
const sizes = files
  .map((p) => [rel(p), readFileSync(p, 'utf8').split(/\r?\n/).length])
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10)
for (const [f, n] of sizes) lines.push(`  ${String(n).padStart(5)}  ${f}`)

const report = lines.join('\n')
writeFileSync(path.join(LOGDIR, 'review.txt'), report)
console.log('')
console.log(report)
console.log('')
console.log(`full report: ${path.join(LOGDIR, 'review.txt')}`)
console.log(`REFACTOR ${N}X: ${first.length} findings, variance ${variance}`)
process.exit(variance > 0 ? 1 : 0)
