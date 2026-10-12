// Is this tree in a state that may be pushed and deployed?
//
// Each check here corresponds to something that actually went wrong, not to a
// general sense of tidiness:
//
//  - A half-finished experiment sat in the working tree for days. It was a
//    _prayingCache that double-counted every prayer and rebuilt itself on every
//    tick, so it passed its own tests and would have shipped broken. Nothing
//    failed; the tree was simply not clean and nobody looked.
//  - Work reached the remote under the wrong GitHub account. The active `gh`
//    account reverts between sessions, so a push can go out as jsorge-bionic
//    with no error anywhere near the command that caused it.
//  - A commit was authored by the wrong identity, which AGENTS.md forbids.
//  - A file was rewritten by a slicing edit that swallowed the opening brace of
//    the next entry. `vite build` failed with one clear error. It was committed
//    anyway, because the build had been run in the same command as the commit
//    and its output was scanned rather than gated on. CI caught it, so nothing
//    shipped broken - but a broken commit went to main, and the deploy job sat
//    red until the next push.
//
//    That last one is why the build is checked here and not only in CI. CI was
//    never the gap. The gap was that nothing local had to pass before the push.
//
// All of these are invisible after the fact and obvious before. This runs in
// seconds and refuses to let any of them through.
//
// Usage: node scripts/assert-shippable.mjs [--allow-dirty] [--skip-build]
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const EXPECTED_NAME = 'The Candle Keeper'
const EXPECTED_EMAIL = 'the-candle-keeper@users.noreply.github.com'
const EXPECTED_OWNER = 'Jiansorge'
const allowDirty = process.argv.includes('--allow-dirty')
const skipBuild = process.argv.includes('--skip-build')

// Does every source file parse? A brace lost by a slicing edit is a syntax
// error, and finding it here names the file and line instead of leaving it to
// whatever runs the build next. Cheap: no bundling, no plugins, just parsing.
const parseFailures = () => {
  const bad = []
  const walk = (dir) => {
    for (const name of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, name.name)
      if (name.isDirectory()) {
        if (name.name !== 'node_modules' && name.name !== 'dist') walk(full)
      } else if (/\.(js|mjs)$/.test(name.name) && !/\.test\.mjs$/.test(name.name)) {
        try {
          execFileSync(process.execPath, ['--check', full], { stdio: ['ignore', 'ignore', 'pipe'] })
        } catch (e) {
          const msg = String(e.stderr || e.message).split('\n').slice(0, 3).join(' ').trim()
          bad.push(`${path.relative(ROOT, full)}: ${msg}`)
        }
      }
    }
  }
  walk(path.join(ROOT, 'src'))
  walk(path.join(ROOT, 'scripts'))
  return bad
}

const git = (...args) =>
  execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()

const problems = []
const notes = []

// 1. Nothing half-finished may ride along with the push.
try {
  const dirty = git('status', '--porcelain')
  if (dirty) {
    const files = dirty.split('\n').filter(Boolean)
    if (allowDirty) {
      notes.push(`dirty tree allowed explicitly (${files.length} file(s))`)
    } else {
      problems.push(
        `the working tree has ${files.length} uncommitted change(s):\n        ` +
          files.slice(0, 10).join('\n        ') +
          '\n        Commit them, or pass --allow-dirty if you mean it.'
      )
    }
  }
} catch {
  problems.push('could not read git status - is this a git repository?')
}

// 2. The commit identity this project requires.
const name = git('config', 'user.name')
const email = git('config', 'user.email')
if (name !== EXPECTED_NAME || email !== EXPECTED_EMAIL) {
  problems.push(
    `commit identity is "${name}" <${email}>, expected "${EXPECTED_NAME}" <${EXPECTED_EMAIL}>\n` +
      `        Fix it for this repo only: git config --local user.name "${EXPECTED_NAME}"`
  )
}

// 3. The remote must belong to the personal account, and the repo-local
//    credential hint must pin it. The global `gh` account is not enough: it is
//    shared with every other repo and reverts on its own between sessions.
const remote = git('remote', 'get-url', 'origin')
if (!remote.includes(`github.com/${EXPECTED_OWNER}/`) && !remote.includes(`github.com:${EXPECTED_OWNER}/`)) {
  problems.push(`origin is ${remote}, expected it to be under ${EXPECTED_OWNER}/`)
}
try {
  const pinned = git('config', '--local', '--get', 'credential.https://github.com/.username')
  if (pinned !== EXPECTED_OWNER) {
    problems.push(
      `this repo pins its GitHub account to "${pinned || 'nothing'}". Without the pin, gh's\n` +
        `        globally-active account decides, and that reverts between sessions.\n` +
        `        Pin it: git config --local credential.https://github.com/.username ${EXPECTED_OWNER}`
    )
  } else {
    notes.push(`push account pinned to ${pinned}`)
  }
} catch {
  problems.push(
    `this repo does not pin its GitHub account.\n` +
      `        Pin it: git config --local credential.https://github.com/.username ${EXPECTED_OWNER}`
  )
}

// 4. Only main is ever deployed, per AGENTS.md.
const branch = git('rev-parse', '--abbrev-ref', 'HEAD')
if (branch !== 'main') {
  problems.push(`HEAD is on "${branch}" - deploys are main-only`)
} else {
  notes.push('on main')
}

const unparseable = parseFailures()
if (unparseable.length) {
  problems.push(
    `these files do not parse:\n        ${unparseable.join('\n        ')}`
  )
} else {
  notes.push('every source file parses')
}

// And then the real thing: does it build? --skip-build exists only for the
// iterations where you have already watched it go green.
if (!skipBuild) {
  try {
    // npm.cmd is a batch file, so it needs a shell to run at all on Windows.
    execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'], {
      cwd: ROOT,
      shell: process.platform === 'win32',
      stdio: ['ignore', 'ignore', 'pipe'],
      timeout: 900000
    })
    notes.push('the app builds')
  } catch (e) {
    const msg = String(`${e.stderr || ''}${e.stdout || ''}${e.message}`)
      .split('\n')
      .filter((l) => /error|Expected|Unexpected/i.test(l))
      .slice(0, 4)
      .join('\n        ')
    problems.push(`the app does not build:\n        ${msg || e.message}`)
  }
}

console.log('ship check')
notes.forEach((n) => console.log(`  ok    ${n}`))
if (problems.length) {
  console.log('')
  problems.forEach((p) => console.log(`  BLOCK ${p}`))
  console.log('')
  console.log(`${problems.length} problem(s). Not shipping.`)
  process.exit(1)
}
console.log('  ok    clean tree, correct identity')
console.log('')
console.log('ready to push')