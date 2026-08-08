import React, { useEffect, useRef } from 'react'
import { useStore } from '../store.js'
import { EarthScene } from '../three/EarthScene.js'

// A quiet, translucent Earth behind the prayer view. Its coastlines glow a
// little brighter as collective prayer accumulates, it rotates slowly, and it
// carries every prayer light in the world behind the words — a subtle, living
// reminder that the whole world is praying together.
//
// Low-power devices (or reduced-motion) get a static starfield instead of the
// live WebGL scene: the backdrop render loop + audio together freeze old
// devices the moment play is pressed. The static stars are drawn once onto a
// plain 2D canvas — no animation loop, no WebGL — so even a slow phone sees a
// quiet night sky with the earth's glow, just frozen.
const isLowPower = () =>
  (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) ||
  (typeof navigator !== 'undefined' && navigator.hardwareConcurrency <= 4)

// Draw a fixed field of stars (a few warmer ones among cool white) onto a 2D
// canvas once. Re-drawn only on resize; never animated. Deterministic enough
// per draw, cheap on every device.
function drawStaticStars(canvas) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
  const w = canvas.clientWidth || window.innerWidth
  const h = canvas.clientHeight || window.innerHeight
  canvas.width = Math.round(w * dpr)
  canvas.height = Math.round(h * dpr)
  ctx.scale(dpr, dpr)
  ctx.clearRect(0, 0, w, h)
  const count = w * h > 900000 ? 420 : 260
  let seed = 7
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return seed / 0x7fffffff
  }
  for (let i = 0; i < count; i++) {
    const x = rnd() * w
    const y = rnd() * h
    const r = 0.5 + rnd() * 1.1
    const warm = rnd() < 0.14
    const a = 0.25 + rnd() * 0.55
    ctx.fillStyle = warm ? `rgba(255, 236, 200, ${a})` : `rgba(210, 226, 255, ${a})`
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
}

export default function EarthBackdrop() {
  const mountRef = useRef(null)
  const staticRef = useRef(null)
  const sceneRef = useRef(null)
  const glow = useStore((s) => s.getGlow())
  const lights = useStore((s) => s.lights)
  const lightSpirits = useStore((s) => s.lightSpirits)
  const people = useStore((s) => s.peoplePraying)
  const totalSeconds = useStore((s) => s.totalPrayerSeconds)
  const youLoc = useStore((s) => s.youLoc)

  useEffect(() => {
    if (isLowPower()) {
      const canvas = staticRef.current
      if (!canvas) return
      drawStaticStars(canvas)
      let raf = 0
      const onResize = () => {
        cancelAnimationFrame(raf)
        raf = requestAnimationFrame(() => drawStaticStars(canvas))
      }
      window.addEventListener('resize', onResize)
      return () => {
        cancelAnimationFrame(raf)
        window.removeEventListener('resize', onResize)
      }
    }
    let scene = null
    try {
      scene = new EarthScene(mountRef.current, { backdrop: true })
      scene.setGlow(useStore.getState().getGlow())
      scene.setLights(useStore.getState().lights, useStore.getState().lightSpirits)
      scene.setYouLoc(useStore.getState().youLoc)
    } catch {}
    sceneRef.current = scene
    return () => {
      if (scene) scene.dispose()
      sceneRef.current = null
    }
  }, [])

  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return
    scene.setGlow(glow)
    scene.setLights(lights, lightSpirits)
    scene.setMood(people, totalSeconds, useStore.getState().getPrayerCount())
    scene.setYouLoc(youLoc)
  }, [glow, lights, lightSpirits, people, totalSeconds, youLoc])

  return (
    <div className="earth-backdrop" aria-hidden="true">
      <canvas ref={staticRef} className="earth-backdrop-canvas earth-backdrop-static" />
      <div ref={mountRef} className="earth-backdrop-canvas" />
      <div className="earth-backdrop-scrim" />
    </div>
  )
}
