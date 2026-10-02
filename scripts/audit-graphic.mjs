// Guards on the generated feature graphic.
//
// Everything here asserts a way the build can quietly go wrong and still exit
// 0: a degenerate coordinate that paints a stray blob, artwork that leaves the
// frame Play specifies, or a stray bright pixel in a corner that only shows up
// on the store listing.

import sharp from 'sharp'
import fs from 'node:fs'

const SVG = 'dist-store/feature-graphic.svg'
const PNG = 'dist-store/feature-graphic.png'
const W = 1024
const H = 500

let pass = 0
let fail = 0
const ok = (cond, label, detail = '') => {
  if (cond) {
    console.log('  ok   ' + label)
    pass++
  } else {
    console.log('  FAIL ' + label + (detail ? '  ' + detail : ''))
    fail++
  }
}

if (!fs.existsSync(PNG) || !fs.existsSync(SVG)) {
  console.log('FAIL run `npm run build:feature-graphic` first')
  process.exit(1)
}

const svg = fs.readFileSync(SVG, 'utf8')

// --- geometry ---------------------------------------------------------------
// A ring() that destructured its "x y" points string produced circles at
// cx="7" cy="1" - single characters - which drew a bright blob in the corner of
// the listing and looked like a starfield star. Bound every decorative circle to
// the region the lattice is actually allowed to occupy.
// The lattice nodes specifically - the starfield is also made of circles, and
// its dots are legitimately small and everywhere.
const nodes = svg.match(/<circle cx="[-\d.eE+]+" cy="[-\d.eE+]+" r="(?:2\.1|5\.5)"/g) || []
const xs = nodes.map((n) => +n.match(/cx="([-\d.eE+]+)"/)[1])
const ys = nodes.map((n) => +n.match(/cy="([-\d.eE+]+)"/)[1])
ok(nodes.length > 0, 'the lattice has vertex nodes', String(nodes.length))
ok(
  xs.every((x) => x > 200 && x < 824) && ys.every((y) => y > 0 && y < H),
  'every lattice node is inside the ring band',
  xs.length ? `x ${Math.min(...xs)}..${Math.max(...xs)}  y ${Math.min(...ys)}..${Math.max(...ys)}` : 'none'
)
ok(
  !nodes.some((n) => /cx="[0-9]\b/.test(n)),
  'no node has collapsed to a single digit',
  nodes.filter((n) => /cx="[0-9]\b/.test(n))[0] || ''
)

const polys = svg.match(/<polygon points="[^"]+"/g) || []
const polyNums = polys.flatMap((p) => p.match(/-?\d+(\.\d+)?/g).map(Number))
ok(
  polyNums.length > 0 && Math.min(...polyNums) >= -1 && Math.max(...polyNums) <= W + 1,
  'polygon vertices stay within the canvas',
  `${Math.min(...polyNums)}..${Math.max(...polyNums)}`
)

// --- output format ----------------------------------------------------------
const meta = await sharp(PNG).metadata()
ok(meta.width === W && meta.height === H, 'is 1024x500', `${meta.width}x${meta.height}`)
ok(meta.channels === 3 && !meta.hasAlpha, 'is a 24-bit PNG with no alpha', `channels=${meta.channels}`)

const bytes = fs.statSync(PNG).size
ok(bytes > 20000 && bytes < 1_000_000, 'file size is sane for upload', Math.round(bytes / 1024) + 'KB')

// --- stray bright artefacts ------------------------------------------------
// The bug this guards against was a soft blob about 15x10 in the top-left,
// left behind by lattice nodes that had collapsed to single digits. Brightness
// alone cannot catch it: a single star legitimately reaches a higher peak than
// the blob's dimmest pixels. What distinguishes them is AREA - a blob covers
// tens of pixels, a star covers a handful. So count bright pixels, not the max.
const { data, info } = await sharp(PNG).raw().toBuffer({ resolveWithObject: true })
const BRIGHT = 500
const MAX_BRIGHT_PX = 24
const corners = {
  'top-left': [0, 70, 0, 50],
  'top-right': [W - 70, W, 0, 50],
  'bottom-left': [0, 70, H - 50, H],
  'bottom-right': [W - 70, W, H - 50, H]
}
for (const [name, [x0, x1, y0, y1]] of Object.entries(corners)) {
  let count = 0
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * info.width + x) * info.channels
      if (data[i] + data[i + 1] + data[i + 2] > BRIGHT) count++
    }
  }
  ok(
    count <= MAX_BRIGHT_PX,
    `no bright cluster in the ${name} corner`,
    `${count} px above ${BRIGHT} (limit ${MAX_BRIGHT_PX})`
  )
}

console.log(`\n${pass} checks passed, ${fail} failed`)
process.exit(fail ? 1 : 0)