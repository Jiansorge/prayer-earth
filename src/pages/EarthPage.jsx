import React, { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useStore } from '../store.js'
import { EarthScene, supportsWebGL2 } from '../three/EarthScene.js'
import { useT } from '../i18n.js'

const WorldFeed = lazy(() => import('../components/WorldFeed.jsx'))

function StaticEarth() {
  return (
    <div className="earth-fallback" role="img" aria-label="Earth">
      <div className="earth-fallback-globe" />
    </div>
  )
}

export default function EarthPage() {
  const mountRef = useRef(null)
  const sceneRef = useRef(null)
  const [webglFail, setWebglFail] = useState(false)
  const [ready, setReady] = useState(false)
  const glowPct = useStore((s) => s.getGlowPercent())
  const fmtPct = (p) =>
    p >= 1 ? Math.round(p) : p >= 0.1 ? p.toFixed(1) : p.toFixed(2)
  const people = useStore((s) => s.peoplePraying)
  const totalSeconds = useStore((s) => s.totalPrayerSeconds)
  const connected = useStore((s) => s.connected)
  const lights = useStore((s) => s.lights)
  const lightSpirits = useStore((s) => s.lightSpirits)
  const youLoc = useStore((s) => s.youLoc)
  const t = useT()

  useEffect(() => {
    let scene = null
    if (!supportsWebGL2()) {
      setWebglFail(true)
      return undefined
    }
    try {
      scene = new EarthScene(mountRef.current, {
        onReady: () => setReady(true),
        onError: () => setWebglFail(true),
        onContextLost: () => setWebglFail(true)
      })
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
    const scene = sceneRef.current
    if (!scene) return
    scene.setGlow(useStore.getState().getGlow())
    scene.setLights(lights, lightSpirits)
    scene.setMood(people, totalSeconds, useStore.getState().getPrayerCount())
    scene.setYouLoc(youLoc)
  }, [glowPct, lights, lightSpirits, people, totalSeconds, youLoc])

  if (webglFail) {
    return (
      <div className="view earth-view">
        <StaticEarth />
        <div className="earth-vignette" />
        <div className="earth-hud">
          <div className="eh-top fade-in">
            <h1>{t('earth.title')}</h1>
            <p>{t('earth.sub')}</p>
          </div>
          <div className="eh-bottom fade-in">
            <div className="eh-glow-pct">{fmtPct(glowPct)}%</div>
            <div className="eh-glow-label">{t('meter.toMillion')}</div>
            <div className="eh-caption">
              {connected ? t('earth.soulsNow', { n: people }) : t('earth.quietCompany')}
            </div>
          </div>
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
            <img className="earth-loading-icon" src="/icons/icon-prayer-128.webp" srcSet="/icons/icon-prayer-128.webp 128w, /icons/icon-prayer-256.webp 256w" sizes="104px" alt="" />
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
          <div className="eh-glow-pct">{fmtPct(glowPct)}%</div>
          <div className="eh-glow-label">{t('meter.toMillion')}</div>
          <div className="eh-caption">
            {connected
              ? people === 1
                ? t('earth.soulNow', { n: people })
                : t('earth.soulsNow', { n: people })
              : t('earth.quietCompany')}          </div>
        </div>
        <Suspense fallback={null}>
          <WorldFeed limit={8} compact />
        </Suspense>
      </div>
    </div>
  )
}
