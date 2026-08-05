import React, { useEffect, useRef } from 'react'
import { useStore } from '../store.js'
import { EarthScene } from '../three/EarthScene.js'

// A quiet, translucent Earth behind the prayer view. Its coastlines glow a
// little brighter as collective prayer accumulates, and soft lights appear at
// the places around the world praying right now, your own light joins them
// the moment you pray.
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
    scene.setMood(people, totalSeconds)
    scene.setYouLoc(youLoc)
  }, [glow, lights, lightSpirits, people, totalSeconds, youLoc])

  return (
    <div className="earth-backdrop" aria-hidden="true">
      <div ref={mountRef} className="earth-backdrop-canvas" />
      <div className="earth-backdrop-scrim" />
    </div>
  )
}
