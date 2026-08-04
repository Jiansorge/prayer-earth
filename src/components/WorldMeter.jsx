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

  return (
    <div className="card world-meter" style={{ marginTop: 18 }}>
      <div className="wm-row">
        <span className="wm-label">{t('meter.prayingNow')}</span>
        <span className="wm-value">{people}</span>
      </div>
      <div className="wm-bar">
        <div className="wm-bar-fill" style={{ width: `${Math.max(2, glowPct)}%` }} />
      </div>
      <div className="wm-row" style={{ marginTop: 8, marginBottom: 0 }}>
        <span className="wm-label">{t('meter.earthAlight')}</span>
        <span className="wm-value">{glowPct}%</span>
      </div>
      <div className="wm-row" style={{ marginTop: 8, marginBottom: 0 }}>
        <span className="wm-label">{t('meter.prayedToday')}</span>
        <span className="wm-value">{usersToday}</span>
        <span className="wm-label" style={{ marginInlineStart: 14 }}>
          {t('meter.prayedWeek')}
        </span>
        <span className="wm-value">{usersWeek}</span>
      </div>
      {!connected && (
        <p className="hint" style={{ marginTop: 8 }}>
          {t('meter.quietCompany')}
        </p>
      )}
    </div>
  )
}
