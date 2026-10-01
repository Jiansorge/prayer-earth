// Build the globe's surface layers by direct pixel maths rather than sharp's
// tint(), which produced grey instead of the cyan the app uses.
//
// The mask is white land on black ocean, so:
//   body  = ocean colour lifted slightly where land is
//   coast = a bright cyan band that follows the coastline (mask minus a
//           blurred copy of itself, which is an edge detector)
//   bloom = a wide soft cyan halo under everything, for the glow

import sharp from 'sharp'
import fs from 'node:fs'

const W = 2048
const H = 1024

const { data } = await sharp('public/land-mask.png')
  .resize(W, H, { fit: 'fill' })
  .greyscale()
  .raw()
  .toBuffer({ resolveWithObject: true })

const N = W * H
const lum = new Float32Array(N)
for (let i = 0; i < N; i++) lum[i] = data[i] / 255

// Separable box blur, twice, to approximate a Gaussian cheaply.
function blur(src, radius) {
  let a = Float32Array.from(src)
  let b = new Float32Array(N)
  const passes = 3
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < H; y++) {
      let sum = 0
      const row = y * W
      for (let x = -radius; x <= radius; x++) sum += a[row + ((x + W) % W)]
      for (let x = 0; x < W; x++) {
        b[row + x] = sum / (radius * 2 + 1)
        sum -= a[row + ((x - radius + W) % W)]
        sum += a[row + ((x + radius + 1) % W)]
      }
    }
    for (let x = 0; x < W; x++) {
      let sum = 0
      for (let y = -radius; y <= radius; y++) sum += b[Math.min(H - 1, Math.max(0, y)) * W + x]
      for (let y = 0; y < H; y++) {
        a[y * W + x] = sum / (radius * 2 + 1)
        sum -= b[Math.min(H - 1, Math.max(0, y - radius)) * W + x]
        sum += b[Math.min(H - 1, Math.max(0, y + radius + 1)) * W + x]
      }
    }
  }
  return a
}

const soft = blur(lum, 3)
const wide = blur(lum, 11)

// Colours lifted from the app's own icon and Earth scene.
const OCEAN = [12, 28, 54]
const LAND = [40, 92, 122]
const COAST = [150, 226, 255]
const BLOOM = [63, 169, 245]

// RGBA: the layers must be transparent over ocean, or the black surround paints
// over the sphere's own gradient and the globe reads as a black wedge.
const body = Buffer.alloc(N * 4)
const coast = Buffer.alloc(N * 4)
const bloom = Buffer.alloc(N * 4)

for (let i = 0; i < N; i++) {
  const l = lum[i]
  const s = soft[i]
  const wgt = wide[i]
  const inner = Math.max(0, l - wgt) * 2.2

  // body: land lifts the ocean a little; the mass interior stays dark so the
  // coastlines carry the read, exactly as in the app.
  body[i * 4 + 0] = OCEAN[0] + (LAND[0] - OCEAN[0]) * l * 0.55
  body[i * 4 + 1] = OCEAN[1] + (LAND[1] - OCEAN[1]) * l * 0.55
  body[i * 4 + 2] = OCEAN[2] + (LAND[2] - OCEAN[2]) * l * 0.55
  body[i * 4 + 3] = Math.round(Math.min(1, l * 1.4) * 255)

  const edge = Math.max(0, Math.min(1, (l - s) * 3.4))
  coast[i * 4 + 0] = COAST[0]
  coast[i * 4 + 1] = COAST[1]
  coast[i * 4 + 2] = COAST[2]
  coast[i * 4 + 3] = Math.round(edge * 255)

  bloom[i * 4 + 0] = BLOOM[0]
  bloom[i * 4 + 1] = BLOOM[1]
  bloom[i * 4 + 2] = BLOOM[2]
  bloom[i * 4 + 3] = Math.round(Math.min(1, wgt * 1.15) * 255)
}

const png = async (buf, file) => {
  const b = await sharp(buf, { raw: { width: W, height: H, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toBuffer()
  fs.writeFileSync(file, b)
  return `data:image/png;base64,${b.toString('base64')}`
}

fs.mkdirSync('dist-store', { recursive: true })
const uriBody = await png(body, 'dist-store/layer-body.png')
const uriCoast = await png(coast, 'dist-store/layer-coast.png')
const uriBloom = await png(bloom, 'dist-store/layer-bloom.png')

fs.writeFileSync(
  'dist-store/layers.json',
  JSON.stringify({ body: uriBody, coast: uriCoast, bloom: uriBloom })
)
console.log('layers rebuilt with pixel-accurate cyan mapping')