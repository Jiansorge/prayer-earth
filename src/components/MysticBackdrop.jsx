import React, { useRef } from 'react'
import { useBackdropCanvas } from './useBackdropCanvas.js'

// A mystical night backdrop, deep indigo space, drifting nebula glows,
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
const stars = Array.from({ length: 420 }, () => ({
  x: rnd(),
  y: rnd() * 0.72,
  r: rnd() < 0.12 ? 1.8 : 0.7 + rnd() * 0.8,
  tw: 0.3 + rnd() * 1.2,
  ph: rnd() * Math.PI * 2,
  warm: rnd() < 0.18
}))
const nebula = Array.from({ length: 7 }, (_, i) => ({
  x: rnd(),
  y: 0.1 + rnd() * 0.7,
  r: 0.24 + rnd() * 0.34,
  hue: NEBULA_HUES[i % NEBULA_HUES.length],
  alpha: 0.08 + rnd() * 0.1,
  drift: 0.005 + rnd() * 0.012,
  ph: rnd() * Math.PI * 2
}))
const veils = Array.from({ length: 4 }, (_, i) => ({
  y: 0.1 + i * 0.14,
  amp: 0.05 + rnd() * 0.035,
  freq: 1.8 + rnd() * 1.6,
  speed: 0.05 + rnd() * 0.06,
  ph: rnd() * Math.PI * 2,
  color: VEIL_COLORS[i % VEIL_COLORS.length]
}))
const motes = Array.from({ length: 70 }, () => ({
  x: rnd(),
  y: rnd(),
  r: 0.5 + rnd() * 1.5,
  vy: 0.008 + rnd() * 0.02,
  sway: 0.4 + rnd() * 0.9,
  ph: rnd() * Math.PI * 2
}))
const rnd2 = mulberry(1234)
const gold = Array.from({ length: 5 }, () => ({
  x: rnd2(),
  y: 0.18 + rnd2() * 0.5,
  r: 0.16 + rnd2() * 0.2,
  ph: rnd2() * Math.PI * 2
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
  g.addColorStop(0, '#04050d')
  g.addColorStop(0.35, '#0a0d28')
  g.addColorStop(0.62, '#121249')
  g.addColorStop(0.82, '#1d1550')
  g.addColorStop(1, '#241a45')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)

  const haze = ctx.createLinearGradient(0, h * 0.4, 0, h)
  haze.addColorStop(0, 'rgba(150,120,255,0)')
  haze.addColorStop(1, 'rgba(150,120,255,0.16)')
  ctx.fillStyle = haze
  ctx.fillRect(0, h * 0.4, w, h * 0.6)

  const eq = ctx.createLinearGradient(0, 0, 0, h)
  eq.addColorStop(0, 'rgba(120,220,255,0.05)')
  eq.addColorStop(0.5, 'rgba(150,120,255,0.04)')
  eq.addColorStop(1, 'rgba(255,190,120,0.06)')
  ctx.fillStyle = eq
  ctx.fillRect(0, 0, w, h)

  ctx.globalCompositeOperation = 'screen'
  for (const nb of nebula) {
    const nx = (nb.x + Math.sin(t * nb.drift + nb.ph) * 0.045) * w
    const ny = nb.y * h
    const nr = nb.r * Math.min(w, h) * 1.2
    const cg = ctx.createRadialGradient(nx, ny, 0, nx, ny, nr)
    cg.addColorStop(0, `rgba(${nb.hue},${nb.alpha})`)
    cg.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = cg
    ctx.fillRect(0, 0, w, h)
  }
  // a soft golden low-glow at the bottom for warmth beneath the deep space
  const lowGlow = ctx.createRadialGradient(w * 0.5, h * 1.05, 0, w * 0.5, h * 1.05, h * 0.7)
  lowGlow.addColorStop(0, 'rgba(255,200,130,0.14)')
  lowGlow.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = lowGlow
  ctx.fillRect(0, 0, w, h)

  for (const v of veils) {
    const base = v.y * h
    const amp = v.amp * h
    ctx.beginPath()
    ctx.moveTo(-10, h)
    const step = 50
    for (let x = -10; x <= w + step; x += step) {
      ctx.lineTo(x, base + Math.sin(x * 0.004 * v.freq + t * v.speed + v.ph) * amp)
    }
    ctx.lineTo(w + 10, h)
    ctx.closePath()
    ctx.fillStyle = v.color.replace('ALPHA', '0.14')
    ctx.fill()
  }
  ctx.globalCompositeOperation = 'source-over'

  for (const s of stars) {
    const tw = reduced ? 0.6 : 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t * s.tw + s.ph))
    const col = s.warm ? '255,236,200' : '235,240,255'
    ctx.fillStyle = `rgba(${col},${tw * 0.95})`
    ctx.beginPath()
    ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2)
    ctx.fill()
  }

  // soft floating golden glows
  ctx.globalCompositeOperation = 'screen'
  for (const gl of gold) {
    const gx = (gl.x + Math.sin(t * 0.03 + gl.ph) * 0.02) * w
    const gy = gl.y * h
    const gr = gl.r * Math.min(w, h) * 0.7
    const gg = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr)
    gg.addColorStop(0, 'rgba(255,220,160,0.10)')
    gg.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = gg
    ctx.fillRect(0, 0, w, h)
  }
  ctx.globalCompositeOperation = 'source-over'

  const ox = w * 0.3
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
