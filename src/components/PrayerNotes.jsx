// The last two overlays: the streak celebration and the voice-unavailable
// note. Both are short-lived messages about the recitation itself.
import React from 'react'
import { useT } from '../i18n.js'

export default function PrayerNotes({ celebration, voiceNote, setVoiceNote, chantMode }) {
  const t = useT()
  return (
    <>
    {celebration > 0 && (
      <div className="streak-toast" role="status">
        🔥 {celebration} {t(celebration === 1 ? 'day.one' : 'day.other', { n: celebration })}
      </div>
    )}

    {voiceNote && (
      <div className="voice-note">
        <button
          className="voice-note-x"
          onClick={() => setVoiceNote(false)}
          aria-label={t('prayer.close')}
        >
          🕯️
        </button>
        <div className="voice-note-title">
          {chantMode ? t('prayer.softChant') : t('prayer.voiceUnavailable')}
        </div>
        <div className="voice-note-body">
          {t('prayer.voiceNoteBody')}
        </div>
      </div>
    )}
    </>
  )
}
