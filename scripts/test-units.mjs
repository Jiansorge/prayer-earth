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
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { sanitizeName } from '../src/shared/profanity.js'
import { foldPrayers, FOLDED_PRAYERS } from '../src/shared/prayerFold.js'
import { dayKeyUTC, streakFromDays, mergeStats } from '../src/shared/stats.js'
import { crc32, summarizeState, summarizePayload } from '../src/shared/backup.js'
import { useStore, quarantine, neverLoseData, safeStorage } from '../src/store.js'
import { tPhrase, PHRASE_MEANING_L10N } from '../src/i18n/prayerL10n.js'
import { mulberry } from '../src/components/mulberry.js'

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

// 4. The ambient bed must be adjustable. Its gain mapping used to be
//    (1.0 + level * 6.5), which has a floor of 1.0, and later
//    (0.2 + 0.8 * ambienceLevel), which still floored it at a fifth of full:
//    stopping a prayer left the bed playing, and dragging "Ambient sound volume"
//    to 0 left it audible. This test used to scrape the gain expression out of
//    ambience.js with a regex and eval it, which broke the moment the expression
//    stopped fitting on one line. bedTarget() is now a pure exported function, so
//    the arithmetic is called directly - see the block near the end.

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

// 8. Every link off the device must actually work on a device.
//
// <a target="_blank"> is DEAD in the Android WebView: it does not create a
// second window, so the tap does nothing. On the web the identical markup works,
// which is why the report-a-re-upload link, the delete-data link, the manual
// deletion link and both Ko-fi buttons were all dead on a phone.
{
  // The settings surface is one UI across many files now: the sheet plus its
  // extracted sections and sub-panels. Every file that links out must go
  // through openExternal, and none may fall back to a dead target=_blank.
  const settingsFiles = [
    'SettingsSheet.jsx', 'SettingsProfile.jsx', 'SettingsWarnings.jsx',
    'SettingsLook.jsx', 'SettingsShare.jsx', 'SettingsInstall.jsx',
    'SettingsAbout.jsx', 'SettingsVoice.jsx', 'SettingsRow.jsx', 'KeysPanel.jsx',
    'PrivacyPanel.jsx', 'BackupPanel.jsx', 'DataPanel.jsx'
  ].map((f) => path.join(ROOT, 'src/components', f))
  const settingsParts = settingsFiles.map((p) => readFileSync(p, 'utf8'))
  // The panel split rendered <ShortcutList /> without importing it: every
  // canonical test passed because none of them open the keyboard panel, and
  // the orphaned settings-ui suite that would have caught the crash was never
  // wired in. Pin the import next to the file that renders it.
  check(
    'the keyboard panel imports the shortcut list it renders',
    /import ShortcutList from '\.\/KeyboardShortcuts\.jsx'/.test(settingsParts[settingsFiles.findIndex((p) => p.endsWith('KeysPanel.jsx'))]) &&
      /<ShortcutList \/>/.test(settingsParts[settingsFiles.findIndex((p) => p.endsWith('KeysPanel.jsx'))]),
    'KeysPanel.jsx lost the KeyboardShortcuts import'
  )
  const blankLeft = settingsParts.filter((s) => /target="_blank"/.test(s))
  check(
    'the settings sheet has no target=_blank links',
    blankLeft.length === 0,
    'remaining: ' + blankLeft.length
  )
  check('external links go through openExternal', settingsParts.some((s) => /openExternal\(/.test(s)))
  const missingImport = settingsFiles.filter(
    (p, i) => /openExternal\(/.test(settingsParts[i]) && !/from '\.\.\/shared\/openExternal\.js'/.test(settingsParts[i])
  )
  check('openExternal is imported', missingImport.length === 0,
    missingImport.map((p) => path.basename(p)).join(', '))

  const helper = readFileSync(path.join(ROOT, 'src/shared/openExternal.js'), 'utf8')
  check('openExternal uses the Capacitor Browser plugin', /Plugins\?\.Browser/.test(helper))
  check('openExternal falls back rather than leaving a dead tap', /window\.location\.assign/.test(helper))
  // It must not statically import the plugin, or the web shim ships to the web
  // bundle for no reason.
  check('openExternal resolves the plugin at call time, not by import',
    !/^import .*@capacitor\/browser/m.test(helper))

  // And the mail link, which had its own bug: assigning href during the click
  // is too late, the browser has already followed href="#".
  const email = readFileSync(path.join(ROOT, 'src/components/ObfuscatedEmail.jsx'), 'utf8')
  check('the mail link prevents the default before assigning mailto',
    /e\.preventDefault\(\)/.test(email))
  check('the mail link assigns the mailto explicitly',
    /location\.assign\(`mailto:/.test(email))
  check('the mail link no longer assigns href during the click',
    !/currentTarget\.href\s*=\s*`mailto:/.test(email))
}
// Oct 20 styling pass: the settings/legal surface asked for a list of small
// spacing and affordance corrections. Each is a visible pixel the user named,
// so each is pinned rather than trusted to survive the next restyle.
{
  const css = readFileSync(path.join(ROOT, 'src/styles.css'), 'utf8')
  const sel = css.match(/\.field-select \{[^}]*\}/)
  const selRule = sel ? sel[0] : ''
  check('the dropdown draws its own chevron with room from the right edge',
    /appearance:\s*none/.test(selRule) &&
      /background-position:\s*right\s*(1[4-9]|[2-9]\d)px/.test(selRule) &&
      /padding:\s*12px\s*(3[4-9]|[4-9]\d)px/.test(selRule),
    selRule || '.field-select rule not found')
  check('the settings header sits close to the modal edge',
    /\.sheet-head \{[^}]*padding:\s*14px\s*(1[0-5]|[0-9])px/.test(css),
    (/\.sheet-head \{[^}]*padding:[^;]*/.exec(css) || ['(absent)'])[0])
  check('the movable-modal handle line is gone from the sheets',
    !/sheet-handle/.test(css) &&
      !/sheet-handle/.test(readFileSync(path.join(ROOT, 'src/components/SettingsSheet.jsx'), 'utf8')) &&
      !/sheet-handle/.test(readFileSync(path.join(ROOT, 'src/components/KeyboardHelp.jsx'), 'utf8')),
    'the drag-handle pill under the header is what made the modal read as movable')
  const presenceRow = (/\.presence-row \{[^}]*\}/.exec(css) || [''])[0]
  const presenceLabel = (/\.presence-label \{[^}]*\}/.exec(css) || [''])[0]
  check('the presence state line has air above it',
    /padding:\s*2px 0 (1[2-9]|[2-9]\d)px/.test(presenceRow),
    presenceRow || '.presence-row rule not found')
  check("the hint under 'Show my prayer to others' is not glued to it",
    /gap:\s*(6|7|8)px/.test(presenceLabel),
    presenceLabel || '.presence-label rule not found')
  const data = readFileSync(path.join(ROOT, 'src/components/DataPanel.jsx'), 'utf8')
  check("the Your data panel has no rule line above 'Privacy & Care'",
    (data.match(/field-divider/g) || []).length === 1 &&
      !/field-divider[\s\S]{0,160}settings\.legal/.test(data),
    'the divider the Oct 20 pass questioned is still before the legal button')
  check('the Privacy & Care sheet back control starts on the content edge',
    /\.legal-sheet > \.settings-panel-head \{[^}]*padding-left:\s*22px/.test(css),
    'the legal sheet head sits outside .sheet-body, so it needs the 22px inset itself')
  check('the legal page back row has air below it before the title',
    /\.legal-view \.back-row \{[^}]*margin-bottom:\s*(1[0-9]|[2-9]\d)px/.test(css),
    'the arrow sat pinned against the big Privacy / Terms title')
  const back = (/\.settings-back \{[^}]*\}/.exec(css) || [''])[0]
  check('the settings back control is the same round arrow as everywhere else',
    /width:\s*38px/.test(back) && /place-items:\s*center/.test(back) && /border-radius:\s*50%/.test(back),
    back || '.settings-back rule not found')
  const shellSrc = readFileSync(path.join(ROOT, 'src/components/PanelShell.jsx'), 'utf8')
  const legalSheetSrc = readFileSync(path.join(ROOT, 'src/components/LegalSheet.jsx'), 'utf8')
  for (const [name, src] of [['sub-panels', shellSrc], ['the legal sheet', legalSheetSrc]]) {
    check(`the back control in ${name} is the arrow, with the word as its label`,
      /aria-label=\{t\('settings\.back'\)\}/.test(src) &&
        /←/.test(src) && !/‹\s*\{t\('settings\.back'\)\}/.test(src),
      name + ' still shows a ‹-plus-word hybrid back button')
  }
  check('a pressed control answers inside the tap, not over the hover transition',
    /gear-btn:active,[^{]*\{[^}]*transition-duration:\s*0\.0\d/.test(css) &&
      /\.gear-btn:active,/.test(css) && /scale\(0\.94\)/.test(css),
    'the settings gear is the reported case: the sheet opens after a chunk load, and a 0.3s press shows nothing in a quick tap')
  check('the last legal section carries the rule above it',
    /\.legal-view \.legal-page-section:last-child \{[^}]*border-top/.test(css),
    'the Oct 20 pass asked for a line above 14. Effective Date - the pin is the last-section rule that draws it')
}
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
  const ramp = src.match(/_rampMaster\(target\)\s*\{[\s\S]{0,2000}?\n  \}/)
  const body = ramp ? ramp[0] : ''
  // A short exponential reaches ~63% of the gap in 70 ms and, unlike
  // cancelScheduledValues + setValueAtTime(gain.value), cannot resume from a
  // stale reading and jump.
  check('the fall uses a short time constant', /setTargetAtTime\([^)]*,\s*rising\s*\?\s*0\.8\s*:\s*0\.0?\d/.test(body), body.slice(0, 160))
  check('the fade does not cancel-and-resume from gain.value (click risk)',
    !/cancelScheduledValues/.test(body) && !/setValueAtTime\(g\.value/.test(body))
  check('rising volume still swells gently', /0\.8/.test(body))
  // Repeated identical setLevel calls must not re-issue setTargetAtTime: that
  // restarts the exponential from the current value, so the gain steps instead
  // of settling - the clicking heard while scrolling the settings sheet
  // mid-prayer.
  check('an identical gain target is not re-scheduled',
    /_lastRampTarget === target\) return/.test(body),
    'no idempotency guard on the ramp')
  check('the guard is cleared when a new audio graph is built',
    /this\.master\s*=\s*this\.ctx\.createGain\(\)[\s\S]{0,200}_lastRampTarget = null/.test(src),
    'a new AudioContext would inherit a stale target and never ramp')
}

// --- legal text falls back to English ---------------------------------------
{
  const i18n = readFileSync(path.join(ROOT, 'src/i18n.js'), 'utf8')
  check('the legal text is English-only in the app, except the "English governs" note',
    /legalIsEnglishOnly/.test(i18n) &&
      /\(\?!langNote\$\)/.test(i18n) &&
      /const LEGAL_ENGLISH_ONLY = \/\^legal\\\./.test(i18n),
    'a legal key could still resolve to a locale translation')
  check('a legal key resolves through en, not the locale table',
    /legalIsEnglishOnly\(key\)\s*\n?\s*\?\s*en\[key\]/.test(i18n))

  // The hosted policy is what Play links to. If the in-app sheet could ever
  // resolve to a different text, the app would be able to contradict the document
  // it points at.
  const enLocale = readFileSync(path.join(ROOT, 'src/locales/en.js'), 'utf8')
  check('the English legal text states the default rather than denying it',
    /on by default/.test(enLocale.match(/'legal\.priv9':[^\n]*/)?.[0] || '') &&
      /on by default/.test(enLocale.match(/'legal\.priv11':[^\n]*/)?.[0] || ''),
    'priv9/priv11 still claim sharing is off until turned on')
}

