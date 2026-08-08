import React, { useRef } from 'react'
import { useBackdropCanvas } from './useBackdropCanvas.js'

// A quiet, non-denominational ancient temple: warm stone columns under a
// classical pediment, a glowing central doorway, moonlight and stars, candles
// flickering, incense smoke drifting, and dust motes in the light.

function mulberry(seed) {
  let s = seed
  return () => {
    s |= 0
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rnd = mulberry(71)
const columns = Array.from({ length: 7 }, (_, i) => ({
  x: 0.14 + i * 0.12 + rnd() * 0.015,
  w: 0.032 + rnd() * 0.006,
  h: 0.34 + rnd() * 0.06
}))
const candles = Array.from({ length: 7 }, (_, i) => ({
  x: 0.1 + i * 0.13 + rnd() * 0.03,
  r: 0.006 + rnd() * 0.004,
  ph: rnd() * Math.PI * 2
}))
const smoke = Array.from({ length: 6 }, () => ({
  x: 0.5 + (rnd() - 0.5) * 0.5,
  r: 0.01 + rnd() * 0.01,
  vy: 0.01 + rnd() * 0.02,
  sway: 0.6 + rnd() * 0.8,
  ph: rnd() * Math.PI * 2
}))
const motes = Array.from({ length: 26 }, () => ({
  x: rnd(),
  y: rnd(),
  r: 0.4 + rnd() * 1.1,
  vy: 0.004 + rnd() * 0.01,
  ph: rnd() * Math.PI * 2
}))
const stars = Array.from({ length: 34 }, () => ({
  x: rnd(),
  y: rnd() * 0.55,
  r: 0.4 + rnd() * 0.9,
  ph: rnd() * Math.PI * 2
}))

function drawTemple(ctx, dpr, t, reduced) {
  const w = window.innerWidth
  const h = window.innerHeight
  const canvas = ctx.canvas
  canvas.width = Math.round(w * dpr)
  canvas.height = Math.round(h * dpr)
  canvas.style.width = w + 'px'
  canvas.style.height = h + 'px'
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, w, h)

  // night sky, deep indigo to warm earth
  const sky = ctx.createLinearGradient(0, 0, 0, h)
  sky.addColorStop(0, '#0b1020')
  sky.addColorStop(0.55, '#1c1830')
  sky.addColorStop(0.8, '#3a2410')
  sky.addColorStop(1, '#4a2c12')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, h)

  // stars, gently twinkling
  for (const st of stars) {
    const a = reduced ? 0.25 : 0.2 + 0.25 * (0.5 + 0.5 * Math.sin(t * 0.9 + st.ph))
    ctx.fillStyle = `rgba(220,225,255,${a})`
    ctx.beginPath()
    ctx.arc(st.x * w, st.y * h, st.r, 0, Math.PI * 2)
    ctx.fill()
  }

  // a soft moon with a pale halo
  const mx = w * 0.28
  const my = h * 0.26
  const moonHalo = ctx.createRadialGradient(mx, my, 0, mx, my, w * 0.16)
  moonHalo.addColorStop(0, 'rgba(240,230,200,0.22)')
  moonHalo.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = moonHalo
  ctx.fillRect(mx - w * 0.16, my - w * 0.16, w * 0.32, w * 0.32)
  ctx.fillStyle = 'rgba(244,236,210,0.9)'
  ctx.beginPath()
  ctx.arc(mx, my, w * 0.028, 0, Math.PI * 2)
  ctx.fill()

  ctx.globalCompositeOperation = 'screen'
  const halo = ctx.createRadialGradient(w * 0.5, h * 0.62, 0, w * 0.5, h * 0.62, w * 0.42)
  const flicker = reduced ? 0.5 : 0.5 + 0.06 * Math.sin(t * 1.8)
  halo.addColorStop(0, `rgba(255,190,110,${0.2 * flicker})`)
  halo.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = halo
  ctx.fillRect(0, 0, w, h)

  for (const s of smoke) {
    ctx.beginPath()
    const baseX = s.x * w
    const r = s.r * Math.min(w, h)
    for (let yy = 0; yy <= 1; yy += 0.05) {
      const y = (1 - yy) * h
      const x = baseX + Math.sin(yy * 4 + t * 0.5 * s.sway + s.ph) * r * 2
      if (yy === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.strokeStyle = reduced
      ? 'rgba(220,205,180,0.06)'
      : `rgba(225,210,180,${0.05 + 0.04 * (0.5 + 0.5 * Math.sin(t + s.ph))})`
    ctx.lineWidth = 2
    ctx.stroke()
  }
  ctx.globalCompositeOperation = 'source-over'

  // the temple: warm stone, columns, a classical pediment, and a glowing doorway
  const baseY = h * 0.86
  const colW = columns[0].w * w
  const colTop = baseY - columns[0].h * h * 1.2
  const templeLeft = (columns[0].x - 0.03) * w
  const templeRight = (columns[columns.length - 1].x + 0.05) * w

  // warm light spilling from inside the doorway
  const doorX = w * 0.5
  const doorR = w * 0.075
  const doorGlow = ctx.createRadialGradient(doorX, baseY - doorR * 0.6, 0, doorX, baseY - doorR * 0.6, doorR * 4)
  doorGlow.addColorStop(0, `rgba(255,196,120,${reduced ? 0.2 : 0.3})`)
  doorGlow.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = doorGlow
  ctx.fillRect(doorX - doorR * 4, baseY - doorR * 5, doorR * 8, doorR * 9)

  // the pediment (triangular roof) over the columns
  ctx.fillStyle = 'rgba(24,15,8,0.98)'
  ctx.beginPath()
  ctx.moveTo(templeLeft - w * 0.02, colTop)
  ctx.lineTo(w * 0.5, colTop - h * 0.075)
  ctx.lineTo(templeRight + w * 0.02, colTop)
  ctx.closePath()
  ctx.fill()
  // a thin roofline highlight catching the moonlight
  ctx.strokeStyle = 'rgba(230,200,150,0.35)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(templeLeft - w * 0.02, colTop)
  ctx.lineTo(w * 0.5, colTop - h * 0.075)
  ctx.lineTo(templeRight + w * 0.02, colTop)
  ctx.stroke()

  // frieze band under the pediment
  ctx.fillStyle = 'rgba(20,13,7,0.98)'
  ctx.fillRect(templeLeft - w * 0.02, colTop, templeRight - templeLeft + w * 0.04, h * 0.018)

  // columns with capitals and bases, warm and softly lit on the inner edge
  for (const c of columns) {
    const cx = c.x * w
    const cw = c.w * w
    const ch = c.h * h * 1.2
    const top = baseY - ch
    // capital
    ctx.fillStyle = 'rgba(28,18,9,0.98)'
    ctx.fillRect(cx - cw * 0.55, top - h * 0.012, cw * 2.1, h * 0.014)
    // shaft
    const shaft = ctx.createLinearGradient(cx - cw / 2, 0, cx + cw / 2, 0)
    shaft.addColorStop(0, 'rgba(26,17,9,0.98)')
    shaft.addColorStop(0.5, 'rgba(60,40,20,0.98)')
    shaft.addColorStop(1, 'rgba(24,15,8,0.98)')
    ctx.fillStyle = shaft
    ctx.fillRect(cx - cw / 2, top, cw, ch)
    // base
    ctx.fillStyle = 'rgba(24,15,8,0.98)'
    ctx.fillRect(cx - cw * 0.6, baseY - h * 0.014, cw * 2.2, h * 0.014)
  }

  // steps
  for (let i = 0; i < 3; i++) {
    const sy = baseY + i * h * 0.02
    ctx.fillStyle = `rgba(26,17,9,${0.9 - i * 0.18})`
    ctx.fillRect(templeLeft - w * 0.06, sy, templeRight - templeLeft + w * 0.12, h * 0.02)
  }

  // the central doorway: a warm arch
  ctx.fillStyle = 'rgba(12,7,3,0.99)'
  ctx.beginPath()
  ctx.moveTo(doorX - doorR, baseY)
  ctx.arc(doorX, baseY - doorR, doorR, Math.PI, 0)
  ctx.lineTo(doorX + doorR, baseY)
  ctx.closePath()
  ctx.fill()
  // doorway edge catching the light
  ctx.strokeStyle = 'rgba(255,200,130,0.4)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(doorX - doorR, baseY)
  ctx.arc(doorX, baseY - doorR, doorR, Math.PI, 0)
  ctx.lineTo(doorX + doorR, baseY)
  ctx.stroke()

  ctx.globalCompositeOperation = 'screen'
  for (const c of candles) {
    const cx = c.x * w
    const cy = baseY - h * 0.02
    const cr = c.r * Math.min(w, h)
    const a = reduced ? 0.55 : 0.45 + 0.3 * (0.5 + 0.5 * Math.sin(t * 2.2 + c.ph))
    const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, cr * 6)
    cg.addColorStop(0, `rgba(255,170,80,${a})`)
    cg.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = cg
    ctx.fillRect(cx - cr * 6, cy - cr * 6, cr * 12, cr * 12)
    ctx.fillStyle = 'rgba(255,230,170,0.95)'
    ctx.beginPath()
    ctx.arc(cx, cy, cr * 1.4, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalCompositeOperation = 'source-over'

  for (const m of motes) {
    const yy = ((m.y - t * m.vy) % 1 + 1) % 1
    const xx = m.x + Math.sin(t * 0.5 + m.ph) * 0.01
    ctx.fillStyle = reduced ? 'rgba(230,210,170,0.3)' : `rgba(230,210,170,${0.2 + 0.25 * (0.5 + 0.5 * Math.sin(t * 0.8 + m.ph))})`
    ctx.beginPath()
    ctx.arc(xx * w, yy * h, m.r, 0, Math.PI * 2)
    ctx.fill()
  }
}

export default function TempleBackdrop() {
  const ref = useRef(null)
  useBackdropCanvas(ref, drawTemple)
  return <canvas ref={ref} className="temple-backdrop" aria-hidden="true" />
}
