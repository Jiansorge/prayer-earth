import React, { useRef } from 'react'
import { useBackdropCanvas } from './useBackdropCanvas.js'

// A bright, airy dawn — soft warm sky, a glowing rising sun, drifting clouds,
// gentle light, a calm sea at the horizon, and a few birds. Offers a light,
// luminous contrast to the deeper night themes.

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

const rnd = mulberry(31)
const clouds = Array.from({ length: 10 }, () => ({
  x: rnd(),
  y: 0.08 + rnd() * 0.4,
  w: 0.16 + rnd() * 0.2,
  v: 0.004 + rnd() * 0.01,
  warm: rnd() > 0.5
}))
const birds = Array.from({ length: 4 }, () => ({
  x: rnd(),
  y: 0.15 + rnd() * 0.3,
  v: 0.008 + rnd() * 0.012,
  s: 0.5 + rnd() * 0.6,
  ph: rnd() * Math.PI * 2
}))
const motes = Array.from({ length: 30 }, () => ({
  x: rnd(),
  y: rnd(),
  r: 0.4 + rnd() * 1.1,
  vy: 0.003 + rnd() * 0.008,
  ph: rnd() * Math.PI * 2
}))

function drawDawn(ctx, dpr, t, reduced) {
  const w = window.innerWidth
  const h = window.innerHeight
  const canvas = ctx.canvas
  canvas.width = Math.round(w * dpr)
  canvas.height = Math.round(h * dpr)
  canvas.style.width = w + 'px'
  canvas.style.height = h + 'px'
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, w, h)

  // soft warm sky: lavender-blue above, honey-gold at the horizon
  const sky = ctx.createLinearGradient(0, 0, 0, h)
  sky.addColorStop(0, '#a7c6e8')
  sky.addColorStop(0.45, '#e8d8c8')
  sky.addColorStop(0.72, '#f6d9a8')
  sky.addColorStop(1, '#fdeecb')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, h)

  // rising sun with a wide soft glow
  const sx = w * 0.5
  const sy = h * 0.58
  const sr = h * 0.1
  const pulse = reduced ? 1 : 1 + 0.02 * Math.sin(t * 1.2)
  const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr * 7)
  glow.addColorStop(0, 'rgba(255,240,200,0.55)')
  glow.addColorStop(0.4, 'rgba(255,225,170,0.28)')
  glow.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, w, h)
  const sunCore = ctx.createRadialGradient(sx - sr * 0.25, sy - sr * 0.25, 0, sx, sy, sr * pulse)
  sunCore.addColorStop(0, 'rgba(255,252,235,1)')
  sunCore.addColorStop(1, 'rgba(255,222,150,0.9)')
  ctx.fillStyle = sunCore
  ctx.beginPath()
  ctx.arc(sx, sy, sr * pulse, 0, Math.PI * 2)
  ctx.fill()

  // gentle god-rays fanning from the rising sun
  ctx.globalCompositeOperation = 'screen'
  const rayA = reduced ? 0.05 : 0.07 + 0.04 * Math.sin(t * 0.6)
  ctx.fillStyle = `rgba(255,240,205,${rayA})`
  for (let i = 0; i < 7; i++) {
    const ang = -0.6 + i * 0.2
    const spread = 0.16
    ctx.beginPath()
    ctx.moveTo(sx, sy)
    ctx.lineTo(sx + Math.cos(ang - spread) * w, sy + Math.sin(ang - spread) * h)
    ctx.lineTo(sx + Math.cos(ang + spread) * w, sy + Math.sin(ang + spread) * h)
    ctx.closePath()
    ctx.fill()
  }
  ctx.globalCompositeOperation = 'source-over'

  // drifting clouds, warm-tinted near the horizon
  for (const c of clouds) {
    const cx = ((c.x + t * c.v) % 1.3 - 0.15) * w
    const cw = c.w * w
    const ch = cw * 0.28
    const tint = c.warm ? 'rgba(255,230,190,0.55)' : 'rgba(255,255,255,0.6)'
    const cg = ctx.createRadialGradient(cx, c.y * h, 0, cx, c.y * h, cw)
    cg.addColorStop(0, tint)
    cg.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = cg
    ctx.beginPath()
    ctx.ellipse(cx, c.y * h, cw, ch, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(cx + cw * 0.4, c.y * h - ch * 0.4, cw * 0.55, ch * 0.8, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  // calm sea at the horizon, catching the sun's light
  const seaY = h * 0.86
  const sea = ctx.createLinearGradient(0, seaY, 0, h)
  sea.addColorStop(0, 'rgba(215,228,242,0.95)')
  sea.addColorStop(0.5, 'rgba(178,205,228,0.97)')
  sea.addColorStop(1, 'rgba(132,170,205,0.98)')
  ctx.fillStyle = sea
  ctx.fillRect(0, seaY, w, h - seaY)
  // a shimmering vertical column of sun reflected on the water
  ctx.globalCompositeOperation = 'screen'
  const reflect = ctx.createLinearGradient(0, seaY, 0, h)
  reflect.addColorStop(0, `rgba(255,244,205,${reduced ? 0.4 : 0.55 + 0.18 * Math.sin(t * 1.6)})`)
  reflect.addColorStop(1, 'rgba(255,244,205,0.02)')
  ctx.fillStyle = reflect
  ctx.beginPath()
  ctx.moveTo(sx - w * 0.012, seaY)
  ctx.lineTo(sx + w * 0.012, seaY)
  ctx.lineTo(sx + w * 0.13, h)
  ctx.lineTo(sx - w * 0.13, h)
  ctx.closePath()
  ctx.fill()
  // scattered caustic glints dancing across the water
  for (let i = 0; i < 10; i++) {
    const cx = ((i * 0.09 + t * (0.003 + (i % 3) * 0.0015)) % 1.15 - 0.075) * w
    const cy = seaY + (0.12 + (i % 5) * 0.16) * (h - seaY)
    const r = (0.012 + (i % 3) * 0.008) * w
    const a = reduced ? 0.12 : 0.08 + 0.14 * (0.5 + 0.5 * Math.sin(t * (1.2 + (i % 3) * 0.4) + i * 1.7))
    ctx.fillStyle = `rgba(255,247,214,${a})`
    ctx.beginPath()
    ctx.ellipse(cx, cy, r, r * 0.4, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  // gentle wave lines
  for (let i = 0; i < 7; i++) {
    const yy = seaY + (i + 0.5) * ((h - seaY) / 8)
    ctx.strokeStyle = `rgba(255,255,255,${0.18 - i * 0.02})`
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let x = 0; x <= w; x += 8) {
      const y = yy + Math.sin(x * 0.008 + t * (0.6 + i * 0.1) + i) * 2.2
      if (x === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
  ctx.globalCompositeOperation = 'source-over'

  // a few birds gliding across the sky
  ctx.strokeStyle = 'rgba(90,110,140,0.55)'
  ctx.lineWidth = 1.6
  for (const b of birds) {
    const bx = ((b.x + t * b.v) % 1.3 - 0.15) * w
    const by = b.y * h + Math.sin(t * 0.8 + b.ph) * 3
    const s = b.s * w * 0.012
    ctx.beginPath()
    ctx.moveTo(bx - s, by)
    ctx.quadraticCurveTo(bx - s * 0.4, by - s * 0.8, bx, by)
    ctx.quadraticCurveTo(bx + s * 0.4, by - s * 0.8, bx + s, by)
    ctx.stroke()
  }

  // soft floating light motes
  ctx.globalCompositeOperation = 'screen'
  for (const m of motes) {
    const yy = ((m.y - t * m.vy) % 1 + 1) % 1
    const a = reduced ? 0.2 : 0.12 + 0.16 * (0.5 + 0.5 * Math.sin(t * 0.7 + m.ph))
    ctx.fillStyle = `rgba(255,246,214,${a})`
    ctx.beginPath()
    ctx.arc(m.x * w, yy * h, m.r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalCompositeOperation = 'source-over'
}

export default function DawnBackdrop() {
  const ref = useRef(null)
  useBackdropCanvas(ref, drawDawn)
  return <canvas ref={ref} className="dawn-backdrop" aria-hidden="true" />
}
