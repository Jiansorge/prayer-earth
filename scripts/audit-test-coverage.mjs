// Testing gap analysis.
//
// Every suite in this repo is good at something and silent about something else.
// This maps what each one actually exercises, then names the parts of the app
// that no suite reaches at all.
//
// The method is deliberately crude and honest about it: it counts which source
// files are referenced by which test script. A file can be reached by a test that
// only greps it, so this overstates coverage rather than hiding a gap - and an
// overstated gap is still worth looking at, whereas an understated one is not.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(ROOT, 'src')

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (/\.(js|jsx)$/.test(e.name)) out.push(p)
  }
  return out
}

const TEST_DIRS = [path.join(ROOT, 'scripts')]
const testFiles = TEST_DIRS.flatMap((d) =>
  fs.readdirSync(d).filter((f) => /^test-.*\.mjs$/.test(f)).map((f) => path.join(d, f))
)

const suiteText = new Map()
for (const f of testFiles) suiteText.set(path.basename(f).replace(/^test-|\.mjs$/g, ''), fs.readFileSync(f, 'utf8'))
const allTests = [...suiteText.values()].join('\n')

const sourceFiles = walk(SRC)
const rows = []

for (const file of sourceFiles) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/')
  const base = path.basename(file)
  const dir = path.dirname(rel).replace(/\\/g, '/')
  // Which suites mention this file at all, by name or by path fragment.
  const suites = []
  for (const [name, text] of suiteText) {
    const stem = base.replace(/\.jsx?$/, '')
    if (text.includes(rel) || text.includes(`/${stem}`) || text.includes(`'${stem}`)) suites.push(name)
  }
  rows.push({ rel, dir, base, suites })
}

// Group by directory so the summary reads as "which parts of the app are untested".
const byDir = new Map()
for (const r of rows) {
  if (!byDir.has(r.dir)) byDir.set(r.dir, [])
  byDir.get(r.dir).push(r)
}

console.log(`source files: ${sourceFiles.length}, test suites: ${testFiles.length}\n`)
console.log('directory                     files  suites naming them')
console.log('-'.repeat(78))
const uncovered = []
for (const [dir, list] of [...byDir.entries()].sort()) {
  const names = new Set()
  for (const r of list) for (const s of r.suites) names.add(s)
  console.log(
    `${dir.padEnd(28)} ${String(list.length).padStart(5)}  ${[...names].join(', ') || '(none)'}`
  )
  if (!names.size) uncovered.push(...list)
}

console.log('')
if (uncovered.length) {
  console.log(`no suite names these ${uncovered.length} file(s):`)
  for (const r of uncovered) console.log(`  ${r.rel}`)
} else {
  console.log('every source file is named by at least one suite')
}

// How much of each suite's text is about src at all - a crude proxy for whether
// a suite is behavioural or just structural.
console.log('\nsuite sizes (lines mentioning src/):')
for (const [name, text] of suiteText) {
  const lines = text.split('\n').length
  const srcLines = text.split('\n').filter((l) => l.includes('src/')).length
  console.log(`  ${name.padEnd(14)} ${String(lines).padStart(5)} total  ${String(srcLines).padStart(4)} mention src/`)
}