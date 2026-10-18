// The offline cache version is bumped BY HAND (public/sw.js: const CACHE =
// 'prayer-earth-vNN') whenever the audio library or its manifest changes. The
// SW is cache-first, so shipping new recordings without the bump serves the
// OLD manifest forever: a prayer with a new recording gets told it has none,
// and on a phone with no TTS voices that reads as silence, not as staleness
// (the v25 -> v26 incident: 274 recordings silent behind one un-bumped string).
//
// This fails a push that touches the audio library without moving the cache
// name - the same class, caught at the only moment it can be caught: the push
// that introduces the mismatch. Both halves must move together.
//
// Usage: node scripts/audit-sw-cache.mjs
//   Compares HEAD against HEAD~1 locally. In CI the workflow passes
//   GITHUB_EVENT_BEFORE (push) or GITHUB_BASE_SHA (pull_request), so the
//   comparison is against what the event actually changed even in a shallow
//   checkout (the base commit is fetched on demand).
import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const git = (args, opts = {}) =>
  execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', ...opts })

const cacheName = (text) => (text.match(/const CACHE = '([^']+)'/) || [])[1] || null

const pushBefore = process.env.GITHUB_EVENT_BEFORE
const prBase = process.env.GITHUB_BASE_SHA
const beforeSha = pushBefore && !/^0+$/.test(pushBefore)
  ? { sha: pushBefore, label: 'push before' }
  : prBase && !/^0+$/.test(prBase)
    ? { sha: prBase, label: 'PR base' }
    : { sha: 'HEAD~1', label: 'parent commit' }

// Shallow checkouts (CI) may not carry the comparison commit; fetch just it.
const have = spawnSync('git', ['cat-file', '-e', `${beforeSha.sha}^{commit}`], { cwd: ROOT })
if (have.status !== 0) {
  console.log(`[sw-cache] fetching ${beforeSha.label} ${beforeSha.sha.slice(0, 12)} for the comparison`)
  try {
    git(['fetch', '--depth=1', 'origin', beforeSha.sha])
  } catch (e) {
    console.log(`[sw-cache] SKIP could not fetch the ${beforeSha.label} (${String(e.message).split('\n')[0]}); nothing to compare against`)
    process.exit(0)
  }
}

let files = []
try {
  files = git(['diff', '--name-only', beforeSha.sha, 'HEAD']).split('\n').filter(Boolean)
} catch {
  console.log('[sw-cache] SKIP no diff available against the comparison commit')
  process.exit(0)
}

const audioFiles = files.filter((f) => f.startsWith('public/audio/'))
if (!audioFiles.length) {
  console.log(`[sw-cache] ok - the audio library did not change in this diff (${files.length} file(s))`)
  process.exit(0)
}

const now = cacheName(readFileSync(path.join(ROOT, 'public', 'sw.js'), 'utf8'))
let before = null
try {
  before = cacheName(git(['show', `${beforeSha.sha}:public/sw.js`]))
} catch {
  before = null // sw.js itself is new in this diff
}
console.log(`[sw-cache] audio library changed (${audioFiles.length} file(s)); CACHE ${before || '(none)'} -> ${now}`)
if (before === now) {
  console.error('[sw-cache] FAIL the audio library or its manifest changed but public/sw.js CACHE did not.')
  console.error('        Bump CACHE (prayer-earth-vNN -> vNN+1) in public/sw.js. The SW is')
  console.error('        cache-first, so a stale manifest keeps sending newly-recorded')
  console.error('        prayers down the no-audio path - silence on a phone with no TTS.')
  console.error('        Also purge the Cloudflare CDN /audio/* cache when shipping audio.')
  process.exit(1)
}
console.log('[sw-cache] ok - the cache version moved with the audio it serves')
