import React, { useRef } from 'react'
import { useBackdropCanvas } from './useBackdropCanvas.js'

// A mystical night backdrop — deep indigo space, drifting nebula glows,
// aurora veils, twinkling stars, a soft glowing orb, and rising motes of light.

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

const NEBULA_HUES = ['214,120,255', '80,220,255', '255,190,110', '150,120,255', '70,255,200']
const VEIL_COLORS = ['rgba(110,255,200,ALPHA)', 'rgba(150,130,255,ALPHA)', 'rgba(255,210,120,ALPHA)']

const rnd = mulberry(777)
const stars = Array.from({ length: 220 }, () => ({
  x: rnd(),
  y: rnd() * 0.72,
  r: rnd() < 0.12 ? 1.6 : 0.8 + rnd() * 0.7,
  tw: 0.3 + rnd() * 1.2,
  ph: rnd() * Math.PI * 2
}))
const nebula = Array.from({ length: 5 }, (_, i) => ({
  x: rnd(),
  y: 0.12 + rnd() * 0.68,
  r: 0.26 + rnd() * 0.3,
  hue: NEBULA_HUES[i],
  drift: 0.005 + rnd() * 0.01,
  ph: rnd() * Math.PI * 2
}))
const veils = Array.from({ length: 3 }, (_, i) => ({
  y: 0.14 + i * 0.16,
  amp: 0.045 + rnd() * 0.03,
  freq: 1.8 + rnd() * 1.4,
  speed: 0.05 + rnd() * 0.05,
  ph: rnd() * Math.PI * 2,
  color: VEIL_COLORS[i]
}))
const motes = Array.from({ length: 42 }, () => ({
  x: rnd(),
  y: rnd(),
  r: 0.6 + rnd() * 1.3,
  vy: 0.008 + rnd() * 0.018,
  sway: 0.4 + rnd() * 0.8,
  ph: rnd() * Math.PI * 2
}))

function drawMystic(ctx, dpr, t, reduced) {
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
  g.addColorStop(0, '#05060f')
  g.addColorStop(0.45, '#0c1130')
  g.addColorStop(0.8, '#1a1740')
  g.addColorStop(1, '#241a45')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)

  const haze = ctx.createLinearGradient(0, h * 0.5, 0, h)
  haze.addColorStop(0, 'rgba(150,120,255,0)')
  haze.addColorStop(1, 'rgba(150,120,255,0.13)')
  ctx.fillStyle = haze
  ctx.fillRect(0, h * 0.5, w, h * 0.5)

  ctx.globalCompositeOperation = 'screen'
  for (const nb of nebula) {
    const nx = (nb.x + Math.sin(t * nb.drift + nb.ph) * 0.04) * w
    const ny = nb.y * h
    const nr = nb.r * Math.min(w, h) * 1.15
    const cg = ctx.createRadialGradient(nx, ny, 0, nx, ny, nr)
    cg.addColorStop(0, `rgba(${nb.hue},0.10)`)
    cg.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = cg
    ctx.fillRect(0, 0, w, h)
  }

  for (const v of veils) {
    const base = v.y * h
    const amp = v.amp * h
    ctx.beginPath()
    ctx.moveTo(-10, h)
    const step = 60
    for (let x = -10; x <= w + step; x += step) {
      ctx.lineTo(x, base + Math.sin(x * 0.004 * v.freq + t * v.speed + v.ph) * amp)
    }
    ctx.lineTo(w + 10, h)
    ctx.closePath()
    ctx.fillStyle = v.color.replace('ALPHA', '0.10')
    ctx.fill()
  }
  ctx.globalCompositeOperation = 'source-over'

  for (const s of stars) {
    const tw = reduced ? 0.6 : 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * s.tw + s.ph))
    ctx.fillStyle = `rgba(235,240,255,${tw * 0.9})`
    ctx.beginPath()
    ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2)
    ctx.fill()
  }

  const ox = w * 0.78
  const oy = h * 0.2
  const or = h * 0.055
  ctx.globalCompositeOperation = 'screen'
  const og = ctx.createRadialGradient(ox, oy, 0, ox, oy, or * 7)
  og.addColorStop(0, 'rgba(235,225,205,0.8)')
  og.addColorStop(0.35, 'rgba(205,190,255,0.18)')
  og.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = og
  ctx.fillRect(0, 0, w, h)
  ctx.globalCompositeOperation = 'source-over'
  const core = ctx.createRadialGradient(ox - or * 0.25, oy - or * 0.25, 0, ox, oy, or)
  core.addColorStop(0, '#fff6e0')
  core.addColorStop(1, 'rgba(220,210,255,0.5)')
  ctx.fillStyle = core
  ctx.beginPath()
  ctx.arc(ox, oy, or, 0, Math.PI * 2)
  ctx.fill()

  for (const m of motes) {
    const yy = ((m.y - t * m.vy) % 1 + 1) % 1
    const xx = m.x + Math.sin(t * m.sway + m.ph) * 0.012
    const a = reduced ? 0.3 : 0.25 + 0.4 * (0.5 + 0.5 * Math.sin(t * 1.4 + m.ph * 3))
    ctx.fillStyle = `rgba(230,220,255,${a})`
    ctx.beginPath()
    ctx.arc(xx * w, yy * h, m.r, 0, Math.PI * 2)
    ctx.fill()
  }
}

export default function MysticBackdrop() {
  const ref = useRef(null)
  useBackdropCanvas(ref, drawMystic)
  return <canvas ref={ref} className="mystic-backdrop" aria-hidden="true" />
}
