import React, { Component, Suspense, lazy, useEffect, useRef, useState } from 'react'
import { useStore } from './store.js'
import { syncClient } from './sync/client.js'
import { ambient } from './audio/ambience.js'
import HomePage from './pages/HomePage.jsx'
import PrayerPage from './pages/PrayerPage.jsx'
import Nav from './components/Nav.jsx'
import SettingsSheet from './components/SettingsSheet.jsx'
import InstallHint from './components/InstallHint.jsx'
import Onboarding from './components/Onboarding.jsx'
import PrayerPicker from './components/PrayerPicker.jsx'
import Scenery, { getScene } from './components/Scenery.jsx'
import { useT, RTL_LOCALES } from './i18n.js'

// The 3D Earth (three.js) is heavy — load it only when the Earth view opens.
const EarthPage = lazy(() => import('./pages/EarthPage.jsx'))
// The quiet Earth that sits behind the prayer view shares that same chunk.
const EarthBackdrop = lazy(() => import('./components/EarthBackdrop.jsx'))

class Boundary extends Component {
  constructor(props) {
    super(props)
    this.state = { err: false }
  }
  static getDerivedStateFromError() {
    return { err: true }
  }
  componentDidCatch() {
    // no-op — keep the app alive
  }
  render() {
    if (this.state.err) {
      return (
        <div className="view" style={{ display: 'grid', placeItems: 'center', textAlign: 'center' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--serif)', fontSize: 30, marginBottom: 12 }}>
              A little light flickered.
            </h1>
            <p className="subtitle" style={{ marginBottom: 20 }}>
              Something went quiet for a moment. The prayers are still there.
            </p>
            <button
              onClick={() => {
                this.setState({ err: false })
                useStore.setState({ view: 'home', praying: false })
              }}
              style={{
                border: 'none',
                padding: '12px 22px',
                borderRadius: 999,
                background: 'linear-gradient(135deg, var(--gold-soft), var(--gold))',
                color: '#0b1026',
                fontFamily: 'var(--sans)',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Return home
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export default function App() {
  const view = useStore((s) => s.view)
  const glowRef = useRef(0)
  const t = useT()

  // Flip the whole interface for right-to-left locales (e.g. Arabic).
  const locale = useStore((s) => s.locale)
  useEffect(() => {
    document.documentElement.dir = RTL_LOCALES.has(locale) ? 'rtl' : 'ltr'
    document.documentElement.lang = locale
  }, [locale])

  // Which scenic time of day the world is in right now.
  const [scene, setScene] = useState(getScene())
  useEffect(() => {
    const t = setInterval(() => setScene(getScene()), 60000)
    return () => clearInterval(t)
  }, [])

  // Begin the global connection and let the ambient engine breathe quietly.
  useEffect(() => {
    syncClient.start()
    ambient.setLevel(0.35)
    return () => {
      syncClient.stop()
      ambient.stop()
    }
  }, [])

  // Follow the pointer with the light so the UI feels alive.
  useEffect(() => {
    const move = (e) => {
      document.documentElement.style.setProperty('--mx', `${e.clientX}px`)
      document.documentElement.style.setProperty('--my', `${e.clientY}px`)
    }
    window.addEventListener('pointermove', move, { passive: true })
    return () => window.removeEventListener('pointermove', move)
  }, [])

  // Deep links: #/earth  or  #/pray/<spirit>/<prayer>
  useEffect(() => {
    const route = () => {
      const m = window.location.hash.match(/^#\/(\w+)(?:\/([^/]+)\/([^/]+))?/)
      if (!m) {
        useStore.getState().go('home')
        return
      }
      const [, view, sp, pr] = m
      if (view === 'earth') useStore.getState().go('earth')
      else if (view === 'pray' && sp && pr) useStore.getState().openPrayer(sp, pr)
    }
    route()
    window.addEventListener('hashchange', route)
    return () => window.removeEventListener('hashchange', route)
  }, [])

  // Keep the address bar in sync so the browser back/forward buttons work.
  // (Skip the very first render — route() owns the initial deep link.)
  const spiritId = useStore((s) => s.spiritId)
  const prayerId = useStore((s) => s.prayerId)
  const firstNav = useRef(true)
  useEffect(() => {
    if (firstNav.current) {
      firstNav.current = false
      return
    }
    let target = '#/'
    if (view === 'earth') target = '#/earth'
    else if (view === 'prayer' && spiritId && prayerId)
      target = `#/pray/${spiritId}/${prayerId}`
    if (window.location.hash !== target) {
      window.location.hash = target
    }
  }, [view, spiritId, prayerId])

  return (
    <div className="app" data-scene={scene}>
      <div className="sky" />
      <Scenery />
      <div className="glow-field" />
      <div className="fireflies" aria-hidden="true">
        {[...Array(10)].map((_, i) => (
          <span
            key={i}
            className="ff"
            style={{
              '--x': `${(i * 11 + 4) % 100}%`,
              '--d': `${14 + ((i * 7) % 12)}s`,
              '--delay': `${(i * 3.7) % 14}s`,
              '--o': 0.35 + ((i * 13) % 40) / 100,
              '--sway': `${((i % 5) - 2) * 22}px`
            }}
          />
        ))}
      </div>

      <Boundary>
        {view === 'prayer' && (
          <Suspense fallback={null}>
            <EarthBackdrop />
          </Suspense>
        )}
        {view === 'home' && <HomePage key="home" />}
        {view === 'prayer' && <PrayerPage key="prayer" />}
        {view === 'earth' && (
          <Suspense
            fallback={
              <div className="view earth-loading">
                <div className="earth-loading-inner">
                  <div className="earth-loading-dot" />
                  <p className="subtitle">{t('earth.loading')}</p>
                </div>
              </div>
            }
          >
            <EarthPage key="earth" />
          </Suspense>
        )}
      </Boundary>

      <Nav />
      <SettingsSheet />
      <InstallHint />
      <Onboarding />
      <PrayerPicker />
    </div>
  )
}
