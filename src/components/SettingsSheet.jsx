import React, { useEffect, useRef, useState } from 'react'
import { useStore } from '../store.js'
import { speech, CHANT_VOICE } from '../audio/speech.js'
import { ambient } from '../audio/ambience.js'
import { SPIRITUALITY_BY_ID } from '../data/prayers.js'
import { useT, LOCALES } from '../i18n.js'
import QRCard from './QRCard.jsx'

const isInstalled = () =>
  window.matchMedia('(display-mode: standalone)').matches || !!window.navigator.standalone

// Nature avatars and light colours for your presence on the Earth.
const AVATARS = ['ðŸŒ¿', 'ðŸŒ™', 'ðŸŒº', 'ðŸ•Šï¸', 'ðŸŒŠ', 'â›°ï¸', 'ðŸŒ¾', 'ðŸ¦‹', 'â˜€ï¸', 'ðŸƒ', 'ðŸš', 'ðŸŒŸ', 'ðŸŒ¸', 'ðŸ', 'ðŸª·', 'ðŸ”¥']
const COLORS = ['#7fc9a0', '#dfb05c', '#7aa2ff', '#ff9e4f', '#ffd166', '#b09dff', '#e8b06f', '#7fd488']

export default function SettingsSheet() {
  const open = useStore((s) => s.settingsOpen)
  const setOpen = useStore((s) => s.setSettingsOpen)
  const voiceURI = useStore((s) => s.voiceURI)
  const setVoiceURI = useStore((s) => s.setVoiceURI)
  const speechRate = useStore((s) => s.speechRate)
  const setSpeechRate = useStore((s) => s.setSpeechRate)
  const ambienceLevel = useStore((s) => s.ambienceLevel)
  const setAmbienceLevel = useStore((s) => s.setAmbienceLevel)
  const locale = useStore((s) => s.locale)
  const setLocale = useStore((s) => s.setLocale)
  const profile = useStore((s) => s.profile)
  const setProfile = useStore((s) => s.setProfile)
  const spiritId = useStore((s) => s.spiritId)
  const prayerId = useStore((s) => s.prayerId)
  const t = useT()

  const [voices, setVoices] = useState([])
  const [qrOpen, setQrOpen] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [appCopied, setAppCopied] = useState(false)
  const previewTimer = useRef(null)

  const spirit = SPIRITUALITY_BY_ID[spiritId]
  const prayer = spirit?.prayers.find((p) => p.id === prayerId) || null

  const preview = () => {
    speech.preview()
    setPreviewing(true)
    clearTimeout(previewTimer.current)
    previewTimer.current = setTimeout(() => setPreviewing(false), 1800)
  }

  const shareApp = async () => {
    const url = window.location.origin
    const text = `Prayer Earth â€” pray with the whole world, in every tradition. Join me: ${url}`
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Prayer Earth', text, url })
        return
      }
    } catch {}
    try {
      await navigator.clipboard.writeText(url)
      setAppCopied(true)
      setTimeout(() => setAppCopied(false), 2000)
    } catch {}
  }

  useEffect(() => () => clearTimeout(previewTimer.current), [])

  useEffect(() => {
    const load = () => setVoices([...speech.voices])
    load()
    if (window.speechSynthesis?.addEventListener) {
      window.speechSynthesis.addEventListener('voiceschanged', load)
      return () => window.speechSynthesis.removeEventListener('voiceschanged', load)
    }
  }, [])

  useEffect(() => {
    if (open && ambient.ctx) ambient.setLevel(0.4)
  }, [open])

  if (!open) return null

  const local = voices.filter((v) => v.localService)
  const remote = voices.filter((v) => !v.localService)
  const grouped = [...local, ...remote]

  return (
    <div className="sheet-backdrop" onClick={() => setOpen(false)}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <h3 className="sheet-title">{t('settings.title')}</h3>

        <label className="field-label" htmlFor="voice-picker">{t('settings.voiceLabel')}</label>
        <div className="field-hint">
          {t('settings.voiceHint')}
        </div>
        <select
          id="voice-picker"
          className="field-select"
          value={voiceURI || ''}
          onChange={(e) => setVoiceURI(e.target.value || null)}
        >
          <option value="">{t('settings.automatic')}</option>
          <option value={CHANT_VOICE}>{t('settings.softChant')}</option>
          {grouped.map((v) => (
            <option key={v.voiceURI} value={v.voiceURI}>
              {v.name} ({v.lang})
            </option>
          ))}
        </select>
        {grouped.length === 0 && (
          <div className="field-hint">{t('settings.noVoices')}</div>
        )}
        <button
          className="field-preview"
          onClick={preview}
          aria-label={t('settings.hearSample')}
        >
          {previewing ? t('settings.listening') : t('settings.hearSample')}
        </button>

        <label className="field-label" htmlFor="rate-range">{t('settings.speedLabel')}</label>
        <input
          id="rate-range"
          type="range"
          className="field-range"
          min="0.6"
          max="2.5"
          step="0.05"
          value={speechRate}
          onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
        />
        <div className="field-row">
          <span className="field-hint">{t('settings.speedSlow', { n: speechRate.toFixed(2) })}</span>
          <span className="field-hint">{t('settings.speedFast')}</span>
        </div>

        <label className="field-label" htmlFor="amb-range">{t('settings.ambientLabel')}</label>
        <div className="field-hint">{t('settings.ambientHint')}</div>
        <input
          id="amb-range"
          type="range"
          className="field-range"
          min="0"
          max="1"
          step="0.05"
          value={ambienceLevel}
          onChange={(e) => setAmbienceLevel(parseFloat(e.target.value))}
        />
        <div className="field-row">
          <span className="field-hint">{t('settings.ambientLow')}</span>
          <span className="field-hint">{t('settings.ambientHigh')}</span>
        </div>

        <label className="field-label" htmlFor="locale-picker">{t('settings.languageLabel')}</label>
        <select
          id="locale-picker"
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

        <div className="field-divider" />

        <label className="field-label">{t('profile.title')}</label>
        <div className="field-hint">{t('profile.nameHint')}</div>
        <input
          id="profile-name"
          className="field-input"
          maxLength={20}
          value={profile.name}
          placeholder={t('profile.namePlaceholder')}
          onChange={(e) => setProfile({ name: e.target.value })}
        />

        <label className="field-label">{t('profile.avatar')}</label>
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

        <div className="field-divider" />

        <label className="field-label">{t('settings.sharePrayerLabel')}</label>
        <div className="field-hint">
          {prayer
            ? t('settings.sharePrayerHint', { title: prayer.title })
            : t('settings.sharePrayerHintNone')}
        </div>
        <button
          className="field-btn"
          disabled={!prayer}
          onClick={() => setQrOpen(true)}
        >
          {t('settings.showQr')}
        </button>

        <div className="field-divider" />

        <label className="field-label">{t('settings.shareAppLabel')}</label>
        <div className="field-hint">
          {t('settings.shareAppHint')}
        </div>
        <button className="field-btn" onClick={shareApp}>
          {appCopied ? t('settings.copied') : t('settings.shareApp')}
        </button>

        <div className="field-divider" />

        <label className="field-label">{t('install.text')}</label>
        <div className="field-hint">{t('install.ios')} <span aria-hidden>↗</span> {t('install.ios2')}</div>
        <button
          className="field-btn"
          onClick={() => {
            const p = window.__installPrompt
            if (p && p.prompt) {
              p.prompt()
              window.__installPrompt = null
            } else if (isInstalled()) {
              // already installed — nothing to do
            }
          }}
        >
          {t('install.button')}
        </button>

        <button className="sheet-close" onClick={() => setOpen(false)}>
          {t('settings.done')}
        </button>
      </div>

      {qrOpen && spirit && prayer && (
        <QRCard spirit={spirit} prayer={prayer} onClose={() => setQrOpen(false)} />
      )}
    </div>
  )
}
