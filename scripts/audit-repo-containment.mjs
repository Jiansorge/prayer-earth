// Do resilience/ and commonwealth/ ever reach the two repos that DO have GitHub
// remotes? Four ways they could:
//   1. tracked as files in prayer-earth or sync-engine
//   2. swallowed by a .gitignore negation
//   3. swept into a build or deploy staging step
//   4. inside a commit as a gitlink/submodule

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = 'C:/Users/j/Documents/Default Project'
const REPOS = ['prayer-earth', 'sync-engine']
const LOCAL = ['resilience', 'commonwealth']

const git = (cwd, args) =>
  execFileSync('git', args, { cwd: path.join(ROOT, cwd), encoding: 'utf8', maxBuffer: 1 << 26 })

let problems = 0
const bad = (msg) => {
  console.log('  FAIL ' + msg)
  problems++
}
const good = (msg) => console.log('  ok   ' + msg)

for (const repo of REPOS) {
  console.log(`\n${repo}`)

  // 1. any tracked path under a local-only project?
  const tracked = git(repo, ['ls-files'])
  const leaks = tracked
    .split('\n')
    .filter(Boolean)
    .filter((f) => LOCAL.some((l) => f === l || f.startsWith(l + '/')))
  if (leaks.length) bad(`tracks ${leaks.length} file(s) from a local-only project: ${leaks.slice(0, 3).join(', ')}`)
  else good('tracks nothing from resilience/ or commonwealth/')

  // 2. submodules or gitlinks
  const modes = new Map()
  for (const line of tracked.split('\n')) {
    const m = /^\d{6} (\S+) [0-9a-f]{40} \d+\t(.+)$/.exec(line)
    if (m) modes.set(m[1], (modes.get(m[1]) || 0) + 1)
  }
  const gitlinks = [...modes.entries()].filter(([, n]) => n === 160000)
  if (gitlinks.length) bad(`has a gitlink/submodule: ${gitlinks.map(([m]) => m).join(', ')}`)
  else good('has no submodules or gitlinks')

  // 3. containment. Both local projects are SIBLINGS of the repos, not children,
  //    so git cannot track them at all - but confirm it rather than assume, and
  //    confirm nothing in .gitignore un-ignores a path that would pull them in.
  const repoRoot = git(repo, ['rev-parse', '--show-toplevel']).trim()
  for (const local of LOCAL) {
    const abs = path.resolve(ROOT, repo, '..', local)
    const inside = path
      .relative(repoRoot, abs)
      .split(path.sep)
      .filter((p) => p && p !== '..')
    const isChild = !path.relative(repoRoot, abs).startsWith('..')
    if (!isChild) good(`${local}/ is outside ${repo}'s worktree - git cannot track it`)
    else if (inside.length && inside[0] === local) bad(`${local}/ IS inside ${repo}'s worktree`)
    else good(`${local}/ is outside ${repo}'s worktree - git cannot track it`)
  }

  // Any .gitignore negation that would re-admit a sibling path?
  const ignoreFile = path.join(ROOT, repo, '.gitignore')
  if (fs.existsSync(ignoreFile)) {
    const negations = fs
      .readFileSync(ignoreFile, 'utf8')
      .split('\n')
      .filter((l) => l.trim().startsWith('!'))
    const risky = negations.filter((l) => LOCAL.some((x) => l.includes(x)))
    if (risky.length) bad(`.gitignore un-ignores them: ${risky.join(' ')}`)
    else good(`no .gitignore negation mentions them (${negations.length} negations checked)`)
  }

  // 4. does any build/deploy/ship step name those directories?
  const scripts = ['scripts', '.github/workflows', 'package.json']
  const hits = []
  for (const s of scripts) {
    const abs = path.join(ROOT, repo, s)
    if (!fs.existsSync(abs)) continue
    const files = fs.statSync(abs).isDirectory()
      ? fs.readdirSync(abs).map((f) => path.join(abs, f))
      : [abs]
    for (const f of files) {
      if (!fs.statSync(f).isFile()) continue
      if (!/\.(mjs|js|ts|json|ya?ml)$/.test(f)) continue
      // This audit necessarily names them to check for them, as does the coverage
      // audit that references them by area. They are the checks, not leak paths.
      if (/audit-(repo-containment|coverage)\.mjs$/.test(path.basename(f))) continue
      const src = fs.readFileSync(f, 'utf8')
      for (const local of LOCAL) {
        if (src.includes(local + '/') || src.includes("'" + local + "'") || src.includes('"' + local + '"')) {
          hits.push(path.relative(path.join(ROOT, repo), f))
        }
      }
    }
  }
  if (hits.length) bad(`build/deploy references them: ${[...new Set(hits)].join(', ')}`)
  else good('no build, deploy or workflow step references them')
}

console.log(
  problems
    ? `\n${problems} problem(s): a local-only project could reach GitHub`
    : '\nresilience/ and commonwealth/ cannot reach either GitHub remote'
)
process.exit(problems ? 1 : 0)