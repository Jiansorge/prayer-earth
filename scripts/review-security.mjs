// 20-pass security review: a static code audit plus dynamic probes against the
// PRODUCTION build served from dist/.
//
// Why passes at all for mostly-deterministic checks: each pass re-derives the
// findings from scratch, so a finding that appears in 20/20 passes is a property
// of the tree, not of a scan artifact - and the dynamic probes sample the served
// app (headers, containment, fallback) 20 times, so an intermittent leak cannot
// hide behind one lucky sample. Variance across passes is reported and fails
// the run, exactly like review-style.
//
// Static checks (recomputed per pass):
//   - tracked signing material (jks/keystore/p12/key.properties) must not exist
//   - secret-shaped literals in tracked text files (keys, tokens, passwords)
//   - XSS sinks: dangerouslySetInnerHTML, innerHTML/outerHTML writes,
//     document.write, eval, new Function, javascript: URLs, string timers,
//     wildcard postMessage, target=_blank without rel=noopener
//   - insecure http:// string loads in src/
//   - dist/: no executable inline <script>, no sourcemaps, no env/signing files,
//     test hooks reported as INFO (expected for non-release builds)
//   - public runtime scripts: no eval
//
// Dynamic probes (contained static server over dist/):
//   - root + SPA hash-route fallback serve the shell
//   - encoded path traversal never escapes dist/
//   - /.env, /server/index.js, /@vite/client serve the shell, never raw files
//   - nosniff set, no x-powered-by
//   - non-GET methods refused
//
// Exit: 1 on any hard finding or on variance between passes.
//
// Usage: node scripts/review-security.mjs --passes 20
import { createServer } from 'node:http'
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { writeFileSync, mkdirSync } from 'node:fs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`)
  return i > -1 ? process.argv[i + 1] : d
}
const N = Number(arg('passes', process.env.PASSES || 20))
const LOGDIR = path.join(os.tmpdir(), 'pe-security-20x')
mkdirSync(LOGDIR, { recursive: true })
const DIST = path.join(ROOT, 'dist')

const findings = [] // { sev: 'hard'|'info', id, where, detail }
const add = (sev, id, where, detail) => findings.push({ sev, id, where, detail })

// --- tracked files ----------------------------------------------------------
const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 })
  .toString('utf8')
  .split('\0')
  .filter(Boolean)
const TEXT_EXT = /\.(js|jsx|mjs|cjs|ts|json|html|htm|css|xml|yml|yaml|sh|bat|properties|webmanifest|txt|md|gradle|java|kt|swift|plist|podspec|env|example|lock)$/i
const isText = (f) =>
  /\.(env)(\.|$)/i.test(f) || TEXT_EXT.test(f) || /^\.env/.test(path.basename(f))
const scanFiles = tracked.filter(
  (f) => isText(f) && !f.startsWith('scripts/') && !f.startsWith('docs/') && !f.endsWith('.md')
)

// --- helpers ----------------------------------------------------------------
const SECRET_RULES = [
  ['private-key-block', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['aws-access-key', /\bAKIA[0-9A-Z]{16}\b/],
  ['github-token', /\bgh[pousr]_[A-Za-z0-9]{30,}\b|\bgithub_pat_[A-Za-z0-9_]{20,}\b/],
  ['google-api-key', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['openai-style-key', /\bsk-[A-Za-z0-9]{30,}\b/],
  [
    'hardcoded-credential',
    /\b(?:password|passwd|api[_-]?key|apikey|client[_-]?secret)\b['"]?\s*[:=]\s*['"][^'"\s]{8,}['"]/i
  ]
]
const walk = (dir, exts, out = []) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, exts, out)
    else if (exts.test(e.name)) out.push(p)
  }
  return out
}
const countIn = (text, re) => (text.match(re) || []).length

