// The open book for the Play feature graphic.
//
// Drawn as a physical object rather than two flat page shapes: a leather cover
// behind the pages, individually rendered sheet edges at the fore edge, curved
// type that follows the page's tilt, a crease, and a short silk marker.
//
// Rendered once at SS x oversampling; the caller downsamples. Fine sheet edges
// alias badly at 1:1 but resolve cleanly with supersampling.
//
// Geometry is authored with the spine at x=0 and the group translated, so
// mirroring the left half onto the right is a bare scale(-1,1).

import sharp from 'sharp'
import fs from 'node:fs'

const SS = 3
const BW = 480
const BH = 260
const CX = BW / 2
const CY = 150

const FW = 205 // pages reach this far from the spine
const GUT_T = -52 // crease, top
const GUT_B = 46 // crease, bottom
const FORE_T = -74 // fore edge, top
const FORE_B = 20 // fore edge, bottom
const RIM = 7 // how far the leather cover shows beyond the pages
const BAND = 22 // width of the visible sheet stack at the fore edge
const SHEETS = 7
const STACK = 62 // height of the stack band, as a share of the page depth

const blockPath =
  `M 0 ${GUT_T} C -72 -66 -148 -78 -${FW} ${FORE_T} ` +
  `L -${FW} ${FORE_B} C -148 16 -72 30 0 ${GUT_B} ` +
  `L ${FW} ${FORE_B} L ${FW} ${FORE_T} C 148 -78 72 -66 0 ${GUT_T} Z`

const half = (inner) => `<g transform="scale(-1 1)">${inner}</g>`

// --- page surface -----------------------------------------------------------
// x is explicit: a mirrored gradient is not enough on its own, because a rect
// drawn at the same x as its gradient paints the wrong falloff onto the page.
const pageFill = (g, x) =>
  `<rect x="${x}" y="${FORE_T - 12}" width="${FW}" height="130" fill="url(#${g})"/>`

// The globe is lit from the upper left, so the book's left page takes the key
// light and the right page falls away. Without this the book reads as a printed
// shape rather than an object sitting in the scene.
const sideShade = `
  <rect x="0" y="${FORE_T - 12}" width="${FW}" height="130" fill="#101f42" opacity="0.14"/>`

// --- the sheet stack --------------------------------------------------------
// A real fore edge is the cut edge of every sheet, each a hair different from
// its neighbour. Opaque bands clipped to the block, not a gradient: a gradient
// reads as one smooth surface and this has to read as a stack. The band only
// covers the outer part of the page - past it the top sheet turns under and the
// page surface takes over - which is what keeps it from reading as a panel.
function sheetEdges() {
  const top = FORE_T
  const depth = FORE_B - FORE_T
  const step = (depth * STACK) / 100 / SHEETS
  let out = `<g clip-path="url(#bkBlock)">`
  for (let i = 0; i < SHEETS; i++) {
    const y = top + i * step
    const t = i / (SHEETS - 1)
    const hi = 198 - Math.round(30 * Math.abs(0.4 - t) * 2) + (((i * 41) % 9) - 4)
    const lo = hi - 34
    out += `<rect x="${-FW - 1}" y="${y.toFixed(2)}" width="${BAND + 2}" height="${(step * 0.56).toFixed(2)}" fill="rgb(${hi},${hi - 9},${hi - 32})"/>`
    out += `<rect x="${-FW - 1}" y="${(y + step * 0.56).toFixed(2)}" width="${BAND + 2}" height="${(step * 0.44).toFixed(2)}" fill="rgb(${lo},${lo - 11},${lo - 34})"/>`
  }
  // Gold-painted edges: the top of the stack catches the light, and the warmth
  // fades out down the stack.
  out += `<rect x="${-FW - 1}" y="${FORE_T}" width="${BAND + 2}" height="26" fill="url(#bkGilt)"/>`
  out += `</g>`
  return out
}

