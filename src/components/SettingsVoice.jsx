import React from 'react'
import { useT } from '../i18n.js'
import { CHANT_VOICE } from '../audio/speech.js'

// The fallback voice picker. Split out of the Look section and placed at the
// end of the settings sheet: it only matters for the few prayers with no
// recording, so it sat between the language picker and everything the sheet
// exists for. (Requested twice, Oct 20.)
export default function SettingsVoice({ voiceURI, setVoiceURI, grouped, previewing, preview }) {
  const t = useT()
  return (
    <>
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
          {voiceURI ? null : <div className="field-hint">{t('settings.automaticHint')}</div>}
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
    </>
  )
}
