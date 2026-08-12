// Generates public/land-mask.png — a binary equirectangular land/ocean mask
// (white=land, black=ocean) that EarthScene.js loads at runtime instead of
// classifying the day photo. Run from prayer-earth/.
//
//   node scripts/generate-land-mask.mjs                    # from the day texture
//   node scripts/generate-land-mask.mjs --source mask.png  # from your own mask
//
// Best results come from authoritative coastline data (Natural Earth 110m land
// polygons, rasterized to an equirectangular PNG). The default source is the
// NASA day texture, classified with the same rules the app used at runtime.
import sharp from 'sharp'
import fs from 'fs'

const OUT = 'public/land-mask.png'
const W = 2048
const H = 1024

const args = process.argv.slice(2)
const srcIdx = args.indexOf('--source')
const source = srcIdx >= 0 ? args[srcIdx + 1] : 'src/assets/textures/earth_atmos.jpg'

// Arctic ice cap reads as bright land; cut the top band like the runtime does.
const ARCTIC_ROWS = Math.floor(H * 10 / 180)

if (srcIdx >= 0) {
  // User-supplied mask: resize/normalise to the working size.
  await sharp(source)
    .resize(W, H, { fit: 'fill' })
    .grayscale()
    .normalise()
    .toFile(OUT)
  console.log('wrote', OUT, 'from', source)
  process.exit(0)
}

// --- classify the day texture into land (255) / ocean (0) ---
const { data, info } = await sharp(source)
  .resize(W, H, { fit: 'fill' })
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true })

const { width, height, channels } = info
const out = Buffer.alloc(width * height)

for (let y = 0; y < height; y++) {
  const arctic = y < ARCTIC_ROWS
  for (let x = 0; x < width; x++) {
    const i = (y * width + x) * channels
    const r = data[i] / 255
    const g = data[i + 1] / 255
    const b = data[i + 2] / 255
    const lum = 0.299 * r + 0.587 * g + 0.114 * b
    const gb = g - b
    // Same rules as the runtime render mask.
    const brightLand = lum > 0.2 && gb > -0.01
    const darkLand = lum <= 0.2 && lum > 0.08 && gb > -0.08 && b < 0.28
    const land = arctic ? 0 : brightLand || darkLand ? 255 : 0
    out[y * width + x] = land
  }
}

// Median filter (5x5) removes isolated cloud speckles and noise while keeping
// coastlines crisp — cleaner than the runtime's soften-then-erode.
await sharp(out, { raw: { width, height, channels: 1 } })
  .median(5)
  .threshold(128)
  .png({ palette: true, compressionLevel: 9 })
  .toFile(OUT)

const size = fs.statSync(OUT).size
console.log(`wrote ${OUT} (${width}x${height}, ${(size / 1024).toFixed(1)} KB)`)
console.log('To use a Natural Earth mask instead:')
console.log('  rasterize land polygons -> equirect PNG -> node scripts/generate-land-mask.mjs --source mask.png')