// --- type -------------------------------------------------------------------
// Lines follow the page: they rise toward the fore edge and shorten toward the
// crease, the way type sits on a curved surface. Ragged right ends and a heavier
// first line read as prose rather than as a ruled grid.
function textLines() {
  let out = `<g clip-path="url(#bkBlock)">`
  for (let i = 0; i < 5; i++) {
    const y = -26 + i * 14
    const xIn = 36 + ((i * 29) % 5) * 2
    const xOut = FW - 34 - ((i * 37) % 6) * 3
    const rise = (xOut - xIn) / FW
    const d =
      `M ${-xIn} ${y.toFixed(1)} ` +
      `Q ${-((xIn + xOut) / 2)} ${(y - 3.6 * rise).toFixed(1)} ${-xOut} ${(y - 9.5 * rise).toFixed(1)}`
    out += `<path d="${d}" stroke="#1b2a3a" stroke-opacity="${(i === 0 ? 0.5 : 0.31).toFixed(2)}" stroke-width="${i === 0 ? 1.6 : 1.25}" fill="none" stroke-linecap="round"/>`
  }
  out += `</g>`
  return out
}

// A short silk marker, forked at the end. The fork is what reads as ribbon.
const ribbon = `
  <g>
    <path d="M -10 ${GUT_B - 12} C -13 ${GUT_B + 4} -12 ${GUT_B + 18} -9 ${GUT_B + 30}
             L -9 ${GUT_B + 41} L -3 ${GUT_B + 35} L 3 ${GUT_B + 42} L 3 ${GUT_B + 29}
             C 0 ${GUT_B + 17} -2 ${GUT_B + 4} 0 ${GUT_B - 12} Z"
          fill="url(#bkRibbon)"/>
    <path d="M -7 ${GUT_B - 8} C -10 ${GUT_B + 4} -9 ${GUT_B + 18} -6 ${GUT_B + 30}"
          stroke="#ffd7a4" stroke-opacity="0.4" stroke-width="1.3" fill="none"/>
  </g>`

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${BW * SS}" height="${BH * SS}" viewBox="0 0 ${BW} ${BH}">
  <defs>
    <!-- Page surface. Lit along the head edge, falling into the crease. These are
         userSpaceOnUse so the mirrored page picks up the reversed falloff for
         free inside a scale(-1,1) group. -->
    <linearGradient id="bkPageL" gradientUnits="userSpaceOnUse" x1="${-FW}" y1="0" x2="0" y2="0">
      <stop offset="0%" stop-color="#fdfaf1"/>
      <stop offset="24%" stop-color="#f6f0df"/>
      <stop offset="62%" stop-color="#ded2b6"/>
      <stop offset="100%" stop-color="#9d8d71"/>
    </linearGradient>
    <linearGradient id="bkPageR" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${FW}" y2="0">
      <stop offset="0%" stop-color="#9d8d71"/>
      <stop offset="38%" stop-color="#ded2b6"/>
      <stop offset="76%" stop-color="#f6f0df"/>
      <stop offset="100%" stop-color="#fdfaf1"/>
    </linearGradient>

    <!-- Navy leather, matching the icon's ground so the book belongs to the
         same scene as the globe. Kept light: the grain filter multiplies, so a
         dark base crushes to black and the rim reads as a picture frame. -->
    <linearGradient id="bkLeatherL" gradientUnits="userSpaceOnUse" x1="${-FW - RIM}" y1="0" x2="${RIM}" y2="0">
      <stop offset="0%" stop-color="#46598a"/>
      <stop offset="46%" stop-color="#2b3a63"/>
      <stop offset="100%" stop-color="#1a2440"/>
    </linearGradient>
    <linearGradient id="bkLeatherR" gradientUnits="userSpaceOnUse" x1="${-RIM}" y1="0" x2="${FW + RIM}" y2="0">
      <stop offset="0%" stop-color="#1a2440"/>
      <stop offset="54%" stop-color="#2b3a63"/>
      <stop offset="100%" stop-color="#46598a"/>
    </linearGradient>

    <linearGradient id="bkGilt" gradientUnits="userSpaceOnUse" x1="${-FW}" y1="${FORE_T}" x2="${-FW}" y2="${FORE_T + 30}">
      <stop offset="0%" stop-color="#ffe9b4" stop-opacity="0.9"/>
      <stop offset="55%" stop-color="#d9a94e" stop-opacity="0.32"/>
      <stop offset="100%" stop-color="#d9a94e" stop-opacity="0"/>
    </linearGradient>

    <!-- Where the topmost sheet turns under, the stack fades into the page. -->
    <linearGradient id="bkStackFade" gradientUnits="userSpaceOnUse" x1="${-FW + BAND}" y1="0" x2="${-FW + BAND + 26}" y2="0">
      <stop offset="0%" stop-color="#e8dcc0" stop-opacity="0.85"/>
      <stop offset="100%" stop-color="#efe6d0" stop-opacity="0"/>
    </linearGradient>

    <!-- Raking light across the page: a bright band just inboard of the fore
         edge, where the surface tilts toward the key light. Without it the page
         is evenly lit and reads as paper-coloured vector fill. -->
    <linearGradient id="bkRakeL" gradientUnits="userSpaceOnUse" x1="${-FW}" y1="0" x2="${-FW + 96}" y2="0">
      <stop offset="0%" stop-color="#fffdf4" stop-opacity="0.5"/>
      <stop offset="45%" stop-color="#fffdf4" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="#fffdf4" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="bkRakeR" gradientUnits="userSpaceOnUse" x1="${FW}" y1="0" x2="${FW - 96}" y2="0">
      <stop offset="0%" stop-color="#fffdf4" stop-opacity="0.26"/>
      <stop offset="100%" stop-color="#fffdf4" stop-opacity="0"/>
    </linearGradient>

    <!-- Ambient occlusion where the pages sit down into the leather rim. -->
    <linearGradient id="bkAoL" gradientUnits="userSpaceOnUse" x1="${-FW}" y1="0" x2="${-FW + 20}" y2="0">
      <stop offset="0%" stop-color="#2a2013" stop-opacity="0.42"/>
      <stop offset="100%" stop-color="#2a2013" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="bkAoR" gradientUnits="userSpaceOnUse" x1="${FW}" y1="0" x2="${FW - 20}" y2="0">
      <stop offset="0%" stop-color="#2a2013" stop-opacity="0.42"/>
      <stop offset="100%" stop-color="#2a2013" stop-opacity="0"/>
    </linearGradient>

    <linearGradient id="bkGold" gradientUnits="userSpaceOnUse" x1="${-FW - RIM}" y1="${FORE_T - RIM}" x2="${FW + RIM}" y2="${FORE_B + RIM}">
      <stop offset="0%" stop-color="#fff3cf"/>
      <stop offset="30%" stop-color="#e8bf72"/>
      <stop offset="55%" stop-color="#9d7328"/>
      <stop offset="80%" stop-color="#f4d896"/>
      <stop offset="100%" stop-color="#c9a05a"/>
    </linearGradient>

    <linearGradient id="bkRibbon" gradientUnits="userSpaceOnUse" x1="-13" y1="0" x2="4" y2="0">
      <stop offset="0%" stop-color="#5c101c"/>
      <stop offset="36%" stop-color="#a82c39"/>
      <stop offset="70%" stop-color="#7d1b27"/>
      <stop offset="100%" stop-color="#400911"/>
    </linearGradient>

    <!-- The crease: near-black at the fold, opening out fast. -->
    <linearGradient id="bkCrease" gradientUnits="userSpaceOnUse" x1="-22" y1="0" x2="22" y2="0">
      <stop offset="0%" stop-color="#3b3020" stop-opacity="0"/>
      <stop offset="32%" stop-color="#241c12" stop-opacity="0.5"/>
      <stop offset="50%" stop-color="#0e0a06" stop-opacity="0.82"/>
      <stop offset="68%" stop-color="#241c12" stop-opacity="0.5"/>
      <stop offset="100%" stop-color="#3b3020" stop-opacity="0"/>
    </linearGradient>

    <!-- Pebbled leather: a bump map lit from the upper left, matching the
         globe's key light. surfaceScale is low and the blend is multiply -
         overlay with a bright lit layer turns navy leather into orange sponge. -->
    <filter id="bkGrain" x="-6%" y="-6%" width="112%" height="112%">
      <feTurbulence type="fractalNoise" baseFrequency="0.22 0.28" numOctaves="4" seed="4" result="h"/>
      <feDiffuseLighting in="h" surfaceScale="1.5" diffuseConstant="1.15" lighting-color="#c3cee8" result="d">
        <feDistantLight azimuth="228" elevation="64"/>
      </feDiffuseLighting>
      <feComposite in="d" in2="SourceGraphic" operator="in" result="dIn"/>
      <feBlend in="SourceGraphic" in2="dIn" mode="multiply"/>
    </filter>

    <!-- Paper fibre: very low contrast, so it reads as tooth rather than noise. -->
    <filter id="bkFibre" x="-5%" y="-5%" width="110%" height="110%">
      <feTurbulence type="fractalNoise" baseFrequency="1.2" numOctaves="2" seed="9" result="n"/>
      <feColorMatrix in="n" type="matrix"
        values="0 0 0 0 0.4  0 0 0 0 0.34  0 0 0 0 0.24  0 0 0 0.12 0"/>
    </filter>

    <clipPath id="bkBlock"><path d="${blockPath}"/></clipPath>
  </defs>

  <g transform="translate(${CX} ${CY})">
    <!-- Leather cover: the page silhouette stroked in leather, which produces a
         even rim that follows the page exactly. An independently drawn cover
         path bulges away from the pages and reads as a dark bow tie. -->
    <path d="${blockPath}" fill="url(#bkLeatherL)" stroke="url(#bkLeatherL)"
          stroke-width="${RIM * 2}" stroke-linejoin="round" filter="url(#bkGrain)"/>
    <path d="${blockPath}" fill="none" stroke="url(#bkLeatherR)" stroke-width="${RIM * 2}"
          stroke-linejoin="round" filter="url(#bkGrain)" opacity="0.9"/>
    <!-- gold tooling, sitting just inside the leather rim -->
    <path d="${blockPath}" fill="none" stroke="url(#bkGold)" stroke-width="1.3" opacity="0.85"/>

    <!-- page block -->
    <g clip-path="url(#bkBlock)">
      ${pageFill('bkPageL', -FW)}
      ${pageFill('bkPageR', 0)}
      ${sheetEdges()}
      ${half(sheetEdges())}
      <rect x="${-FW}" y="${FORE_T - 12}" width="${FW * 2}" height="130" filter="url(#bkFibre)"/>
      ${textLines()}
      ${half(textLines())}
      <!-- raking light: the near page takes the key, the far page only spill -->
      <rect x="${-FW}" y="${FORE_T - 12}" width="110" height="130" fill="url(#bkRakeL)"/>
      <rect x="${FW - 110}" y="${FORE_T - 12}" width="110" height="130" fill="url(#bkRakeR)"/>
      ${half(sideShade)}
      <!-- contact shadow into the leather rim -->
      <rect x="${-FW}" y="${FORE_T - 12}" width="20" height="130" fill="url(#bkAoL)"/>
      <rect x="${FW - 20}" y="${FORE_T - 12}" width="20" height="130" fill="url(#bkAoR)"/>
      <rect x="-22" y="${GUT_T - 14}" width="44" height="130" fill="url(#bkCrease)"/>
      <!-- head-edge sheen -->
      <path d="M 0 ${GUT_T} C -72 -66 -148 -78 -${FW} ${FORE_T}"
            stroke="#fffdf6" stroke-opacity="0.65" stroke-width="1.8" fill="none"/>
      <path d="M 0 ${GUT_T} C 72 -66 148 -78 ${FW} ${FORE_T}"
            stroke="#fffdf6" stroke-opacity="0.4" stroke-width="1.6" fill="none"/>
    </g>

    <!-- the page silhouette: a thin warm edge where paper meets leather, not a
         dark contour, which at this scale reads as a drawn outline. -->
    <path d="${blockPath}" fill="none" stroke="#e6d7b4" stroke-opacity="0.3" stroke-width="0.9"/>

    ${ribbon}
  </g>
</svg>`

fs.mkdirSync('dist-store', { recursive: true })
fs.writeFileSync('dist-store/book.svg', svg)
const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer()
fs.writeFileSync('dist-store/book.png', png)
fs.writeFileSync(
  'dist-store/book.json',
  JSON.stringify({ book: `data:image/png;base64,${png.toString('base64')}` })
)
console.log('book.png', `${BW * SS}x${BH * SS}`, Math.round(png.length / 1024) + 'KB')