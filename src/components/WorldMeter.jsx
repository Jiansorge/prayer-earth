import React, { useEffect, useState } from 'react'
import { useStore } from '../store.js'
import { useT } from '../i18n.js'

export default function WorldMeter() {
  const people = useStore((s) => s.peoplePraying)
  const connected = useStore((s) => s.connected)
  const usersToday = useStore((s) => s.usersToday)
  const usersWeek = useStore((s) => s.usersWeek)
  const glowPct = useStore((s) => Math.round(s.getGlow() * 100))
  const [, force] = useState(0)
  const t = useT()

  useEffect(() => {
    const t = setInterval(() => force((x) => x + 1), 1000)
    return () => clearInterval(t)
  }, [])

  // numbers glow more as they grow (a soft gold halo scaled by magnitude)
  const glow = (n) => {
    const g = Math.min(1, Math.log10((n || 0) + 2) / 4)
    return {
      textShadow: `0 0 ${5 + g * 20}px rgba(232,196,122,${0.22 + g * 0.7})`
    }
  }

  return (
    <div className="card world-meter" style={{ marginTop: 18 }}>
      <div className="wm-row">
        <span className="wm-label">{t('meter.prayingNow')}</span>
        <span className="wm-value" style={glow(people)}>{people}</span>
      </div>
      <div className="wm-bar">
        <div className="wm-bar-fill" style={{ width: `${Math.max(2, glowPct)}%` }} />
      </div>
      <div className="wm-row" style={{ marginTop: 8, marginBottom: 0 }}>
        <span className="wm-label">{t('meter.toMillion')}</span>
        <span className="wm-value" style={glow(glowPct)}>{glowPct}%</span>
      </div>
      <div className="wm-row" style={{ marginTop: 8, marginBottom: 0 }}>
        <span className="wm-label">{t('meter.prayedToday')}</span>
        <span className="wm-value" style={glow(usersToday)}>{usersToday}</span>
        <span className="wm-label" style={{ marginInlineStart: 14 }}>
          {t('meter.prayedWeek')}
        </span>
        <span className="wm-value" style={glow(usersWeek)}>{usersWeek}</span>
      </div>
      {!connected && (
        <p className="hint" style={{ marginTop: 8 }}>
          {t('meter.quietCompany')}
        </p>
      )}
    </div>
  )
}
