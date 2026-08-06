import React, { useEffect, useRef, useState } from 'react'
import { useStore } from '../store.js'
import { EarthScene } from '../three/EarthScene.js'
import WorldFeed from '../components/WorldFeed.jsx'
import { useT } from '../i18n.js'

export default function EarthPage() {
  const mountRef = useRef(null)
  const sceneRef = useRef(null)
  const [webglFail, setWebglFail] = useState(false)
  const [ready, setReady] = useState(false)
  const glowPct = useStore((s) => Math.round(s.getGlow() * 100))
  const people = useStore((s) => s.peoplePraying)
  const totalSeconds = useStore((s) => s.totalPrayerSeconds)
  const connected = useStore((s) => s.connected)
  const lights = useStore((s) => s.lights)
  const lightSpirits = useStore((s) => s.lightSpirits)
  const youLoc = useStore((s) => s.youLoc)
  const [, force] = useState(0)
  const t = useT()

  useEffect(() => {
    let scene = null
    try {
      scene = new EarthScene(mountRef.current, { onReady: () => setReady(true) })
      sceneRef.current = scene
      scene.setGlow(useStore.getState().getGlow())
      scene.setLights(useStore.getState().lights, useStore.getState().lightSpirits)
    } catch {
      setWebglFail(true)
      setReady(true)
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
    scene.setMood(people, totalSeconds, useStore.getState().getPrayerCount())
    scene.setYouLoc(youLoc)
  }, [glowPct, lights, lightSpirits, people, totalSeconds, youLoc])

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
      <div ref={mountRef} className="earth-canvas" role="img" aria-label={t('earth.title')} />
      {!ready && (
        <div className="earth-loading-overlay">
          <div className="earth-loading-inner">
            <img className="earth-loading-icon" src="/icons/icon-512.png" alt="" />
            <p className="subtitle">{t('earth.loading')}</p>
          </div>
        </div>
      )}
      <div className="earth-vignette" />
      <div className="earth-hud">
        <div className="eh-top fade-in">
          <h1>{t('earth.title')}</h1>
          <p>{t('earth.sub')}</p>
        </div>
        <div className="eh-bottom fade-in">
          <div className="eh-glow-pct">{glowPct}%</div>
          <div className="eh-glow-label">{t('meter.toMillion')}</div>
          <div className="eh-caption">
            {connected
              ? people === 1
                ? t('earth.soulNow')
                : t('earth.soulsNow', { n: people })
              : t('earth.quietCompany')}          </div>
        </div>
        <WorldFeed limit={8} compact />
      </div>
    </div>
  )
}
