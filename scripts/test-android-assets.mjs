import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIST = path.join(ROOT, 'dist')
const ANDROID_PUBLIC = path.join(ROOT, 'android', 'app', 'src', 'main', 'assets', 'public')
const ANDROID_APP_BUILD = path.join(ROOT, 'android', 'app', 'build')
let failures = 0

const check = (name, condition, detail = '') => {
  console.log(`[android-assets] ${condition ? 'PASS' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`)
  if (!condition) failures++
}

// A check that only applies once the artifact exists (e.g. it needs Gradle to
// have run). Reported as SKIP rather than FAIL so the same script can run both
// before and after the Android build.
const checkIf = (name, applicable, condition, detail = '') => {
  if (!applicable) {
    console.log(`[android-assets] SKIP ${name} (${detail || 'precondition not met'})`)
    return
  }
  check(name, condition, detail)
}

const required = [
  path.join(DIST, 'index.html'),
  path.join(DIST, 'sw.js'),
  path.join(ANDROID_PUBLIC, 'index.html'),
  path.join(ANDROID_PUBLIC, 'sw.js')
]
check('dist and Android shell files exist', required.every((file) => existsSync(file)), required.filter((file) => !existsSync(file)).join(', '))

if (required.every((file) => existsSync(file))) {
  const distHtml = readFileSync(path.join(DIST, 'index.html'), 'utf8')
  const androidHtml = readFileSync(path.join(ANDROID_PUBLIC, 'index.html'), 'utf8')
  check('Android index matches the built index', distHtml === androidHtml)
  check('service worker matches the built service worker', readFileSync(path.join(DIST, 'sw.js'), 'utf8') === readFileSync(path.join(ANDROID_PUBLIC, 'sw.js'), 'utf8'))
  check('entry CSS is inlined', !/<link[^>]*rel=["']stylesheet["']/i.test(distHtml) && /<style>[\s\S]*--bg-0/.test(distHtml))

  const assetRefs = new Set()
  for (const file of readdirSync(path.join(DIST, 'assets'))) {
    if (!file.endsWith('.js')) continue
    const source = readFileSync(path.join(DIST, 'assets', file), 'utf8')
    for (const match of source.matchAll(/assets\/[^"'`\s]+\.(?:js|css|jpg|png|webp|svg)/g)) assetRefs.add(match[0])
  }
  const missingDist = [...assetRefs].filter((ref) => !existsSync(path.join(DIST, ref)))
  const missingAndroid = [...assetRefs].filter((ref) => !existsSync(path.join(ANDROID_PUBLIC, ref)))
  check('lazy preload references exist in dist', missingDist.length === 0, missingDist.join(', ') || 'none')
  check('lazy preload references exist in Android package', missingAndroid.length === 0, missingAndroid.join(', ') || 'none')

  // The Android build must point at the real sync Worker. A build made with a
  // plain `npm run build` (not build:capacitor) omits VITE_SYNC_URL, which used
  // to bake a dead ws://localhost into the app (permanently offline). Assert
  // the packaged bundle references the production wss:// endpoint.
  const androidJs = readdirSync(path.join(ANDROID_PUBLIC, 'assets'))
    .filter((f) => f.endsWith('.js'))
    .map((f) => readFileSync(path.join(ANDROID_PUBLIC, 'assets', f), 'utf8'))
    .join('\n')
  check(
    'Android bundle targets the production sync Worker',
    androidJs.includes('wss://joining-palms.app')
  )

  // The app only ever consumes a COARSE fix (enableHighAccuracy:false, rounded
  // to 0.1 degrees, and the server only ever receives a 1-degree grid cell), so
  // ACCESS_FINE_LOCATION was removed as over-collection. Assert it stays out of
  // the merged manifest that actually ships -- an app asking for a precise fix
  // it never uses misstates the Play data-safety form and asks users for more
  // than we need. COARSE must still be there, or the light would never anchor.
  const merged = path.join(ANDROID_APP_BUILD, 'intermediates', 'merged_manifest')
  // Pick the MOST RECENT merged manifest. The build dir keeps both debug and
  // release variants, and auditing a stale one silently passes a check against a
  // build that no longer exists.
  let manifestFile = null
  let newest = -1
  if (existsSync(merged)) {
    for (const dir of readdirSync(merged)) {
      for (const sub of readdirSync(path.join(merged, dir))) {
        const p = path.join(merged, dir, sub, 'AndroidManifest.xml')
        if (!existsSync(p)) continue
        const m = statSync(p).mtimeMs
        if (m > newest) { newest = m; manifestFile = p }
      }
    }
  }
  checkIf('a merged AndroidManifest is available to audit', !!manifestFile, true,
    manifestFile || 'Gradle has not run yet; run this script again after assembleDebug')
  if (manifestFile) {
    const xml = readFileSync(manifestFile, 'utf8')
    check('the shipped manifest does NOT request ACCESS_FINE_LOCATION',
      !/android\.permission\.ACCESS_FINE_LOCATION/.test(xml))
    check('the shipped manifest still requests ACCESS_COARSE_LOCATION',
      /android\.permission\.ACCESS_COARSE_LOCATION/.test(xml))
    check('the shipped manifest requests no camera or microphone',
      !/android\.permission\.(CAMERA|RECORD_AUDIO)/.test(xml))
  }

  const manifestPath = path.join(DIST, 'audio', 'manifest.json')
  const androidManifestPath = path.join(ANDROID_PUBLIC, 'audio', 'manifest.json')
  check('audio manifest exists in dist and Android package', existsSync(manifestPath) && existsSync(androidManifestPath))
  if (existsSync(manifestPath)) {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
    const missingAudioDist = []
    const missingAudioAndroid = []
    for (const [prayerId, entry] of Object.entries(manifest.prayers || {})) {
      for (let i = 0; i < (entry.phrases || 0); i++) {
        for (const voice of entry.voices || []) {
          const file = `audio/${prayerId}/${i}-${voice}.mp3`
          if (!existsSync(path.join(DIST, file))) missingAudioDist.push(file)
          if (!existsSync(path.join(ANDROID_PUBLIC, file))) missingAudioAndroid.push(file)
        }
      }
    }
    check('manifest audio files exist in dist', missingAudioDist.length === 0, missingAudioDist.slice(0, 5).join(', ') || 'none')
    check('manifest audio files exist in Android package', missingAudioAndroid.length === 0, missingAudioAndroid.slice(0, 5).join(', ') || 'none')
  }
}

if (failures) process.exitCode = 1
else console.log('[android-assets] ALL CHECKS PASSED')
