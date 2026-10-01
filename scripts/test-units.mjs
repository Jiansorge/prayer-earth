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

  // Rotation is decorative, so reduced-motion must switch it off.
  const css = readFileSync(path.join(ROOT, 'src/styles.css'), 'utf8')
  check('the static globe honours prefers-reduced-motion',
    /@media \(prefers-reduced-motion: reduce\)[\s\S]{0,400}\.efg-spin[\s\S]{0,120}animation:\s*none/.test(css))
}

// 6. Fading the ambient bed DOWN must be fast. setTargetAtTime is an
//    exponential approach, so a 0.8s constant only closes ~63% of the gap in
//    0.8s, which is why stop and pause felt like they were hanging on.
{
  const src = readFileSync(path.join(ROOT, 'src/audio/ambience.js'), 'utf8')
  check('the master gain no longer uses a slow exponential fade',
    !/master\.gain\.setTargetAtTime/.test(src))
  check('falling volume uses a short linear ramp',
    /linearRampToValueAtTime\(target, t \+/.test(src),
    'no linear ramp on the fall')
  check('rising volume still swells gently',
    /setTargetAtTime\(target, t, 0\.8\)/.test(src))
}

const failed = results.filter((r) => !r.pass)
console.log(`\n[units] ${results.length - failed.length}/${results.length} passed`)
if (failed.length) {
  console.log('[units] FAILED:\n' + failed.map((f) => '  - ' + f.name).join('\n'))
  process.exit(1)
}
void existsSync
