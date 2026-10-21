import React from 'react'
import { useT } from '../i18n.js'
import { sanitizeName } from '../shared/profanity.js'

// Nature avatars and light colours for your presence on the Earth.
const AVATARS = ['🌿', '🌙', '🌺', '🕊️', '🌊', '⛰️', '🌾', '🦋', '☀️', '🍃', '🐚', '🌟', '🌸', '🍁', '🪷', '🔥']
const COLORS = ['#7fc9a0', '#dfb05c', '#7aa2ff', '#ff9e4f', '#ffd166', '#b09dff', '#e8b06f', '#7fd488']

export default function SettingsProfile({ profile, setProfile }) {
  const t = useT()
  return (
    <>
          <label className="field-label section">{t('profile.title')}</label>
  
          <div className="field-hint">{t('profile.nameHint')}</div>
          <input
            id="profile-name"
            className="field-input"
            maxLength={20}
            value={profile.name}
            placeholder={t('profile.namePlaceholder')}
            onChange={(e) => {
              const v = e.target.value
              // block vulgar or profane display names
              if (sanitizeName(v) === '' && v.trim() !== '') return
              setProfile({ name: v.slice(0, 20) })
            }}
          />
  
          <label className="field-label" htmlFor="avatar-grid">{t('profile.avatar')}</label>
          <div id="avatar-grid" className="avatar-grid">
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
  
          <label className="field-label">{t('profile.color')}</label>
          <div className="swatch-row">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={`swatch ${profile.color === c ? 'on' : ''}`}
                style={{ background: c }}
                onClick={() => setProfile({ color: c })}
                aria-label={c}
              />
            ))}
          </div>
    </>
  )
}
