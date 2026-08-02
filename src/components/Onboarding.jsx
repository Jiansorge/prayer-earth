import React, { useState } from 'react'
import { useStore } from '../store.js'
import { useT } from '../i18n.js'

const KEY = 'pe-onboarded'

// A first taste of the nature avatars — the same set as in Settings.
const AVATARS = ['🌿', '🌙', '🌺', '🕊️', '🌊', '⛰️', '🌾', '🦋', '☀️', '🍃', '🐚', '🌟', '🌸', '🍁', '🪷', '🔥']

export default function Onboarding() {
  const view = useStore((s) => s.view)
  const profile = useStore((s) => s.profile)
  const setProfile = useStore((s) => s.setProfile)
  const t = useT()
  const [shown, setShown] = useState(() => {
    try {
      return !localStorage.getItem(KEY)
    } catch {
      return false
    }
  })

  if (view !== 'home' || !shown) return null

  const done = () => {
    try {
      localStorage.setItem(KEY, '1')
    } catch {}
    setShown(false)
  }

  const steps = [
    { emoji: '🕊️', title: t('onboard.s1'), body: t('onboard.s1b') },
    { emoji: '🌍', title: t('onboard.s2'), body: t('onboard.s2b') },
    { emoji: '✨', title: t('onboard.s3'), body: t('onboard.s3b') }
  ]

  return (
    <div className="onboard-backdrop">
      <div className="onboard-card">
        <div className="onboard-logo">🌿</div>
        <h1 className="onboard-title">{t('onboard.title')}</h1>
        <p className="onboard-sub">{t('onboard.sub')}</p>
        <div className="onboard-steps">
          {steps.map((s, i) => (
            <div key={i} className="onboard-step">
              <div className="onboard-step-emoji">{s.emoji}</div>
              <div>
                <div className="onboard-step-title">{s.title}</div>
                <div className="onboard-step-body">{s.body}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="onboard-profile">
          <div className="onboard-step-title">{t('profile.title')}</div>
          <div className="onboard-step-body">{t('profile.nameHint')}</div>
          <input
            id="onboard-name"
            className="field-input"
            maxLength={20}
            value={profile.name}
            placeholder={t('profile.namePlaceholder')}
            onChange={(e) => setProfile({ name: e.target.value })}
          />
          <div className="avatar-grid">
            {AVATARS.map((a) => (
              <button
                key={a}
                type="button"
                className={`avatar-btn ${profile.avatar === a ? 'on' : ''}`}
                onClick={() => setProfile({ avatar: a })}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        <button className="onboard-begin" onClick={done}>
          {t('onboard.begin')}
        </button>
        <button className="onboard-skip" onClick={done}>
          {t('onboard.skip')}
        </button>
      </div>
    </div>
  )
}
