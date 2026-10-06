import React, { useEffect, useState } from 'react'
import { useStore } from '../store.js'
import { useT, LOCALES } from '../i18n.js'
import { sanitizeName } from '../shared/profanity.js'
import { syncClient } from '../sync/client.js'
import useFocusTrap from '../shared/useFocusTrap.js'

const KEY = 'pe-onboarded'

// A first taste of the nature avatars, the same set as in Settings.
const AVATARS = ['🌿', '🌙', '🌺', '🕊️', '🌊', '⛰️', '🌾', '🦋', '☀️', '🍃', '🐚', '🌟', '🌸', '🍁', '🪷', '🔥']

// Sharing is on by default now, so first run has to say so and offer the
// opposite. This is the only place that promise is made, which is why it sits in
// onboarding rather than being a line in the privacy policy that a user has to go
// looking for.
//
// The choice is the user's: keep it, or turn it off here. Either way it is
// recorded, so this never comes back, and turning it off here is exactly as
// available as the toggle in Privacy.
function PresenceChoice({ sharePresence, onChange }) {
  const t = useT()
  return (
    <div className="onboard-profile" data-testid="onboard-presence">
      <div className="onboard-step-title">{t('settings.presenceWelcomeTitle')}</div>
      <div className="onboard-step-body">{t('settings.presenceWelcomeBody')}</div>
      <div className="presence-row" style={{ marginTop: 10 }}>
        <input
          id="onboard-share-presence"
          type="checkbox"
          className="presence-toggle"
          checked={!!sharePresence}
          onChange={(e) => onChange(e.target.checked)}
          data-testid="onboard-presence-toggle"
        />
        <label htmlFor="onboard-share-presence" className="presence-label">
          <span className="presence-title">{t('settings.sharePresence')}</span>
        </label>
      </div>
      <div className="onboard-step-body" data-testid="onboard-presence-state">
        {sharePresence ? t('settings.privacyOn') : t('settings.privacyOff')}
      </div>
    </div>
  )
}

export default function Onboarding() {
  const view = useStore((s) => s.view)
  const profile = useStore((s) => s.profile)
  const setProfile = useStore((s) => s.setProfile)
  const locale = useStore((s) => s.locale)
  const setLocale = useStore((s) => s.setLocale)
  const sharePresence = useStore((s) => s.sharePresence)
  const setSharePresence = useStore((s) => s.setSharePresence)
  const markPresencePromptSeen = useStore((s) => s.markPresencePromptSeen)
  const t = useT()
  const [shown, setShown] = useState(() => {
    try {
      return !localStorage.getItem(KEY)
    } catch {
      return false
    }
  })
  const cardRef = useFocusTrap(shown && view === 'home')

  // Let Escape close the dialog.
  useEffect(() => {
    if (!shown) return
    const onKey = (e) => {
      if (e.key === 'Escape') done()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown])

  if (view !== 'home' || !shown) return null

  const done = () => {
    // Record that the choice was offered, so a dismissed or accepted prompt
    // never returns. Without this the default silently re-asserts itself on the
    // next launch for anyone who turned sharing off here.
    markPresencePromptSeen()
    try {
      localStorage.setItem(KEY, '1')
    } catch {}
    setShown(false)
  }

  // Route through the sync client, not just the store, so the consent change
  // takes effect immediately and any pending location request is withdrawn.
  const setPresence = (on) => syncClient.setPresenceSharing(on)

  const steps = [
    { emoji: '🕊️', title: t('onboard.s1'), body: t('onboard.s1b') },
    { emoji: '🌍', title: t('onboard.s2'), body: t('onboard.s2b') },
    { emoji: '✨', title: t('onboard.s3'), body: t('onboard.s3b') }
  ]

  return (
    <div className="onboard-backdrop">
      <div
        className="onboard-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboard-title"
        tabIndex={-1}
        ref={cardRef}
      >
        <div className="onboard-logo">🌿</div>
        <h1 id="onboard-title" className="onboard-title">{t('onboard.title')}</h1>
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

        <div className="onboard-language">
          <label className="onboard-step-title" htmlFor="onboard-locale">{t('settings.languageLabel')}</label>
          <select
            id="onboard-locale"
            className="field-select"
            value={locale}
            onChange={(e) => setLocale(e.target.value)}
          >
            {LOCALES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </div>

        <div className="onboard-profile">
          <label className="onboard-step-title" htmlFor="onboard-name">{t('profile.title')}</label>
          <div className="onboard-step-body">{t('profile.nameHint')}</div>
          <input
            id="onboard-name"
            className="field-input"
            maxLength={20}
            value={profile.name}
            placeholder={t('profile.namePlaceholder')}
            onChange={(e) => {
              const v = e.target.value
              // block vulgar or profane display names (matches SettingsSheet)
              if (sanitizeName(v) === '' && v.trim() !== '') return
              setProfile({ name: v.slice(0, 20) })
            }}
          />
          <div className="avatar-grid">
            {AVATARS.map((a) => (
              <button
                key={a}
                type="button"
                className={`avatar-btn ${profile.avatar === a ? 'on' : ''}`}
                aria-pressed={profile.avatar === a}
                aria-label={`${t('profile.title')} ${a}`}
                onClick={() => setProfile({ avatar: a })}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        <PresenceChoice sharePresence={sharePresence} onChange={setPresence} />

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
