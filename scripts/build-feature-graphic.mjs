// Play feature graphic: 1024x500.
//
// Palette and composition follow the app rather than a generic prayer look: the
// deep navy of the main icon, the electric cyan coastlines of the Earth scene,
// and the same starfield. The globe is centred over South America so the middle
// of the sphere is land rather than open ocean.
//
// An earlier version put an open book under the globe and tried to render it as
// a physical object. It never stopped reading as a flat shape: sharp delegates
// SVG to librsvg, which paints paths, so there is no lighting model to give the
// leather or the paper real depth. The book is gone. What remains is one subject
// - the Earth and the hands - with the mathematics around it.
//
// The globe is pre-rendered by build-graphic-globe.mjs with sharp, and composited
// here. Everything rasterises at SS x supersampling and is downsampled at the end,
// which is what keeps the hairline lattice and the thin letterforms clean.

import sharp from 'sharp'
import fs from 'node:fs'

const { globe } = JSON.parse(fs.readFileSync('dist-store/globe.json', 'utf8'))
const { hands: handsArt } = JSON.parse(fs.readFileSync('dist-store/hands.json', 'utf8'))

const SS = 3 // supersample factor
const W = 1024
const H = 500
const TITLE = 'Joining Palms'

// Lifted from the app's own icon and Earth scene.
const C = {
  space: '#050a1c',
  space2: '#0a1430',
  nebula: '#1d2f6b',
  coast: '#5fd0ff',
  coastHot: '#d6f2ff',
  star: '#cfe6ff',
  aura: '#3fa9f5',
  auraSoft: '#8fd8ff',
  ink: '#f2fbff'
}

const rand = (seed) => {
  let s = seed >>> 0
  return () => ((s = (s * 1664525 + 1013904223) >>> 0), s / 4294967296)
}
const r = rand(20261026)

const stars = Array.from({ length: 340 }, () => {
  const x = (r() * W).toFixed(1)
  const y = (r() * H).toFixed(1)
  const rad = (r() * 1.5 + 0.25).toFixed(2)
  const op = (r() * 0.72 + 0.12).toFixed(2)
  return `<circle cx="${x}" cy="${y}" r="${rad}" fill="${C.star}" opacity="${op}"/>`
}).join('')

// --- the geometric field ----------------------------------------------------
// Concentric regular polygons, radial spokes and the vertex nodes between them,
// drawn BEHIND the globe so the sphere occludes the middle and only the outer
// rings read as a halo around it.
//
// The polygons are Platonic-style regular n-gons at incommensurable rotations
// (0, 15, 7.5 degrees) so their vertices never line up, which is what keeps the
// pattern from reading as a single flat grid. Deliberately not a flower-of-life
// or a Metatron construction: the app carries 16 traditions, and both of those
// belong to one each.
// The globe is centred over South America so the middle of the sphere is land
// rather than open ocean. Its centre is the anchor for the atmosphere.
const G = { cx: 512, cy: 250 }
const EARTH = { cx: 512, cy: 258, r: 146 }
const geo = []

function ring(sides, radius, rotDeg, width, opacity, nodes) {
  const rot = (rotDeg * Math.PI) / 180
  const coords = []
  const pts = []
  for (let i = 0; i < sides; i++) {
    const a = rot + (i * 2 * Math.PI) / sides
    const x = G.cx + Math.cos(a) * radius
    const y = G.cy + Math.sin(a) * radius
    // Keep the numeric pair alongside the SVG points string. Destructuring the
    // string would yield its characters, not two numbers - which silently
    // scatters the nodes across single digits near the origin.
    coords.push([x, y])
    pts.push(`${x.toFixed(2)} ${y.toFixed(2)}`)
  }
  geo.push(
    `<polygon points="${pts.join(' ')}" fill="none" stroke="url(#geoFade)" stroke-width="${width}" stroke-opacity="${opacity}"/>`
  )
  if (nodes) {
    for (const [x, y] of coords) {
      geo.push(`<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="2.1" fill="${C.coastHot}" opacity="${(opacity * 0.85).toFixed(3)}"/>`)
      geo.push(
        `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="5.5" fill="${C.auraSoft}" opacity="${(opacity * 0.18).toFixed(3)}"/>`
      )
    }
  }
}

function spokes(count, radius, rotDeg, opacity) {
  const rot = (rotDeg * Math.PI) / 180
  for (let i = 0; i < count; i++) {
    const a = rot + (i * 2 * Math.PI) / count
    geo.push(
      `<line x1="${(G.cx + Math.cos(a) * radius * 0.52).toFixed(2)}" y1="${(G.cy + Math.sin(a) * radius * 0.52).toFixed(2)}" ` +
        `x2="${(G.cx + Math.cos(a) * radius).toFixed(2)}" y2="${(G.cy + Math.sin(a) * radius).toFixed(2)}" ` +
        `stroke="url(#geoFade)" stroke-width="0.9" stroke-opacity="${opacity}"/>`
    )
  }
}

