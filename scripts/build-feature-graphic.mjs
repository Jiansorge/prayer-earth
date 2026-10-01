// Feature graphic for Google Play: 1024x500 PNG.
//
// Play crops this differently depending on where it appears (full width on the
// listing, centre-cropped on some promotional surfaces), so everything essential
// lives in a centred safe area and the atmosphere comes from gradients rather
// than edge detail.
//
// Rendered as SVG and rasterised with sharp, already a dependency. The palette
// is lifted from the app's own stylesheet so the graphic reads as the same
// product rather than stock prayer clip-art.

import sharp from 'sharp'
import fs from 'node:fs'

const W = 1024
const H = 500

// The app's own values: --bg-0 #07150d, --bg-1 #0b1f14, --gold #dfb05c,
// --gold-soft #f3e2b0, --accent-1 #7fc9a0, --sky-top #040714, plus the globe's
// lantern gold #e8c47a and violet #b9a6f5.
const C = {
  night: '#040714',
  bg0: '#07150d',
  bg1: '#0b1f14',
  gold: '#dfb05c',
  goldSoft: '#f3e2b0',
  accent: '#7fc9a0',
  ink: '#f1f5e8',
  lantern: '#e8c47a',
  violet: '#b9a6f5'
}

// Deterministic, so repeated builds produce a byte-identical file.
const rand = (seed) => {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}
const r = rand(20261001)

const stars = Array.from({ length: 260 }, () => {
  const x = (r() * W).toFixed(1)
  const y = (r() * H).toFixed(1)
  const rad = (r() * 1.4 + 0.3).toFixed(2)
  const op = (r() * 0.55 + 0.10).toFixed(2)
  return `<circle cx="${x}" cy="${y}" r="${rad}" fill="#ffffff" opacity="${op}"/>`
}).join('')

// The globe sits in the lower half so the wordmark has clean sky above it and
// the two never collide.
const cx = 512
const cy = 340
const R = 116

const graticule = (() => {
  const lines = []
  for (const f of [-0.62, -0.31, 0.31, 0.62]) {
    const y = cy + f * R
    const half = R * Math.sqrt(Math.max(0, 1 - f * f))
    lines.push(
      `<path d="M ${(cx - half).toFixed(1)} ${y.toFixed(1)} Q ${cx} ${(y + 7).toFixed(1)} ${(cx + half).toFixed(1)} ${y.toFixed(1)}" fill="none" stroke="${C.accent}" stroke-opacity="0.15" stroke-width="1"/>`
    )
  }
  for (const k of [0.3, 0.64, 0.92]) {
    lines.push(
      `<ellipse cx="${cx}" cy="${cy}" rx="${(R * k).toFixed(1)}" ry="${R}" fill="none" stroke="${C.accent}" stroke-opacity="0.13" stroke-width="1"/>`
    )
  }
  return lines.join('')
})()

// Lights clustered on landmasses so the globe reads as inhabited rather than
// randomly speckled. Fractions of the globe's bounding box.
const spots = [
  [0.30, 0.42, 3.8, 0.95],
  [0.35, 0.54, 2.6, 0.68],
  [0.43, 0.46, 3.2, 0.80],
  [0.51, 0.41, 4.2, 1.0],
  [0.58, 0.51, 2.8, 0.72],
  [0.65, 0.43, 3.5, 0.86],
  [0.71, 0.57, 2.4, 0.64],
  [0.26, 0.63, 2.2, 0.58],
  [0.47, 0.63, 2.7, 0.68],
  [0.61, 0.67, 2.1, 0.55],
  [0.77, 0.37, 2.5, 0.62],
  [0.38, 0.31, 2.2, 0.56]
]

