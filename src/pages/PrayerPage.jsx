import React, { useEffect, useRef, useState } from 'react'
import { useStore } from '../store.js'
import { SPIRITUALITY_BY_ID } from '../data/prayers.js'
import { speech } from '../audio/speech.js'
import { ambient } from '../audio/ambience.js'
import { syncClient } from '../sync/client.js'
import { useT } from '../i18n.js'
import PrayerStats from '../components/PrayerStats.jsx'

const fmt = (s) => {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`
}

// Scripts that read right-to-left — their original text must flow RTL even
// though the transliteration and meaning below stay left-to-right.
const RTL_LANGS = new Set(['ar', 'he', 'fa', 'ur', 'sd', 'dv'])

export default function PrayerPage() {
  const closePrayer = useStore((s) => s.closePrayer)
  const openPrayer = useStore((s) => s.openPrayer)
  const openPrayerPicker = useStore((s) => s.openPrayerPicker)
  const spiritId = useStore((s) => s.spiritId)
  const prayerId = useStore((s) => s.prayerId)
  const setPraying = useStore((s) => s.setPraying)
  const addLocalPrayer = useStore((s) => s.addLocalPrayer)
  const addPrayerSecond = useStore((s) => s.addPrayerSecond)
  const notePrayerComplete = useStore((s) => s.notePrayerComplete)
  const getPrayerTotal = useStore((s) => s.getPrayerTotal)
  const loopOn = useStore((s) => s.loopOn)
  const setLoopOn = useStore((s) => s.setLoopOn)
  const speechRate = useStore((s) => s.speechRate)
  const setSpeechRate = useStore((s) => s.setSpeechRate)
  const volume = useStore((s) => s.volume)
  const setVolume = useStore((s) => s.setVolume)
  const people = useStore((s) => s.peoplePraying)
  const prayerCounts = useStore((s) => s.prayerCounts)
  const spiritCounts = useStore((s) => s.spiritCounts)

  const spirit = SPIRITUALITY_BY_ID[spiritId]
  const [active, setActive] = useState(null)
  const [playing, setPlaying] = useState(false)
  const [paused, setPaused] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [finished, setFinished] = useState(false)
  const [copied, setCopied] = useState(false)
  const [chantMode, setChantMode] = useState(false)
  const [chantReason, setChantReason] = useState(null)
  const [voiceNote, setVoiceNote] = useState(false)
  const [tuning, setTuning] = useState(false)
  const [celebration, setCelebration] = useState(0)
  const celebrationTimer = useRef(null)
  const prayer = spirit ? spirit.prayers.find((p) => p.id === prayerId) : null
  const rtl = RTL_LANGS.has(prayer?.lang)
  const phrases = prayer ? prayer.phrases : []
  const prayerTotal = useStore((s) => (prayer ? s.getPrayerTotal(prayer.id) : 0))
  const t = useT()

  useEffect(() => {
    if (!spirit) {
      useStore.getState().go('home')
    }
  }, [spirit])

  useEffect(() => {
    setActive(null)
    setPlaying(false)
    setPaused(false)
    setElapsed(0)
    setFinished(false)
    setChantMode(false)
    setChantReason(null)
    setVoiceNote(false)
    setTuning(false)
    stopJob()
  }, [prayerId])

  const startJob = () => {
    stopJob()
    setActive(0)
    setPaused(false)
    setPlaying(true)
    setFinished(false)
    setVoiceNote(false)
    setPraying(true)
    syncClient.presenceNow()
    ambient.start()
    ambient.setLevel(0.9)
    ambient.ring(0.6)
    setElapsed(0)

    const opts = {
      phrases,
      lang: prayer.lang,
      rate: speechRate,
      loop: loopOn,
      gapMs: prayer.loop ? 1400 : 700,
      onPhrase: (i) => setActive(i),
      onFallback: (reason) => {
        setChantMode(true)
        setChantReason(reason)
        if (reason !== 'chosen') setVoiceNote(true)
      },
      onCycle: () => {
        ambient.ring(0.5)
        useStore.getState().markPrayedToday()
        notePrayerComplete(prayer.id)
        celebrateStreak()
      },
      onEnd: () => {
        useStore.getState().markPrayedToday()
        notePrayerComplete(prayer.id)
        celebrateStreak()
        setPlaying(false)
        setPraying(false)
        setFinished(true)
        setActive(null)
        setChantMode(false)
        setChantReason(null)
        ambient.setLevel(0.4)
        ambient.ring(0.8)
      }
    }
    speech.start(opts)
  }

  const celebrateStreak = () => {
    const s = useStore.getState()
    if (s.celebrateStreak > 0) {
      setCelebration(s.celebrateStreak)
      useStore.getState().clearCelebration()
      clearTimeout(celebrationTimer.current)
      celebrationTimer.current = setTimeout(() => setCelebration(0), 4200)
    }
  }

  useEffect(() => () => clearTimeout(celebrationTimer.current), [])

  // Keep the chosen prayer's chip in view when switching prayers or traditions.
  const chooserRef = useRef(null)
  useEffect(() => {
    const el = chooserRef.current
    if (!el) return
    const active = el.querySelector('.chip.on')
    if (active && active.scrollIntoView) {
      active.scrollIntoView({ inline: 'nearest', block: 'nearest' })
    }
  }, [prayerId, spiritId])

  const stopJob = () => {
    speech.stop()
    setPlaying(false)
    setPaused(false)
    setPraying(false)
    syncClient.presenceNow()
    setActive(null)
    setChantMode(false)
    setChantReason(null)
    ambient.setLevel(0.35)
  }

  // Count prayer seconds while playing
  useEffect(() => {
    if (!playing || !prayer) return
    const t = setInterval(() => {
      addLocalPrayer(1)
      addPrayerSecond(prayer.id)
      setElapsed((e) => e + 1)
    }, 1000)
    return () => clearInterval(t)
  }, [playing, prayer, addLocalPrayer, addPrayerSecond])

  // Always send the presence signal to the world when leaving
  useEffect(() => {
    return () => {
      setPraying(false)
      syncClient.presenceNow()
      speech.stop()
    }
  }, [setPraying])

  const togglePlay = () => {
    if (!playing) {
      startJob()
      return
    }
    if (!paused) {
      try {
        window.speechSynthesis.pause()
      } catch {}
      setPaused(true)
      ambient.setLevel(0.35)
    } else {
      try {
        window.speechSynthesis.resume()
      } catch {}
      setPaused(false)
      ambient.setLevel(0.9)
    }
  }

  const toggleLoop = () => {
    const next = !loopOn
    setLoopOn(next)
    if (playing) {
      const wasPlaying = playing
      stopJob()
      if (wasPlaying) {
        setTimeout(startJob, 120)
      }
    }
  }

  const setLiveVolume = (v) => {
    setVolume(v)
    ambient.setVolume(v)
  }

  const setLiveRate = (r) => {
    setSpeechRate(r)
    speech.setRate(r)
  }

  const share = async () => {
    const url = `${window.location.origin}/#/pray/${spiritId}/${prayerId}`
    const text = `${prayer.title} · ${spirit.name}. Pray with the world: ${url}`
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Prayer Earth', text, url })
        return
      }
    } catch {}
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  return (
    <div className="view prayer-page">
      <div className="back-row">
        <button onClick={closePrayer} aria-label={t('prayer.back')}>
          ←
        </button>
        <div>
          <div style={{ fontSize: 14, color: 'var(--ink-dim)' }}>
            {spirit.emoji} {t(`trad.${spirit.id}.name`)}
          </div>
          <div className="subtitle" style={{ fontSize: 13, marginTop: 2 }}>
            {t(`trad.${spirit.id}.tagline`)}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="pulse-dot" />
          <span style={{ fontSize: 13, color: 'var(--ink-dim)' }}>{t('prayer.peoplePraying', { n: people })}</span>
          <button className="share-btn" onClick={share} aria-label={t('prayer.share')} title={t('prayer.share')}>
            ⇪
          </button>
          {copied && <span className="copied-pill">{t('settings.copied')}</span>}
        </div>
      </div>

      <div className="chooser" ref={chooserRef}>
        <button
          className="chip chip-all"
          onClick={() => openPrayerPicker(spiritId)}
          title={t('picker.all')}
        >
          ☰ <span className="chip-all-label">{t('picker.all')}</span>
        </button>
        {spirit.prayers.map((p) => (
          <button
            key={p.id}
            className={`chip ${p.id === prayerId ? 'on' : ''}`}
            onClick={() => openPrayer(spiritId, p.id)}
          >
            {p.title}
            <span className={`chip-count ${p.id === prayerId ? 'on' : ''}`}>
              {prayerCounts[p.id] || 0}
            </span>
          </button>
        ))}
      </div>

      <div className="prayer-stage fade-in" key={prayer.id}>
        {prayer.loop && (
          <div className="loop-dots">
            {phrases.map((_, i) => (
              <span
                key={i}
                className={`loop-dot ${active === i ? 'lit' : ''}`}
              />
            ))}
          </div>
        )}

        <div className="prayer-title">{prayer.title}</div>
        <div className="prayer-sub">
          {prayer.langLabel} · {prayer.loop ? t('prayer.repeated') : t('prayer.recited')}
        </div>

        <div className="praying-now" title={t('prayer.prayingNowTitle')}>
          <span className="pulse-dot" />
          <b>{prayerCounts[prayer.id] || 0}</b>{' '}
          <span className="praying-now-rest">
            {t('prayer.prayingNowRest')}
            <span className="praying-now-sub">
              {t('prayer.across', { n: spiritCounts[spiritId] || 0, name: spirit.name })}
            </span>
          </span>
          <span className="praying-now-total" title={t('prayer.allTimeTitle')}>
            {t('prayer.allTime', { n: prayerTotal.toLocaleString() })}
          </span>
        </div>

        <div className="prayer-lines">
          {phrases.map((ph, i) => (
            <div
              key={i}
              className={`prayer-line ${active === i ? 'on' : ''}`}
              dir={rtl ? 'rtl' : 'ltr'}
              lang={prayer.lang}
            >
              <span className="hlt">{ph.t}</span>
              {ph.s && (
                <span className="sub">
                  {ph.s}
                </span>
              )}
              {ph.e && (
                <span className="en">
                  {ph.e}
                </span>
              )}
            </div>
          ))}
        </div>

        <div className="prayer-translation">{prayer.translation}</div>

        {finished && !playing && (
          <div className="done-card fade-in">
            <div className="done-emoji">🕊️</div>
            <div className="done-title">{t('prayer.doneTitle')}</div>
            <div className="done-sub">
              {t('prayer.doneSub', { time: fmt(elapsed) })}
            </div>
            <button onClick={() => setFinished(false)}>{t('prayer.keepListening')}</button>
          </div>
        )}

        <div className="controls">
          <button
            className={`ctrl-btn repeat ${loopOn ? 'on' : ''}`}
            onClick={toggleLoop}
            aria-label="Repeat"
            title={t('prayer.repeat')}
          >
            ⟳
          </button>
          <button
            className="ctrl-btn play"
            onClick={togglePlay}
            aria-label={playing ? t('prayer.pause') : t('prayer.pray')}
          >
            {playing && !paused ? '❚❚' : '▶'}
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
            ♪
          </button>
        </div>

        {tuning && (
          <div className="prayer-tune fade-in" aria-label={t('prayer.tuneLabel')}>
            <div className="pt-row">
              <label className="pt-label" htmlFor="pt-volume">{t('prayer.volume')}</label>
              <input
                id="pt-volume"
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={volume}
                onChange={(e) => setLiveVolume(parseFloat(e.target.value))}
              />
              <span className="pt-val">{Math.round(volume * 100)}%</span>
            </div>
            <div className="pt-row">
              <label className="pt-label" htmlFor="pt-rate">{t('prayer.speed')}</label>
              <input
                id="pt-rate"
                type="range"
                min="0.6"
                max="1.5"
                step="0.05"
                value={speechRate}
                onChange={(e) => setLiveRate(parseFloat(e.target.value))}
              />
              <span className="pt-val">{speechRate.toFixed(2)}×</span>
            </div>
          </div>
        )}

        {chantMode && (
          <div className="chant-pill">{t('prayer.softChant')}</div>
        )}

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
              ✕
            </button>
            <div className="voice-note-title">
              {chantMode ? t('prayer.softChant') : t('prayer.voiceUnavailable')}
            </div>
            <div className="voice-note-body">
              {t('prayer.voiceNoteBody')}
            </div>
          </div>
        )}
      </div>

      <PrayerStats prayerId={prayer.id} />
    </div>
  )
}
