import React, { useEffect, useRef } from 'react'
import { getScene } from './Scenery.jsx'

// A rich, painterly nature backdrop rendered to a canvas, layered skies,
// glowing sun or moon, drifting clouds, mist, mountain ridges, and pines.
// Self-contained (no external images), tuned per time of day.

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

function scenePalette(scene) {
  const p = {
    night: {
      sky: ['#04060f', '#0a1428', '#16233e'],
      horizon: '#1e3050',
      sun: null,
      moon: { x: 0.76, y: 0.16, r: 0.035, glow: 'rgba(235,231,205,0.75)', core: '#fdf8e6' },
      cloudA: 'rgba(90,110,150,0.28)',
      cloudB: 'rgba(60,80,120,0.2)',
      ridge: ['rgba(10,18,38,0.95)', 'rgba(16,26,50,0.9)', 'rgba(24,36,64,0.85)'],
      pine: 'rgba(5,10,24,0.96)',
      mist: 'rgba(80,110,160,0.18)',
      stars: 220
    },
    dawn: {
      sky: ['#1a2040', '#5a4a72', '#e8926a'],
      horizon: '#f6c08a',
      sun: { x: 0.3, y: 0.72, r: 0.05, glow: 'rgba(255,190,130,0.85)', core: '#fff0d4' },
      moon: null,
      cloudA: 'rgba(255,190,150,0.3)',
      cloudB: 'rgba(200,150,190,0.22)',
      ridge: ['rgba(34,30,60,0.9)', 'rgba(52,42,74,0.85)', 'rgba(78,60,92,0.8)'],
      pine: 'rgba(20,22,48,0.94)',
      mist: 'rgba(255,190,150,0.22)',
      stars: 40
    },
    day: {
      sky: ['#2a6cc9', '#8fc3ef', '#dff3ff'],
      horizon: '#eaf7ff',
      sun: { x: 0.82, y: 0.14, r: 0.045, glow: 'rgba(255,245,210,0.95)', core: '#ffffff' },
      moon: null,
      cloudA: 'rgba(255,255,255,0.75)',
      cloudB: 'rgba(235,245,255,0.55)',
      ridge: ['rgba(22,72,56,0.75)', 'rgba(30,90,66,0.7)', 'rgba(42,110,80,0.65)'],
      pine: 'rgba(12,52,36,0.9)',
      mist: 'rgba(255,255,255,0.25)',
      stars: 0
    },
    golden: {
      sky: ['#5a4a60', '#c07a4a', '#f7c97e'],
      horizon: '#ffe9c0',
      sun: { x: 0.24, y: 0.7, r: 0.07, glow: 'rgba(255,190,110,0.95)', core: '#fff3d0' },
      moon: null,
      cloudA: 'rgba(255,205,150,0.42)',
      cloudB: 'rgba(240,170,140,0.3)',
      ridge: ['rgba(88,60,44,0.85)', 'rgba(112,74,52,0.8)', 'rgba(140,96,66,0.75)'],
      pine: 'rgba(52,36,24,0.92)',
      mist: 'rgba(255,210,150,0.3)',
      stars: 0
    },
    dusk: {
      sky: ['#20264a', '#5a4a80', '#b05a70'],
      horizon: '#e8906a',
      sun: { x: 0.72, y: 0.66, r: 0.06, glow: 'rgba(255,160,110,0.9)', core: '#ffe0c0' },
      moon: null,
      cloudA: 'rgba(180,140,200,0.34)',
      cloudB: 'rgba(140,100,170,0.26)',
      ridge: ['rgba(26,22,52,0.92)', 'rgba(40,32,66,0.88)', 'rgba(58,44,82,0.82)'],
      pine: 'rgba(16,16,40,0.95)',
      mist: 'rgba(210,150,170,0.24)',
      stars: 30
    }
  }
  return p[scene]
}

