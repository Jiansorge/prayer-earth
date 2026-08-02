import React, { useEffect, useRef, useState } from 'react'
import { useStore } from '../store.js'
import { EarthScene } from '../three/EarthScene.js'
import WorldFeed from '../components/WorldFeed.jsx'
import { useT } from '../i18n.js'

export default function EarthPage() {
  const mountRef = useRef(null)
  const sceneRef = useRef(null)
  const [webglFail, setWebglFail] = useState(false)
  const glowPct = useStore((s) => Math.round(s.getGlow() * 100))
  const people = useStore((s) => s.peoplePraying)
  const connected = useStore((s) => s.connected)
  const lights = useStore((s) => s.lights)
  const lightSpirits = useStore((s) => s.lightSpirits)
  const [, force] = useState(0)
  const t = useT()

  useEffect(() => {
    let scene = null
    try {
      scene = new EarthScene(mountRef.current)
      sceneRef.current = scene
      scene.setGlow(useStore.getState().getGlow())
      scene.setLights(useStore.getState().lights, useStore.getState().lightSpirits)
    } catch {
      setWebglFail(true)
    }
    return () => {
      if (scene) scene.dispose()
      sceneRef.current = null
    }
  }, [])

  useEffect(() => {
    const t = setInterval(() => force((x) => x + 1), 800)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return
    scene.setGlow(useStore.getState().getGlow())
    scene.setLights(lights, lightSpirits)
  }, [glowPct, lights, lightSpirits])

  if (webglFail) {
    const company = connected
      ? t('earth.failSouls', { people })
      : t('earth.failQuiet')
    return (
      <div className="view" style={{ display: 'grid', placeItems: 'center', textAlign: 'center' }}>
        <div className="card" style={{ maxWidth: 380 }}>
          <div style={{ fontSize: 44, marginBottom: 10 }}>🌍</div>
          <h2 style={{ fontFamily: 'var(--serif)', fontSize: 24, marginBottom: 10 }}>
            {t('earth.failTitle')}
          </h2>
          <p className="subtitle">
            {t('earth.failBody', { pct: glowPct, company })}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="view earth-view">
      <div ref={mountRef} className="earth-canvas" />
      <div className="earth-vignette" />
      <div className="earth-hud">
        <div className="eh-top fade-in">
          <h1>{t('earth.title')}</h1>
          <p>{t('earth.sub')}</p>
        </div>
        <div className="eh-bottom fade-in">
          <div className="eh-glow-pct">{glowPct}%</div>
          <div className="eh-caption">
            {connected ? t('earth.soulsNow', { people }) : t('earth.quietCompany')}          </div>
        </div>
        <WorldFeed limit={8} compact />
      </div>
    </div>
  )
}
