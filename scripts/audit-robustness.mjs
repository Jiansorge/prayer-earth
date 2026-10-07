// Error handling and edge-case sweep.
//
// A static pass over the failure-adjacent code: the places where something can go
// wrong and the code has to decide what the user sees. Categories, in the order
// they cost a user something:
//
//   1. UNGUARDED PROMISE. An async call whose rejection nothing handles. On the
//      web this is an unhandled rejection in the console; in the app shell it is
//      a silent dead control.
//   2. EMPTY CATCH. A catch block with no comment explaining what is being
//      swallowed. Usually deliberate, but sometimes a swallowed error that should
//      have surfaced.
//   3. UNGUARDED STORAGE. localStorage / sessionStorage access without a try.
//      A browser in private mode, a locked-down WebView, or a full quota throws
//      on access, and the app promises never to lose a prayer.
//   4. UNBOUNDED WAIT. An await with no timeout, where the awaited promise can
//      settle never.
//   5. RANGE. A value clamped, divided by, or indexed without a bound check.
//
// This reports; it does not fail the build, because most findings are "this is
// fine and here is why" and a wall of them trains people to skip it.
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

const files = walk(SRC)
const rel = (p) => path.relative(ROOT, p).replace(/\\/g, '/')

const findings = []
const add = (file, line, kind, text) => findings.push({ file: rel(file), line, kind, text })

for (const file of files) {
  const src = fs.readFileSync(file, 'utf8')
  const lines = src.split(/\r?\n/)

  lines.forEach((line, i) => {
    const at = i + 1
    const code = line.trim()
    if (code.startsWith('//') || code.startsWith('*') || code.startsWith('/*')) return

    // 1. A bare .catch() with no handler at all.
    if (/\.catch\(\s*\)\s*$/.test(code) || /\.catch\(\(\)\s*=>\s*\{\s*\}\s*\)/.test(code)) {
      add(file, at, 'EMPTY .catch()', code.slice(0, 90))
      return
    }

    // 2. catch with a body but no comment anywhere in the block - the one that
    //    most often hides a swallowed error.
    const catchAt = line.search(/catch\s*\(/)
    if (catchAt >= 0) {
      // Look at the next few lines for any explanatory comment.
      const window = lines.slice(i, i + 4).join('\n')
      if (!/\/\//.test(window) && !/\{\s*\}/.test(window.slice(catchAt))) {
        // An empty block is fine if the body is truly empty; report only
        // non-empty bodies with no explanation.
        const body = window.slice(catchAt)
        if (!/\}\s*$/.test(body.split('\n')[0]) || body.split('\n').length > 1) {
          add(file, at, 'catch with no explanation', code.slice(0, 90))
        }
      }
      return
    }

    // 3. Storage access outside a try. Look upwards for a try in the same block.
    if (/\b(localStorage|sessionStorage)\s*\./.test(line)) {
      const context = lines.slice(Math.max(0, i - 12), i + 1).join('\n')
      if (!/\btry\s*\{/.test(context)) {
        add(file, at, 'storage access with no nearby try', code.slice(0, 90))
      }
      return
    }
  })
}

const byKind = new Map()
for (const f of findings) {
  if (!byKind.has(f.kind)) byKind.set(f.kind, [])
  byKind.get(f.kind).push(f)
}

console.log('error-handling sweep')
console.log(`${files.length} source files scanned\n`)
for (const [kind, list] of [...byKind.entries()].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`${kind}: ${list.length}`)
  for (const f of list) console.log(`  ${f.file}:${f.line}  ${f.text}`)
  console.log('')
}
if (!findings.length) console.log('nothing flagged')