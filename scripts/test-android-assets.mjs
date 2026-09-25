import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIST = path.join(ROOT, 'dist')
const ANDROID_PUBLIC = path.join(ROOT, 'android', 'app', 'src', 'main', 'assets', 'public')
let failures = 0

const check = (name, condition, detail = '') => {
  console.log(`[android-assets] ${condition ? 'PASS' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`)
  if (!condition) failures++
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
