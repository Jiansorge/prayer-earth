import sharp from 'sharp'
const src = 'public/icons/icon-prayer.webp'
for (const [size, out] of [[192,'public/icons/icon-192.png'],[512,'public/icons/icon-512.png'],[180,'public/icons/apple-touch-icon-180.png']]) {
  await sharp(src).resize(size,size, { fit:'cover', position:'center' }).png({ compressionLevel:9 }).toFile(out)
  console.log(`wrote ${out} ${size}x${size}`)
}
// also generate icon.svg placeholder? keep existing svg but ensure it references new icon? For now keep svg as is.
console.log('done')
