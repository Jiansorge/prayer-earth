// Rasterize Natural Earth 110m land polygons into public/land-mask.png
// (white=land, black=ocean). Authoritative coastline data — no RGB
// classification, so narrow seas like the Red Sea and Persian Gulf are correct.
//
//   node scripts/generate-land-mask.mjs
//
// Expects scripts/data/ne_110m_land.geojson (Natural Earth 110m land). If it
// is missing, falls back to classifying the day texture (see the fallback
// path in this file).
import sharp from 'sharp'
import fs from 'fs'

const OUT = 'public/land-mask.png'
const W = 2048
const H = 1024
const GEOJSON = 'scripts/data/ne_110m_land.geojson'

const lon2x = (lon) => (((lon + 180) / 360) * W).toFixed(2)
const lat2y = (lat) => (((90 - lat) / 180) * H).toFixed(2)

// Convert a GeoJSON ring (array of [lon, lat]) to an SVG path segment.
const ringToPath = (ring) => {
  let d = ''
  for (let i = 0; i < ring.length; i++) {
    const [lon, lat] = ring[i]
    d += (i === 0 ? 'M' : 'L') + lon2x(lon) + ' ' + lat2y(lat)
  }
  return d + ' Z'
}

if (fs.existsSync(GEOJSON)) {
  const gj = JSON.parse(fs.readFileSync(GEOJSON, 'utf8'))

  let paths = ''
  for (const feat of gj.features) {
    const geom = feat.geometry
    const polys = geom.type === 'MultiPolygon' ? geom.coordinates : [geom.coordinates]
    for (const poly of polys) {
      // outer ring + holes all in one path; evenodd keeps holes as ocean
      paths += '<path d="' + poly.map(ringToPath).join(' ') + '" fill="white" fill-rule="evenodd"/>'
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="black"/>${paths}</svg>`

  await sharp(Buffer.from(svg))
    .png({ palette: true, compressionLevel: 9 })
    .toFile(OUT)

  const size = fs.statSync(OUT).size
  console.log(`wrote ${OUT} from Natural Earth (${W}x${H}, ${(size / 1024).toFixed(1)} KB)`)
  process.exit(0)
}

// ---- fallback: classify the day texture (only if GeoJSON is absent) ----
console.warn('Natural Earth GeoJSON not found at', GEOJSON, '— falling back to day-texture classification')
console.warn('Download it with:')
console.warn('  curl -o scripts/data/ne_110m_land.geojson https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_land.geojson')

const ARCTIC_ROWS = Math.floor((H * 10) / 180)
const { data, info } = await sharp('src/assets/textures/earth_atmos_medium.jpg')
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
await sharp(out, { raw: { width: W, height: H, channels: 1 } })
  .median(5)
  .png({ palette: true, compressionLevel: 9 })
  .toFile(OUT)
console.log('wrote', OUT, '(fallback)')