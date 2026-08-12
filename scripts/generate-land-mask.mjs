// Generates public/land-mask.png — a binary equirectangular land/ocean mask
// (white=land, black=ocean) that EarthScene.js loads at runtime instead of
// classifying the day photo. Run from prayer-earth/.
//
//   node scripts/generate-land-mask.mjs                    # from the day texture
//   node scripts/generate-land-mask.mjs --source mask.png  # from your own mask
//
// The default source is the NASA day texture, classified with the exact same
// pipeline the app used at runtime (classify → fill-lakes → soften → erode),
// so the result matches the previously-shipped coastline quality. For
// pixel-perfect coastlines, regenerate from Natural Earth 110m land polygons.
import sharp from 'sharp'
import fs from 'fs'

const OUT = 'public/land-mask.png'
const W = 2048
const H = 1024

const args = process.argv.slice(2)
const srcIdx = args.indexOf('--source')
const source = srcIdx >= 0 ? args[srcIdx + 1] : 'src/assets/textures/earth_atmos_medium.jpg'

if (srcIdx >= 0) {
  await sharp(source).resize(W, H, { fit: 'fill' }).grayscale().normalise().toFile(OUT)
  console.log('wrote', OUT, 'from', source)
  process.exit(0)
}

// Arctic ice cap reads as bright land; cut the top band like the runtime does.
const ARCTIC_ROWS = Math.floor((H * 10) / 180)

// --- 1. classify the day texture into land (255) / ocean (0) ---
const { data, info } = await sharp(source)
  .resize(W, H, { fit: 'fill' })
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true })

const CH = info.channels
let out = new Uint8Array(W * H)

for (let y = 0; y < H; y++) {
  const arctic = y < ARCTIC_ROWS
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * CH
    const r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255
    const lum = 0.299 * r + 0.587 * g + 0.114 * b
    const gb = g - b
    const brightLand = lum > 0.2 && gb > -0.01
    const darkLand = lum <= 0.2 && lum > 0.08 && gb > -0.08 && b < 0.28
    out[y * W + x] = arctic ? 0 : brightLand || darkLand ? 255 : 0
  }
}

// --- 2. median filter (5x5) removes speckles while keeping wide seas ---
{
  const tmp = new Uint8Array(W * H)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const vals = []
      for (let dy = -2; dy <= 2; dy++) {
        const ny = Math.max(0, Math.min(H - 1, y + dy))
        for (let dx = -2; dx <= 2; dx++) {
          const nx = (x + dx + W) % W
          vals.push(out[ny * W + nx])
        }
      }
      vals.sort((a, b) => a - b)
      tmp[y * W + x] = vals[12]
    }
  }
  out = tmp
}

// --- 3. fill enclosed water "lakes" inside continents (matches runtime) ---
{
  const isLand = (i) => out[i] > 128
  const visited = new Uint8Array(W * H)
  const stack = []
  const seed = (i) => { if (!visited[i] && !isLand(i)) { visited[i] = 1; stack.push(i) } }
  for (let x = 0; x < W; x++) { seed(x); seed((H - 1) * W + x) }
  for (let y = 0; y < H; y++) { seed(y * W); seed(y * W + W - 1) }
  while (stack.length) {
    const i = stack.pop()
    const x = i % W, y = (i / W) | 0
    const n = [
      x > 0 ? i - 1 : i + W - 1,
      x < W - 1 ? i + 1 : i - W + 1,
      y > 0 ? i - W : -1,
      y < H - 1 ? i + W : -1
    ]
    for (const ni of n) {
      if (ni >= 0 && !visited[ni] && !isLand(ni)) { visited[ni] = 1; stack.push(ni) }
    }
  }
  const MAX_LAKE = Math.round((W * H) / 800)
  const seen = new Uint8Array(W * H)
  for (let i = 0; i < W * H; i++) {
    if (seen[i] || isLand(i) || visited[i]) continue
    const region = []
    const q = [i]
    seen[i] = 1
    while (q.length) {
      const c = q.pop()
      region.push(c)
      const x = c % W, y = (c / W) | 0
      const n = [
        x > 0 ? c - 1 : -1,
        x < W - 1 ? c + 1 : -1,
        y > 0 ? c - W : -1,
        y < H - 1 ? c + W : -1
      ]
      for (const ni of n) {
        if (ni >= 0 && !seen[ni] && !isLand(ni) && !visited[ni]) { seen[ni] = 1; q.push(ni) }
      }
    }
    if (region.length < MAX_LAKE) {
      for (const c of region) out[c] = 255
    }
  }
}

// --- 4. wrap seam (first/last column match) ---
for (let y = 0; y < H; y++) {
  out[y * W + W - 1] = out[y * W]
}

await sharp(out, { raw: { width: W, height: H, channels: 1 } })
  .png({ palette: true, compressionLevel: 9 })
  .toFile(OUT)

const size = fs.statSync(OUT).size
console.log(`wrote ${OUT} (${W}x${H}, ${(size / 1024).toFixed(1)} KB)`)
console.log('To use a Natural Earth mask instead:')
console.log('  rasterize land polygons -> equirect PNG -> node scripts/generate-land-mask.mjs --source mask.png')