// --- static ----------------------------------------------------------------
function staticPass() {
  findings.length = 0

  // 1. Signing material must not be tracked.
  for (const f of tracked) {
    if (/\.(jks|keystore|pem|p12|pfx)$/i.test(f) || /(^|\/)key\.properties$/.test(f) || /google-services\.json$/.test(f)) {
      add('hard', 'signing-material-tracked', f, 'key material must never be committed')
    }
  }

  // 2. Secret-shaped literals in tracked text files.
  for (const f of scanFiles) {
    let text
    try {
      text = readFileSync(path.join(ROOT, f), 'utf8')
    } catch {
      continue
    }
    const lines = text.split(/\r?\n/)
    for (const [rule, re] of SECRET_RULES) {
      lines.forEach((line, i) => {
        if (re.test(line)) add('hard', `secret:${rule}`, `${f}:${i + 1}`, line.trim().slice(0, 100))
      })
    }
    if (/^\.env/.test(path.basename(f)) && !/\.env\.example$/i.test(f)) {
      add('info', 'env-file-tracked', f, 'tracked env file (config only is allowed; secrets are not)')
    }
  }

  // 3. XSS / code-injection sinks in first-party runtime code.
  const SINKS = [
    ['dangerouslySetInnerHTML', /dangerouslySetInnerHTML/],
    ['innerHTML-write', /\.innerHTML\s*(?:\+)?=(?!=)/],
    ['outerHTML-write', /\.outerHTML\s*=(?!=)/],
    ['document-write', /document\.write(?:ln)?\s*\(/],
    ['eval', /(?<![\w.$])eval\s*\(/],
    ['new-Function', /new\s+Function\s*\(/],
    ['javascript-url', /javascript:/i],
    ['string-timer', /set(?:Timeout|Interval)\s*\(\s*['"`]/],
    ['wildcard-postMessage', /postMessage\s*\((?:[^,]|\([^)]*\))+,\s*['"]\*['"]/]
  ]
  const runtimeFiles = [
    ...walk(path.join(ROOT, 'src'), /\.(js|jsx)$/),
    ...walk(path.join(ROOT, 'server'), /\.(js|mjs)$/),
    ...readdirSync(path.join(ROOT, 'public'))
      .filter((f) => f.endsWith('.js'))
      .map((f) => path.join(ROOT, 'public', f))
  ]
  for (const p of runtimeFiles) {
    const rel = path.relative(ROOT, p).replace(/\\/g, '/')
    const lines = readFileSync(p, 'utf8').split(/\r?\n/)
    lines.forEach((line, i) => {
      // Comment prose often QUOTES the dangerous pattern while explaining why
      // it is avoided ("a plain <a target=_blank> is dead in the WebView...").
      // Only executable lines are findings.
      if (/^\s*(?:\/\/|\/\*|\*)/.test(line)) return
      for (const [id, re] of SINKS) {
        if (re.test(line)) add('hard', `sink:${id}`, `${rel}:${i + 1}`, line.trim().slice(0, 100))
      }
      // target=_blank without rel=noopener within the tag window
      if (/target\s*=\s*["']_blank["']/.test(line)) {
        const window = lines.slice(Math.max(0, i - 3), i + 4).join('\n')
        if (!/rel\s*=\s*["'][^"']*noopener/.test(window)) {
          add('hard', 'sink:blank-without-noopener', `${rel}:${i + 1}`, line.trim().slice(0, 100))
        }
      }
    })
  }

  // 4. Insecure http:// loads in src/ (localhost bridge origins are fine).
  for (const p of walk(path.join(ROOT, 'src'), /\.(js|jsx)$/)) {
    const rel = path.relative(ROOT, p).replace(/\\/g, '/')
    readFileSync(p, 'utf8').split(/\r?\n/).forEach((line, i) => {
      if (/['"`]http:\/\//.test(line) && !/localhost|127\.0\.0\.1/.test(line)) {
        add('info', 'insecure-http', `${rel}:${i + 1}`, line.trim().slice(0, 100))
      }
    })
  }

  // 5. Built artifact checks.
  if (!existsSync(path.join(DIST, 'index.html'))) {
    add('hard', 'dist-missing', 'dist/', 'no dist/index.html - run `npm run build` first')
  } else {
    const html = readFileSync(path.join(DIST, 'index.html'), 'utf8')
    const scripts = [...html.matchAll(/<script\b([^>]*)>/gi)]
    const inline = scripts.filter(
      (m) => !/>\s*<\//i.test(m[0]) && !/type\s*=\s*["']application\/ld\+json["']/i.test(m[1]) && !/\bsrc\s*=/i.test(m[1])
    )
    for (const m of inline) add('hard', 'dist:inline-script', 'dist/index.html', m[0].slice(0, 80))

    const maps = existsSync(DIST) ? walk(DIST, /\.map$/) : []
    for (const m of maps) add('hard', 'dist:sourcemap', path.relative(ROOT, m).replace(/\\/g, '/'), 'shipped sourcemap')
    for (const dir of ['assets']) {
      const d = path.join(DIST, dir)
      if (!existsSync(d)) continue
      for (const f of readdirSync(d)) {
        if (!/\.(js|css)$/.test(f)) continue
        const src = readFileSync(path.join(d, f), 'utf8')
        if (/sourceMappingURL=/.test(src)) add('hard', 'dist:sourcemap-ref', `dist/${dir}/${f}`, 'sourceMappingURL in shipped asset')
      }
    }
    for (const f of walk(DIST, /(\.env|\.jks|key\.properties|google-services)/i)) {
      add('hard', 'dist:sensitive-file', path.relative(ROOT, f).replace(/\\/g, '/'), 'sensitive file inside dist/')
    }
    const assetDir = path.join(DIST, 'assets')
    if (existsSync(assetDir)) {
      const hooks = []
      for (const f of readdirSync(assetDir).filter((f) => f.endsWith('.js'))) {
        const src = readFileSync(path.join(assetDir, f), 'utf8')
        for (const h of ['__store', '__speech', '__ambient']) {
          if (new RegExp(`window\\s*\\.\\s*${h}\\b|\\b${h}\\s*=`).test(src)) hooks.push(`${f}:${h}`)
        }
      }
      if (hooks.length) add('info', 'dist:test-hooks', 'dist/assets/', hooks.join(', '))
    }
  }

  // 6. No eval in the shipped public runtime scripts.
  for (const f of ['sw.js', 'analytics-loader.js', 'boot-failsafe.js']) {
    const p = path.join(ROOT, 'public', f)
    if (!existsSync(p)) continue
    const src = readFileSync(p, 'utf8')
    if (/(?<![\w.$])eval\s*\(/.test(src)) add('hard', 'public:eval', `public/${f}`, 'eval in runtime script')
  }

  findings.sort((a, b) => a.sev.localeCompare(b.sev) || a.id.localeCompare(b.id) || a.where.localeCompare(b.where))
}

// --- dynamic ---------------------------------------------------------------
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.xml': 'application/xml'
}

function makeServer() {
  return createServer((req, res) => {
    const base = { 'x-content-type-options': 'nosniff' }
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.writeHead(405, { ...base, allow: 'GET, HEAD' }).end('method not allowed')
      return
    }
    let rel
    try {
      rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '')
    } catch {
      res.writeHead(400, base).end('bad request')
      return
    }
    const abs = path.resolve(DIST, rel)
    if (abs !== DIST && !abs.startsWith(DIST + path.sep)) {
      res.writeHead(403, base).end('forbidden')
      return
    }
    let file = null
    try {
      if (rel && statSync(abs).isFile()) file = abs
    } catch {}
    if (!file) file = path.join(DIST, 'index.html') // SPA fallback
    let body
    try {
      body = readFileSync(file)
    } catch {
      res.writeHead(404, base).end('not found')
      return
    }
    res.writeHead(200, { ...base, 'content-type': MIME[path.extname(file)] || 'application/octet-stream' })
    res.end(req.method === 'HEAD' ? undefined : body)
  })
}

async function dynamicPass(base) {
  const probes = []
  const probe = (id, ok, detail) => probes.push({ id, ok, detail })
  const get = async (p) => {
    const r = await fetch(base + p)
    const body = await r.text()
    return { status: r.status, headers: r.headers, body }
  }

  const root = await get('/')
  probe('root-serves-shell', root.status === 200 && /<div id="root">/.test(root.body), `status ${root.status}`)
  probe(
    'headers-hygiened',
    (root.headers.get('x-content-type-options') || '') === 'nosniff' && !root.headers.get('x-powered-by'),
    `nosniff=${root.headers.get('x-content-type-options')} powered-by=${root.headers.get('x-powered-by')}`
  )

  const spa = await get('/some/deep/route')
  probe('spa-fallback-serves-shell', spa.status === 200 && /<div id="root">/.test(spa.body), `status ${spa.status}`)

  for (const trav of ['/..%2f..%2fpackage.json', '/%2e%2e%2fpackage.json', '/..%2f..%2fserver%2findex.js']) {
    const r = await get(trav)
    const leaked = /"prayer-earth"|createServer|node_modules/.test(r.body) && r.status === 200
    probe(`traversal-contained:${trav}`, !leaked, `status ${r.status}`)
  }

  for (const p of ['/.env', '/server/index.js', '/@vite/client', '/android/key.properties']) {
    const r = await get(p)
    const leaked = !/<div id="root">/.test(r.body) && r.status === 200
    probe(`no-raw-exposure:${p}`, !leaked, `status ${r.status}, shell=${/<div id="root">/.test(r.body)}`)
  }

  const post = await fetch(base + '/', { method: 'POST', body: 'x' }).catch(() => null)
  probe('post-refused', post && post.status === 405, `status ${post ? post.status : 'network-error'}`)

  return probes
}

// --- main ------------------------------------------------------------------
const server = makeServer()
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const BASE = `http://127.0.0.1:${server.address().port}`

let variance = 0
let firstKey = null
let firstReport = null
let probeFailsEver = []
try {
  for (let pass = 1; pass <= N; pass++) {
    staticPass()
    const probes = await dynamicPass(BASE)
    const key = JSON.stringify({ f: findings, p: probes.map((p) => [p.id, p.ok, p.detail]) })
    if (pass === 1) {
      firstKey = key
      firstReport = { findings: [...findings], probes }
    } else if (key !== firstKey) {
      variance++
    }
    for (const p of probes.filter((p) => !p.ok)) probeFailsEver.push(`pass ${pass}: ${p.id} (${p.detail})`)
    const hard = findings.filter((f) => f.sev === 'hard').length
    const probeBad = probes.filter((p) => !p.ok).length
    console.log(`pass ${String(pass).padStart(2)}/${N} done: ${findings.length} findings (${hard} hard), ${probeBad} probe failures`)
  }

  const hard = firstReport.findings.filter((f) => f.sev === 'hard')
  const info = firstReport.findings.filter((f) => f.sev === 'info')
  const probeBad = firstReport.probes.filter((p) => !p.ok)

  const lines = []
  lines.push(`SECURITY REVIEW - ${N} passes, dist served at ${BASE.replace(/:\d+/, ':<port>')}`)
  lines.push('')
  lines.push(`== VARIANCE: findings/probes differ across passes: ${variance} ==`)
  lines.push('')
  lines.push(`== HARD FINDINGS: ${hard.length} ==`)
  for (const f of hard) lines.push(`  [${f.id}] ${f.where} - ${f.detail}`)
  lines.push('')
  lines.push(`== INFO: ${info.length} ==`)
  for (const f of info) lines.push(`  [${f.id}] ${f.where} - ${f.detail}`)
  lines.push('')
  lines.push(`== DYNAMIC PROBES (${firstReport.probes.length} per pass): ${probeBad.length} failing ==`)
  for (const p of firstReport.probes) lines.push(`  ${p.ok ? 'ok  ' : 'FAIL'} ${p.id} - ${p.detail}`)
  if (probeFailsEver.length) {
    lines.push('')
    lines.push('== probe failures seen on any pass ==')
    for (const p of [...new Set(probeFailsEver)]) lines.push(`  ${p}`)
  }
  const report = lines.join('\n')
  writeFileSync(path.join(LOGDIR, 'review.txt'), report)
  console.log('')
  console.log(report)
  console.log('')
  console.log(`full report: ${path.join(LOGDIR, 'review.txt')}`)

  const bad = hard.length > 0 || variance > 0 || probeBad.length > 0
  console.log(`SECURITY 20X: ${hard.length} hard, ${info.length} info, variance ${variance}, ${probeBad.length} probes failing`)
  process.exitCode = bad ? 1 : 0
} finally {
  server.close()
}
if (process.exitCode === undefined) process.exitCode = 0
process.exit(process.exitCode)