function drawScene(ctx, w, h, scene) {
  const P = scenePalette(scene)
  const rnd = mulberry(scene === 'day' ? 7 : scene === 'night' ? 99 : 42)

  // sky
  const g = ctx.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, P.sky[0])
  g.addColorStop(0.55, P.sky[1])
  g.addColorStop(1, P.sky[2])
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  // horizon haze
  const haze = ctx.createLinearGradient(0, h * 0.55, 0, h)
  haze.addColorStop(0, 'rgba(255,255,255,0)')
  haze.addColorStop(1, P.horizon)
  ctx.globalCompositeOperation = 'screen'
  ctx.fillStyle = haze
  ctx.fillRect(0, h * 0.55, w, h * 0.45)
  ctx.globalCompositeOperation = 'source-over'

  // stars
  if (P.stars) {
    for (let i = 0; i < P.stars; i++) {
      const x = rnd() * w
      const y = rnd() * h * 0.7
      const a = 0.2 + rnd() * 0.8
      const s = rnd() < 0.12 ? 2 : 1
      ctx.fillStyle = `rgba(255,255,255,${a})`
      ctx.fillRect(x, y, s, s)
    }
  }

  // sun or moon
  const orb = P.sun || P.moon
  if (orb) {
    const ox = orb.x * w
    const oy = orb.y * h
    const or = orb.r * h
    const glow = ctx.createRadialGradient(ox, oy, 0, ox, oy, or * 6)
    glow.addColorStop(0, orb.glow)
    glow.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, w, h)
    const core = ctx.createRadialGradient(ox - or * 0.25, oy - or * 0.25, 0, ox, oy, or)
    core.addColorStop(0, orb.core)
    core.addColorStop(1, 'rgba(255,240,200,0.55)')
    ctx.fillStyle = core
    ctx.beginPath()
    ctx.arc(ox, oy, or, 0, Math.PI * 2)
    ctx.fill()
  }

  // clouds (two layers, soft blobs)
  const cloud = (tint, count, yMin, yMax, scale, alpha) => {
    for (let i = 0; i < count; i++) {
      const cx = rnd() * w
      const cy = yMin + rnd() * (yMax - yMin)
      const cw = (0.1 + rnd() * 0.22) * w * scale
      const ch = cw * 0.35
      const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, cw)
      cg.addColorStop(0, tint)
      cg.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.globalAlpha = alpha
      ctx.fillStyle = cg
      ctx.beginPath()
      ctx.ellipse(cx, cy, cw, ch, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
    }
  }
  cloud(P.cloudA, 7, h * 0.06, h * 0.5, 1, 1)
  cloud(P.cloudB, 6, h * 0.3, h * 0.62, 0.6, 0.8)

  // mist band above the horizon
  const mist = ctx.createLinearGradient(0, h * 0.72, 0, h * 0.95)
  mist.addColorStop(0, 'rgba(255,255,255,0)')
  mist.addColorStop(1, P.mist)
  ctx.fillStyle = mist
  ctx.fillRect(0, h * 0.72, w, h * 0.28)

  // mountain ridges (far to near, with atmospheric tint + shading)
  const ridge = (color, amp, baseY, seed) => {
    const rr = mulberry(seed)
    const step = 24
    const pts = []
    for (let x = -1; x <= w + step; x += step) {
      let y = baseY
      for (let o = 0; o < 3; o++) y += (rr() - 0.5) * amp * 2
      pts.push([x, y])
    }
    ctx.beginPath()
    ctx.moveTo(pts[0][0], h)
    for (const [x, y] of pts) ctx.lineTo(x, y)
    ctx.lineTo(w + 1, h)
    ctx.closePath()
    const sh = ctx.createLinearGradient(0, pts[0][1], 0, h)
    sh.addColorStop(0, color)
    sh.addColorStop(1, 'rgba(0,0,0,0.35)')
    ctx.fillStyle = sh
    ctx.fill()
  }
  ridge(P.ridge[0], h * 0.012, h * 0.82, 11)
  ridge(P.ridge[1], h * 0.015, h * 0.86, 23)
  ridge(P.ridge[2], h * 0.02, h * 0.9, 37)

  // pines along the bottom
  ctx.fillStyle = P.pine
  const pw = h * 0.014
  for (let x = -10; x < w + 20; x += pw * 1.5) {
    const ph = pw * (1.6 + rnd() * 1.6)
    const bx = x + rnd() * pw * 0.6
    ctx.beginPath()
    ctx.moveTo(bx, h)
    ctx.lineTo(bx + pw, h)
    ctx.lineTo(bx + pw * 0.5, h - ph)
    ctx.closePath()
    ctx.fill()
  }
}

export default function NatureBackdrop() {
  const ref = useRef(null)
  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas.getContext('2d')
    let raf = 0
    const draw = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      const w = window.innerWidth
      const h = window.innerHeight
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      canvas.style.width = w + 'px'
      canvas.style.height = h + 'px'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      drawScene(ctx, w, h, getScene())
      raf = 0
    }
    const onResize = () => {
      if (!raf) raf = requestAnimationFrame(draw)
    }
    draw()
    window.addEventListener('resize', onResize)
    // re-render when the time of day changes
    const t = setInterval(() => {
      if (!raf) raf = requestAnimationFrame(draw)
    }, 60000)
    return () => {
      cancelAnimationFrame(raf)
      clearInterval(t)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return <canvas ref={ref} className="nature-backdrop" aria-hidden="true" />
}
