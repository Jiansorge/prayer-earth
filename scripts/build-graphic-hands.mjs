// Lift the praying hands out of the app icon so they can sit over the globe.
//
// icon-512.png is the glowing hands on a navy square with no alpha channel, so
// it cannot simply be dropped in. The hands are the bright, saturated part of
// the frame and the background is near-black, so a luminance ramp keys them out
// cleanly - and the tiny stars in the icon's sky become loose sparkles, which
// read as magic rather than as debris.

import sharp from 'sharp'
import fs from 'node:fs'

const { data, info } = await sharp('public/icons/icon-512.png')
  .resize(512, 512, { fit: 'fill' })
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true })

const out = Buffer.alloc(512 * 512 * 4)

// The icon's background sits around RGB(5,11,15); the hands reach well past 120
// on all channels. Ramp between them.
const FLOOR = 46
const RANGE = 104

for (let i = 0; i < 512 * 512; i++) {
  const r = data[i * 4]
  const g = data[i * 4 + 1]
  const b = data[i * 4 + 2]
  const strength = (r + g + b) / 3
  let a = (strength - FLOOR) / RANGE
  a = a < 0 ? 0 : a > 1 ? 1 : a
  // Ease so the glow's soft edge survives but the solid core stays opaque.
  a = Math.pow(a, 0.85)
  // Colours pass through untouched - reordering channels turned the icon's
  // blue hands magenta, so the alpha ramp is the only thing applied here.
  out[i * 4] = r
  out[i * 4 + 1] = g
  out[i * 4 + 2] = b
  out[i * 4 + 3] = Math.round(a * 255)
}

// Drop the lower wrist so the hands read as rising out of the book rather than
// as a floating sticker.
for (let y = 400; y < 512; y++) {
  for (let x = 0; x < 512; x++) {
    const i = (y * 512 + x) * 4 + 3
    const t = (y - 400) / 112
    out[i] = Math.round(out[i] * (1 - t))
  }
}

const hands = await sharp(out, { raw: { width: 512, height: 512, channels: 4 } })
  .png({ compressionLevel: 9 })
  .toBuffer()

fs.writeFileSync('dist-store/hands.png', hands)
fs.writeFileSync(
  'dist-store/hands.json',
  JSON.stringify({ hands: `data:image/png;base64,${hands.toString('base64')}` })
)
console.log('hands.png', Math.round(hands.length / 1024) + 'KB')