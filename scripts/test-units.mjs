// Pass-2 coverage: three gaps this audit found that nothing was guarding.
//
//  1. i18n placeholders. translate() substitutes {name} params, and when a caller
//     forgets the params object it leaves the literal "{n}" in the interface. A
//     static check finds every t('key') call that omits params for a key that
//     actually has a placeholder -- the bug class, not one instance.
//  2. profanity.sanitizeName. The user's display name is shown to other people
//     while they pray, so this is a moderation function and it had no test at
//     all. Pure module, so it runs without a browser.
//  3. testHooks must never grow a RUNTIME gate. It is build-time only now; a
//     previous version keyed on ?peTest=1 and shipped that to production. This
//     asserts the source cannot regress to reading the URL or a query param.

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { sanitizeName } from '../src/shared/profanity.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const results = []
const check = (name, pass, extra = '') => {
  results.push({ name, pass })
  console.log(`[units] ${pass ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`)
}

const walk = (dir, out = []) => {
  for (const f of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name)
    if (f.isDirectory()) walk(p, out)
    else if (/\.(js|jsx)$/.test(f.name)) out.push(p)
  }
  return out
}

const srcFiles = walk(path.join(ROOT, 'src'))

// Comments must be stripped before source scanning: these files document the
// incidents they guard against, and a naive substring scan flags its own notes.
const stripComments = (text) =>
  text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, (m, p1) => p1)

// --- 1. i18n placeholders -----------------------------------------------------
{
  // Which keys declare a {placeholder}?
  const placeholders = new Map() // key -> Set(paramNames)
  for (const file of readdirSync(path.join(ROOT, 'src', 'locales'))) {
    if (!file.endsWith('.js')) continue
    const text = readFileSync(path.join(ROOT, 'src', 'locales', file), 'utf8')
    for (const m of text.matchAll(/'([\w.]+)'\s*:\s*'([^']*)'/g)) {
      const params = [...m[2].matchAll(/\{(\w+)\}/g)].map((p) => p[1])
      if (params.length) {
        if (!placeholders.has(m[1])) placeholders.set(m[1], new Set())
        for (const p of params) placeholders.get(m[1]).add(p)
      }
    }
  }
  check('some keys use placeholders (guard is meaningful)', placeholders.size > 0,
    `${placeholders.size} keys`)

  // Every t('key') / translate('key') call site: does it pass params?
  const offenders = []
  for (const file of srcFiles) {
    const text = readFileSync(file, 'utf8')
    for (const m of text.matchAll(/\bt\(\s*'([\w.]+)'(\s*[,)])/g)) {
      const key = m[1]
      if (!placeholders.has(key)) continue
      // m[2] is ',' (params passed) or ')' (no params).
      if (m[2] === ')') offenders.push(`${path.relative(ROOT, file)}: t('${key}')`)
    }
  }
  check('no t(key) call omits params for a key that has a placeholder',
    offenders.length === 0, offenders.join(' | ') || 'checked all call sites')

  // And the reverse hazard: a caller passing params to a key with none is dead
  // code, and usually a typo'd key name.
  const bogus = []
  for (const file of srcFiles) {
    const text = readFileSync(file, 'utf8')
    for (const m of text.matchAll(/\bt\(\s*'([\w.]+)'\s*,\s*\{/g)) {
      if (!placeholders.has(m[1])) bogus.push(`${path.relative(ROOT, file)}: t('${m[1]}', {...})`)
    }
  }
  check('no t(key, params) call targets a key with no placeholder (typo guard)',
    bogus.length === 0, bogus.join(' | ') || 'none')
}

// --- 2. profanity.sanitizeName ----------------------------------------------
{
  check('rejects a plainly profane name', sanitizeName('fuck') === '')
  check('rejects a profane name among several words', sanitizeName('holy shit') === '')
  check('rejects leetspeak evasion (sh1t)', sanitizeName('sh1t') === '')
  check('rejects symbol evasion (f.u.c.k)', sanitizeName('f.u.c.k') === '')
  check('rejects currency evasion (@ss)', sanitizeName('@ss') === '')
  check('rejects a slur', sanitizeName('nigger') === '')
  check('allows an ordinary name', sanitizeName('River') === 'River')
  check('allows a name containing a blocked substring as a whole word',
    sanitizeName('Bass') === 'Bass', sanitizeName('Bass'))
  check('allows a name with a blocked word inside a longer word',
    sanitizeName('Classic') === 'Classic', sanitizeName('Classic'))
  check('truncates to 24 characters', sanitizeName('x'.repeat(40)).length === 24)
  check('trims surrounding whitespace', sanitizeName('  Ana  ') === 'Ana')
  check('returns empty for empty input', sanitizeName('') === '')
  check('returns empty for whitespace-only input', sanitizeName('   ') === '')
  check('tolerates null/undefined without throwing',
    sanitizeName(null) === '' && sanitizeName(undefined) === '')
  // The app must never echo raw markup from a chosen name.
  check('does not strip angle brackets (caller must escape when rendering)',
    sanitizeName('<b>x</b>') === '<b>x</b>', 'rendered via React, so this is escaped')
}

// --- 4. isAppShell must be FALSE in a browser ------------------------------
// The regression: Capacitor core is bundled into the web build too, and there
// getPlatform() returns the string 'web', which is truthy. Treating a truthy
// getPlatform() as "native" made isAppShell() true in every browser, which
// hid the Add-to-Home-Screen prompt on the web, disabled the physical-keyboard
// shortcuts, and hid the keyboard help. This asserts the detection logic cannot
// regress to a truthiness check.
{
  const text = readFileSync(path.join(ROOT, 'src', 'shared', 'mobile.js'), 'utf8')
  const body = stripComments(text).match(/isAppShell\s*=\s*\(\)\s*=>([\s\S]*?)\n\s*\n|\n\nexport default/)?.[0] || text
  check('isAppShell does not treat a truthy getPlatform() as native',
    !/Capacitor\?\.getPlatform\?\.\(\)\s*\)?\s*$|!!window\.Capacitor\?\.getPlatform/.test(body),
    'Capacitor.getPlatform() returns "web" in a browser, which is truthy')
  check('isAppShell uses Capacitor.isNativePlatform()',
    /Capacitor\?\.isNativePlatform\?\.\(\)/.test(stripComments(text)))

  // And the web build must not be shipping the app-shell path.
  const distIndex = path.join(ROOT, 'dist', 'index.html')
  if (existsSync(distIndex)) {
    const assets = readdirSync(path.join(ROOT, 'dist', 'assets'))
      .filter((f) => f.endsWith('.js'))
      .map((f) => readFileSync(path.join(ROOT, 'dist', 'assets', f), 'utf8'))
      .join('\n')
    check('the built bundle still contains the native-only install prompt',
      assets.includes('install-banner') || assets.includes('beforeinstallprompt'),
      'so the web platform is not silently treated as native')
  }
}

