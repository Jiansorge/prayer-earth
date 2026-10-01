// Render the globe as a single raster with sharp rather than layering SVG
// gradients, <image> elements and a terminator inside one document. Doing the
// sphere in one compositing pass removes a whole class of surprises - the SVG
// version rendered the ocean nearly black because the layers and the
// terminator interacted unpredictably.

import sharp from 'sharp'
import fs from 'node:fs'

const { body, bloom, coast } = JSON.parse(fs.readFileSync('dist-store/layers.json', 'utf8'))

// Supersampled, then downscaled, for clean edges.
const S = 3
const D = 262 * S
const R = D / 2

// Centre the sphere over South America so the middle is land, not open ocean.
const LON = -58
const LAT = -16
const tx = R - ((LON + 180) / 360) * 2 * D
const ty = R - ((90 - LAT) / 180) * D

const dec = (uri) => Buffer.from(uri.split(',')[1], 'base64')
const LAYERS = { body: dec(body), bloom: dec(bloom), coast: dec(coast) }

// The layers are a 2:1 equirectangular strip. Only the window that falls inside
// the sphere is drawn, so crop to it before compositing - sharp refuses an
// overlay larger than the base canvas.
const imgX = ((LON + 180) / 360) * 2 * D
const winLeft = Math.max(0, Math.min(D, Math.round(imgX - R)))
const strip = async (name) =>
  sharp(LAYERS[name])
    .resize(D * 2, D, { fit: 'fill' })
    .extract({ left: winLeft, top: 0, width: D, height: D })
    .png()
    .toBuffer()

// Ocean sphere with a lit upper-left and a dark limb, drawn once.
const oceanSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${D}" height="${D}">
  <defs>
    <radialGradient id="o" cx="33%" cy="28%" r="82%">
      <stop offset="0%" stop-color="#2b5f92"/>
      <stop offset="42%" stop-color="#1b3f६8"/>
      <stop offset="74%" stop-color="#10233f"/>
      <stop offset="100%" stop-color="#050b1a"/>
    </radialGradient>
  </defs>
  <circle cx="${R}" cy="${R}" r="${R}" fill="url(#o)"/>
</svg>`.replace('६', '6')

// Night side, painted over the lit side so the sphere reads as a globe.
const shadeSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${D}" height="${D}">
  <defs>
    <radialGradient id="s" cx="33%" cy="28%" r="84%">
      <stop offset="0%" stop-color="#02060f" stop-opacity="0"/>
      <stop offset="55%" stop-color="#02060f" stop-opacity="0.05"/>
      <stop offset="86%" stop-color="#02060f" stop-opacity="0.42"/>
      <stop offset="100%" stop-color="#01040c" stop-opacity="0.72"/>
    </radialGradient>
  </defs>
  <circle cx="${R}" cy="${R}" r="${R}" fill="url(#s)"/>
</svg>`

// Prayer lights, placed by the same lon/lat mapping as the app.
const LIGHTS = [
  [-46, -12], [-58, -22], [-70, -32], [-40, -20], [-75, 5], [-84, 34],
  [-100, 40], [-115, 34], [-8, 40], [2, 48], [13, 52], [24, -34], [28, 0],
  [8, 4], [18, 8], [32, 28], [78, 22], [88, 22], [103, 14], [116, 40],
  [139, 36], [106, -6], [151, -33], [-99, 19], [7, 6]
]
const px = (lon) => ((lon + 180) / 360) * 2 * D + tx
const py = (lat) => ((90 - lat) / 180) * D + ty

let lights = ''
for (const [lon, lat] of LIGHTS) {
  const x = px(lon)
  const y = py(lat)
  const d = Math.hypot(x - R, y - R)
  if (d > R - 6 * S) continue
  const s = (0.5 + (1 - d / R) * 0.8) * S
  lights += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(9 * s).toFixed(1)}" fill="#3fa9f5" opacity="0.3"/>
  <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(4 * s).toFixed(1)}" fill="#d6f2ff"/>
  <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(2 * s).toFixed(1)}" fill="#ffffff"/>`
}
const lightsSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${D}" height="${D}">${lights}</svg>`

// Everything above is drawn on a transparent canvas, then masked to the sphere.
const flat = await sharp({
  create: { width: D, height: D, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
})
  .composite([
    { input: Buffer.from(oceanSvg), left: 0, top: 0 },
    { input: await strip('body'), left: 0, top: 0 },
    { input: await strip('bloom'), left: 0, top: 0, blend: 'screen' },
    { input: await strip('coast'), left: 0, top: 0 },
    { input: Buffer.from(lightsSvg), left: 0, top: 0 },
    { input: Buffer.from(shadeSvg), left: 0, top: 0 }
  ])
  .png()
  .toBuffer()

// Circular mask, applied at the supersampled size.
const mask = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${D}" height="${D}">
     <circle cx="${R}" cy="${R}" r="${R}" fill="#fff"/></svg>`
)

// Downsample FIRST, then add the atmosphere. Compositing the ring at the final
// size keeps every overlay smaller than its base, which sharp requires.
const OUT = 262
const atmo = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${OUT}" height="${OUT}">
     <defs><filter id="b" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="6"/></filter></defs>
     <circle cx="${OUT / 2}" cy="${OUT / 2}" r="${OUT / 2 - 4}" fill="none"
             stroke="#5fd0ff" stroke-opacity="0.6" stroke-width="3" filter="url(#b)"/>
     <circle cx="${OUT / 2}" cy="${OUT / 2}" r="${OUT / 2 - 1}" fill="none"
             stroke="#9be8ff" stroke-opacity="0.45" stroke-width="1.4"/>
   </svg>`
)

const masked = await sharp(flat).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer()
const globe = await sharp(masked)
  .resize(OUT, OUT, { kernel: 'lanczos3' })
  .composite([{ input: atmo, blend: 'over' }])
  .png()
  .toBuffer()

fs.writeFileSync('dist-store/globe.png', globe)
fs.writeFileSync(
  'dist-store/globe.json',
  JSON.stringify({ globe: `data:image/png;base64,${globe.toString('base64')}` })
)
console.log('globe.png', Math.round(globe.length / 1024) + 'KB')