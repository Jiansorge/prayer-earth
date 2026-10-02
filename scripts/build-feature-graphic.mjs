// Play feature graphic: 1024x500.
//
// Palette and composition follow the app rather than a generic prayer look: the
// deep navy of the main icon, the electric cyan coastlines of the Earth scene,
// and the same starfield. The globe is centred over South America so the middle
// of the sphere is land rather than open ocean.
//
// The globe is pre-rendered by build-graphic-globe.mjs, the book by
// build-graphic-book.mjs, and both are composited here. Everything is rasterised
// at SS x supersampling and downsampled at the end: fine sheet edges, hairline
// gold rules and 1px specular highlights all alias badly at 1:1.

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
  shade: '#01050e'
}

// Warm champagne metal for the wordmark. The ice-white of the first version was
// indistinguishable from a plain flat fill; a warm metal against the cool navy
// has somewhere to go. The values stay high: a darker "deep" tone turns the
// whole wordmark olive and muddy at this size.
const M = {
  hi: '#ffffff',
  bounce: '#fffaf0',
  lit: '#f9efd8',
  mid: '#e3cea4',
  deep: '#bda87c',
  edge: '#8e7c58'
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

// --- the wordmark -----------------------------------------------------------
// Drawn as a stack rather than one fill: a cool glow behind, a dark cast that
// gives it depth, the metal face, and a specular sweep across the upper third.
// A single <text> with a gradient can only ever be flat, because a gradient
// across the bounding box has no idea where the letterforms are.
const TITLE_X = 512
const TITLE_Y = 92
const TITLE_SIZE = 78
// Position is passed separately from the attributes: including x/y in the shared
// string and then overriding them produces a duplicate attribute, which is an
// XML parse error, not a warning.
const TITLE_FONT = "Garamond, 'Palatino Linotype', Georgia, serif"
const TITLE_ATTRS =
  `font-family="${TITLE_FONT}" font-size="${TITLE_SIZE}" ` +
  `letter-spacing="7" text-anchor="middle"`
const at = (dx = 0, dy = 0, extra = '') =>
  `<text ${TITLE_ATTRS} x="${(TITLE_X + dx).toFixed(2)}" y="${(TITLE_Y + dy).toFixed(2)}" ${extra}>${TITLE}</text>`

const wordmark = `
  <defs>
    <!-- The glyph shape as a mask. Embossing needs the highlight and shadow to
         be clipped to the letterforms; without that they just smear either side
         of the text and it still reads as a flat fill. -->
    <mask id="tGlyphs" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}">
      <rect width="${W}" height="${H}" fill="#000"/>
      <text ${TITLE_ATTRS} x="${TITLE_X}" y="${TITLE_Y}" fill="#fff">${TITLE}</text>
    </mask>

    <!-- Brushed striations, masked to the glyphs. Fine vertical banding is what
         separates cast metal from a flat gradient at this size. -->
    <linearGradient id="tBrush" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#fff" stop-opacity="0.16"/>
      <stop offset="18%" stop-color="#000" stop-opacity="0.1"/>
      <stop offset="34%" stop-color="#fff" stop-opacity="0.13"/>
      <stop offset="52%" stop-color="#000" stop-opacity="0.11"/>
      <stop offset="70%" stop-color="#fff" stop-opacity="0.14"/>
      <stop offset="86%" stop-color="#000" stop-opacity="0.09"/>
      <stop offset="100%" stop-color="#fff" stop-opacity="0.15"/>
    </linearGradient>
  </defs>

  <g>
    <!-- cool halo, so the letters sit in the same light as the globe -->
    ${at(0, 0, `fill="${C.auraSoft}" opacity="0.4" filter="url(#tGlow)"`)}
    <!-- cast shadow below and right: the letters stand off the background -->
    ${at(2.4, 3.2, 'fill="#01030a" opacity="0.8" filter="url(#tSoft)"')}
    <!-- the metal face -->
    ${at(0, 0, 'fill="url(#tMetal)"')}
    <!-- emboss: an inner shadow from a copy pushed down, and an inner highlight
         from a copy pushed up, both clipped to the glyphs -->
    <g mask="url(#tGlyphs)">
      ${at(0, 2.2, 'fill="#4a3d24" opacity="0.5"')}
      ${at(0, -2.2, 'fill="#fffdf2" opacity="0.72"')}
      <rect width="${W}" height="${H}" fill="url(#tBrush)"/>
    </g>
    <!-- specular sweep across the letterforms -->
    ${at(0, 0, 'fill="url(#tSpec)" opacity="0.8"')}
    <!-- a cool rim along the top edge, the light bouncing back off the globe -->
    ${at(-1, -1.2, 'fill="#bfe6ff" opacity="0.26"')}
    <!-- and a thin dark contour so the wordmark holds on the brightest stars -->
    ${at(0, 0, 'fill="none" stroke="#040a18" stroke-opacity="0.32" stroke-width="0.7"')}
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
    <radialGradient id="auraGrad" cx="50%" cy="72%" r="60%">
      <stop offset="0%" stop-color="${C.auraSoft}" stop-opacity="0.85"/>
      <stop offset="55%" stop-color="${C.aura}" stop-opacity="0.34"/>
      <stop offset="100%" stop-color="${C.aura}" stop-opacity="0"/>
    </radialGradient>

    <!-- Champagne metal, lit from above: bright cap, mid body, dark underside,
         then the bounce from whatever is below. -->
    <linearGradient id="tMetal" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${M.hi}"/>
      <stop offset="16%" stop-color="${M.bounce}"/>
      <stop offset="33%" stop-color="${M.lit}"/>
      <stop offset="52%" stop-color="${M.mid}"/>
      <stop offset="70%" stop-color="${M.deep}"/>
      <stop offset="84%" stop-color="${M.edge}"/>
      <stop offset="95%" stop-color="${M.mid}"/>
      <stop offset="100%" stop-color="${M.bounce}"/>
    </linearGradient>

    <!-- The specular sweep. Placed against the letterform box rather than the
         whole graphic, which is why it reads as metal catching a light rather
         than as a diagonal band laid over the image. -->
    <linearGradient id="tSpec" x1="0" y1="0" x2="0.35" y2="1">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.9"/>
      <stop offset="18%" stop-color="#ffffff" stop-opacity="0.42"/>
      <stop offset="34%" stop-color="#ffffff" stop-opacity="0"/>
      <stop offset="72%" stop-color="#ffe9bd" stop-opacity="0"/>
      <stop offset="88%" stop-color="#ffe9bd" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0.5"/>
    </linearGradient>

    <filter id="soft" x="-70%" y="-70%" width="240%" height="240%">
      <feGaussianBlur stdDeviation="10"/>
    </filter>
    <filter id="softer" x="-80%" y="-80%" width="260%" height="260%">
      <feGaussianBlur stdDeviation="24"/>
    </filter>
    <filter id="tSoft" x="-20%" y="-40%" width="150%" height="200%">
      <feGaussianBlur stdDeviation="3"/>
    </filter>
    <filter id="tGlow" x="-30%" y="-60%" width="170%" height="240%">
      <feGaussianBlur stdDeviation="9"/>
    </filter>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#space)"/>
  <ellipse cx="190" cy="110" rx="430" ry="250" fill="url(#nebA)" opacity="0.5"/>
  <ellipse cx="880" cy="70" rx="360" ry="210" fill="url(#nebA)" opacity="0.38"/>
  ${stars}

  <!-- aura cast by the book, behind the globe -->
  <circle cx="512" cy="256" r="300" fill="url(#auraGrad)" opacity="0.4" filter="url(#softer)"/>

  <image href="${globe}" x="366" y="112" width="292" height="292"/>

  <!-- the app icon's own glowing hands, lifted out of its navy frame. A soft
       dark halo separates them from the lit globe so they read as being in
       front of the sphere rather than printed on it. -->
  <ellipse cx="512" cy="252" rx="126" ry="128" fill="#03081c" opacity="0.55" filter="url(#softer)"/>
  <image href="${handsArt}" x="380" y="132" width="264" height="264"/>

  ${wordmark}
</svg>`

fs.writeFileSync('dist-store/feature-graphic.svg', svg)

// The book is drawn at 3x in its own file. Trim it to its alpha bounds first so
// placement is by the artwork rather than by the viewBox, then scale it so the
// hands still read as rising out of it rather than being buried.
const BOOK_W = 344
const bookRaw = await sharp('dist-store/book.png')
  .trim({ threshold: 1 })
  .resize(BOOK_W * SS, null, { fit: 'inside' })
  .png()
  .toBuffer()
const bookMeta = await sharp(bookRaw).metadata()
const bookLeft = Math.round((W * SS) / 2 - bookMeta.width / 2)
const bookTop = Math.round(H * SS - bookMeta.height - 14 * SS)
if (bookLeft < 0 || bookTop < 0 || bookLeft + bookMeta.width > W * SS || bookTop + bookMeta.height > H * SS) {
  throw new Error(
    `book does not fit: ${bookLeft},${bookTop} ${bookMeta.width}x${bookMeta.height} into ${W * SS}x${H * SS}`
  )
}

// Two passes, not one: sharp runs resize BEFORE composite, so compositing a
// supersampled book onto an already-downsampled base is rejected as oversized.
const composed = await sharp(Buffer.from(svg))
  .composite([{ input: bookRaw, left: bookLeft, top: bookTop }])
  .png()
  .toBuffer()

await sharp(composed)
  .resize(W, H, { kernel: 'lanczos3' })
  .flatten({ background: C.space })
  .removeAlpha()
  .png({ compressionLevel: 9 })
  .toFile('dist-store/feature-graphic.png')

const m = await sharp('dist-store/feature-graphic.png').metadata()
console.log(
  `feature-graphic.png  ${m.width}x${m.height}  ${Math.round(fs.statSync('dist-store/feature-graphic.png').size / 1024)}KB  channels=${m.channels}`
)