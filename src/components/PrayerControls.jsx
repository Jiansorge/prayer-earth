// The main control bar: repeat, play/pause, stop, tune, and the vertical
// master fader.
import React from 'react'
import { useT } from '../i18n.js'
import { useStore } from '../store.js'
import { applyMute } from '../audio/mute.js'

export default function PrayerControls({ loopOn, toggleLoop, starting, playing, paused, togglePlay, stopJob, tuning, setTuning, volume, muted, setLiveVolume }) {
  const t = useT()
  return (
    <div className="controls">
      <button
        className={`ctrl-btn repeat ${loopOn ? 'on' : ''}`}
        onClick={toggleLoop}
        aria-label="Repeat"
        title={t('prayer.repeat')}
      >
        {'⟳\uFE0E'}
      </button>
      <button
        className={`ctrl-btn play ${starting ? 'starting' : ''}`}
        onClick={togglePlay}
        aria-label={starting ? t('prayer.loading') : playing ? t('prayer.pause') : t('prayer.pray')}
      >
        {starting ? <span className="play-spinner" aria-hidden="true" /> : (playing && !paused ? '❚❚' : '▶\uFE0E')}
      </button>
      <button
        className="ctrl-btn stop"
        onClick={stopJob}
        aria-label={t('prayer.stop')}
      >
        ◼
      </button>
      <button
        className={`ctrl-btn tune ${tuning ? 'on' : ''}`}
        onClick={() => setTuning(!tuning)}
        aria-label={t('prayer.tuneLabel')}
        title={t('prayer.tune')}
      >
        {'\u2699\uFE0E'}
      </button>
      <div className="vol-vert" role="group" aria-label={t('prayer.volume')}>
        <span className="vol-vert-icon" aria-hidden="true">
          {volume <= 0 ? '🔇' : volume < 0.4 ? '🔉' : '🔊'}
        </span>
        <input
          className="vol-slider-vert"
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={muted ? 0 : volume}
          onChange={(e) => {
            const v = parseFloat(e.target.value)
            setLiveVolume(v)
            if (muted && v > 0) {
              // Seed lastVolume with the chosen level BEFORE unmuting, else
              // applyMute(false) restores the pre-mute level and the thumb
              // snaps back (the bug SoundControls.onVoice already fixed).
              useStore.setState({ lastVolume: v })
              applyMute(false)
            }
          }}
          aria-label={t('prayer.volume')}
        />
      </div>
    </div>
  )
}