const lights = spots
  .map(([fx, fy, rad, op]) => {
    const x = (cx - R + fx * R * 2).toFixed(1)
    const y = (cy - R + fy * R * 2).toFixed(1)
    return `<circle cx="${x}" cy="${y}" r="${(rad * 2.6).toFixed(1)}" fill="${C.lantern}" opacity="${(op * 0.10).toFixed(3)}"/>
      <circle cx="${x}" cy="${y}" r="${(rad * 1.8).toFixed(1)}" fill="${C.gold}" opacity="${(op * 0.20).toFixed(3)}"/>
      <circle cx="${x}" cy="${y}" r="${rad.toFixed(1)}" fill="#fff7e4"/>`
  })
  .join('')

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${C.night}"/>
      <stop offset="52%" stop-color="#06180f"/>
      <stop offset="100%" stop-color="${C.bg1}"/>
    </linearGradient>
    <radialGradient id="hazeA" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${C.accent}" stop-opacity="0.5"/>
      <stop offset="100%" stop-color="${C.accent}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="hazeB" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${C.violet}" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="${C.violet}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="globeFill" cx="36%" cy="28%" r="80%">
      <stop offset="0%" stop-color="#16442c"/>
      <stop offset="55%" stop-color="#0b2a1a"/>
      <stop offset="100%" stop-color="#04140d"/>
    </radialGradient>
    <radialGradient id="rim" cx="50%" cy="50%" r="50%">
      <stop offset="86%" stop-color="${C.gold}" stop-opacity="0"/>
      <stop offset="97%" stop-color="${C.gold}" stop-opacity="0.60"/>
      <stop offset="100%" stop-color="${C.gold}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="core" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${C.goldSoft}" stop-opacity="0.13"/>
      <stop offset="70%" stop-color="${C.gold}" stop-opacity="0.03"/>
      <stop offset="100%" stop-color="${C.gold}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="title" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="${C.goldSoft}"/>
    </linearGradient>
    <linearGradient id="rule" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${C.gold}" stop-opacity="0"/>
      <stop offset="25%" stop-color="${C.gold}" stop-opacity="0.9"/>
      <stop offset="75%" stop-color="${C.gold}" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="${C.gold}" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="vignette" cx="50%" cy="50%" r="72%">
      <stop offset="55%" stop-color="#000000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.5"/>
    </radialGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#sky)"/>
  ${stars}

  <!-- haze kept wide and low so it never reads as a smudge behind the title -->
  <ellipse cx="512" cy="470" rx="640" ry="220" fill="url(#hazeA)" opacity="0.34"/>
  <ellipse cx="820" cy="330" rx="300" ry="150" fill="url(#hazeB)" opacity="0.20"/>
  <ellipse cx="170" cy="360" rx="300" ry="140" fill="url(#hazeB)" opacity="0.13"/>

  <!-- globe -->
  <circle cx="${cx}" cy="${cy}" r="${R}" fill="url(#globeFill)"/>
  ${graticule}
  ${lights}
  <circle cx="${cx}" cy="${cy}" r="${R}" fill="url(#core)"/>
  <circle cx="${cx}" cy="${cy}" r="${R}" fill="url(#rim)"/>
  <circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${C.accent}" stroke-opacity="0.32" stroke-width="1.2"/>

  <!-- wordmark: clear sky above the globe, well inside the safe area -->
  <g font-family="Georgia, 'Times New Roman', serif" text-anchor="middle">
    <text x="512" y="132" font-size="64" font-weight="600" fill="url(#title)" letter-spacing="1">Joining Palms</text>
  </g>
  <rect x="392" y="162" width="240" height="1.6" fill="url(#rule)"/>
  <g font-family="Georgia, 'Times New Roman', serif" text-anchor="middle">
    <text x="512" y="206" font-size="24" fill="${C.ink}" fill-opacity="0.88" letter-spacing="3.6">PRAY WITH THE WORLD</text>
  </g>

  <!-- footer sits over the globe's lower edge, which is dark enough to read -->
  <g font-family="Georgia, 'Times New Roman', serif" text-anchor="middle">
    <text x="512" y="482" font-size="17" fill="${C.ink}" fill-opacity="0.72" letter-spacing="0.5">16 traditions &#183; 244 prayers &#183; 15 languages &#183; no ads, ever</text>
  </g>

  <rect width="${W}" height="${H}" fill="url(#vignette)"/>
</svg>`

fs.mkdirSync('dist-store', { recursive: true })
fs.writeFileSync('dist-store/feature-graphic.svg', svg)

// Play requires the feature graphic to be a 24-bit PNG or JPEG with NO alpha
// channel, so the render is flattened onto an opaque backdrop rather than
// written with transparency. Compositing onto the same sky colour the SVG
// paints first makes this visually a no-op.
await sharp(Buffer.from(svg))
  .flatten({ background: C.night })
  .removeAlpha()
  .png({ compressionLevel: 9, palette: false })
  .toFile('dist-store/feature-graphic.png')

const m = await sharp('dist-store/feature-graphic.png').metadata()
const kb = Math.round(fs.statSync('dist-store/feature-graphic.png').size / 1024)
console.log(`feature-graphic.png  ${m.width}x${m.height}  ${kb}KB`)