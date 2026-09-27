// One source of truth for the sound controls, shared by Settings and the prayer
// mini-tune panel so the labels, ranges, and live-apply behavior can never drift
// between the two surfaces.
//
// Order (identical everywhere): Prayer voice volume, Ambient sound volume, Speed,
// then the ambient bed picker. Every slider applies live to the audio engines.

import React from 'react'
import { useStore } from '../store.js'
import { speech } from '../audio/speech.js'
import { ambient } from '../audio/ambience.js'
import { AMBIENT_PRESETS } from '../audio/presets.js'
import { applyMute } from '../audio/mute.js'
import { useT } from '../i18n.js'

export default function SoundControls({ layout = 'field', showBeds = true }) {
  const t = useT()
  const volume = useStore((s) => s.volume)
  const setVolume = useStore((s) => s.setVolume)
  const speechRate = useStore((s) => s.speechRate)
  const setSpeechRate = useStore((s) => s.setSpeechRate)
  const ambienceLevel = useStore((s) => s.ambienceLevel)
  const setAmbienceLevel = useStore((s) => s.setAmbienceLevel)
  const ambientPreset = useStore((s) => s.ambientPreset)
  const setAmbientPreset = useStore((s) => s.setAmbientPreset)
  const muted = useStore((s) => s.muted)

  // 'field' = Settings sheet styling, 'pt' = prayer mini-panel styling.
  const isPt = layout === 'pt'
  const labelCls = isPt ? 'pt-label' : 'field-label'
  const rowCls = isPt ? 'pt-row' : 'field-row-slider'
  const valCls = isPt ? 'pt-val' : 'field-hint'

  const onVoice = (v) => {
    setVolume(v)
    speech.setVolume(v)
    // Raising the voice while muted should unmute, so the two controls never
    // disagree (muted stayed true while audio was audible).
    if (muted && v > 0) applyMute(false)
  }
  const onAmbient = (v) => {
    setAmbienceLevel(v)
    // Re-apply so the bed is heard immediately, not just on the next play.
    ambient.setLevel(ambient.level)
  }
  const onSpeed = (r) => {
    setSpeechRate(r)
    speech.setRate(r)
  }
  const onBed = (id) => {
    setAmbientPreset(id)
    ambient.setPreset(id)
  }

  return (
    <>
      <div className={rowCls}>
        <label className={labelCls} htmlFor="sc-voice">{t('sound.prayerVoice')}</label>
        <input
          id="sc-voice"
          type="range"
          className="field-range"
          min="0"
          max="1"
          step="0.05"
          value={volume}
          onChange={(e) => onVoice(parseFloat(e.target.value))}
        />
        <span className={valCls}>{Math.round(volume * 100)}%</span>
      </div>
      <div className={rowCls}>
        <label className={labelCls} htmlFor="sc-ambient">{t('sound.ambient')}</label>
        <input
          id="sc-ambient"
          type="range"
          className="field-range"
          min="0"
          max="1"
          step="0.05"
          value={ambienceLevel}
          onChange={(e) => onAmbient(parseFloat(e.target.value))}
        />
        <span className={valCls}>{Math.round(ambienceLevel * 100)}%</span>
      </div>
      <div className={rowCls}>
        <label className={labelCls} htmlFor="sc-speed">{t('sound.speed')}</label>
        <input
          id="sc-speed"
          type="range"
          className="field-range"
          min="0.6"
          max="2.0"
          step="0.05"
          value={speechRate}
          onChange={(e) => onSpeed(parseFloat(e.target.value))}
        />
        <span className={valCls}>{speechRate.toFixed(2)}×</span>
      </div>
      {showBeds && (
        <>
          <div className={isPt ? 'pt-row' : 'field-label'}>
            <span className={isPt ? 'pt-label' : 'field-label'} id="sc-bed-label">
              {t('settings.ambientSound')}
            </span>
          </div>
          <div className="ambient-pick" role="group" aria-labelledby="sc-bed-label">
            {AMBIENT_PRESETS.map((id) => (
              <button
                key={id}
                type="button"
                className={`ambient-chip${ambientPreset === id ? ' on' : ''}`}
                onClick={() => onBed(id)}
                aria-pressed={ambientPreset === id}
              >
                {t(`ambience.${id}`)}
              </button>
            ))}
          </div>
        </>
      )}
    </>
  )
}
