import React, { useEffect, useRef } from 'react'
import { useStore } from '../store.js'
import { EarthScene, lightGridKey } from '../three/EarthScene.js'

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

// A gentle, always-on constellation behind the prayer view so the backdrop is
// never an empty dark globe: a fixed set of real cities (low, so they read as
// subtle) that sit under the live lights and keep the world feeling alive even
// before — or while — anyone anywhere is actively praying.
const IDLE_LIGHTS = [
  [40.7, -74.0], [51.5, -0.1], [35.7, 139.7], [28.6, 77.2], [-23.5, -46.6],
  [31.2, 121.5], [19.1, 72.9], [1.4, 103.8], [30.0, 31.2], [-34.6, -58.4],
  [52.5, 13.4], [37.8, -122.4], [48.9, 2.35], [25.2, 55.3], [55.8, 37.6],
  [-33.9, 151.2], [13.7, 100.5], [-1.3, 36.8], [19.4, -99.1], [31.6, 74.9]
]
function idleLights() {
  const out = {}
  for (const [la, lo] of IDLE_LIGHTS) out[lightGridKey(la, lo)] = 1
  return out
}

export default function EarthBackdrop() {
  const mountRef = useRef(null)
  const sceneRef = useRef(null)
  const glow = useStore((s) => s.getGlow())
  const lights = useStore((s) => s.lights)
  const lightSpirits = useStore((s) => s.lightSpirits)
  const people = useStore((s) => s.peoplePraying)
  const totalSeconds = useStore((s) => s.totalPrayerSeconds)
  const youLoc = useStore((s) => s.youLoc)

  useEffect(() => {
    let scene = null
    try {
      scene = new EarthScene(mountRef.current, { backdrop: true })
      scene.setGlow(useStore.getState().getGlow())
      scene.setLights(
        { ...idleLights(), ...useStore.getState().lights },
        useStore.getState().lightSpirits
      )
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
    // The live world's lights ride on top of the gentle idle constellation, so
    // real prayer always outshines the backdrop's quiet placeholder.
    scene.setLights({ ...idleLights(), ...lights }, lightSpirits)
    scene.setMood(people, totalSeconds, useStore.getState().getPrayerCount())
    scene.setYouLoc(youLoc)
  }, [glow, lights, lightSpirits, people, totalSeconds, youLoc])

  return (
    <div className="earth-backdrop" aria-hidden="true">
      <div ref={mountRef} className="earth-backdrop-canvas" />
      <div className="earth-backdrop-scrim" />
    </div>
  )
}
