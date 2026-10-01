// Play feature graphic: 1024x500.
//
// Palette and composition follow the app rather than a generic prayer look: the
// deep navy of the main icon, the electric cyan coastlines of the Earth scene,
// and the same starfield. The globe is centred over South America so the middle
// of the sphere is land rather than open ocean.
//
// The globe itself is pre-rendered by build-graphic-globe.mjs with sharp,
// because compositing a sphere from equirectangular layers is far more
// predictable in one pass than layered inside a single SVG.

import sharp from 'sharp'
import fs from 'node:fs'

const { globe } = JSON.parse(fs.readFileSync('dist-store/globe.json', 'utf8'))
const { hands: handsArt } = JSON.parse(fs.readFileSync('dist-store/hands.json', 'utf8'))

const W = 1024
const H = 500

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
  ink: '#f2fbff',
  shade: '#01050e'
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

// --- open spell book -----------------------------------------------------
const book = `<g transform="translate(512 404)">
  <ellipse cx="0" cy="-50" rx="256" ry="140" fill="url(#auraGrad)" opacity="0.6"/>
  <path d="M 0 -4 C -64 -30 -140 -34 -210 -20 L -210 34 C -140 20 -64 20 0 38 Z" fill="url(#pageL)"/>
  <path d="M 0 -4 C 64 -30 140 -34 210 -20 L 210 34 C 140 20 64 20 0 38 Z" fill="url(#pageR)"/>
  <path d="M 0 -4 L 0 38" stroke="${C.aura}" stroke-opacity="0.55" stroke-width="1.8"/>
  <g stroke="${C.aura}" stroke-opacity="0.5" stroke-width="2.6" stroke-linecap="round">
    <path d="M -178 -8 L -44 2"/><path d="M -178 6 L -66 13"/><path d="M -156 19 L -44 24"/>
    <path d="M 178 -8 L 44 2"/><path d="M 178 6 L 66 13"/><path d="M 156 19 L 44 24"/>
  </g>
  <ellipse cx="0" cy="14" rx="16" ry="34" fill="${C.coastHot}" opacity="0.65"/>
  <g fill="${C.coastHot}">
    <circle cx="-16" cy="-22" r="3.2" opacity="0.95"/>
    <circle cx="8" cy="-36" r="2.3" opacity="0.85"/>
    <circle cx="26" cy="-18" r="1.9" opacity="0.75"/>
    <circle cx="-6" cy="-56" r="1.7" opacity="0.65"/>
    <circle cx="20" cy="-68" r="1.4" opacity="0.55"/>
    <circle cx="-26" cy="-44" r="1.2" opacity="0.5"/>
  </g>
</g>`

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
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
    <linearGradient id="handFill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#f4fdff" stop-opacity="0.97"/>
      <stop offset="42%" stop-color="${C.auraSoft}" stop-opacity="0.8"/>
      <stop offset="100%" stop-color="${C.aura}" stop-opacity="0.48"/>
    </linearGradient>
    <linearGradient id="pageL" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#f4fcff"/>
      <stop offset="100%" stop-color="#a9cbe9"/>
    </linearGradient>
    <linearGradient id="pageR" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#e9f7ff"/>
      <stop offset="100%" stop-color="#8db4da"/>
    </linearGradient>
    <linearGradient id="titleG" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="${C.coastHot}"/>
    </linearGradient>
    <filter id="soft" x="-70%" y="-70%" width="240%" height="240%">
      <feGaussianBlur stdDeviation="10"/>
    </filter>
    <filter id="softer" x="-80%" y="-80%" width="260%" height="260%">
      <feGaussianBlur stdDeviation="24"/>
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

  ${book}
  

  <g font-family="Garamond, 'Palatino Linotype', Georgia, serif" text-anchor="middle">
    <text x="512" y="90" font-size="80" letter-spacing="7" fill="url(#titleG)" filter="url(#soft)" opacity="0.8">Joining Palms</text>
    <text x="512" y="90" font-size="80" letter-spacing="7" fill="url(#titleG)">Joining Palms</text>
  </g>
</svg>`

fs.writeFileSync('dist-store/feature-graphic.svg', svg)
await sharp(Buffer.from(svg)).flatten({ background: C.space }).removeAlpha().png({ compressionLevel: 9 })
  .toFile('dist-store/feature-graphic.png')

const m = await sharp('dist-store/feature-graphic.png').metadata()
console.log(`feature-graphic.png  ${m.width}x${m.height}  ${Math.round(fs.statSync('dist-store/feature-graphic.png').size / 1024)}KB  channels=${m.channels}`)