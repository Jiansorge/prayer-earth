import React, { useEffect, useMemo, useRef } from 'react'
import { useStore } from '../store.js'
import { EarthScene } from '../three/EarthScene.js'

// A quiet, translucent Earth behind the prayer view. Its coastlines glow a
// little brighter as collective prayer accumulates, it rotates slowly, and it
// lights up at the places around the world praying this same tradition right
// now — your own light joins them the moment you pray.
export default function EarthBackdrop() {
  const mountRef = useRef(null)
  const sceneRef = useRef(null)
  const glow = useStore((s) => s.getGlow())
  const lights = useStore((s) => s.lights)
  const lightSpirits = useStore((s) => s.lightSpirits)
  const spiritId = useStore((s) => s.spiritId)
  const people = useStore((s) => s.peoplePraying)
  const totalSeconds = useStore((s) => s.totalPrayerSeconds)
  const youLoc = useStore((s) => s.youLoc)

  // Only the prayer lights for the tradition currently on screen: the shared
  // world tracks a coarse spirit per cell, so show those who are praying this
  // tradition now.
  const spiritLights = useMemo(() => {
    if (!lights || !lightSpirits) return lights
    const out = {}
    for (const [cell, n] of Object.entries(lights)) {
      if (lightSpirits[cell] === spiritId) out[cell] = n
    }
    return out
  }, [lights, lightSpirits, spiritId])

  useEffect(() => {
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
    scene.setLights(spiritLights, lightSpirits)
    scene.setMood(people, totalSeconds, useStore.getState().getPrayerCount())
    scene.setYouLoc(youLoc)
  }, [glow, spiritLights, lightSpirits, people, totalSeconds, youLoc])

  return (
    <div className="earth-backdrop" aria-hidden="true">
      <div ref={mountRef} className="earth-backdrop-canvas" />
      <div className="earth-backdrop-scrim" />
    </div>
  )
}
