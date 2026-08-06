import React, { useEffect, useState } from 'react'
import { useStore } from '../store.js'
import { SPIRITUALITIES } from '../data/prayers.js'
import WorldMeter from '../components/WorldMeter.jsx'
import WorldFeed from '../components/WorldFeed.jsx'
import Sparkles from '../components/Sparkles.jsx'
import { useT } from '../i18n.js'

const fmtLife = (s) => {
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  if (h > 0) return `${h}h ${m % 60}m`
  if (m > 0) return `${m}m ${s % 60}s`
  return `${s}s`
}

const dayKey = (t) =>
  `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(
    t.getUTCDate()
  ).padStart(2, '0')}`

export default function HomePage() {
  const go = useStore((s) => s.go)
  const openPrayerPicker = useStore((s) => s.openPrayerPicker)
  const connected = useStore((s) => s.connected)
  const spiritCounts = useStore((s) => s.spiritCounts)
  const setSettingsOpen = useStore((s) => s.setSettingsOpen)
  const localPrayerSeconds = useStore((s) => s.localPrayerSeconds)
  const streak = useStore((s) => s.streak)
  const bestStreak = useStore((s) => s.bestStreak)
  const lastPrayedDay = useStore((s) => s.lastPrayedDay)
  const profile = useStore((s) => s.profile)
  const [, force] = useState(0)
  const t = useT()

  useEffect(() => {
    const t = setInterval(() => force((x) => x + 1), 3000)
    return () => clearInterval(t)
  }, [])

  const missedToday = streak > 0 && !!lastPrayedDay && lastPrayedDay !== dayKey(new Date())

  return (
    <div className="view fade-in">
      <Sparkles count={18} />
      <div className="row" style={{ marginTop: 4 }}>
        <div>
          <h1 className="page-title">
            {t('home.title')}
          </h1>
          <p className="subtitle" style={{ marginTop: 10 }}>
            {t('home.sub')}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="settings-label-btn" onClick={() => setSettingsOpen(true)}>
            {t('settings.title')}
          </button>
          <button className="gear-btn" onClick={() => setSettingsOpen(true)} aria-label={t('settings.gear')} title={t('settings.gear')}>
            <span className="nav-icon">⚙︎</span>
          </button>
        </div>
      </div>

      <div className="world-meter">
        <WorldMeter />
      </div>

      <WorldFeed limit={10} />

      <div className="life-card">
        <span className="you-avatar" style={{ borderColor: profile.color }}>
          {profile.avatar}
        </span>
        <span className="you-name">{profile.name || t('profile.you')}</span>
        <span className="life-sep">·</span>
        <span className="life-dot" />
        <span>
          {t('home.carried', { time: fmtLife(localPrayerSeconds) })}
        </span>
        {streak > 0 && (
          <span className="streak-chip" title={t('home.bestStreak', { n: bestStreak })}>
            🔥 {t(streak === 1 ? 'day.one' : 'day.other', { n: streak })}
          </span>
        )}
      </div>

      {missedToday && (
        <div className="nudge">
          <span className="nudge-emoji">🕯️</span>
          <span>
            {t('home.nudge', { streak })}
          </span>
          <button
            className="nudge-go"
            onClick={() => go('prayer')}
            aria-label={t('home.prayStreak')}
          >
            {t('home.pray')}
          </button>
        </div>
      )}

      <div className="row" style={{ marginTop: 26, marginBottom: 2 }}>
        <h2 style={{ fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 600 }}>
          {t('home.sacredWords')}
        </h2>
        <span
          className="pulse-dot"
          style={{
            background: connected ? 'var(--accent-1)' : 'var(--ink-faint)',
            boxShadow: connected ? '0 0 12px var(--accent-1)' : 'none'
          }}
          title={connected ? 'Connected to the world' : 'Offline, in quiet company'}
        />
      </div>

      <div className="spirit-grid">
        {SPIRITUALITIES.map((s, i) => (
          <button
            key={s.id}
            className="tile fade-in"
            style={{
              '--tile-glow': s.glow,
              animationDelay: `${i * 60}ms`
            }}
            onClick={() => openPrayerPicker(s.id)}
          >
            <span className="tile-emoji">{s.emoji}</span>
            <span className="tile-name">{t(`trad.${s.id}.name`)}</span>
            <span className="tile-tagline">{t(`trad.${s.id}.tagline`)}</span>
            <span className="tile-prayers">
              {t(s.prayers.length === 1 ? 'home.prayers.one' : 'home.prayers.other', {
                n: s.prayers.length
              })}
            </span>
            <span className="tile-praying">
              {t('home.prayingNow', { n: spiritCounts[s.id] || 0 })}
            </span>
          </button>
        ))}
      </div>

      <p className="hint" style={{ marginTop: 26 }}>
        {t('home.hint')}
      </p>
    </div>
  )
}