// --- 3. testHooks must stay build-time only ---------------------------------
{
  // Strip comments first. The historical `?peTest=1` incident is *documented* in
  // these files, so a naive substring scan flags its own explanation.
  const stripComments = (text) =>
    text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

  const text = readFileSync(path.join(ROOT, 'src', 'shared', 'testHooks.js'), 'utf8')
  check('testHooks does not read the URL or a query param',
    !/location\.search|URLSearchParams|searchParams|peTest/.test(stripComments(text)))
  check('testHooks gates on import.meta.env only',
    /import\.meta\.env/.test(stripComments(text)))
  // And no executable code anywhere in src may reintroduce a runtime gate.
  const offenders = []
  for (const file of srcFiles) {
    if (stripComments(readFileSync(file, 'utf8')).includes('peTest')) {
      offenders.push(path.relative(ROOT, file))
    }
  }
  check('no executable source reintroduces the peTest query param', offenders.length === 0,
    offenders.join(' | ') || 'none')
}

// 4. The ambient bed must be able to reach silence. Its gain mapping used to be
//    (1.0 + level * 6.5), which has a floor of 1.0, so no value of `level` could
//    ever be quiet: stopping or pausing a prayer left the bed playing at roughly
//    half volume. This checks the mapping itself, because the symptom is silence
//    that a UI test cannot easily hear.
{
  const src = readFileSync(path.join(ROOT, 'src/audio/ambience.js'), 'utf8')
  const m = src.match(/const target = ([^\n]+)/)
  const expr = m ? m[1].trim() : ''
  const gainFor = (level, user = 1, vol = 1) => {
    // eslint-disable-next-line no-new-func
    return Function(
      'level',
      'user',
      'vol',
      `return ${expr.replace(/this\.level/g, 'level').replace(/this\.vol/g, 'vol')}`
    )(level, user, vol)
  }
  check('the ambient gain mapping has no floor that blocks silence',
    expr !== '' && gainFor(0) === 0,
    `expr="${expr}" gain(0)=${gainFor(0)}`)
  check('the ambient bed is still audible at full prayer level',
    gainFor(0.9) > 5,
    `gain(0.9)=${gainFor(0.9).toFixed(2)}`)
  check('muting the app silences the bed',
    gainFor(0.9, 1, 0) === 0,
    `gain(0.9,vol=0)=${gainFor(0.9, 1, 0)}`)
}

