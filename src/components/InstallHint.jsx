import React, { useEffect, useState } from 'react'
import { useT } from '../i18n.js'

let prompted = false

// A phone/tablet — desktop users can find Install in Settings instead.
function isMobile() {
  return (
    /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints > 0 && window.innerWidth < 900)
  )
}

export default function InstallHint() {
  const [kind, setKind] = useState(null)
  const [deferred, setDeferred] = useState(null)
  const t = useT()

  useEffect(() => {
    if (prompted || !isMobile()) return
    const ios =
      /iphone|ipad|ipod/i.test(navigator.userAgent) &&
      !window.navigator.standalone &&
      !window.matchMedia('(display-mode: standalone)').matches
    if (ios) {
      prompted = true
      setKind('ios')
      return
    }
    const onPrompt = (e) => {
      if (prompted) return
      prompted = true
      e.preventDefault()
      setDeferred(e)
      window.__installPrompt = e // also reachable from Settings
      setKind('install')
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  if (!kind) return null

  const install = async () => {
    if (deferred && deferred.prompt) {
      await deferred.prompt()
      setKind(null)
    }
  }

  return (
    <div className="install-hint">
      {kind === 'ios' ? (
        <p className="install-hint-text">
          {t('install.ios')} <span aria-hidden>↗</span> {t('install.ios2')}
        </p>
      ) : (
        <>
          <p className="install-hint-text">{t('install.text')}</p>
          <button className="install-hint-btn" onClick={install}>
            {t('install.button')}
          </button>
        </>
      )}
      <button
        className="install-hint-x"
        onClick={() => setKind(null)}
        aria-label={t('install.dismiss')}
      >
        ×
      </button>
    </div>
  )
}