// 7 rings: a triangle, two hexagons, two dodecagons and two near-circles. The
// radii step outward so the density stays even rather than bunching at the core,
// which the globe hides anyway. The outermost ring stops short of the frame so
// no vertex is clipped by the edge.
ring(3, 186, 0, 1.1, 0.5, false)
ring(6, 164, 15, 1.1, 0.46, false)
ring(12, 144, 7.5, 1, 0.42, false)
spokes(24, 214, 7.5, 0.3)
ring(6, 202, 7.5, 1.2, 0.4, true)
ring(12, 224, 0, 1, 0.34, true)
ring(5, 240, 18, 1.1, 0.28, true)

const geometry = `
  <g>
    <circle cx="${G.cx}" cy="${G.cy}" r="250" fill="url(#geoGlow)"/>
    ${geo.join('\n    ')}
  </g>`

// --- the wordmark -----------------------------------------------------------
// Cool light blue rather than warm metal: it now belongs to the globe instead of
// competing with it, and the thin geometric forms want a quiet letterform. The
// top stops stay off pure white - a near-white cap on a thin serif reads as
// white type no matter how blue the rest of the ramp is.
const T = {
  hi: '#eaf6ff',
  lit: '#cfe9ff',
  mid: '#a9d8f7',
  deep: '#7fbde6',
  edge: '#5c9ccc',
  bounce: '#ddf1ff'
}

const TITLE_X = 512
const TITLE_Y = 92
const TITLE_SIZE = 76
const TITLE_FONT = "Garamond, 'Palatino Linotype', Georgia, serif"
const TITLE_ATTRS =
  `font-family="${TITLE_FONT}" font-size="${TITLE_SIZE}" ` +
  `letter-spacing="9" text-anchor="middle"`
const at = (dx = 0, dy = 0, extra = '') =>
  `<text ${TITLE_ATTRS} x="${(TITLE_X + dx).toFixed(2)}" y="${(TITLE_Y + dy).toFixed(2)}" ${extra}>${TITLE}</text>`

