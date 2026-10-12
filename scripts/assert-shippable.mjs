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
//
// All three are invisible after the fact and obvious before. This runs in
// seconds and refuses to let any of them through.
//
// Usage: node scripts/assert-shippable.mjs [--allow-dirty]
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const EXPECTED_NAME = 'The Candle Keeper'
const EXPECTED_EMAIL = 'the-candle-keeper@users.noreply.github.com'
const EXPECTED_OWNER = 'Jiansorge'
const allowDirty = process.argv.includes('--allow-dirty')

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