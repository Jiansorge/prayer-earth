import React, { useEffect, useRef } from 'react'

// A deep-space backdrop — a dark cosmos with twinkling stars, a drift of
// nebula light, a faint Milky Way band, and a couple of distant planets.
// Self-contained, gently animated, and still for reduced-motion.

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

export default function SpaceBackdrop() {
  const ref = useRef(null)
  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas.getContext('2d')
    const reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
    const rnd = mulberry(2024)

    const stars = Array.from({ length: 420 }, () => ({
      x: rnd(),
      y: rnd(),
      r: rnd() < 0.1 ? 1.6 : 0.5 + rnd() * 0.9,
      tw: 0.4 + rnd() * 1.6,
      ph: rnd() * Math.PI * 2,
      warm: rnd() < 0.18
    }))
    const planets = [
      { x: 0.16, y: 0.24, r: 0.045, color: '#c9b6e6', glow: 'rgba(160,140,220,0.5)', ring: true },
      { x: 0.82, y: 0.68, r: 0.028, color: '#ffd9a0', glow: 'rgba(255,200,140,0.4)', ring: false }
    ]
    const nebula = [
      { x: 0.3, y: 0.55, r: 0.3, c: 'rgba(120,80,200,ALPHA)', drift: 0.004 },
      { x: 0.75, y: 0.25, r: 0.26, c: 'rgba(60,160,220,ALPHA)', drift: 0.003 }
    ]

    const draw = (t) => {
      const w = window.innerWidth
      const h = window.innerHeight
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      canvas.style.width = w + 'px'
      canvas.style.height = h + 'px'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)

      const g = ctx.createLinearGradient(0, 0, 0, h)
      g.addColorStop(0, '#020208')
      g.addColorStop(0.55, '#070b22')
      g.addColorStop(1, '#101534')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)

      // nebula washes
      ctx.globalCompositeOperation = 'screen'
      for (const nb of nebula) {
        const nx = (nb.x + Math.sin(t * nb.drift * 8 + 1) * 0.02) * w
        const ny = nb.y * h
        const nr = nb.r * Math.min(w, h)
        const cg = ctx.createRadialGradient(nx, ny, 0, nx, ny, nr)
        cg.addColorStop(0, nb.c.replace('ALPHA', '0.14'))
        cg.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = cg
        ctx.fillRect(0, 0, w, h)
      }

      // faint Milky Way band
      const mw = ctx.createLinearGradient(0, h * 0.15, w, h * 0.85)
      mw.addColorStop(0, 'rgba(220,225,255,0)')
      mw.addColorStop(0.5, 'rgba(200,210,255,0.05)')
      mw.addColorStop(1, 'rgba(220,225,255,0)')
      ctx.fillStyle = mw
      ctx.save()
      ctx.translate(w / 2, h / 2)
      ctx.rotate(-0.5)
      ctx.fillRect(-w, -h, w * 2, h * 2)
      ctx.restore()
      ctx.globalCompositeOperation = 'source-over'

      // stars
      for (const s of stars) {
        const tw = reduced ? 0.6 : 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t * s.tw + s.ph))
        ctx.fillStyle = s.warm
          ? `rgba(255,235,210,${tw * 0.9})`
          : `rgba(225,232,255,${tw * 0.9})`
        ctx.beginPath()
        ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2)
        ctx.fill()
      }

      // planets
      for (const p of planets) {
        const px = p.x * w
        const py = p.y * h
        const pr = p.r * Math.min(w, h)
        ctx.globalCompositeOperation = 'screen'
        const pg = ctx.createRadialGradient(px, py, 0, px, py, pr * 4)
        pg.addColorStop(0, p.glow)
        pg.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = pg
        ctx.fillRect(0, 0, w, h)
        ctx.globalCompositeOperation = 'source-over'
        const body = ctx.createRadialGradient(px - pr * 0.3, py - pr * 0.3, pr * 0.1, px, py, pr)
        body.addColorStop(0, '#ffffff')
        body.addColorStop(0.35, p.color)
        body.addColorStop(1, 'rgba(20,20,40,1)')
        ctx.fillStyle = body
        ctx.beginPath()
        ctx.arc(px, py, pr, 0, Math.PI * 2)
        ctx.fill()
        if (p.ring) {
          ctx.strokeStyle = 'rgba(210,200,240,0.5)'
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.ellipse(px, py, pr * 1.9, pr * 0.55, -0.4, 0, Math.PI * 2)
          ctx.stroke()
        }
      }
    }

    let raf = 0
    const loop = (t) => {
      draw(t / 1000)
      if (!reduced) raf = requestAnimationFrame(loop)
    }
    if (reduced) draw(2.5)
    else raf = requestAnimationFrame(loop)

    const onResize = () => {
      if (!raf) raf = requestAnimationFrame(loop)
    }
    const onVis = () => {
      cancelAnimationFrame(raf)
      raf = 0
      if (!document.hidden && !reduced) raf = requestAnimationFrame(loop)
    }
    window.addEventListener('resize', onResize)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  return <canvas ref={ref} className="space-backdrop" aria-hidden="true" />
}
