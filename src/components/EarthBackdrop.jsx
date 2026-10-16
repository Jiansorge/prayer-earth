import React, { useEffect, useRef, useState } from 'react'
import { useStore } from '../store.js'
import { EarthScene, supportsWebGL2 } from '../three/EarthScene.js'
import StaticEarth from './StaticEarth.jsx'

// A quiet, translucent Earth behind the prayer view. Its coastlines glow a
// little brighter as collective prayer accumulates, it rotates slowly, and it
// carries every prayer light in the world behind the words — a subtle, living
// reminder that the whole world is praying together.
//
// Weak devices get a static starfield instead of the live WebGL scene: the
// backdrop render loop + audio together freeze old devices the moment play is
// pressed. That is a question about the hardware, not about how the app was
// packaged — an app build on a flagship phone has far more GPU than a browser
// tab on a five-year-old laptop. Shipping the static globe to every native
// build turned the prayer view into a different, smaller, dimmer Earth on
// exactly the devices that could afford the real one. Anything that does fail
// still falls back: `failed` covers a throw, a WebGL error, and a lost
// context, so a device that cannot hold the scene degrades the same way it
// always did, just on evidence rather than on packaging.
export default function EarthBackdrop() {
  const mountRef = useRef(null)
  const sceneRef = useRef(null)
  const [failed, setFailed] = useState(false)
  const [staticMode] = useState(
    () =>
      (typeof navigator !== 'undefined' && navigator.hardwareConcurrency <= 4) ||
      !supportsWebGL2()
  )
  const glow = useStore((s) => s.getGlow())
  const lights = useStore((s) => s.lights)
  const lightSpirits = useStore((s) => s.lightSpirits)
  const people = useStore((s) => s.peoplePraying)
  const totalSeconds = useStore((s) => s.totalPrayerSeconds)
  const youLoc = useStore((s) => s.youLoc)

  useEffect(() => {
    let scene = null
    if (staticMode || failed) return undefined
    try {
      scene = new EarthScene(mountRef.current, {
        backdrop: true,
        onError: () => setFailed(true),
        onContextLost: () => setFailed(true)
      })
      scene.setGlow(useStore.getState().getGlow())
      scene.setLights(useStore.getState().lights, useStore.getState().lightSpirits)
      scene.setYouLoc(useStore.getState().youLoc)
    } catch {}
    sceneRef.current = scene
    return () => {
      if (scene) scene.dispose()
      sceneRef.current = null
    }
  }, [staticMode, failed])

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
      {staticMode || failed ? (
        <StaticEarth compact />
      ) : (
        <div ref={mountRef} className="earth-backdrop-canvas" />
      )}
      <div className="earth-backdrop-scrim" />
    </div>
  )
}
