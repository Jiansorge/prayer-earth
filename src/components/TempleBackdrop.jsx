import React, { useRef } from 'react'
import { useBackdropCanvas } from './useBackdropCanvas.js'

// A quiet, non-denominational ancient temple — warm stone, a row of columns
// and a central arch, candlelight flickering, incense smoke drifting upward,
// and dust motes in the light.

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
const columns = Array.from({ length: 9 }, (_, i) => ({
  x: i / 9 + rnd() * 0.02,
  w: 0.045 + rnd() * 0.012,
  h: 0.5 + rnd() * 0.16
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

  const g = ctx.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, '#120c08')
  g.addColorStop(0.55, '#241709')
  g.addColorStop(0.82, '#3a2410')
  g.addColorStop(1, '#4a2c12')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)

  ctx.globalCompositeOperation = 'screen'
  const halo = ctx.createRadialGradient(w * 0.5, h * 0.55, 0, w * 0.5, h * 0.55, w * 0.4)
  const flicker = reduced ? 0.5 : 0.5 + 0.06 * Math.sin(t * 1.8)
  halo.addColorStop(0, `rgba(255,190,110,${0.16 * flicker})`)
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

  const floor = ctx.createLinearGradient(0, h * 0.72, 0, h)
  floor.addColorStop(0, 'rgba(0,0,0,0)')
  floor.addColorStop(1, 'rgba(0,0,0,0.45)')
  ctx.fillStyle = floor
  ctx.fillRect(0, h * 0.72, w, h * 0.28)

  ctx.fillStyle = 'rgba(14,9,5,0.96)'
  for (const c of columns) {
    const cx = c.x * w
    const cw = c.w * w
    const ch = c.h * h
    ctx.fillRect(cx, h - ch, cw, ch)
    ctx.fillRect(cx - cw * 0.18, h - ch, cw * 1.36, cw * 0.55)
    ctx.fillRect(cx - cw * 0.18, h - cw * 0.5, cw * 1.36, cw * 0.5)
  }
  const ax = w * 0.5
  const ar = w * 0.13
  ctx.beginPath()
  ctx.moveTo(ax - ar, h)
  ctx.arc(ax, h, ar, Math.PI, 0)
  ctx.lineTo(ax + ar, h)
  ctx.closePath()
  ctx.fill()

  ctx.globalCompositeOperation = 'screen'
  for (const c of candles) {
    const cx = c.x * w
    const cy = h * 0.72
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