const wordmark = `
  <defs>
    <!-- The glyph shape as a mask, so the emboss highlight and shadow land on
         the letterforms instead of smearing either side of them. -->
    <mask id="tGlyphs" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}">
      <rect width="${W}" height="${H}" fill="#000"/>
      <text ${TITLE_ATTRS} x="${TITLE_X}" y="${TITLE_Y}" fill="#fff">${TITLE}</text>
    </mask>
  </defs>

  <g>
    <!-- the light around the wordmark: wide wash, then tight bright core -->
    ${at(0, 0, `fill="#4aa8ff" opacity="0.5" filter="url(#tGlowWide)"`)}
    ${at(0, 0, `fill="#9fdcff" opacity="0.62" filter="url(#tGlowTight)"`)}
    <!-- the soft shadow that lifts the letters off the starfield -->
    ${at(1.6, 2.6, 'fill="#01030a" opacity="0.62" filter="url(#tSoft)"')}
    <!-- a second, tighter shadow right under the baseline for contact -->
    ${at(0, 1.1, 'fill="#020611" opacity="0.4"')}
    <!-- the face -->
    ${at(0, 0, 'fill="url(#tFace)"')}
    <!-- emboss, clipped to the glyphs -->
    <g mask="url(#tGlyphs)">
      ${at(0, 1.9, 'fill="#123a55" opacity="0.34"')}
      ${at(0, -1.9, 'fill="#ffffff" opacity="0.4"')}
    </g>
    <!-- the faint outline: dark enough to hold against the brightest stars,
         light enough that it never reads as a stroke -->
    ${at(0, 0, 'fill="none" stroke="#0a2038" stroke-opacity="0.38" stroke-width="0.8"')}
    ${at(0, -0.7, 'fill="none" stroke="#eaf6ff" stroke-opacity="0.2" stroke-width="0.5"')}
  </g>`

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W * SS}" height="${H * SS}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="space" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${C.space}"/>
      <stop offset="62%" stop-color="${C.space2}"/>
      <stop offset="100%" stop-color="#0b1c40"/>
    </linearGradient>
    <radialGradient id="nebA" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${C.nebula}" stop-opacity="0.7"/>
      <stop offset="100%" stop-color="${C.nebula}" stop-opacity="0"/>
    </radialGradient>

    <!-- The atmosphere around the Earth.
         Three layers rather than one, because a single wide falloff either
         hugs the limb as a hard rim or floods the frame - there is no radius
         that reads as both "around the planet" and "in the air".
           rim    - a thin bright limb right at the edge of the sphere
           bloom  - the main glow, white into light blue
           air    - a very wide, very weak wash that lifts the lattice out of
                    the background without fogging it -->
    <radialGradient id="rimGlow" gradientUnits="userSpaceOnUse" cx="${EARTH.cx}" cy="${EARTH.cy}" r="${EARTH.r + 34}">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0"/>
      <stop offset="55%" stop-color="#ffffff" stop-opacity="0.5"/>
      <stop offset="74%" stop-color="#dff4ff" stop-opacity="0.62"/>
      <stop offset="88%" stop-color="#8fd0ff" stop-opacity="0.26"/>
      <stop offset="100%" stop-color="#4aa4ff" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="bloomGlow" gradientUnits="userSpaceOnUse" cx="${EARTH.cx}" cy="${EARTH.cy}" r="${EARTH.r + 86}">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.34"/>
      <stop offset="30%" stop-color="#eaf8ff" stop-opacity="0.3"/>
      <stop offset="58%" stop-color="#9fd8ff" stop-opacity="0.19"/>
      <stop offset="82%" stop-color="#5aa8f5" stop-opacity="0.07"/>
      <stop offset="100%" stop-color="#3a86e0" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="airGlow" gradientUnits="userSpaceOnUse" cx="${EARTH.cx}" cy="${EARTH.cy}" r="${EARTH.r + 190}">
      <stop offset="0%" stop-color="#bfe4ff" stop-opacity="0.13"/>
      <stop offset="40%" stop-color="#8cc8ff" stop-opacity="0.07"/>
      <stop offset="72%" stop-color="#5f9de8" stop-opacity="0.028"/>
      <stop offset="100%" stop-color="#4a7fd0" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="geoGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${C.aura}" stop-opacity="0.2"/>
      <stop offset="52%" stop-color="${C.nebula}" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="${C.nebula}" stop-opacity="0"/>
    </radialGradient>

    <!-- Strokes fade toward the frame so the lattice dissolves into space
         instead of stopping at a hard edge. Must be userSpaceOnUse: with the
         default objectBoundingBox units a near-horizontal spoke has a
         zero-height box, the gradient degenerates, and librsvg paints a stray
         blob at the origin. -->
    <radialGradient id="geoFade" gradientUnits="userSpaceOnUse" cx="${G.cx}" cy="${G.cy}" r="268">
      <stop offset="0%" stop-color="${C.coastHot}" stop-opacity="0.15"/>
      <stop offset="55%" stop-color="${C.coast}" stop-opacity="0.85"/>
      <stop offset="82%" stop-color="${C.coast}" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="${C.aura}" stop-opacity="0.05"/>
    </radialGradient>

    <linearGradient id="tFace" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${T.hi}"/>
      <stop offset="20%" stop-color="${T.bounce}"/>
      <stop offset="38%" stop-color="${T.lit}"/>
      <stop offset="62%" stop-color="${T.mid}"/>
      <stop offset="84%" stop-color="${T.deep}"/>
      <stop offset="100%" stop-color="${T.edge}"/>
    </linearGradient>

    <filter id="softer" x="-80%" y="-80%" width="260%" height="260%">
      <feGaussianBlur stdDeviation="24"/>
    </filter>
    <filter id="tSoft" x="-20%" y="-40%" width="150%" height="200%">
      <feGaussianBlur stdDeviation="3.2"/>
    </filter>
    <!-- Two glows: a wide soft wash that lifts the wordmark off the starfield,
         and a tighter brighter one that reads as light bending around the
         letterforms. One blur alone reads either as haze or as a hard outline. -->
    <filter id="tGlowWide" x="-45%" y="-90%" width="200%" height="290%">
      <feGaussianBlur stdDeviation="16"/>
    </filter>
    <filter id="tGlowTight" x="-30%" y="-70%" width="170%" height="250%">
      <feGaussianBlur stdDeviation="5"/>
    </filter>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#space)"/>
  <ellipse cx="190" cy="110" rx="430" ry="250" fill="url(#nebA)" opacity="0.5"/>
  <ellipse cx="880" cy="70" rx="360" ry="210" fill="url(#nebA)" opacity="0.38"/>
  ${stars}

  <!-- the geometric field, behind the sphere so only its outer rings show -->
  ${geometry}

  <!-- the atmosphere, then the Earth inside it -->
  <circle cx="${EARTH.cx}" cy="${EARTH.cy}" r="${EARTH.r + 190}" fill="url(#airGlow)"/>
  <circle cx="${EARTH.cx}" cy="${EARTH.cy}" r="${EARTH.r + 86}" fill="url(#bloomGlow)" filter="url(#softer)"/>
  <image href="${globe}" x="366" y="112" width="292" height="292"/>
  <circle cx="${EARTH.cx}" cy="${EARTH.cy}" r="${EARTH.r + 34}" fill="url(#rimGlow)" filter="url(#softer)"/>

  <!-- the app icon's own glowing hands, lifted out of its navy frame. A soft
       dark halo separates them from the lit globe so they read as being in
       front of the sphere rather than printed on it. -->
  <ellipse cx="512" cy="252" rx="126" ry="128" fill="#03081c" opacity="0.55" filter="url(#softer)"/>
  <image href="${handsArt}" x="380" y="132" width="264" height="264"/>

  ${wordmark}
</svg>`

fs.writeFileSync('dist-store/feature-graphic.svg', svg)

await sharp(Buffer.from(svg))
  .resize(W, H, { kernel: 'lanczos3' })
  .flatten({ background: C.space })
  .removeAlpha()
  .png({ compressionLevel: 9 })
  .toFile('dist-store/feature-graphic.png')

const m = await sharp('dist-store/feature-graphic.png').metadata()
console.log(
  `feature-graphic.png  ${m.width}x${m.height}  ${Math.round(fs.statSync('dist-store/feature-graphic.png').size / 1024)}KB  channels=${m.channels}`
)