// --- the ambient bed must actually be adjustable ---------------------------
//
// Two bugs lived here. The bed gain was `(0.2 + 0.8 * ambienceLevel)`, so the
// slider at 0 still played at a fifth of full and read as broken; and the
// prayer-view fader only moved the voice, so the one control labelled "volume"
// next to the main action did not change the room. Neither was reachable by a
// test until the arithmetic was pulled out of the class, because both needed an
// AudioContext to observe.
{
  const { bedTarget, BED_HEADROOM } = await import('../src/audio/ambience.js')
  const at = (level, ambienceLevel, volume) =>
    bedTarget({ level, ambienceLevel, volume })

  check('the bed reaches true silence when the ambient slider is 0',
    at(0.9, 0, 1) === 0, 'target=' + at(0.9, 0, 1))
  check('the bed reaches true silence when the master volume is 0',
    at(0.9, 1, 0) === 0, 'target=' + at(0.9, 1, 0))
  check('the bed reaches true silence when the engine is stopped',
    at(0, 1, 1) === 0, 'target=' + at(0, 1, 1))
  check('the bed is not silent at any non-zero setting',
    at(0.9, 1, 1) > 0 && at(0.9, 0.05, 1) > 0, 'target=' + at(0.9, 0.05, 1))

  // Monotonic in each factor: raising any slider never lowers the bed, which is
  // the whole point of a slider.
  let mono = true
  for (const f of ['level', 'ambienceLevel', 'volume']) {
    for (let i = 1; i <= 20; i++) {
      const lo = {}
      const hi = {}
      lo.level = 0.9; lo.ambienceLevel = 0.9; lo.volume = 0.9
      hi.level = 0.9; hi.ambienceLevel = 0.9; hi.volume = 0.9
      lo[f] = (i - 1) / 20
      hi[f] = i / 20
      if (at(hi.level, hi.ambienceLevel, hi.volume) < at(lo.level, lo.ambienceLevel, lo.volume)) {
        mono = false
      }
    }
  }
  check('raising any of the three never lowers the bed', mono)

  check('the bed gain stays within Web Audio\'s safe range',
    BED_HEADROOM * 1 * 1 * 1 <= 8, 'headroom=' + BED_HEADROOM)

  // Out-of-range and junk input must clamp to silence rather than produce a
  // negative or NaN gain, which Web Audio would reject or turn into a click.
  const nasty = [at(NaN, 1, 1), at(1, -5, 1), at(1, 1, 99), at(undefined, undefined, undefined)]
  check('junk input clamps to a safe gain rather than NaN',
    nasty.every((g) => Number.isFinite(g) && g >= 0), JSON.stringify(nasty))

  // The seven beds are hand-tuned per preset, so their loudness was whatever
  // the inline literals happened to produce - measured, that ran from 0.67x to
  // 1.54x the median ("some are louder than others"). The fix is one trim
  // table applied at the preset bus; pin the table's shape here and the
  // rendered levels in test-audio-ambient's OfflineAudioContext band.
  {
    const { PRESET_TRIM } = await import('../src/audio/ambience.js')
    const { AMBIENT_PRESETS } = await import('../src/audio/presets.js')
    const missing = AMBIENT_PRESETS.filter((p) => !(p in PRESET_TRIM))
    check('every ambient preset has a loudness trim',
      missing.length === 0 && Object.keys(PRESET_TRIM).length === AMBIENT_PRESETS.length,
      'missing=' + JSON.stringify(missing))
    const vals = Object.values(PRESET_TRIM)
    check('every trim is a sane finite level',
      vals.every((v) => Number.isFinite(v) && v >= 0.5 && v <= 2),
      JSON.stringify(PRESET_TRIM))
    const ambSrc = readFileSync(path.join(ROOT, 'src/audio/ambience.js'), 'utf8')
    check('buildPreset applies the trim on the preset bus',
      /linearRampToValueAtTime\(PRESET_TRIM\[id\] \?\? 1/.test(ambSrc),
      'the bus ramp no longer reads PRESET_TRIM - a rebuilt bed would skip its level')
  }

  // Every volume control must go through the shared applyVolumes(), or the
  // asymmetry comes straight back. Asserted as an invariant rather than by
  // matching a window of source: a component that pushes to an engine directly
  // is the bug, wherever the line happens to sit.
  const prayer = readFileSync(path.join(ROOT, 'src/pages/PrayerPage.jsx'), 'utf8')
  const sound = readFileSync(path.join(ROOT, 'src/components/SoundControls.jsx'), 'utf8')
  const mute = readFileSync(path.join(ROOT, 'src/audio/mute.js'), 'utf8')
  const volumes = readFileSync(path.join(ROOT, 'src/audio/volumes.js'), 'utf8')
  check('the prayer view sets volume through applyVolumes, not an engine directly',
    /applyVolumes/.test(prayer) && !/speech\.setVolume\(/.test(prayer) && !/ambient\.setVolume\(/.test(prayer),
    'a direct engine push in PrayerPage can only ever set one of the two')
  check('the settings sound controls set volume through applyVolumes',
    /applyVolumes/.test(sound) && !/speech\.setVolume\(/.test(sound) && !/ambient\.setVolume\(/.test(sound))
  check('mute delegates to applyVolumes rather than doing its own push',
    /applyVolumes\(\)/.test(mute) && !/speech\.setVolume/.test(mute) && !/ambient\.setVolume/.test(mute))
  check('applyVolumes is the only place that pushes volume into both engines',
    /speech\.setVolume/.test(volumes) && /ambient\.setVolume/.test(volumes))
// The store runs a module-level setInterval for the prayer clock, which is
  // correct in a browser and fatal in Node: a pending timer holds the event loop
  // open, so every script that imported it - including this one - finished and
  // then hung. It showed up as a CI job stuck for 20+ minutes with every check
  // already green. Asserted as source because the symptom is a hanging process,
  // which this file cannot observe from inside itself.
  const storeSrc = readFileSync(path.join(ROOT, 'src/store.js'), 'utf8')
  check('the prayer-clock interval cannot keep a Node process alive',
    /setInterval\(creditPrayerClock, 1000\)\?\.unref\?\.\(\)/.test(storeSrc),
    'a module-level timer without unref() hangs any Node script that imports the store')

  // Importing the store must therefore not leak a handle. Checked by loading it
  // in a child process and asserting that process exits on its own.
  const leak = spawnSync(process.execPath, ['-e', "import('./src/store.js')"], {
    cwd: ROOT,
    timeout: 20000,
    encoding: 'utf8'
  })
  check('a script that only imports the store exits on its own',
    !leak.error && leak.signal === null && leak.status === 0,
    leak.error ? leak.error.message : `signal=${leak.signal} status=${leak.status}`)
}

// --- sound must never clip, and never be cut while it is still audible -----
// Reported as a crunchy, glitchy quality that arrives when a lot happens fast
// (scrolling hard, a burst of taps), and as a soft periodic click with no
// trigger at all. Six distinct causes, each asserted here: samples leaving Web
// Audio above full scale, a gain written instead of moved, a phrase stopped
// mid-waveform, a wall-clock watchdog mistaking a busy main thread for a dead
// engine, the noise loop wrapping with a step once every three seconds, and a
// decoded phrase starting at full amplitude from its first sample. There is no
// harness in this file that can listen to output, so every check is over
// source or over the pure arithmetic.
{
  const amb = readFileSync(path.join(ROOT, 'src/audio/ambience.js'), 'utf8')
  const speech = readFileSync(path.join(ROOT, 'src/audio/speech.js'), 'utf8')
  const { ceilingCurve, CEILING_KNEE } = await import('../src/audio/ambience.js')

  // The ceiling, tested as arithmetic rather than as text: full scale in, and
  // nothing above full scale may come out.
  const curve = ceilingCurve(4097)
  let peak = -Infinity
  let monotonic = true
  for (let i = 0; i < curve.length; i++) {
    peak = Math.max(peak, curve[i])
    if (i > 0 && curve[i] < curve[i - 1]) monotonic = false
  }
  check('no sample can leave the output ceiling above full scale',
    peak < 1 && curve[curve.length - 1] < 1, 'peak=' + peak)
  check('the ceiling never folds a signal back on itself', monotonic,
    'a non-monotonic transfer curve inverts the waveform it is supposed to tame')

  // Exactly linear below the knee, or the ceiling colours ordinary levels -
  // and a limiter you can hear is not an improvement.
  const kneeAt = Math.round(((CEILING_KNEE + 1) / 2) * (curve.length - 1))
  let linear = true
  for (let i = kneeAt - 12; i < kneeAt - 1; i++) {
    if (Math.abs(curve[i + 1] - curve[i] - (curve[i] - curve[i - 1])) > 1e-6) linear = false
  }
  check('ordinary levels pass through the ceiling untouched', linear)

  check('the output ceiling is wired into the graph',
    /createWaveShaper\(\)[\s\S]{0,600}limiter\.connect\(this\.ceiling\)[\s\S]{0,300}ceiling\.connect\(this\.ctx\.destination\)/.test(amb),
    'a ceiling that nothing connects to guarantees nothing')

  // The looping noise buffer every "air" layer plays used to wrap with a hard
  // step: brown noise ends wherever the random walk wandered, and jumping back
  // to sample 0 is a discontinuity once every 3 seconds - a periodic click on
  // all seven beds, belonging to no gesture and no control. The generator is
  // pure, so the seam is asserted directly: seed Math.random so the buffer is
  // identical on every machine, and require the wrap step to stay inside the
  // bound the walk's own consecutive samples already respect.
  const { makeNoiseBuffer } = await import('../src/audio/ambience.js')
  const fakeCtx = {
    sampleRate: 44100,
    // One channel array, returned for every call: the generator writes
    // through getChannelData(0) and the assertions read it back, so a fake
    // that mints a fresh array per call would hand both sides different
    // buffers and compare zeros.
    createBuffer: (ch, len, sr) => {
      const data = new Float32Array(len)
      return { length: len, sampleRate: sr, getChannelData: () => data }
    }
  }
  let lcg = 42
  const realRandom = Math.random
  Math.random = () => {
    lcg = (lcg * 1664525 + 1013904223) >>> 0
    return lcg / 4294967296
  }
  let noise
  try {
    noise = makeNoiseBuffer(fakeCtx, { seconds: 3 })
  } finally {
    Math.random = realRandom
  }
  const nd = noise.getChannelData(0)
  const seam = Math.abs(nd[0] - nd[nd.length - 1])
  let maxStep = 0
  for (let i = 1; i < nd.length; i++) {
    maxStep = Math.max(maxStep, Math.abs(nd[i] - nd[i - 1]))
  }
  check('the looping noise buffer is continuous at its loop point',
    seam <= 0.09,
    `wrap step ${seam.toFixed(3)} vs in-loop max step ${maxStep.toFixed(3)} - a step here is a click every 3 seconds on every bed`)
  // The crossfade region blends two independent halves of the walk, so its
  // steps can approach the sum of two walk steps (~0.13 worst case) - that
  // is the price of a seamless wrap and is inaudible inside filtered air
  // layers. The seam itself is held to ONE walk step (the check above); this
  // bound only catches a blend gone wrong (weights flipped, double-write).
  check('the crossfade region stays within two walk steps',
    maxStep <= 0.15,
    `in-loop max step ${maxStep.toFixed(3)}`)

  // A decoded phrase starts at full gain from its first sample. If that sample
  // is not zero - and a recording's first sample is only zero by luck - the
  // graph sees a step and the shared limiter pumps the bed behind it: one
  // click on the voice, heard as the room clicking. The start must ramp in.
  const voiceBranch = (speech.match(/const gain = ctx\.createGain\(\)[\s\S]{0,1400}?src\.start\(0, 0\)/) || [''])[0]
  check('a decoded phrase fades in instead of starting at full amplitude',
    /linearRampToValueAtTime|setTargetAtTime/.test(voiceBranch) && !/gain\.gain\.value\s*=/.test(voiceBranch),
    voiceBranch.slice(0, 260) || 'the buffer-source phrase start was not found in speech.js')

  // Moving a gain while a phrase sounds must be a move. Assigning .value is a
  // step between two adjacent samples, which is a click - and the volume
  // slider, mute, and anything ending in applyVolumes() all arrive here.
  const setVol = (speech.match(/setVolume\(volume\)\s*\{[\s\S]{0,900}?\n  \}/) || [''])[0]
  check('the voice gain ramps instead of stepping',
    /setTargetAtTime/.test(setVol) && !/gain\.value\s*=/.test(setVol),
    setVol.slice(0, 220))
  check('the element volume ramps instead of stepping',
    /_rampElementVolume\(this\.cloudAudio/.test(setVol))
  check('the element route re-tunes on the audio thread when it is in the graph',
    /this\._elGain\.gain\.setTargetAtTime/.test(setVol) &&
      /this\._elTarget = vol/.test(setVol),
    'a slider drag would step el.volume under the graph instead of ramping the gain')

  // A phrase stopped at full amplitude ends mid-waveform. The fade has to be
  // scheduled before the stop, and the stop has to be in the future.
  const stopBody = (speech.match(/stopCloudSource\(\)\s*\{[\s\S]{0,4000}?\n  \}/) || [''])[0]
  check('a playing phrase is faded before it is cut',
    /setTargetAtTime\(0\.0001/.test(stopBody) && /src\.stop\(t \+ /.test(stopBody),
    stopBody.slice(0, 240))

  // The bed's teardown used exactly the pattern _rampMaster's own comment
  // warns about - resuming a ramp from a reading of gain.value - and rapid bed
  // switching walked straight into it. Comments are stripped first: the fix
  // names the pattern it rejects, so a raw match would read its own prose as a
  // failure.
  const stripComments = (text) =>
    text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
  const teardown = stripComments((amb.match(/_teardownPreset\(\)\s*\{[\s\S]{0,6000}?\n  \}/) || [''])[0])
  check('the bed fades without resuming from a stale gain reading',
    !/setValueAtTime\(g\.value/.test(teardown) && /setTargetAtTime\(0\.0001/.test(teardown),
    teardown.slice(0, 240))

  // The clock is not evidence. Under load Date.now() runs past the limit while
  // the phrase is healthy, and the "restart" it performs is a cut plus the
  // phrase from the top - repeated, that is the crackle that follows activity.
  // One stale read is not evidence either: two consecutive non-ok observations
  // (12s of disagreement) separate a dead engine from a busy frame loop.
  check('the watchdog asks the engine before cutting a healthy phrase',
    /elapsed > \(j\.phraseHold \|\| 4000\) \* 2 \+ 4000 && health !== 'ok' && this\._stallHits >= 2/.test(speech),
    'elapsed time alone mistook a busy main thread for a dead engine')
  check('the stall guard also waits while a phrase is still sounding',
    /voiceHealth\(\) === 'ok'/.test(speech))

  // The phone plays every phrase through the shared <audio> element, so its
  // boundaries are the ones the ear judges. Three defects met there: the
  // fade-in ran on requestAnimationFrame (a Pixel idling near 10fps frames
  // collapses a 60ms ramp to one write - the very click it removed), a cut
  // paused the element at full amplitude (a step to silence at every
  // boundary, supersede and restart), and a single stale currentTime under
  // load hard-restarted a healthy phrase.
  const rampBody = stripComments(
    (speech.match(/_rampElementVolume\(el, target, ms = 60\) \{[\s\S]{0,3200}?\n  \}/) || [''])[0]
  )
  check('the element volume ramp is driven by timers, not frames',
    !!rampBody && /setTimeout/.test(rampBody) && !/requestAnimationFrame/.test(rampBody),
    rampBody ? 'the fade-in still rides frame pacing and collapses under jank' : '_rampElementVolume(el, target, ms) not found')
  check('a superseded volume ramp still resolves its promise',
    !!rampBody && /this\._volDone = resolve/.test(rampBody) && /done\(\)/.test(rampBody),
    rampBody ? 'a slider drag during a cut leaves the pending fade unresolvable - the next phrase never starts' : '_rampElementVolume not found')
  const cutBody = stripComments(
    (speech.match(/_cutElement\(ms = 35\) \{[\s\S]{0,2400}?\n  \}/) || [''])[0]
  )
  check('a phrase boundary fades the element out before the cut',
    !!cutBody && /_elGain\.gain\.setTargetAtTime\(0\.0001/.test(cutBody) &&
      /_rampElementVolume\(el, 0\.001, ms\)/.test(cutBody) && /el\.pause\(\)/.test(cutBody) &&
      /await this\._silenceElement\(\)/.test(speech) && /this\._cutElement\(\)/.test(stopBody),
    cutBody ? 'the element still pauses at full amplitude on some route' : '_cutElement not found')
  // The graph route the phone plays through: one guarded attach, fades on the
  // audio thread, and the stepped timer kept only as the fallback for a
  // context that is not running (the element still sounds without the graph).
  const phraseOut = stripComments(
    (speech.match(/_phraseOut\(\) \{[\s\S]{0,2600}?\n  \}/) || [''])[0]
  )
  check('the element joins the shared graph through one guarded attach',
    !!phraseOut && /createMediaElementSource\(el\)/.test(phraseOut) &&
      /gain\.connect\(this\._outNode\(ctx\)\)/.test(phraseOut) &&
      /ctx\.state !== 'running'/.test(phraseOut) &&
      !/gain\.value\s*=/.test(phraseOut),
    phraseOut ? 'the attach lost its guard or steps a gain' : '_phraseOut not found')
  check('the graph attach leaves no stale element-volume timer running',
    !!phraseOut && /this\._volTimer/.test(phraseOut) && /clearTimeout\(this\._volTimer\)/.test(phraseOut),
    phraseOut ? 'a fallback-era ramp keeps writing el.volume under the graph' : '_phraseOut not found')
  // Only _rampElementVolume ends a ramp - by finishing it, or by a newer
  // ramp superseding it (which resolves the promise first). stopCloudSource
  // clearing the shared timer killed a running cut's last tick without
  // settling _volDone, so the promise _cutElement awaits never settled: stop
  // mid-phrase, press play, and the first phrase waited forever on a fade
  // that could no longer finish - recorded audio silently never starting.
  const stopClean = stripComments(stopBody)
  check('a stop while a fade is running does not strand the fade',
    !!stopClean && !/_volTimer|_volDone/.test(stopClean),
    stopClean ? 'stopCloudSource kills the fade timer without settling its promise - the next phrase waits forever' : 'stopCloudSource not found')
  check('the watchdog needs two stalled reads before it cuts',
    /this\._stallHits = \(this\._stallHits \|\| 0\) \+ 1/.test(speech) &&
      /health === 'ok'\) \{\s*this\._stallHits = 0/.test(speech),
    'one stale currentTime under load still hard-restarts a healthy phrase')

  // Without a user activation the browser does not reject resume() - it leaves
  // the promise pending forever. Awaiting it directly hung speakCloud inside
  // the suspended-graph branch: no element assigned, no source started, only
  // the safety net advancing through silence (the reported "voices stopped").
  // Both awaits of it - the phrase's own resume and ambience ensure(), which
  // start() blocks on - must race a deadline so a pend falls through the way a
  // refusal always did, and speakCloud must latch a pending one so each later
  // phrase of the same suspension does not pay the deadline again.
  const speechResumeRace = stripComments(speech)
  check('a resume that never settles still falls through to the element backup',
    /Promise\.race\(\[\s*ctx\.resume\(\)\.then\(/.test(speechResumeRace) &&
      !/await ctx\.resume\(\)/.test(speechResumeRace),
    'speakCloud awaits resume() directly again - a pending resume hangs the phrase with no audio at all')
  check('a hung resume is paid once per suspension, not once per phrase',
    /this\._resumeHung = true/.test(speechResumeRace) && /if \(!this\._resumeHung\)/.test(speechResumeRace),
    'the resume deadline is charged for every phrase while the graph stays suspended')
  const ensureResumeRace = stripComments(amb)
  check('starting the bed cannot hang on a pending resume',
    /Promise\.race\(\[\s*this\.ctx\.resume\(\)/.test(ensureResumeRace),
    'ambient.ensure() returns resume() directly - start() awaits it and hangs with the graph suspended')

  // The mid-prayer voice switch (the reported swarea -> madhur silence) runs
  // stop() then start() inside one tap, and three unguarded seams turned that
  // rebuild into permanent silence: the Android service calls issued
  // unordered (a stop landing after the start left _fgsOn latched over a dead
  // service), the element branch writing to the shared element after its last
  // await with no ownership recheck (a stale continuation repointed src at the
  // old recording and replaced the new job's onended), and stop() clearing
  // synth's queue with cancel() but not its paused flag - after which the
  // next job's speak() queues behind a paused synth and never fires.
  const sp = stripComments(speech)
  const fgsBody = (sp.match(/_fgs\(on\) \{[\s\S]{0,1600}?\n  \}/) || [''])[0]
  check('the foreground-service stop/start runs in issue order',
    !!fgsBody && /this\._fgsSeq = Promise\.resolve\(this\._fgsSeq\)/.test(fgsBody) &&
      /\.then\(\(\) =>/.test(fgsBody),
    fgsBody ? '_fgs fires the native calls unordered again - a voice switch can leave the service dead while _fgsOn says it is up' : '_fgs(on) not found')
  const iSil = sp.indexOf('await this._silenceElement()')
  const iEl = sp.indexOf('const el = this._elementEl()', iSil)
  const silSeg = iSil >= 0 && iEl > iSil ? sp.slice(iSil, iEl) : ''
  check('the element branch re-owns the element after the silence wait',
    !!silSeg && silSeg.includes('if (!isCurrent()) return true'),
    'a superseded continuation writes el.src/onended for a dead job after _silenceElement - the live phrase never advances')
  const iPlay = sp.indexOf('await el.play()')
  const iRamp = sp.indexOf('this._rampElementVolume(el, target)', iPlay)
  // Both fade-ins live after the guard: the graph ramp (if (out) {...}) and
  // the stepped fallback. The window spans both.
  const playSeg = iPlay >= 0 && iRamp > iPlay && iRamp - iPlay < 900 ? sp.slice(iPlay, iRamp) : ''
  check('a phrase superseded during play() is not ramped',
    !!playSeg && playSeg.includes('if (!isCurrent()) return true') && playSeg.includes('if (out)'),
    'a stale ramp re-volumes the shared element the new job took over')
  const iCancel = sp.lastIndexOf('this.synth.cancel()')
  const stopSeg = iCancel >= 0 ? sp.slice(iCancel, iCancel + 300) : ''
  check('stop() unblocks the synth queue as well as clearing it',
    /synth\.cancel\(\)[\s\S]{0,200}?synth\.resume\(\)/.test(stopSeg),
    'cancel() alone can leave the synth paused - the next job speaks into a paused queue and stays silent')

  // Each preview call built a fresh Audio element and kept no handle, so
  // auditioning voices in quick succession stacked them at full volume.
  check('only one voice preview can play at a time',
    /this\._previewAudio = audio/.test(speech) && /this\._previewAudio\.pause\(\)/.test(speech),
    'an unreferenced preview element cannot be stopped')

  // The engine used to force the bed's volume to 1 on start, so a prayer could
  // begin louder than the very slider that governs it, and start() used to ring
  // a second bowl on top of the call site's own.
  const startBody = (amb.match(/async start\(\)\s*\{[\s\S]{0,2400}?\n  \}/) || [''])[0]
  check('starting a prayer respects the master volume',
    /s\.muted \? 0 : s\.volume \?\? 1/.test(startBody),
    startBody.slice(-260))
  check('the engine does not ring a bowl the call site already rings',
    !/this\.ring\(/.test(startBody))
}

// --- sharing must go through the hardened path ---------------------------
  // PrayerPage used to hand-roll this: navigator.share, then a bare
  // navigator.clipboard.writeText awaited directly. That last one can stay
  // pending forever where the clipboard permission prompt is suppressed, so the
  // tap gave no feedback and no error, and it had no execCommand fallback - the
  // only copy path that works in the Android/iOS WebView.
  const prayerPage = readFileSync(path.join(ROOT, 'src/pages/PrayerPage.jsx'), 'utf8')
  // Comments are stripped first: the comment explaining WHY this used to be
  // hand-rolled necessarily names navigator.clipboard.writeText, so the negative
  // check below would otherwise fail on its own explanation.
  //
  // Split on \r?\n, not \n: a checkout with core.autocrlf=true leaves a \r at
  // the end of every line, and `.` does not match \r, so a /^\/\/.*$/ strip
  // silently missed every line comment. The check then failed locally while CI
  // checked out LF and passed - the guard only ever worked on one platform.
  const prayerCode = prayerPage
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*\/\/.*$/, ''))
    .join('\n')
  check('the prayer page shares through shareLink, not a raw clipboard call',
    /shareLink\(/.test(prayerCode) &&
      !/navigator\.clipboard\.writeText/.test(prayerCode) &&
      /shared\/share\.js/.test(prayerCode),
    'a hand-rolled share reintroduces the hang and the missing WebView fallback')

  // --- storage writes are guarded ------------------------------------------
  // A bare setItem throws in private mode, on a full quota, and in some
  // locked-down WebViews. In a click handler the throw happens before the state
  // update, so the control silently stops working.
  const homePage = readFileSync(path.join(ROOT, 'src/pages/HomePage.jsx'), 'utf8')
  const storageWrites = [...homePage.matchAll(/localStorage\.(setItem|removeItem)\([^)]*\)/g)]
  let unguarded = []
  for (const m of storageWrites) {
    const context = homePage.slice(Math.max(0, m.index - 260), m.index)
    if (!/\btry\s*\{/.test(context)) unguarded.push(m[0])
  }
  check('every storage write in HomePage sits inside a try', unguarded.length === 0,
    unguarded.join(' | ') || 'all guarded')

  // --- the CI workflow must stay structurally sound ----------------------
  // An edit once matched an existing step's text and replaced it from column 0,
  // de-indenting it out of the `steps:` list. GitHub rejected the whole file, so
  // no job ran at all and the run reported failure with no failing check - which
  // is worse than a red test, because nothing local notices.
  //
  // This is deliberately dependency-free. A full YAML parse would want a new
  // package, and adding one to a privacy-first app to validate its own CI is a
  // poor trade; the failure mode here is structural indentation, which is cheap
  // to check directly. scripts/audit-workflow.mjs does the full parse when the
  // yaml package happens to be present.
{
  const wf = path.join(ROOT, '.github/workflows/test.yml')
  const lines = readFileSync(wf, 'utf8').split(/\r?\n/)
  const offenders = []
  lines.forEach((line, i) => {
    if (!/^\s*-\s*(name|run|uses):/.test(line)) return
    const indent = (line.match(/^\s*/) || [''])[0].length
    // Allowed indents: 2 = a list under a key, 6 = a step in a job, 8 = a key
    // inside a step, 10 = deeper still. Anything else is a step that escaped
    // its list.
    if (![2, 6, 8, 10].includes(indent)) {
      offenders.push(`${i + 1} indent=${indent}: ${line.trim().slice(0, 44)}`)
    }
  })
  check('every workflow step sits at a valid indent', offenders.length === 0,
    offenders.join(' | ') || 'all steps nested correctly')

  // The translated prayer text is the one source file no suite named. It is an
  // object literal keyed by the English phrase, so it carries exactly the
  // duplicate-key risk that shipped a mojibake string in zh.js.
  const l10n = readFileSync(path.join(ROOT, 'src/i18n/prayerL10n.js'), 'utf8')
  const phrases = [...l10n.matchAll(/^\s*'((?:[^'\\]|\\.)*)'\s*:\s*\{/gm)].map((m) => m[1])
  const dupes = phrases.filter((p, i) => phrases.indexOf(p) !== i)
  check('no prayer phrase is defined twice (the second would silently win)',
    dupes.length === 0, dupes.map((d) => JSON.stringify(d.slice(0, 40))).join(' | ') || `${phrases.length} distinct phrases`)

  check('the prayer phrases carry no replacement characters',
    !l10n.includes('\uFFFD'), 'a mangled encoding would render as garbage in a prayer')
  const l10nLocales = [...new Set([...l10n.matchAll(/\b(es|fr|de|pt|it|ru|zh|ar|ja|ko|hi)\s*:\s*'/g)].map((m) => m[1]))]
  check('the prayer phrases cover every locale they claim to',
    l10nLocales.length >= 10, `locales found: ${l10nLocales.join(', ')}`)

  // The spirituality marks are pure data with no suite behind them, and one
  // shipped as two ASCII question marks. A commit that rewrote source files
  // replaced Buddhism's Wheel of Dharma with `??`, and since then every tile,
  // picker row and feed pill has drawn `??` with nothing reporting it - the
  // mojibake checks above all read locale files, and none of them look here.
  //
  // A question mark can never be part of an emoji, and no symbol this app uses
  // sits below U+2000 (the lowest real one is U+262A), so those two rules
  // catch a placeholder, a truncated character and a lost encoding alike.
  const { SPIRITUALITIES } = await import('../src/data/prayers.js')
  const badMarks = SPIRITUALITIES.filter((s) => {
    const mark = String(s.emoji ?? '')
    if (!mark) return true
    if (mark.includes('?') || mark.includes('\uFFFD')) return true
    const cp = mark.codePointAt(0)
    return !cp || cp < 0x2000
  }).map((s) => `${s.id}=${JSON.stringify(s.emoji)}`)
  check('every spirituality carries a real symbol, not placeholder punctuation',
    badMarks.length === 0,
    badMarks.join(' | ') || `${SPIRITUALITIES.length} marks are symbols`)

  // A job with no steps would pass an indent check while running nothing.
  const stepRuns = lines.filter((l) => /^\s{8}run:\s*\S/.test(l)).length
  check('the workflow still runs a meaningful number of commands', stepRuns >= 8,
    `only ${stepRuns} run: lines found`)
}

// --- 6. The three phone bugs nothing had a guard for -------------------------
// Earth graphics, recorded audio, and the offline index. All three were
// behaviour a desktop browser test cannot see: the first two only bite on a
// packaged Android build, the third only bites once the service worker has a
// stale copy of something the app cannot recover from.
{
  // (a) The Earth must be chosen by hardware, never by packaging. The fallback
  // for weak devices is real, but keying it on Capacitor shipped a static,
  // dimmer globe to every phone - the devices with the most GPU in the room -
  // while a browser tab on a five-year-old laptop got the live scene.
  const backdrop = readFileSync(path.join(ROOT, 'src/components/EarthBackdrop.jsx'), 'utf8')
  const scene = readFileSync(path.join(ROOT, 'src/three/EarthScene.js'), 'utf8')
  const staticInit = backdrop.slice(backdrop.indexOf('const [staticMode]'), backdrop.indexOf('const glow'))
  const lowPower = scene.slice(scene.indexOf('this.lowPower ='), scene.indexOf('this.seg ='))
  check('the backdrop globe is not made static because the app is packaged native',
    staticInit.length > 0 && !/Capacitor|isNativePlatform/.test(staticInit),
    'hardwareConcurrency / WebGL2 only')
  check('the 3D Earth keeps full quality on a packaged build',
    lowPower.length > 0 && !/Capacitor|isNativePlatform/.test(lowPower) &&
      /hardwareConcurrency/.test(lowPower),
    'segments and antialiasing decided by cores, not by packaging')

  // (b) A recorded file's own length is the only trustworthy bound on when it
  // ends. estimateMs() prices text, so it under-counted a 12.3s Chinese verse
  // at 4.9s and its own safety net cut seven of twelve High King sutra verses.
  const speech = readFileSync(path.join(ROOT, 'src/audio/speech.js'), 'utf8')
  const at = speech.indexOf('el.onloadedmetadata')
  const meta = at >= 0 ? speech.slice(at, speech.indexOf('el.volume', at)) : ''
  check('a recorded file replaces the guessed deadline with its real duration',
    at >= 0 && /el\.duration/.test(meta) && /job\.advTimer\s*=\s*setTimeout\(\s*finish/.test(meta),
    'the watchdog must be reseeded from the file, not from estimateMs')

  // (c) /audio/* is cache-first on purpose - that is what lets the player work
  // offline - but the manifest is the index of what exists. Served stale it is
  // wrong about reality, and every prayer it denies gets the silent path on a
  // phone with no TTS voices at all.
  const sw = readFileSync(path.join(ROOT, 'public/sw.js'), 'utf8')
  const cacheName = sw.match(/const CACHE = '([^']+)'/)?.[1] || ''
  check('the service worker cache has a name that can be bumped',
    /^prayer-earth-v\d+$/.test(cacheName), cacheName || 'none')
  const branchAt = sw.indexOf("url.pathname === '/audio/manifest.json'")
  const branchEnd = sw.indexOf('const cacheable', branchAt)
  const branch = branchAt >= 0 && branchEnd > branchAt ? sw.slice(branchAt, branchEnd) : ''
  const fetchAt = branch.indexOf('fetch(req)')
  check('the audio manifest is fetched before the cache can answer',
    fetchAt > -1 && fetchAt < branch.indexOf('caches.match(req)'),
    'a stale index must not lie while the network is up')
  check('the manifest route exits instead of falling through to cache-first',
    branch.length > 0 && /\breturn\b/.test(branch))
  check('the mp3s themselves stay cache-first',
    /url\.pathname\.startsWith\('\/audio\/'\)/.test(sw),
    'the offline player still depends on it')
  // A bump that never got rebuilt ships the old cache name, so nothing
  // re-caches and the new files are unreachable until the SW itself changes.
  const distSw = path.join(ROOT, 'dist/sw.js')
  if (existsSync(distSw)) {
    const built = readFileSync(distSw, 'utf8')
    check('the built service worker carries the current cache version',
      built.match(/const CACHE = '([^']+)'/)?.[1] === cacheName,
      `${cacheName} vs ${built.match(/const CACHE = '([^']+)'/)?.[1] || 'none'} - run npm run build`)
  }

  // (d) A sleeping phone can return with mode === 'live' and a dead socket. The
  // old foreground handler trusted the cached mode and called pushSync(), which
  // never sends presence, so the world stopped seeing a prayer that was still
  // playing. Foregrounding now reconnects whenever the transport cannot carry
  // presence, and pause/resume does the same instead of sending into silence.
  const engine = readFileSync(path.join(ROOT, 'src/sync/engine.js'), 'utf8')
  const client = readFileSync(path.join(ROOT, 'src/sync/client.js'), 'utf8')
  check('the sync transport reports whether its socket is actually usable',
    /alive\(\)\s*\{[\s\S]{0,220}?readyState\s*===\s*WebSocket\.OPEN/.test(engine),
    'cached live mode is not enough after sleep')
  check('returning to the app reconnects a dead transport while a prayer plays',
    /this\.mode !== 'live'\s*\|\|\s*!this\.engineAlive\(\)\s*\|\|\s*playing/.test(client) &&
      /this\.sendPresence\(\)/.test(client),
    'presence must be sent, not merely synced')
  check('pause/resume reconnects rather than sending presence into a dead socket',
    /activePlayback\(useStore\.getState\(\)\)[\s\S]{0,220}?this\.connect\(\)/.test(client),
    'resume is the recovery path after lock')

  // (e) The feed pill mixes icon, name, title, place and time at different
  // sizes. Centered boxes left their text baselines visibly uneven, so the row
  // itself is now baseline-aligned.
  const styles = readFileSync(path.join(ROOT, 'src/styles.css'), 'utf8')
  check('world-feed pills align their text on a common baseline',
    /\.feed-pill\s*\{[^}]*align-items:\s*baseline/.test(styles),
    'different glyph metrics need baseline alignment, not centered boxes')

  // (f) A prayer that ships a second recitation lets the listener switch
  // language without splitting the prayer in two. That only works if the
  // renderer produces the second set, the player follows the chosen voice,
  // and the sutra actually declares the second language.
  const gen = readFileSync(path.join(ROOT, 'scripts/generate-audio.mjs'), 'utf8')
  const speechJs = readFileSync(path.join(ROOT, 'src/audio/speech.js'), 'utf8')
  const buddhism = readFileSync(path.join(ROOT, 'src/data/spirits/buddhism.js'), 'utf8')
  const prayerPage = readFileSync(path.join(ROOT, 'src/pages/PrayerPage.jsx'), 'utf8')
  check('the renderer produces a prayer\'s second recitation from its gloss',
    /p\.altLang/.test(gen) && /textKey:\s*'e'/.test(gen),
    'a declared altLang must render, not just sit in the data')
  check('which language is spoken follows the listener\'s chosen voice',
    /reciteLang\(job\)[\s\S]{0,400}prayerVoices/.test(speechJs) &&
      /phrase\.e \|\| phrase\.s \|\| phrase\.t/.test(speechJs),
    'the recitation must follow the voice, not a hardcoded language')
  check('a second recitation is priced by the text actually spoken',
    /const recite = this\.reciteLang\(this\.job\)\s*\n\s*const text = \(recite/.test(speechJs),
    'an English rendering of a Chinese line is longer than the line')
  check('the High King Sutra offers its English recitation',
    /id: 'high-king-sutra'[\s\S]{0,900}?altLang: 'en'/.test(buddhism),
    'the sutra declares the second language the renderer looks for')
  check('the player passes the second recitation through to the job',
    /altLang:\s*prayer\.altLang \|\| null/.test(prayerPage),
    'the job must know which second language it may speak')

  // (g) The Three Refuges and the Triple Refuge were the same vow in two
  // languages, so they are now one prayer. Deleting the English-only id would
  // have taken a listener's favourite, counts and streak with it, and none of
  // that lives on the server — so the history folds forward instead. These run
  // the fold for real, because a bug here loses data that cannot be recovered.
  check('the duplicate English Refuges entry is gone',
    !/id: 'refuges'/.test(buddhism),
    'two prayers for one vow is the duplication being fixed')
  check('the Triple Refuge offers its English recitation',
    /id: 'sarana'[\s\S]{0,700}?altLang: 'en'/.test(buddhism),
    'the surviving prayer carries both languages')

  for (const [from, to] of FOLDED_PRAYERS) {
    const folded = foldPrayers({
      favorites: ['mani', from, to, 'metta'],
      prayerCompletions: { [from]: 3, [to]: 4, mani: 9 },
      prayerTotals: { [from]: 10 },
      prayerDayCompletions: { '2026-01-01': { [from]: 2, [to]: 1 } },
      prayerDayStats: { '2026-01-01': { [from]: 7, [to]: 5 }, '2026-01-02': { mani: 1 } },
      prayerVoices: { [from]: 'en-US-AvaNeural', [to]: 'hi-IN-SwaraNeural' }
    })
    check(`folding ${from} into ${to} keeps both favourites, once each`,
      folded.favorites.filter((id) => id === to).length === 1 && !folded.favorites.includes(from) &&
        folded.favorites.includes('mani') && folded.favorites.includes('metta'),
      JSON.stringify(folded.favorites))
    check(`folding ${from} into ${to} adds its counts rather than replacing them`,
      folded.prayerCompletions[to] === 7 && !folded.prayerCompletions[from] &&
        folded.prayerCompletions.mani === 9,
      `${to}=${folded.prayerCompletions[to]}`)
    check(`folding ${from} into ${to} folds every day that carried it`,
      folded.prayerDayCompletions['2026-01-01'][to] === 3 &&
        folded.prayerDayStats['2026-01-01'][to] === 12 &&
        !(from in folded.prayerDayCompletions['2026-01-01']) &&
        !(from in folded.prayerDayStats['2026-01-01']) &&
        folded.prayerDayStats['2026-01-02'].mani === 1,
      `day totals ${JSON.stringify(folded.prayerDayStats['2026-01-01'])}`)
    check(`folding ${from} into ${to} drops a voice chosen in the old language`,
      !(from in folded.prayerVoices) && folded.prayerVoices[to] === 'hi-IN-SwaraNeural',
      JSON.stringify(folded.prayerVoices))
    const untouched = { favorites: ['mani'], prayerCompletions: { mani: 1 } }
    check(`folding is a no-op when the deleted id was never used`,
      foldPrayers(untouched) === untouched,
      'a launch with no affected history must change nothing')
  }

  // The fold runs inside persist's migrate, where a throw aborts rehydration
  // entirely: merge never runs, so the listener silently reboots on defaults
  // with their saved volume, streak and favourites gone. The malformed shape a
  // corrupted store can carry must therefore be inert, not fatal.
  const malformed = { favorites: 'not-an-array', prayerVoices: 12345, prayerCompletions: 'garbage', prayerDayStats: [] }
  let foldThrew = null
  try { foldPrayers(malformed) } catch (e) { foldThrew = e }
  check('folding tolerates a store whose counters are not objects',
    foldThrew === null, String(foldThrew) || 'the `in` operator must not see a primitive')
  check('folding a malformed store changes nothing rather than throwing',
    foldPrayers(malformed) === malformed, 'no fold target means no work')
  const malformedWithTarget = { ...malformed, favorites: ['refuges'], prayerTotals: { refuges: 4 } }
  let secondThrew = null
  let secondOut = null
  try { secondOut = foldPrayers(malformedWithTarget) } catch (e) { secondThrew = e }
  check('folding still works when a sibling counter is malformed',
    secondThrew === null && secondOut.prayerTotals.sarana === 4 && !('refuges' in secondOut.prayerTotals) &&
      typeof secondOut.prayerVoices === 'number' && secondOut.prayerCompletions === 'garbage',
    String(secondThrew) || JSON.stringify(secondOut))

  // (h) Coming back from a prayer, the tradition grid was invisible for nearly
  // two seconds and read as tiles that had gone missing rather than tiles still
  // arriving. Two separate clocks did it: a stagger that scaled with the index
  // (nineteenth tile a full second behind the first) and a redundant .fade-in
  // on the home root that overrode .view's own 0.55s viewIn with a slower 0.8s
  // fadeUp, making home the one route whose transition cost more than the rest.
  const homeSrc = readFileSync(path.join(ROOT, 'src/pages/HomePage.jsx'), 'utf8')
  check('the home tile cascade no longer scales with the grid size',
    /animationDelay:\s*`\$\{Math\.min\([^)]*\)\s*\*\s*\d+\}ms`/.test(homeSrc),
    'an uncapped index puts the last tile a second behind the first')
  check('the home view keeps .view\'s own entrance instead of a slower override',
    !/<div className="view fade-in">/.test(homeSrc),
    'HomePage must transition at the same pace as every other route')
  check('a tradition tile fades in faster than the shared .fade-in',
    /\.tile\.fade-in\s*\{[^}]*animation-duration:\s*0\.[0-7]\d*s/.test(styles),
    'a nineteen-tile wall at 0.8s each is a long time to look empty')
  // fill:both keeps the finished transform on every tile, and a filled
  // transform pins the tile to its own composited layer - over a rounded
  // mask, a gradient pseudo-surface and a drop-shadow filter, which Android
  // WebView can fail to raster: one tile stayed blank until a scroll forced
  // a repaint ("tiles appearing blank, goes away on scroll"). HomePage now
  // drops the class on animationend, and .view uses backwards fill so the
  // route scroller itself does not keep a promoted transform forever.
  check('a finished tile drops its entrance class instead of pinning a layer',
    /onAnimationEnd/.test(homeSrc) && /classList\.remove\('fade-in'\)/.test(homeSrc) &&
      /animationName === 'fadeUp'/.test(homeSrc),
    'a tile that keeps fill:both after its animation can sit blank until scroll')
  check('the view entrance does not leave the scroller promoted',
    /animation:\s*viewIn[^;]*backwards/.test(styles),
    '.view still fills with both - a permanent transform on the top scroller is a known source of blank child tiles')

  // (i) The picker sheet is a fixed-height column that clips, and the favourites
  // strip sits above the prayer list inside it. As a flex item with visible
  // overflow it would not compress below its own content, so favouriting enough
  // prayers made that strip taller than the whole card: the sheet clipped it and
  // shrank the prayer list to about 25px, leaving neither usable.
  // Strip the block comment first: the explanation above names max-height and
  // overflow-y, so a matcher run over raw text could pass on its own prose.
  const favsRule = ((styles.match(/\.picker-favs\s*\{[^}]*\}/) || [''])[0])
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
  check('the favourites strip is bounded and scrolls inside the sheet',
    /max-height\s*:/.test(favsRule) && /overflow-y\s*:\s*auto/.test(favsRule),
    favsRule || '.picker-favs rule not found')
  check('the favourites strip is not squeezed down to a single row',
    /flex:\s*0\s*0\s*auto/.test(favsRule),
    'the sheet must give the list what the strip does not use, not divide it away')
  check('the prayer list still scrolls on its own',
    /\.picker-list\s*\{[^}]*overflow-y:\s*auto/.test(styles),
    'bounded only by the sheet, the list is what holds the long tradition')

  // (j) The tradition view stopped at a fixed 82dvh, so the list got whatever
  // the head, search and favourites band left over: 277px on a 700px phone,
  // three rows of a thirty-prayer tradition with 3124px left to scroll. Only
  // vertical space buys rows, so the sheet now fills the overlay it sits in.
  // Two things are pinned: that the 82dvh cap stays gone, and that the sheet's
  // height is derived from the overlay's own padding, since a sheet sized by
  // viewport while the overlay still insets it is a card that outgrows its
  // frame and clips. Strip the comment first - the note above names the 82dvh
  // cap this test exists to keep out.
  const sheetRule = ((styles.match(/\.picker-sheet\s*\{[^}]*\}/) || [''])[0])
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
  const overlayRule = ((styles.match(/\.picker-overlay\s*\{[^}]*\}/) || [''])[0])
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
  const rowRule = ((styles.match(/\.picker-row\s*\{[^}]*\}/) || [''])[0])
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
  check('the tradition view fills the screen instead of stopping at 82dvh',
    sheetRule !== '' && !/82dvh/.test(sheetRule) && /100dvh/.test(sheetRule),
    sheetRule || '.picker-sheet rule not found')
  const overlayPad = (overlayRule.match(/padding:\s*(\d+)px/) || [])[1]
  const sheetGap = (sheetRule.match(/height:\s*min\(calc\(100dvh\s*-\s*(\d+)px\)/) || [])[1]
  check('the sheet can never outgrow the overlay that holds it',
    !!overlayPad && Number(sheetGap) === Number(overlayPad) * 2,
    `overlay padding ${overlayPad}px vs sheet height minus ${sheetGap}px`)
  const rowPad = (rowRule.match(/padding:\s*(\d+)px\s+\d+px/) || [])[1]
  check('a prayer row is slim enough to show a tradition at a glance',
    !!rowPad && Number(rowPad) <= 10,
    `row padding ${rowPad}px - tall rows cost the reader a line each, thirty times`)
  // The Oct 20 pass: the sheet's flat 14px top put its edge under the Android
  // status-bar icons, and a short tradition ended in blank space at the bottom
  // of an otherwise full-height sheet.
  check('the picker clears the Android status bar at the top',
    /padding-top:\s*calc\(24px \+ env\(safe-area-inset-top/.test(overlayRule) &&
      /max-height:\s*100%/.test(sheetRule),
    overlayRule || '.picker-overlay rule not found')
  check('the picker list spends the sheet height on prayers, not on air',
    /\.picker-list\s*\{[^}]*flex:\s*1 1 auto[\s\S]*?min-height:\s*0/.test(styles),
    'the list ends at its content and the sheet keeps dead space below it')

  // (k) "I, whose name is . . . , take refuge..." (issue #21). The blank is
  // filled at render time and only where the device has consented to being
  // identified, and the audio is left exactly as it was recorded: the voice
  // says the blank, the highlight follows the recording, so wiring the name
  // into the speech path would either desync the highlight or need a recording
  // per person. Consent here is sharePresence - the flag that already decides
  // whether the name appears anywhere another person can see - because a second
  // switch for the same fact is a switch that will eventually disagree.
  const { practitionerName, fillPractitionerName } = await import('../src/shared/prayerName.js')
  check('the name is withheld when presence sharing is off',
    practitionerName('Amara', false) === '',
    'prayer text must read the same consent the world feed reads')
  check('the name appears when presence sharing is on',
    practitionerName('Amara', true) === 'Amara',
    'a device that shares its name shows it in the prayer that asks for it')
  check('a rejected or absent name falls back to the plain ellipsis',
    practitionerName('hitler', true) === '' && practitionerName('', true) === '',
    `blocked word returned "${practitionerName('hitler', true)}"`)
  check('a name the blocklist cannot read is not discarded',
    practitionerName('सतनाम', true) === 'सतनाम',
    'the blocklist normalizes to a-z, so a non-Latin name must pass through it')
  check('a name is inserted literally, never as a replacement pattern',
    fillPractitionerName('. . .', '$&') === '$&' && fillPractitionerName('. . .', '$1') === '$1',
    'String.replace would read "$&" as the match it just removed')
  check('a line with no blank is left alone',
    fillPractitionerName('To the Tathagata Glorious Conqueror Shakyamuni I bow.', 'Amara') ===
      'To the Tathagata Glorious Conqueror Shakyamuni I bow.',
    'only a deliberate blank is a name blank')

  const buddhismPrayers = (await import('../src/data/spirits/buddhism.js')).default
  const confession = buddhismPrayers.prayers.find((p) => p.id === 'thirtyfive-confession')
  const opening = confession && confession.phrases[0] && confession.phrases[0].t
  check('the Confession keeps its conventional ellipsis in the source',
    typeof opening === 'string' && opening.includes('. . .'),
    opening ? opening.slice(0, 56) : 'thirtyfive-confession not found')
  const filled = fillPractitionerName(opening, 'Amara')
  check('the name lands where the blank was, with the comma intact',
    filled.includes('whose name is Amara,') && !filled.includes('. . .'),
    filled.slice(0, 56))
  const blankCount = srcFiles
    .filter((f) => f.includes(path.join('src', 'data')))
    .reduce((n, f) => {
      const body = readFileSync(f, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '')
      return n + (body.match(/\.\s+\.\s+\./g) || []).length
    }, 0)
  check('every blank in the prayer data is a practitioner blank',
    blankCount === 1,
    `${blankCount} found - a second one is either a new name line or an elision, and only a person can say which`)

  const pageSrc = readFileSync(path.join(ROOT, 'src/pages/PrayerPage.jsx'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
  const stageSrc = readFileSync(path.join(ROOT, 'src/components/PrayerStage.jsx'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
  check('the prayer page fills the line and the screen-reader line',
    /fillPractitionerName\(ph\.t/.test(stageSrc) &&
      /fillPractitionerName\(phrases\[active\]\.t/.test(stageSrc) &&
      /s\.sharePresence/.test(stageSrc),
    'the prayer view must read consent itself; the helper cannot know it')
  const speechSrc = readFileSync(path.join(ROOT, 'src/audio/speech.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
  check('the speech path still speaks the blank as recorded',
    !/fillPractitionerName|prayerName/.test(speechSrc),
    'audio was decided to stay as recorded - a name in the utterance desyncs the highlight')
}

// --- 7. Audio reliability: silence stays silent, a line that ended ends ------
{
  // Every check here guards one reported defect. The class is the same in all
  // of them: audio that keeps running after it should stop, or sits still after
  // it should move, and a reader who hears it as "the sound is broken".
  const settingsSrc = stripComments(
    readFileSync(path.join(ROOT, 'src/shared/useSheetBed.js'), 'utf8')
  )
  const prayerPageSrc = stripComments(
    readFileSync(path.join(ROOT, 'src/pages/PrayerPage.jsx'), 'utf8')
  )
  const speechSrc = stripComments(readFileSync(path.join(ROOT, 'src/audio/speech.js'), 'utf8'))
  // The dip effect itself, not from the ref declarations: the sandbox helpers
  // (an audition at 0.4, its cancel flag) now live between prevLevelRef and the
  // effect, and a wider slice counted their 0.4 as a second unconditional rise.
  const dipStart = settingsSrc.indexOf('if (!ambient.ctx) return')
  const dipEnd = settingsSrc.indexOf('}, [open])', dipStart)
  const bedFx = settingsSrc.slice(dipStart, dipEnd)
  const dipAt = bedFx.indexOf('ambient.setLevel(0.4)')
  const guardAt = bedFx.indexOf('if (ambient.level > 0.4)')
  check(
    'opening settings never raises a bed that was off',
    guardAt > -1 && dipAt > guardAt && (bedFx.match(/ambient\.setLevel\(0\.4\)/g) || []).length === 1,
    'the sheet wrote 0.4 unconditionally and started the ambient sound with nothing playing'
  )
  check(
    'the bed it dips is put back when the sheet closes',
    /prevLevelRef\.current != null/.test(bedFx) && /ambient\.setLevel\(prevLevelRef\.current\)/.test(bedFx),
    'a dip with no restore leaves the prayer quiet for the rest of the prayer'
  )

  const pbSrc = stripComments(readFileSync(path.join(ROOT, 'src/playback.js'), 'utf8'))
  const toggle = pbSrc.slice(
    pbSrc.indexOf('export async function requestPlayToggle'),
    pbSrc.indexOf('export async function stopPlayback')
  )
  const pauseAt = toggle.indexOf('speech.pause()')
  const resumeAt = toggle.indexOf('speech.resume()')
  const pauseBranch = toggle.slice(pauseAt, resumeAt > pauseAt ? resumeAt : undefined)
  const resumeBranch = toggle.slice(resumeAt > -1 ? resumeAt : 0)
  check(
    'pausing from anywhere also silences the ambient bed',
    pauseAt > -1 && resumeAt > -1 && /ambient\.setLevel\(0\)/.test(pauseBranch),
    'the footer pause left the bed running, so one pause stopped the sound on one screen and not the other'
  )
  check(
    'resuming from anywhere brings the bed back at the prayer level',
    /ambient\.setLevel\(0\.9\)/.test(resumeBranch) && /ambient\.setLevel\(0\.9\)/.test(prayerPageSrc),
    'the two pause paths must agree on how loud the bed returns, or one of them starts from nothing'
  )

  check(
    'a line that ended moves on instead of waiting out its estimate',
    /advance\(i, fromEnd\)/.test(speechSrc) && /if \(!fromEnd && since < hold\)/.test(speechSrc),
    'phraseHold is deliberately generous, so paying its remainder after onended stacked dead air after every line'
  )
  const realEnds = (speechSrc.match(/advance\(i, true\)/g) || []).length
  const stallRetries = (speechSrc.match(/this\.advance\(i\)/g) || []).length
  check(
    'only a real end claims to be a real end',
    realEnds === 3 && stallRetries === 1,
    `${realEnds} real ends, ${stallRetries} stall retries - the stall path must keep the safety floor`
  )
  check(
    'the breath between cycles scales with the chosen rate',
    /j\.gapMs\) \|\| 900\) \/ rate/.test(speechSrc),
    'a flat 900ms reads as a stall at 1.6x and as nothing at 0.7x'
  )
  check(
    'the timed/chant fallback paces itself at the chosen rate',
    /estimateMs\(opts\.phrases\[i\]\) \/ rate/.test(speechSrc) &&
      /\(opts\.gapMs \|\| 900\) \/ rate/.test(speechSrc),
    'the fallback walked the lines at plain reading pace whatever the reader selected'
  )
  check(
    "the next line's audio is warmed while the current line is still playing",
    /const next = i \+ 1[\s\S]{0,600}this\._bufferFor\(ns\)\.catch/.test(speechSrc),
    'first pass paid the fetch inside the only gap the reader can hear'
  )
  check(
    'the native and fast-rate routes warm the HTTP cache instead of decoding',
    /fetch\(ns, \{ cache: 'force-cache' \}\)/.test(speechSrc),
    'those routes play from an <audio> element, so a decoded buffer would be thrown away'
  )
  check(
    'a phrase buffer is fetched once even while the prefetch is in flight',
    /\.set\(url, load\)/.test(speechSrc) && /this\._bufferByUrl\.delete\(url\)/.test(speechSrc),
    'caching only finished buffers let a line arriving early fire a second request for the same file'
  )

  const ambSrc = stripComments(readFileSync(path.join(ROOT, 'src/audio/ambience.js'), 'utf8'))
  const builtAt = ambSrc.indexOf('new AC()')
  const armedAt = ambSrc.indexOf('this._watchState()')
  const resumeAt2 = ambSrc.indexOf("state === 'suspended'")
  check(
    'the audio graph starts watching itself the moment it exists',
    builtAt > -1 && armedAt > builtAt && resumeAt2 > armedAt,
    'an interrupted context with nothing watching it stays silent until some unrelated tap'
  )
  check(
    'an interrupted audio graph revives itself',
    /onstatechange = \(\) => tryResume/.test(ambSrc) && /_stateRetry = setTimeout\(\(\) => tryResume/.test(ambSrc),
    'a call or a backgrounded tab left the context interrupted - the reported cuts-out-until-I-tap-it'
  )
  check(
    'the revival gives up on its own instead of scheduling work forever',
    /attempt >= 30/.test(ambSrc),
    'an unbounded retry keeps firing long after the app is done with the sound'
  )
  check(
    'the output ceiling stays cheap enough to run under the 3D earth',
    /oversample = '2x'/.test(ambSrc) && !/oversample = '4x'/.test(ambSrc),
    'oversampling is per-sample work on the same audio thread the visuals compete with'
  )

  // _pad runs every note through ONE gain, so the stacked level a preset pushes
  // into the shared bus is notes x gain (+ its air layer) - an upper bound, and
  // the number that made a five-note bed louder than a three-note one at the
  // same "0.05".
  const stacked = (name) => {
    const body = new RegExp(`${name}: \\(b, s\\) => \\{([\\s\\S]*?)\\n      \\}`).exec(ambSrc)
    if (!body) return null
    const pad = /_pad\(b, s, \{ notes: \[([^\]]+)\], gain: ([\d.]+)/.exec(body[1])
    const air = /_air\(b, s, \{ gain: ([\d.]+)/.exec(body[1])
    if (!pad || !air) return null
    return pad[1].split(',').length * Number(pad[2]) + Number(air[1])
  }
  const reikiStack = stacked('reiki')
  const oceanStack = stacked('ocean')
  check(
    'the default bed is not the loudest thing in the rack',
    reikiStack != null && oceanStack != null && reikiStack <= oceanStack,
    `reiki stacks ${reikiStack}, ocean stacks ${oceanStack}`
  )
}

// --- 8. A pick plays, navigation runs once, the earth's small bodies show ----
{
  // (m) Three reported defects, one shape: a control that means one thing but
  // did another. Picking a prayer from the list meant "open it" when the
  // reader was asking to hear it; every navigation action ran unguarded, so a
  // double-tap ran the work twice (and openLegal twice rewrote its own return
  // point); the earth's moon sat at a fixed world point that no aspect keeps
  // on screen, and its orbiting bodies wrapped an orb texture onto a sphere,
  // which at phone resolution is an orange square drifting across the sky.
  // Strip comments first - every source here narrates the bug it guards.
  const pickStoreSrc = stripComments(readFileSync(path.join(ROOT, 'src/store.js'), 'utf8'))
  const pickPbSrc = stripComments(readFileSync(path.join(ROOT, 'src/playback.js'), 'utf8'))
  const pickPickerSrc = stripComments(
    readFileSync(path.join(ROOT, 'src/components/PrayerPicker.jsx'), 'utf8')
  )
  const pickPageSrc = stripComments(readFileSync(path.join(ROOT, 'src/pages/PrayerPage.jsx'), 'utf8'))

  const andPlayAt = pickStoreSrc.indexOf('openAndPlay:')
  const andPlay = pickStoreSrc.slice(andPlayAt, andPlayAt + 420)
  check(
    'picking a prayer arms the play and closes the list in one set',
    andPlayAt > -1 && /navThrottle\(`play:/.test(andPlay) &&
      /pendingPlay: true/.test(andPlay) && /prayerPickerSpiritId: null/.test(andPlay),
    'one atomic set means a double-tap is one nav key the throttle can drop'
  )
  const openOnly = pickStoreSrc.slice(pickStoreSrc.indexOf('openPrayer: (spiritId'), andPlayAt)
  check(
    'viewing a prayer without picking it still keeps the old one playing',
    openOnly.length > 0 && !/pendingPlay/.test(openOnly),
    'deep links and related chips are navigation, not a request to speak'
  )

  const chosenAt = pickPbSrc.indexOf('export function playChosenPrayer')
  const chosen = pickPbSrc.slice(chosenAt, chosenAt + 320)
  check(
    'the pick unlocks audio inside the tap and never waits to navigate',
    chosenAt > -1 && chosen.indexOf('primeAudio()') > -1 &&
      chosen.indexOf('primeAudio()') < chosen.indexOf('openAndPlay(') &&
      !/await primeAudio/.test(chosen),
    'priming after the await leaves the unlock outside the gesture; awaiting it delays the sheet closing'
  )
  const stopSlice = pickPbSrc.slice(pickPbSrc.indexOf('export async function stopPlayback'))
  check(
    'stopping from anywhere also cancels a queued start',
    /pendingPlay: false/.test(stopSlice),
    'pendingPlay outlives a stop pressed inside the 60ms queue, so silence itself starts speaking'
  )
  const pageStopSlice = pickPageSrc.slice(
    pickPageSrc.indexOf('const stopJob = () => {'),
    pickPageSrc.indexOf('const elapsed = useStore((s) => s.elapsed)')
  )
  check(
    'the prayer page stop beats a queued start too',
    /setPendingPlay\(false\)/.test(pageStopSlice),
    'the same lost race exists on the page stop button'
  )

  check(
    'every way of choosing a prayer starts it',
    (pickPickerSrc.match(/playChosenPrayer\(spirit\.id, p\.id\)/g) || []).length === 2 &&
      !/openPrayer\(/.test(pickPickerSrc),
    'row and favourite chip both speak; a leftover openPrayer would reopen the old silent behaviour'
  )
  check(
    'the stop before a pick finishes first, or it cancels the pick it preceded',
    (pickPickerSrc.match(/await stopPlayback\(\)/g) || []).length === 2,
    'stopPlayback clears pendingPlay after an await of its own - unawaited, the clear lands after the arm'
  )

  check(
    'navigation drops only a duplicate destination in the same instant',
    /if \(key === lastNavKey && now - lastNavAt < NAV_WINDOW_MS\) return/.test(pickStoreSrc),
    'a key-equality check that ignores time would swallow every later return to a view'
  )
  check(
    'every navigation action runs through the throttle',
    (pickStoreSrc.match(/navThrottle\(/g) || []).length === 8,
    `${(pickStoreSrc.match(/navThrottle\(/g) || []).length} wrapped - go, openPrayer, openAndPlay, openLegal, closeLegal, closePrayer, both picker sides`
  )

  // The throttle is the part a substring cannot prove, so drive the store
  // itself: a subscribe counter sees exactly the sets that were not dropped.
  // The prime call runs one real navigation BEFORE the baseline is taken, so
  // anything that settles on first touch (persist hydration firing a set of
  // its own) is spent rather than miscounted as a duplicate.
  const { useStore } = await import('../src/store.js')
  let navFires = 0
  const navUnsub = useStore.subscribe(() => { navFires++ })
  try {
    const navState = useStore.getState()
    navState.openPrayer('judaism', 'shema') // prime: hydration and friends fire here
    const nav0 = navFires
    navState.openPrayer('judaism', 'shema') // the double-tap itself
    check(
      'a double-tapped prayer opens exactly once',
      navFires - nav0 === 0,
      `${navFires - nav0} extra sets for one destination tapped twice`
    )
    navState.go('home')
    check(
      'a different destination inside the window still moves',
      navFires - nav0 === 1,
      `${navFires - nav0} extra sets after a different destination`
    )
    const realNow = Date.now
    try {
      Date.now = () => realNow() + 300
      navState.go('home')
    } finally {
      Date.now = realNow
    }
    check(
      'the same destination runs again once the window has passed',
      navFires - nav0 === 2,
      `${navFires - nav0} extra sets after the window expired`
    )
    check(
      'openAndPlay lands every field it exists to set',
      (() => {
        const g = useStore.getState()
        g.openAndPlay('hinduism', 'gayatri')
        const s = useStore.getState()
        return s.view === 'prayer' && s.spiritId === 'hinduism' && s.prayerId === 'gayatri' &&
          s.pendingPlay === true && s.prayerPickerSpiritId === null
      })(),
      'the prayer page keys its start effect off pendingPlay; the picker keys its render off the spirit id'
    )
  } finally {
    navUnsub()
  }

  const pickStyles = readFileSync(path.join(ROOT, 'src/styles.css'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
  const loadingRule = ((pickStyles.match(/\.picker-loading\s*\{[^}]*\}/) || [''])[0])
    .replace(/\s+/g, ' ')
  const loadingSpin = ((pickStyles.match(/\.picker-loading \.play-spinner\s*\{[^}]*\}/) || [''])[0])
    .replace(/\s+/g, ' ')
  check(
    'the loading line is styled for the dark sheet it sits on',
    /display:\s*flex/.test(loadingRule) && /justify-content:\s*center/.test(loadingRule) &&
      /color:\s*var\(--ink-dim\)/.test(loadingRule),
    loadingRule || '.picker-loading rule not found'
  )
  check(
    'the loading spinner is visible against that sheet',
    /border-top-color:\s*rgba\(/.test(loadingSpin) && !/#0d2214/.test(loadingSpin),
    loadingSpin || 'the play button\'s dark-green ring ships unretinted into a dark sheet'
  )

  const pickAppSrc = stripComments(readFileSync(path.join(ROOT, 'src/shared/useWarmApp.js'), 'utf8'))
  check(
    'the tradition picker is warmed with the rest of the first tap',
    /import\('\.\.?\/components\/PrayerPicker\.jsx'\)/.test(pickAppSrc),
    'the picker is the first thing anyone taps, and it loaded its chunk inline on that tap'
  )

  const earthSrc = stripComments(readFileSync(path.join(ROOT, 'src/three/EarthScene.js'), 'utf8'))
  check(
    'the orbiting bodies are billboards, not wrapped spheres',
    /new THREE\.Sprite\(/.test(earthSrc) && !/SphereGeometry\(d\.r/.test(earthSrc),
    'the orb texture is a lit disc on transparent ground; equirect-wrapping it seams and notches into a blocky orange square at phone resolution'
  )
  const moonCallCount = (earthSrc.match(/this\._placeMoon\(\)/g) || []).length
  check(
    'the moon is placed from the screen, so no aspect can strand it off-screen',
    /_placeMoon\(\)\s*\{/.test(earthSrc) && moonCallCount === 2 && /unproject/.test(earthSrc),
    `${moonCallCount} call sites (build + resize) - a fixed world point measured above the frame on every aspect`
  )
}

// --- 9. Weak hardware runs the same page with less paint --------------------
{
  // (n) "Old iPad" reported the app as choppy. The scene already cuts its own
  // geometry on weak devices, but everything CSS stacked on top of that live
  // canvas kept running at full price: backdrop blurs re-filtering the canvas
  // per frame, screen-blended layers forcing blend passes on every scroll,
  // particle fields animating shadowed dots, and a fixed aurora layer larger
  // than the viewport. The gate is a class set before first paint; these
  // checks pin both halves - the tag, and the paint it is meant to silence.
  const mainSrc = stripComments(readFileSync(path.join(ROOT, 'src/main.jsx'), 'utf8'))
  check(
    'weak hardware is tagged before the first paint',
    /documentElement\.classList\.add\('low-power'\)/.test(mainSrc) &&
      /hardwareConcurrency <= 4/.test(mainSrc) && /deviceMemory/.test(mainSrc),
    'the tag must be in the entry, not in a component that renders after the paint it gates'
  )
  const lpStyles = readFileSync(path.join(ROOT, 'src/styles.css'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
  const lpRule = (sel) => {
    const m = lpStyles.match(new RegExp(`\\.low-power ${sel.replace(/[.:[\]]/g, '\\$&')}\\s*\\{[^}]*\\}`))
    return m ? m[0].replace(/\s+/g, ' ') : ''
  }
  for (const sel of ['.prayer-stage', '.prayer-tune', '.prayer-stats', '.card', '.home-favs', '.picker-overlay']) {
    check(
      `low-power drops the blur behind ${sel}`,
      /backdrop-filter:\s*none/.test(lpRule(sel)),
      lpRule(sel) || `.low-power ${sel} rule not found`
    )
  }
  check(
    'low-power replaces the frosted grounds with opaque ones, not holes',
    /background:\s*rgba\(/.test(lpRule('.card')) && /background:\s*rgba\(/.test(lpRule('.picker-overlay')),
    'a translucent ground without its blur is unreadable over a live canvas'
  )
  check(
    'low-power stops the blend passes and the particle work',
    /display:\s*none/.test(lpRule('.fireflies')) &&
      /animation:\s*none/.test(lpRule('.glow-field')) &&
      /mix-blend-mode:\s*normal/.test(lpRule('.glow-field')) &&
      /animation:\s*none/.test(lpRule('.sky::before')),
    'the fireflies, the aurora and the canopy dapple were the per-frame costs, not the layout'
  )
  const lpAppSrc = stripComments(readFileSync(path.join(ROOT, 'src/shared/useWarmApp.js'), 'utf8'))
  const warmBlock = lpAppSrc.slice(lpAppSrc.indexOf('const warm = () => {'))
  check(
    'the keyboard sheet loads with the first tap, not inside the ? keypress',
    /import\('\.\.?\/components\/KeyboardHelp\.jsx'\)/.test(warmBlock),
    'the shortcut help is lazy() and was fetched at the moment of the keypress - the shortcut lag itself'
  )
}

// --- 10. A muted bed is released, and the settings sheet stays a sandbox -----
{
  // Long sessions went staticy/laggy while the sheet and the nav looked fine,
  // because stopping only ever MOVED A GAIN: the oscillators, LFOs, noise loop
  // and Temple's interval kept running at zero from the first prayer onward,
  // forever, on every screen - CPU and memory the user could never hand back.
  // stop() must schedule the same teardown preset switching already uses, a
  // rebuild inside the window must cancel it (the bed came back), and every
  // true-stop path in the app must actually call stop() - not just setLevel(0),
  // which is what pause/resume legitimately do instead.
  const ambSrc = stripComments(readFileSync(path.join(ROOT, 'src/audio/ambience.js'), 'utf8'))
  check(
    'ambient stop tears the preset graph down after the fade, not just to silence',
    /stop\(\)\s*{[\s\S]*?_rampMaster\(0\.0001\)[\s\S]*?_stopTimer\s*=\s*setTimeout\([\s\S]*?_teardownPreset\(\)/.test(ambSrc) &&
      /_stopTimer[^}]*?if \(this\.running\) return/.test(ambSrc),
    'the graph must be released once the fade is inaudible, and a bed that came back owns it'
  )
  check(
    'a rebuild cancels a pending stop teardown',
    /buildPreset\(id\)\s*{[\s\S]*?clearTimeout\(this\._stopTimer\)/.test(ambSrc),
    'otherwise setPreset/start lands a fresh bus that the pending teardown then kills'
  )
  check(
    'an exhausted resume loop re-arms on the next return of the reader',
    /_armIdleRetry\(\)/.test(ambSrc) &&
      /visibilitychange/.test(ambSrc) &&
      /addEventListener\('pointerdown'/.test(ambSrc) &&
      /attempt >= 30[\s\S]{0,200}?_armIdleRetry\(\)/.test(ambSrc),
    'the bounded loop used to give up with the sound permanently silent until an unrelated tap'
  )
  const pbSrc = stripComments(readFileSync(path.join(ROOT, 'src/playback.js'), 'utf8'))
  check(
    'the shared stopPlayback ends the bed, not just its level',
    /setLevel\(0\)\s*[\s\S]{0,400}?ambient\.stop\(\)/.test(pbSrc),
    'a stop from any view left the engine running muted behind every screen'
  )
  // Oct 20: "if i minimize the app on my phone, and try to play another video,
  // the app wont interfere." Hidden must pause through the button's own path,
  // and coming back must not resume on its own - an auto-resume into someone
  // else's video is the same interference.
  const hide = pbSrc.slice(pbSrc.indexOf('function pauseForHidden'))
  check(
    'the app pauses its own sound the moment it is hidden',
    /addEventListener\('visibilitychange'/.test(pbSrc) &&
      /if \(document\.hidden\) pauseForHidden\(\)/.test(pbSrc) &&
      /appStateChange/.test(pbSrc) &&
      /!isActive\) pauseForHidden\(\)/.test(pbSrc),
    'the WebView keeps talking while hidden unless both surfaces arm the pause'
  )
  check(
    'the hidden pause reuses the pause button path instead of a second one',
    !!hide && /if \(!s\.playing \|\| s\.paused\) return/.test(hide) &&
      /requestPlayToggle\(\)\.catch/.test(hide) &&
      !/resume\(/.test(hide),
    'a second pause implementation drifts from the button, and a resume here would talk over another video'
  )
  const prayerSrc = stripComments(readFileSync(path.join(ROOT, 'src/pages/PrayerPage.jsx'), 'utf8'))
  check(
    'the page stop and the finish path release the bed too',
    (prayerSrc.match(/setLevel\(0\)\s*\n\s*ambient\.stop\(\)/g) || []).length >= 2,
    'setLevel(0) alone mutes; only stop() pays the oscillators off'
  )
  const sheetSrc = stripComments(readFileSync(path.join(ROOT, 'src/components/SettingsSheet.jsx'), 'utf8'))
  const bedSrc = stripComments(readFileSync(path.join(ROOT, 'src/shared/useSheetBed.js'), 'utf8'))
  check(
    'the sheet snapshots what was running and ends only its own audition',
    /runningAtOpenRef\.current\s*=\s*ambient\.running/.test(bedSrc) &&
      /bedPickedRef\.current\s*&&\s*runningAtOpenRef\.current\s*===\s*false/.test(bedSrc) &&
      /endSheetBed\(\)/.test(bedSrc) &&
      /useSheetBed\(\{ open, panel, legalOpen \}\)/.test(sheetSrc),
    'a bed the sheet started belongs to the sheet; a bed the prayer started belongs to the prayer'
  )
  check(
    'the audition is cancelled if the sheet closes before the ctx is ready',
    /previewCancelRef/.test(bedSrc) &&
      /if \(previewCancelRef\.current \|\| bedPickedRef\.current === false\) return/.test(bedSrc),
    'the async ensure() could otherwise resurrect a bed the sheet already gave up on'
  )
  check(
    'stepping into a sub-panel ends the audition like a close does',
    /open && \(panel \|\| legalOpen\)\) endSheetBed\(\)/.test(bedSrc),
    'Privacy/backup/keys/legal all leave the sound section the way Done does'
  )
  const scSrc = stripComments(readFileSync(path.join(ROOT, 'src/components/SoundControls.jsx'), 'utf8'))
  check(
    'only the sheet previews a bed; the prayer panel keeps its plain switch',
    /previewBeds && !ambient\.running/.test(scSrc) && /onBedPick\?\.\(id\)/.test(scSrc),
    'previewBeds is a prop: without it (prayer tune panel) onBed never starts anything'
  )
}

// --- 11. The prayer view says what it means --------------------------------
{
  // Three edits of the same idea: the view was narrating choices the reader
  // never made. The tune button wore a music note (readable as "this plays a
  // tune" rather than "these are settings"), the help strings pointed at it by
  // that note, the live "praying with you" pill sat above the lines it was
  // interrupting, and every prayer claimed to be "recited aloud" - including
  // silent ones, and ones whose voice had just failed (the failure already has
  // its own toast and now has its own badge).
  // The prayer view is composed of the page plus the sections it renders
  // (stage, controls, tune sheet, chrome); structural pins read all of them.
  const psrc = stripComments(
    ['src/pages/PrayerPage.jsx', 'src/components/PrayerStage.jsx', 'src/components/PrayerControls.jsx',
      'src/components/PrayerTuneSheet.jsx', 'src/components/PrayerBackRow.jsx', 'src/components/PrayerChooser.jsx',
      'src/components/PrayerToasts.jsx', 'src/components/PrayerNotes.jsx', 'src/pages/usePrayerKeys.js',
      'src/pages/usePrayerSync.js']
      .map((f) => readFileSync(path.join(ROOT, f), 'utf8'))
      .join('\n')
  )
  check(
    'the tune button is a gear in text presentation, not a music note',
    /'\\u2699\\uFE0E'/.test(psrc) && !/♪/.test(psrc),
    'U+2699 with VS15 keeps Android from falling back to a colour emoji'
  )
  const helpFiles = ['en.js', 'bo.js', 'tl.js', 'vi.js']
  const gearParens = `(${String.fromCodePoint(0x2699, 0xfe0e)})`
  const noteParens = '(\u266A)'
  for (const f of helpFiles) {
    const loc = readFileSync(path.join(ROOT, 'src/locales', f), 'utf8')
    check(
      `the ${f} help string points at the gear, not the note`,
      loc.includes(gearParens) && !loc.includes(noteParens),
      'the four scripts that spelled out "Tune (note)" by glyph'
    )
  }
  const linesAt = psrc.indexOf('prayer-lines')
  const pillAt = psrc.indexOf('praying-now')
  const statsAt = psrc.indexOf('<PrayerStats')
  check(
    'the live "praying together" pill sits with the stats, below the lines',
    linesAt > -1 && pillAt > linesAt && statsAt > pillAt,
    'it used to sit above the lines, pushing the prayer down the screen'
  )
  // The words used to stop being highlighted and the stage simply continued at
  // the same brightness - no visual close, so the reader inferred the end from
  // silence alone. The band sits between the lines and the footer description,
  // and the pill gets top air so it no longer runs into that description.
  const styles = readFileSync(path.join(ROOT, 'src/styles.css'), 'utf8')
  const bandAt = psrc.indexOf('prayer-end-band')
  const translationAt = psrc.indexOf('prayer-translation')
  check(
    'an end-of-prayer band sits between the words and the footer description',
    bandAt > linesAt && bandAt > -1 && bandAt < translationAt,
    'the recitation needs a visual close, not just a highlight that stops'
  )
  const bandRule = (styles.match(/\.prayer-end-band\s*\{[^}]*\}/) || [''])[0]
  check(
    'the end-of-prayer band is a darker floor, not more of the same stage',
    /linear-gradient\(/.test(bandRule) && /rgba\(0,\s*0,\s*0/.test(bandRule),
    bandRule.replace(/\s+/g, ' ').slice(0, 160)
  )
  check(
    'the praying-together pill has air above it',
    /\.praying-now\s*\{[^}]*margin:\s*[1-9]\d*px auto/.test(styles),
    'the footer description used to run straight into the pill'
  )
  // The compact feed's pills wrap; baseline aligns only the first line, so the
  // icon sat at the top edge while the wrapped text ran below it.
  const compactPillRules = styles.match(/\.earth-view \.world-feed\.compact \.feed-pill\s*\{[^}]*\}/g) || []
  check(
    'the earth feed pills centre their icon against wrapped text',
    compactPillRules.length >= 2 && compactPillRules.every((r) => /align-items:\s*center/.test(r)),
    `${compactPillRules.length} compact-pill rule(s), ${compactPillRules.filter((r) => !/align-items:\s*center/.test(r)).length} still top-aligned`
  )
  check(
    'no prayer claims a recitation style it did not choose',
    !/prayer\.recited/.test(psrc) && !/prayer\.repeated/.test(psrc),
    'the keys stay in the locales; the view simply stopped asserting them'
  )
  check(
    'a failed voice shows the unavailable badge, a chosen chant does not',
    /chantMode && chantReason !== 'chosen' &&\s*\(\s*<span className="prayer-mode">\{t\('prayer\.voiceUnavailable'\)\}/.test(psrc),
    'degradation is exactly when chantMode is on for a reason other than choice'
  )
}

// --- 12. The repeat switch changes the prayer that is already speaking ------
{
  // Toggling repeat mid-prayer used to stop the job and start a new one 120ms
  // later, and that one restart produced both reported faults: the current
  // line re-spoke from its top, and the restart ran through a setTimeout
  // closure built BEFORE the click, so the new job was born holding the old
  // loop flag - the switch read "on" while the prayer was already set to end.
  // Repeat is therefore a live property of the running job: the switch flips
  // the flag where the engine reads it and nothing restarts.
  const loopPage = stripComments(readFileSync(path.join(ROOT, 'src/pages/PrayerPage.jsx'), 'utf8'))
  const loopSpeech = stripComments(readFileSync(path.join(ROOT, 'src/audio/speech.js'), 'utf8'))
  // Slice one top-level function out of a file by its signature. Everything
  // inside is indented past the signature, so the first line that closes at the
  // signature's own indent ("\n  }") is its end - comments are already gone.
  const fnBody = (src, sig) => {
    const at = src.indexOf(sig)
    if (at < 0) return null
    const open = src.indexOf('{', at)
    if (open < 0) return null
    const close = src.indexOf('\n  }', open)
    return close < 0 ? null : src.slice(open, close + 4)
  }

  const toggle = fnBody(loopPage, 'const toggleLoop = () => {')
  check('the repeat toggle handler is present', !!toggle, 'signature not found in PrayerPage.jsx')
  check(
    'toggling repeat no longer stops and restarts the prayer',
    !!toggle && !/stopJob\(/.test(toggle) && !/startJob\(/.test(toggle) && !/restartTimer/.test(toggle),
    toggle ? 'the restart re-speaks the current line from its top' : 'no handler to check'
  )
  check(
    'the repeat toggle hands the new value to the engine',
    !!toggle && /speech\.setLoop\(/.test(toggle),
    toggle ? 'the switch only changed React state; the running job never heard about it' : 'no handler to check'
  )

  const setter = fnBody(loopSpeech, 'setLoop(on) {')
  check(
    'the engine writes the loop flag onto the job it is already running',
    !!setter && /this\.job\.loop = !!on/.test(setter),
    setter ? setter.replace(/\s+/g, ' ').slice(0, 120) : 'SpeechEngine has no setLoop(on)'
  )

  const timed = fnBody(loopSpeech, 'timedLoop(opts, chant) {')
  check(
    'the chant/timeout loop reads the live job flag, not the value captured at start',
    !!timed && /j\.loop/.test(timed) && !/opts\.loop/.test(timed),
    timed ? (timed.includes('opts.loop') ? 'opts.loop was captured before the switch was pressed' : 'no j.loop read') : 'timedLoop not found'
  )

  check(
    'a prayer starts with the loop flag the store holds at that moment',
    /loop: useStore\.getState\(\)\.loopOn/.test(loopPage) && !/loop: loopOn,/.test(loopPage),
    'a render-time binding is stale for any start scheduled before a toggle'
  )
  check(
    'the restart timer that re-spoke the line is gone from the page',
    !/restartTimer/.test(loopPage),
    'nothing else arms it; it only ever existed to restart after a toggle'
  )
}

// --- 13. Background audio survives Android 17, and scrolling drops its blurs --
{
  // Android 17 enforces "background audio hardening": an app that is neither
  // visible nor running a mediaPlayback foreground service gets its audio
  // muted through the CONTROL_AUDIO app op seconds after it is backgrounded.
  // The prayer therefore used to go silent on minimize and roar back on return
  // - the reported ambient "disconnect". The service must exist, be typed
  // mediaPlayback, and be tied to the life of a speech job: started where a
  // job activates, stopped where the job dies, kept across pause.
  const read = (p) => {
    try {
      return readFileSync(path.join(ROOT, p), 'utf8')
    } catch {
      return null
    }
  }
  const fnBody = (src, sig) => {
    if (!src) return null
    const at = src.indexOf(sig)
    if (at < 0) return null
    const open = src.indexOf('{', at)
    if (open < 0) return null
    const close = src.indexOf('\n  }', open)
    return close < 0 ? null : src.slice(open, close + 4)
  }

  const manifest = read('android/app/src/main/AndroidManifest.xml')
  check('the manifest exists to declare a media foreground service', !!manifest, 'AndroidManifest.xml unreadable')
  check(
    'the app may run foreground services at all',
    !!manifest && /android\.permission\.FOREGROUND_SERVICE"/.test(manifest),
    'FOREGROUND_SERVICE permission missing'
  )
  check(
    'the foreground service may be of the media type Android 17 requires',
    !!manifest && /android\.permission\.FOREGROUND_SERVICE_MEDIA_PLAYBACK/.test(manifest),
    'FOREGROUND_SERVICE_MEDIA_PLAYBACK permission missing'
  )
  // Services without an intent-filter are written self-closing (<service ... />),
  // so the pattern accepts either form.
  const serviceTag =
    !!manifest && (manifest.match(/<service[\s\S]*?(?:\/>|<\/service>)/g) || []).find((t) => t.includes('.PrayerPlaybackService'))
  check(
    'the manifest declares the playback service as mediaPlayback',
    !!serviceTag && /foregroundServiceType="mediaPlayback"/.test(serviceTag),
    serviceTag ? 'PrayerPlaybackService is declared but not typed mediaPlayback' : 'no .PrayerPlaybackService declaration'
  )

  const service = read('android/app/src/main/java/app/joiningpalms/PrayerPlaybackService.java')
  check('the playback service class exists', !!service, 'PrayerPlaybackService.java missing')
  check(
    'the service promotes itself to the foreground with the media type',
    !!service && /startForeground\(/.test(service) && /FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK/.test(service),
    service ? 'startForeground must pass FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK' : 'no service class to check'
  )

  const plugin = read('android/app/src/main/java/app/joiningpalms/PrayerAudioPlugin.java')
  check('the native bridge plugin class exists', !!plugin, 'PrayerAudioPlugin.java missing')
  check(
    'the plugin is named PrayerAudio and exposes start/stop',
    !!plugin &&
      /@CapacitorPlugin\(name = "PrayerAudio"\)/.test(plugin) &&
      /void startPlayback\(/.test(plugin) &&
      /void stopPlayback\(/.test(plugin),
    plugin ? 'plugin name or methods do not match what speech.js calls' : 'no plugin class to check'
  )

  const main = read('android/app/src/main/java/app/joiningpalms/MainActivity.java')
  const regIdx = main ? main.indexOf('registerPlugin(PrayerAudioPlugin.class)') : -1
  const superIdx = main ? main.indexOf('super.onCreate(') : -1
  check(
    'the plugin is registered before the bridge is built',
    regIdx >= 0 && superIdx >= 0 && regIdx < superIdx,
    main
      ? regIdx < 0
        ? 'MainActivity never registers PrayerAudioPlugin'
        : 'BridgeActivity.onCreate builds the bridge; registering after super.onCreate feeds a builder that was already consumed'
      : 'MainActivity.java missing'
  )

  const speechSrc = stripComments(readFileSync(path.join(ROOT, 'src/audio/speech.js'), 'utf8'))
  const startBody = fnBody(speechSrc, 'async start(opts) {')
  check(
    'starting a prayer arms the background service under the tap that began it',
    !!startBody && /this\._fgs\(true\)/.test(startBody),
    startBody ? 'no _fgs(true) in start(): backgrounding the app mutes the prayer' : 'SpeechEngine.start not found'
  )
  const finishBody = fnBody(speechSrc, 'finishJob() {')
  check(
    'a prayer that ends on its own releases the service',
    !!finishBody && /this\._fgs\(false\)/.test(finishBody),
    finishBody ? 'finishJob leaves the service running after the last line' : 'finishJob not found'
  )
  const stopBody = fnBody(speechSrc, '\n  stop() {')
  check(
    'the stop button releases the service',
    !!stopBody && /this\._fgs\(false\)/.test(stopBody),
    stopBody ? 'stop() leaves the service running with nothing to play' : 'SpeechEngine.stop not found'
  )

  // The native route plays every phrase through the shared <audio> element.
  // It used to start at full volume on whatever its first sample happened to
  // be; now it starts silent either way - under the graph the gain owns
  // loudness (the element sits at 1), and without the graph the element itself
  // starts at 0.001 for the stepped ramp.
  const cloudBody = fnBody(speechSrc, 'async speakCloud(i) {')
  const elStart = cloudBody ? cloudBody.slice(cloudBody.indexOf('const el = this._elementEl()'), cloudBody.indexOf('await el.play()')) : null
  const elAfter = cloudBody ? cloudBody.slice(cloudBody.indexOf('await el.play()'), cloudBody.indexOf('const next = i + 1')) : null
  check(
    'a recorded phrase starts silent on the element path',
    !!elStart && /el\.volume = out \? 1 : 0\.001/.test(elStart) &&
      /const out = this\._phraseOut\(\)/.test(elStart),
    elStart ? 'the element jumps to full volume on its first sample' : 'element branch not located'
  )
  check(
    'a recorded phrase ramps up to the chosen volume after play',
    !!elAfter && /this\._rampElementVolume\(el, target\)/.test(elAfter),
    elAfter ? 'no ramp after play(): the fade-in never reaches the user volume' : 'element branch not located'
  )
  check(
    'under a running context the element fades in on the audio thread',
    !!elAfter && /if \(out\)/.test(elAfter) &&
      /cancelScheduledValues\(t\)/.test(elAfter) &&
      /linearRampToValueAtTime\(target, t \+ 0\.06\)/.test(elAfter),
    elAfter ? 'no graph fade-in after play(): every phrase start is the stepped ramp again' : 'element branch not located'
  )

  const appSrc = readFileSync(path.join(ROOT, 'src/App.jsx'), 'utf8')
  check(
    'the app marks the document while any region is scrolling',
    /addEventListener\('scroll'/.test(appSrc) && /capture: true/.test(appSrc) && /is-scrolling/.test(appSrc),
    'no capture-phase scroll listener driving the is-scrolling class'
  )
  const css = readFileSync(path.join(ROOT, 'src/styles.css'), 'utf8')
  const scrollRules = css.match(/\.is-scrolling [\s\S]{0,600}?\}/)
  check(
    'backdrop blurs are suspended while the page moves',
    !!scrollRules &&
      /\.is-scrolling \.prayer-stage/.test(scrollRules[0]) &&
      /backdrop-filter:\s*none/.test(scrollRules[0]) &&
      /\.is-scrolling \.card/.test(scrollRules[0]),
    scrollRules ? 'is-scrolling rules missing the stage or the cards' : 'no .is-scrolling block in styles.css'
  )
  // The blur cut alone left a Pixel 7 measuring 85-133ms median frames (and the
  // home page 73ms) while moving: the rest of the .low-power bargain was never
  // ported. The screen-blended sky and glow-field re-blend every frame behind
  // them during a swipe, the fireflies animate shadowed dots on the main
  // thread, and the shooting stars repaint their trails - all work the
  // low-power comment already names as recurring on every scroll.
  const scrollSection = css.slice(css.indexOf('.is-scrolling .prayer-stage'))
  check(
    'the screen-blended sky stops blending while the page moves',
    /\.is-scrolling \.sky::before \{[^}]*animation:\s*none[^}]*mix-blend-mode:\s*normal/.test(scrollSection),
    scrollSection ? 'is-scrolling keeps the sky screen-blended: every scroll frame pays a blend pass' : 'no .is-scrolling section in styles.css'
  )
  check(
    'the glow field stops blending while the page moves',
    /\.is-scrolling \.glow-field \{[^}]*animation:\s*none[^}]*mix-blend-mode:\s*normal/.test(scrollSection),
    'is-scrolling keeps the glow-field screen-blended: every scroll frame pays a blend pass'
  )
  check(
    'the fireflies pause mid-flight while the page moves',
    /\.is-scrolling \.fireflies \{[^}]*animation-play-state:\s*paused/.test(scrollSection) &&
      !/\.is-scrolling \.fireflies \{[^}]*(display:\s*none|animation:\s*none)/.test(scrollSection),
    scrollSection
      ? 'is-scrolling must pause the fireflies, not cancel them: cancelling restarts every light from 0% with its full delay on the next scroll - the reported pulsed rise'
      : 'no .is-scrolling section in styles.css'
  )
  check(
    'the shooting stars drop their trails while the page moves',
    /\.is-scrolling \.sp \{[^}]*box-shadow:\s*0 0 6px/.test(scrollSection),
    'is-scrolling still repaints full shooting-star trails every moving frame'
  )
  // Idle measurements split the pages cleanly: earth view (no fireflies, no
  // sparkles, no theme canvas) idles at 19ms median frames while home sits at
  // 101ms and prayer at 121ms - the always-on backgrounds own the budget the
  // scroll then has to fit inside. The gesture must pause them the way
  // visibilitychange already does, or every fling frame competes with a
  // full-screen canvas draw or a WebGL render.
  const hookSrc = stripComments(readFileSync(path.join(ROOT, 'src/components/useBackdropCanvas.js'), 'utf8'))
  const loopArm = hookSrc.slice(hookSrc.indexOf('const loop = (t)'), hookSrc.indexOf('const onResize'))
  check(
    'the theme backdrop stops drawing while the page scrolls',
    !!loopArm && /requestAnimationFrame\(loop\)[\s\S]{0,160}is-scrolling/.test(loopArm),
    loopArm ? 'useBackdropCanvas keeps drawing full-screen frames under every swipe' : 'backdrop loop not located'
  )
  const earthSrc = stripComments(readFileSync(path.join(ROOT, 'src/three/EarthScene.js'), 'utf8'))
  const animateBody = fnBody(earthSrc, 'animate = () => {')
  check(
    'the prayer globe stops rendering while the page scrolls',
    !!animateBody && /is-scrolling/.test(animateBody),
    animateBody ? 'EarthScene keeps rendering its 24fps backdrop under the scrolling prayer text' : 'EarthScene.animate not found'
  )
  check(
    'the sparkle twinkle pauses while the page moves',
    /\.is-scrolling \.sp \{[^}]*animation-play-state:\s*paused/.test(scrollSection) &&
      !/\.is-scrolling \.sp \{[^}]*animation:\s*none/.test(scrollSection),
    'is-scrolling must pause the sparkles, not cancel them: cancellation restarts each streak from zero on every scroll'
  )
}

// --- 14. Lifetime data, streak math and the extracted shared helpers ---------
// Direct tests for the exports store.js says exist for exactly this purpose
// (safeStorage / neverLoseData / quarantine), for the pure streak math that
// nothing guarded yet, and for the two modules this refactor extracted
// (mulberry, LocaleSelect) so their behaviour cannot silently drift back into
// copies.
{
  const fakeStorage = () => {
    const map = new Map()
    return {
      getItem: (k) => (map.has(k) ? map.get(k) : null),
      setItem: (k, v) => map.set(k, String(v)),
      removeItem: (k) => map.delete(k),
      get: (k) => map.get(k)
    }
  }
  const flags = () => ({
    quarantined: useStore.getState().dataQuarantined,
    failed: useStore.getState().dataPreservationFailed
  })
  const resetFlags = () => useStore.setState({ dataQuarantined: false, dataPreservationFailed: false, persistFailed: false })
  const hadWindow = Object.prototype.hasOwnProperty.call(globalThis, 'window')
  const savedWindow = globalThis.window
  try {
    resetFlags()

    // quarantine: unreadable bytes are MOVED aside, counted, and surfaced -
    // never silently overwritten by the defaults the app is about to write.
    globalThis.window = { localStorage: fakeStorage() }
    check(
      'quarantine preserves unreadable bytes instead of overwriting them',
      quarantine('pe-state', 'corrupt{{{') === true &&
        globalThis.window.localStorage.get('pe-state.unreadable') === 'corrupt{{{'
    )
    check(
      'quarantine counts repeated incidents',
      globalThis.window.localStorage.get('pe-state.unreadable.count') === '1' &&
        quarantine('pe-state', 'corrupt-again') === true &&
        globalThis.window.localStorage.get('pe-state.unreadable.count') === '2'
    )
    check(
      'quarantine tells the store the data was preserved',
      flags().quarantined === true && flags().failed === false
    )

    // Storage refuses the write (quota / sandbox): the store must be told
    // preservation FAILED, because defaults are about to land on top of it.
    globalThis.window = {
      localStorage: {
        getItem: () => null,
        setItem: () => {
          throw new Error('QuotaExceededError')
        },
        removeItem: () => {}
      }
    }
    resetFlags()
    check(
      'quarantine reports failure when storage refuses the write',
      quarantine('pe-state', 'raw') === false && flags().quarantined === true && flags().failed === true
    )

    // safeStorage: corrupt JSON reads as null (and is quarantined first),
    // valid JSON passes through, missing keys are null.
    const st = fakeStorage()
    st.setItem('pe-state', '{"broken":')
    globalThis.window = { localStorage: st }
    check(
      'safeStorage quarantines a corrupt entry and reads null',
      safeStorage.getItem('pe-state') === null && st.get('pe-state.unreadable') === '{"broken":'
    )
    st.setItem('pe-good', '{"ok":1}')
    check('safeStorage passes valid JSON through untouched', safeStorage.getItem('pe-good') === '{"ok":1}')
    check('safeStorage reads a missing key as null', safeStorage.getItem('pe-missing') === null)

    // neverLoseData: a write may never LOWER stored counters, keeps the
    // identity the server knows (anonId + delete token), and takes ordinary
    // preferences from the incoming value.
    globalThis.window = {
      localStorage: (() => {
        const map = new Map([
          [
            'pe-state',
            JSON.stringify({
              state: {
                localPrayerSeconds: 100,
                bestStreak: 7,
                streak: 3,
                anonId: 'anon-kept',
                deleteToken: 'tok-kept',
                theme: 'dawn',
                prayerCompletions: { alpha: 4 },
                prayerDayStats: { '2026-10-19': { seconds: 50 } }
              }
            })
          ]
        ])
        return {
          getItem: (k) => (map.has(k) ? map.get(k) : null),
          setItem: (k, v) => map.set(k, String(v)),
          removeItem: (k) => map.delete(k)
        }
      })()
    }
    const merged = JSON.parse(
      neverLoseData(
        'pe-state',
        JSON.stringify({
          state: {
            localPrayerSeconds: 50,
            bestStreak: 2,
            streak: 9,
            theme: 'mystic',
            anonId: '',
            deleteToken: '',
            prayerCompletions: { beta: 1 },
            prayerDayStats: { '2026-10-19': { seconds: 20 } }
          }
        })
      )
    )
    check('a lower localPrayerSeconds can never be persisted', merged.state.localPrayerSeconds === 100)
    check('bestStreak is max-merged and never drops below the streak', merged.state.bestStreak === 9)
    check('the anonId survives an incoming empty identity', merged.state.anonId === 'anon-kept')
    check('the delete token survives an incoming empty token', merged.state.deleteToken === 'tok-kept')
    check('non-counter preferences come from the incoming value', merged.state.theme === 'mystic')
    check('per-day counters max-merge instead of overwriting', merged.state.prayerDayStats['2026-10-19'].seconds === 50)

    // With storage access throwing at all (bare node, blocked window) the
    // value comes back untouched rather than being dropped.
    delete globalThis.window
    const passthrough = '{"state":{"localPrayerSeconds":7}}'
    check('neverLoseData returns the value unchanged when storage is unreachable',
      neverLoseData('pe-state', passthrough) === passthrough)

    resetFlags()
  } finally {
    if (hadWindow) globalThis.window = savedWindow
    else delete globalThis.window
    resetFlags()
  }
}

{
  // Streak math: derived from the day map so a lapsed streak can decrease.
  check('dayKeyUTC pads month and day to two digits', dayKeyUTC(new Date(Date.UTC(2025, 0, 5))) === '2025-01-05')
  check('dayKeyUTC reads the UTC date, not local', dayKeyUTC(new Date(Date.UTC(2025, 11, 31))) === '2025-12-31')

  const now = new Date('2026-10-20T12:00:00Z')
  const [d0, d1, d2] = ['2026-10-20', '2026-10-19', '2026-10-18']
  check('an empty day map is a zero streak', streakFromDays({}, now) === 0)
  check('praying today keeps the streak alive', streakFromDays({ [d0]: {} }, now) === 1)
  check('praying only yesterday still keeps it alive', streakFromDays({ [d1]: {} }, now) === 1)
  check('a three-day run counts three', streakFromDays({ [d0]: {}, [d1]: {}, [d2]: {} }, now) === 3)
  check(
    'a gap behind yesterday stops the count at today, it does not zero a live streak',
    streakFromDays({ [d0]: {}, [d2]: {} }, now) === 1
  )
  check(
    'an older run behind a gap never merges into the live one',
    streakFromDays({ [d0]: {}, [d1]: {}, '2026-10-16': {} }, now) === 2
  )
  check('the count walks back from yesterday when today is missed', streakFromDays({ [d1]: {}, [d2]: {} }, now) === 2)
  check('a future-only day map is not a streak', streakFromDays({ '2026-10-21': {} }, now) === 0)

  // Key the map off the real clock: mergeStats re-derives with new Date(), so
  // hardcoded day keys silently go stale the moment UTC rolls past midnight.
  const yesterday = dayKeyUTC(new Date(Date.now() - 86400000))
  const out = mergeStats({ streak: 99, bestStreak: 0, localPrayerSeconds: 100, prayerDayCompletions: { [yesterday]: {} } }, {})
  check('streak is re-derived from days, never max-restored', out.streak === 1)
  check('bestStreak is never lower than the derived streak', out.bestStreak === 1)
  check(
    'localPrayerSeconds takes the greater side',
    mergeStats({ localPrayerSeconds: 100 }, { localPrayerSeconds: 50 }).localPrayerSeconds === 100 &&
      mergeStats({ localPrayerSeconds: 50 }, { localPrayerSeconds: 150 }).localPrayerSeconds === 150
  )
  check(
    'lastPrayedDay keeps the later of the two days',
    mergeStats({ lastPrayedDay: '2026-10-19' }, { lastPrayedDay: '2026-10-20' }).lastPrayedDay === '2026-10-20' &&
      mergeStats({ lastPrayedDay: '2026-10-20' }, { lastPrayedDay: '2026-10-19' }).lastPrayedDay === '2026-10-20'
  )
  const many = {}
  for (let i = 0; i < 121; i++) many[dayKeyUTC(new Date(Date.UTC(2026, 0, 1) + i * 86400000))] = {}
  const capped = mergeStats({}, { prayerDayCompletions: many }).prayerDayCompletions
  check('the merged day map is capped at 120 entries', Object.keys(capped).length === 120)
  check('the oldest day is the one dropped from the cap', !('2026-01-01' in capped))
}

{
  // Backup digest + checksum: the recovery code's integrity primitive.
  check('crc32 matches the standard CRC-32 check vector', crc32('123456789') === 0xcbf43926)
  check('crc32 of an empty string is zero', crc32('') === 0)
  check(
    'crc32 is deterministic and input-sensitive',
    crc32('prayer') === crc32('prayer') && crc32('prayer') !== crc32('prayers')
  )
  const rich = { localPrayerSeconds: 9, bestStreak: 4, prayerCompletions: { alpha: 2 } }
  check(
    'summarizeState is the state-side alias of summarizePayload',
    JSON.stringify(summarizeState(rich)) === JSON.stringify(summarizePayload(rich))
  )
  check(
    'summarizeState of empty state reports zeroes',
    JSON.stringify(summarizeState({})) ===
      JSON.stringify({ distinctPrayers: 0, completions: 0, seconds: 0, bestStreak: 0, days: 0, fromDay: 0, toDay: 0 })
  )
}

{
  // Phrase-level meaning translations (the small "e" line under a prayer).
  check('a known phrase meaning translates', tPhrase('Glory be to God.', 'es') === 'Gloria a Dios.')
  check(
    'an untranslated phrase falls back to its meaning',
    tPhrase('A phrase nobody translated.', 'es') === 'A phrase nobody translated.'
  )
  check('the phrase table holds entries', Object.keys(PHRASE_MEANING_L10N).length >= 10)
  const badEntries = Object.entries(PHRASE_MEANING_L10N).filter(
    ([, v]) => !v || typeof v !== 'object' || !Object.values(v).every((s) => typeof s === 'string' && s.trim())
  )
  check(
    'every phrase entry maps to non-empty locale strings',
    badEntries.length === 0,
    badEntries.map(([k]) => k).join(', ')
  )
}

{
  // The extracted shared helpers: one PRNG, one locale select - pinned so the
  // copies cannot come back.
  const r = mulberry(31)
  const five = [r(), r(), r(), r(), r()]
  check(
    'mulberry(31) opens with the pinned sequence',
    JSON.stringify(five) ===
      JSON.stringify([0.6722561160568148, 0.8359460374340415, 0.7496604530606419, 0.04891713825054467, 0.41673933155834675])
  )
  const a = mulberry(7)
  const b = mulberry(7)
  let same = true
  for (let i = 0; i < 50; i++) if (a() !== b()) same = false
  check('the same seed replays the same sequence', same)
  check('a different seed gives a different stream', mulberry(31)() !== mulberry(777)())
  check('every draw lands inside [0, 1)', five.every((x) => x >= 0 && x < 1))

  const defs = srcFiles.filter((p) => /function mulberry\(/.test(stripComments(readFileSync(p, 'utf8'))))
  check(
    'the PRNG has exactly one definition in src',
    defs.length === 1 && defs[0].endsWith(path.join('components', 'mulberry.js')),
    defs.map((p) => path.relative(ROOT, p)).join(', ')
  )
  const backdrops = ['DawnBackdrop', 'MysticBackdrop', 'NatureBackdrop', 'OceanBackdrop', 'SpaceBackdrop', 'TempleBackdrop']
  const missing = backdrops.filter(
    (b) => !/from '\.\/mulberry\.js'/.test(readFileSync(path.join(ROOT, 'src', 'components', `${b}.jsx`), 'utf8'))
  )
  check('every theme backdrop imports the shared PRNG', missing.length === 0, missing.join(', '))

  // ...and every theme backdrop must animate through the shared harness: it
  // caps the frame rate at 24fps, pauses on scroll and visibility, lowers
  // resolution on low-power hardware and draws one static frame for reduced
  // motion. Nature drew once plus on a 60s interval instead, so its
  // fireflies and birds held still for a minute and then jumped - the
  // nature theme's small lights "moving in pulses instead of continuously".
  const ownLoop = backdrops.filter((b) => {
    const src = readFileSync(path.join(ROOT, 'src', 'components', `${b}.jsx`), 'utf8')
    return !/useBackdropCanvas\(/.test(src) || /setInterval\(/.test(stripComments(src))
  })
  check('every theme backdrop animates through the shared harness',
    ownLoop.length === 0, ownLoop.join(', '))

  const selFiles = srcFiles.filter((p) => /LOCALES\.map\(/.test(readFileSync(p, 'utf8')))
  check(
    'the locale select has exactly one implementation',
    selFiles.length === 1 && selFiles[0].endsWith(path.join('components', 'LocaleSelect.jsx')),
    selFiles.map((p) => path.relative(ROOT, p)).join(', ')
  )
  const users = ['Onboarding.jsx', 'SettingsLook.jsx'].filter(
    (f) => !/<LocaleSelect /.test(readFileSync(path.join(ROOT, 'src/components', f), 'utf8'))
  )
  check('onboarding and the settings look section both use the shared select', users.length === 0, users.join(', '))
}

const failed = results.filter((r) => !r.pass)
console.log(`\n[units] ${results.length - failed.length}/${results.length} passed`)
if (failed.length) {
  console.log('[units] FAILED:\n' + failed.map((f) => '  - ' + f.name).join('\n'))
  process.exit(1)
}
void existsSync
