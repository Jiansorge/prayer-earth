// The tune sheet behind the gear button: recitation voice chips, the shared
// sound controls, and the repeat switch. The outside-tap and Escape handling
// live in the page (they need the sheet's open state alongside the rest of
// the page's keyboard behavior).
import React from 'react'
import { useT } from '../i18n.js'
import { useStore } from '../store.js'
import { isAppShell } from '../shared/mobile.js'
import SoundControls from './SoundControls.jsx'

// Human names for the locales that can sit beside their own script in a single
// prayer's voice list. Only reached when a prayer ships more than one
// recitation, so a short map beats pulling in a whole locale database.
const VOICE_LANGS = {
  zh: '中文',
  yue: '粵語',
  en: 'English',
  hi: 'हिन्दी',
  ja: '日本語',
  ko: '한국어',
  ar: 'العربية',
  fr: 'Français',
  de: 'Deutsch',
  es: 'Español',
  pt: 'Português',
  ru: 'Русский',
  it: 'Italiano'
}

export default function PrayerTuneSheet({ tuning, setTuning, prayer, prayerVoices, chosenVoice, pickVoice, muted, loopOn, toggleLoop }) {
  const t = useT()

  const friendlyVoice = (v) =>
    String(v).replace(/^[a-z]{2,3}-[A-Z]{2,3}-/i, '').replace(/Neural$/, '')

  // When a prayer offers a second recitation, the chip names its language
  // first — otherwise two chips reading "Xiaoxiao" and "Ava" give the
  // listener nothing to tell the Chinese from the English.
  const voiceChipLabel = (v) => {
    const name = friendlyVoice(v)
    if (!prayer?.altLang) return name
    const base = String(v).split('-')[0]
    return `${VOICE_LANGS[base] || base} · ${name}`
  }
  return (
    <>
    {tuning && (
      <div
        className="prayer-tune fade-in"
        role="group"
        aria-label={t('prayer.tuneLabel')}
        tabIndex={-1}
        ref={(el) => el && el.focus()}
      >
        <button
          className="pt-close"
          onClick={() => setTuning(false)}
          aria-label={t('prayer.tuneClose')}
          title={t('prayer.tuneClose')}
        >
          ▼
        </button>
        {!isAppShell() && (
          <button
            className="pt-help"
            onClick={() => useStore.getState().setKeyboardHelpOpen(true)}
            aria-label={t('keys.help')}
            title={t('keys.help')}
          >
            ?
          </button>
        )}
        {prayerVoices.length > 1 && (
          <div className="pt-row pt-voices">
            <label className="pt-label" id="pt-voice-label">
              {/* A prayer that ships a second recitation is really offering a
                  language choice, so name it as one; otherwise the row is
                  just voices. */}
              {prayer?.altLang ? t('prayer.recitation') : t('prayer.voice')}
            </label>
            <div className="voice-chips" role="group" aria-labelledby="pt-voice-label">
              {prayerVoices.map((v) => {
                const active = (chosenVoice || prayerVoices[0]) === v
                return (
                  <button
                    key={v}
                    type="button"
                    className={`voice-chip ${active ? 'on' : ''}`}
                    onClick={() => pickVoice(v)}
                    aria-pressed={active}
                  >
                    {voiceChipLabel(v)}
                  </button>
                )
              })}
            </div>
          </div>
        )}
        {/* Shared sound controls (identical labels/order/behavior to Settings):
            prayer voice volume, ambient sound volume, speed, then the bed picker. */}
        <SoundControls layout="pt" />
        {muted && <div className="pt-muted">🔇 {t('prayer.muted')}</div>}
        <div className="pt-row">
          <label className="pt-label" htmlFor="pt-loop">{t('prayer.repeat')}</label>
          <button
            id="pt-loop"
            type="button"
            className={`switch ${loopOn ? 'on' : ''}`}
            role="switch"
            aria-checked={loopOn}
            onClick={toggleLoop}
          >
            <span className="switch-knob" />
          </button>
          <span className="pt-val">{loopOn ? '∞' : t('prayer.once')}</span>
        </div>
      </div>
    )}
    </>
  )
}