// 5. The static Earth fallback must be a real part of the product. LibreWolf
//    blocks WebGL by default, so every one of its users lands here, and the
//    old version was a bare sphere with no coastlines and no prayer lights.
{
  const file = path.join(ROOT, 'src/components/StaticEarth.jsx')
  const s = readFileSync(file, 'utf8')
  const cssAll = readFileSync(path.join(ROOT, 'src/styles.css'), 'utf8')
  check('the no-WebGL Earth uses the real land mask',
    /url\(['"]\/land-mask\.png['"]\)/.test(cssAll))
  check('the no-WebGL Earth draws the live prayer lights',
    /useStore\(\(s\) => s\.lights\)/.test(s) && /efg-light/.test(s))
  check('the no-WebGL Earth is used by both the page and the backdrop',
    /StaticEarth/.test(readFileSync(path.join(ROOT, 'src/pages/EarthPage.jsx'), 'utf8')) &&
      /StaticEarth/.test(readFileSync(path.join(ROOT, 'src/components/EarthBackdrop.jsx'), 'utf8')))
  check('the old bare-sphere fallback is gone',
    !/\.earth-fallback-globe/.test(cssAll))

  // The lights must sit on the same lon/lat mapping the WebGL scene uses.
  const xFor = (lon) => ((lon + 180) / 360) * 200
  const yFor = (lat) => ((90 - lat) / 180) * 100
  check('lights at lon 0 / lat 0 land mid-globe',
    xFor(0) === 100 && yFor(0) === 50,
    `x=${xFor(0)} y=${yFor(0)}`)
  check('the mapping spans exactly two wrapped copies',
    xFor(-180) === 0 && xFor(180) === 200 && yFor(90) === 0 && yFor(-90) === 100)

  // The globe has ~23,760 possible cells. The WebGL path pools sprites, so the
  // fallback has to cap too - it runs on four-core-and-down devices, which are
  // the least able to absorb thousands of animated DOM nodes.
  const MAX_DOTS = 256
  const MAX_M = (s.match(/const MAX = (\d+)/) || [])[1]
  check('the fallback caps its rendered dots', /const MAX_DOTS = \d+/.test(s))
  // The two renderers must not drift apart: EarthScene.js builds a sprite pool of
  // MAX and the fallback builds MAX_DOTS nodes. If one is raised without the
  // other, the fallback silently becomes the slowest path on the hardware it
  // exists to serve.
  const scene = readFileSync(path.join(ROOT, 'src/three/EarthScene.js'), 'utf8')
  const webglMax = Number((scene.match(/const MAX = (\d+)/) || [])[1])
  const domMax = Number((s.match(/const MAX_DOTS = (\d+)/) || [])[1])
  check('both renderers define a cap', webglMax > 0 && domMax > 0, `webgl=${webglMax} dom=${domMax}`)
  check('the fallback cap matches the WebGL sprite pool', webglMax === domMax, `webgl=${webglMax} dom=${domMax}`)
  void MAX_DOTS
  void MAX_M

  // Rotation is decorative, so reduced-motion must switch it off.
  const css = readFileSync(path.join(ROOT, 'src/styles.css'), 'utf8')
  check('the static globe honours prefers-reduced-motion',
    /@media \(prefers-reduced-motion: reduce\)[\s\S]{0,400}\.efg-spin[\s\S]{0,120}animation:\s*none/.test(css))
}

// 5b. A geolocation fix can arrive long after consent was withdrawn, so every
//     path that can produce a position has to be guarded by a consent
//     generation. This is a static check because the race needs a real browser.
{
  const src = readFileSync(path.join(ROOT, 'src/sync/client.js'), 'utf8')
  const fn = src.match(/ensureLocation\(\)\s*\{[\s\S]{0,2600}?\n  \}/)
  const body = fn ? fn[0] : ''
  check('consent changes bump a generation counter', /_consentGen/.test(src))
  check('a stale fix is discarded', /stale\(\)\s*\)\s*return/.test(body))
  check('the geolocation success path is guarded', /const done = \(pos\) => \{\s*if \(stale\(\)\) return/.test(body))
  // Every fallback path must go through the guarded closure. Asserting the mere
  // absence of fallbackLoc() would be wrong - it legitimately appears inside
  // that closure - so count the call sites instead: there must be exactly one,
  // and it must sit behind the stale check.
  const fallbackCalls = (body.match(/this\.fallbackLoc\(\)/g) || []).length
  check('there is exactly one fallbackLoc call site', fallbackCalls === 1, `found ${fallbackCalls}`)
  check('the geolocation DENIED path is guarded too',
    /const fallback = \(\) => \{\s*if \(stale\(\)\) return\s*this\.fallbackLoc\(\)/.test(body))
  // And the native/plugin error path must call the closure, not fallbackLoc.
  check('the native geolocation error path goes through the guard',
    /\.catch\(fallback\)/.test(body) && !/\.catch\(\(\) => \{[^}]*this\.fallbackLoc/.test(body))
}

// 6. The deletion endpoint must be reached over HTTP, not on the socket URL.
//
// requestDeletion reused VITE_SYNC_URL, which is a wss:// URL meant for the
// WebSocket. The fetch threw, the catch reported 'offline', and the app told
// the user nothing was deleted - on every Android build, since the app shell is
// the only build that sets VITE_SYNC_URL at all. Found on a device.
//
// This is a static check on purpose: in the browser test environment
// VITE_SYNC_URL is unset, so the default https base is used there and the bug
// is invisible. Only the source shows what the app shell will do.
{
  const src = readFileSync(path.join(ROOT, 'src/shared/deletion.js'), 'utf8')
  const base = src.match(/const syncBase = \(\) => \{[\s\S]{0,700}?\n\}/)
  const body = base ? base[0] : ''
  check('the HTTP base is derived, not the socket URL verbatim',
    /const syncBase = \(\)/.test(src))
  check('a wss:// base is rewritten to https://',
    /startsWith\('wss:\/\/'\)/.test(body) && /'https:\/\/'/.test(body), body.slice(0, 200))
  check('a ws:// base is rewritten to http://',
    /startsWith\('ws:\/\/'\)/.test(body) && /'http:\/\/'/.test(body))
  check('the rewrite covers both schemes in one function',
    /wss:\/\//.test(body) && /ws:\/\//.test(body) && /https:\/\//.test(body) && /http:\/\//.test(body))
}

// 7. The app shell must not be on an opaque origin.
//
// capacitor:// is a non-special scheme, so it is an opaque origin and every
// browser serialises its Origin header as the literal string "null" - which the
// sync engine must refuse, because every sandboxed iframe and file:// document
// sends "null" too. androidScheme must therefore be https, giving a real,
// allow-listable origin. Verified on a Pixel: with capacitor:// the device sent
// "null" and could not connect at all.
{
  const cfg = readFileSync(path.join(ROOT, 'capacitor.config.json'), 'utf8')
  const android = /"androidScheme"\s*:\s*"([^"]+)"/.exec(cfg)
  check('the Android app shell has a real, allow-listable origin',
    android && android[1] === 'https',
    'androidScheme=' + (android ? android[1] : '(absent)'))
  check('the Android app shell is not served from an opaque scheme',
    !/androidScheme"\s*:\s*"capacitor"/.test(cfg))
}
{
  const src = readFileSync(path.join(ROOT, 'src/audio/ambience.js'), 'utf8')
  const ramp = src.match(/_rampMaster\(target\)\s*\{[\s\S]{0,600}?\n  \}/)
  const body = ramp ? ramp[0] : ''
  // A short exponential reaches ~63% of the gap in 70 ms and, unlike
  // cancelScheduledValues + setValueAtTime(gain.value), cannot resume from a
  // stale reading and jump.
  check('the fall uses a short time constant', /setTargetAtTime\([^)]*,\s*rising\s*\?\s*0\.8\s*:\s*0\.0?\d/.test(body), body.slice(0, 160))
  check('the fade does not cancel-and-resume from gain.value (click risk)',
    !/cancelScheduledValues/.test(body) && !/setValueAtTime\(g\.value/.test(body))
  check('rising volume still swells gently', /0\.8/.test(body))
}

const failed = results.filter((r) => !r.pass)
console.log(`\n[units] ${results.length - failed.length}/${results.length} passed`)
if (failed.length) {
  console.log('[units] FAILED:\n' + failed.map((f) => '  - ' + f.name).join('\n'))
  process.exit(1)
}
void existsSync
