import React, { useRef } from 'react'
import { useBackdropCanvas } from './useBackdropCanvas.js'

// A deep ocean backdrop, navy-to-teal water, shafts of light from above,
// gentle wave layers, drifting bioluminescent sparks, and rising bubbles.

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

const rnd = mulberry(888)
const sparks = Array.from({ length: 40 }, () => ({
  x: rnd(),
  y: rnd(),
  r: 0.5 + rnd() * 1.4,
  vy: 0.006 + rnd() * 0.02,
  ph: rnd() * Math.PI * 2
}))
const bubbles = Array.from({ length: 18 }, () => ({
  x: rnd(),
  y: rnd(),
  r: 1 + rnd() * 2.5,
  vy: 0.01 + rnd() * 0.03
}))
const rays = Array.from({ length: 5 }, () => ({
  x: rnd(),
  w: 0.05 + rnd() * 0.07,
  tilt: -0.25 + rnd() * 0.5
}))
const fish = Array.from({ length: 6 }, () => ({
  x: rnd(),
  y: 0.4 + rnd() * 0.4,
  v: 0.006 + rnd() * 0.012,
  s: 0.5 + rnd() * 0.8,
  ph: rnd() * Math.PI * 2
}))

function drawOcean(ctx, dpr, t, reduced) {
  const w = window.innerWidth
  const h = window.innerHeight
  const canvas = ctx.canvas
  canvas.width = Math.round(w * dpr)
  canvas.height = Math.round(h * dpr)
  canvas.style.width = w + 'px'
  canvas.style.height = h + 'px'
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, w, h)

  const g = ctx.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, '#061a2e')
  g.addColorStop(0.5, '#0a2c44')
  g.addColorStop(1, '#0d3b4f')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)

  // a soft moon with a wide pale halo above the water
  const mx = w * 0.78
  const my = h * 0.326
  const moonHalo = ctx.createRadialGradient(mx, my, 0, mx, my, w * 0.2)
  moonHalo.addColorStop(0, 'rgba(200,225,255,0.14)')
  moonHalo.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = moonHalo
  ctx.fillRect(mx - w * 0.2, my - w * 0.2, w * 0.4, w * 0.4)
  ctx.fillStyle = 'rgba(225,238,255,0.9)'
  ctx.beginPath()
  ctx.arc(mx, my, w * 0.022, 0, Math.PI * 2)
  ctx.fill()

  ctx.globalCompositeOperation = 'screen'
  for (const r of rays) {
    ctx.save()
    ctx.translate(r.x * w, 0)
    ctx.rotate(r.tilt)
    const lg = ctx.createLinearGradient(0, 0, 0, h)
    lg.addColorStop(0, 'rgba(190,230,255,0.10)')
    lg.addColorStop(1, 'rgba(190,230,255,0)')
    ctx.fillStyle = lg
    ctx.fillRect(-r.w * w * 0.5, 0, r.w * w, h * 1.2)
    ctx.restore()
  }

  for (let layer = 0; layer < 4; layer++) {
    const yy = h * (0.55 + layer * 0.13)
    const amp = (0.008 + layer * 0.003) * h
    const speed = 0.5 + layer * 0.2
    const alpha = 0.05 + layer * 0.02
    ctx.strokeStyle = `rgba(160,220,235,${alpha})`
    ctx.lineWidth = 1.2
    ctx.beginPath()
    for (let x = 0; x <= w; x += 6) {
      const y = yy + Math.sin(x * 0.006 + t * speed + layer) * amp
      if (x === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
  ctx.globalCompositeOperation = 'source-over'

  for (const b of bubbles) {
    const yy = ((b.y - t * b.vy) % 1 + 1) % 1
    ctx.strokeStyle = 'rgba(200,235,245,0.25)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(b.x * w, yy * h, b.r, 0, Math.PI * 2)
    ctx.stroke()
  }

  // tiny fish silhouettes drifting through the middle water
  ctx.fillStyle = 'rgba(190,235,245,0.22)'
  for (const f of fish) {
    const fx = ((f.x + t * f.v) % 1.2 - 0.1) * w
    const fy = f.y * h + Math.sin(t * 0.6 + f.ph) * 4
    const s = f.s * w * 0.006
    ctx.beginPath()
    ctx.ellipse(fx, fy, s, s * 0.5, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(fx + s, fy)
    ctx.lineTo(fx + s * 1.7, fy - s * 0.5)
    ctx.lineTo(fx + s * 1.7, fy + s * 0.5)
    ctx.closePath()
    ctx.fill()
  }

  ctx.globalCompositeOperation = 'screen'
  for (const s of sparks) {
    const yy = ((s.y - t * s.vy) % 1 + 1) % 1
    const a = reduced ? 0.3 : 0.25 + 0.4 * (0.5 + 0.5 * Math.sin(t * 1.2 + s.ph))
    ctx.fillStyle = `rgba(140,240,220,${a})`
    ctx.beginPath()
    ctx.arc(s.x * w, yy * h, s.r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalCompositeOperation = 'source-over'
}

export default function OceanBackdrop() {
  const ref = useRef(null)
  useBackdropCanvas(ref, drawOcean)
  return <canvas ref={ref} className="ocean-backdrop" aria-hidden="true" />
}
