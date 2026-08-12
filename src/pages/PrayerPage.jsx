import React, { useEffect, useRef, useState } from 'react'
import { useStore } from '../store.js'
import { SPIRITUALITY_BY_ID, loadSpirit } from '../data/prayers.js'
import { speech } from '../audio/speech.js'
import { ambient } from '../audio/ambience.js'
import { syncClient } from '../sync/client.js'
import { useT, prayerTitle } from '../i18n.js'
import { tPrayer, tPhrase } from '../i18n/prayerL10n.js'
import PrayerStats from '../components/PrayerStats.jsx'
import Sparkles from '../components/Sparkles.jsx'
import { stopPlayback } from '../playback.js'
import { toggleMute, applyMute } from '../audio/mute.js'

const fmt = (s) => {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`
}

// Scripts that read right-to-left, their original text must flow RTL even
// though the transliteration and meaning below stay left-to-right.
const RTL_LANGS = new Set(['ar', 'he', 'fa', 'ur', 'sd', 'dv'])

export default function PrayerPage() {
  const closePrayer = useStore((s) => s.closePrayer)
  const openPrayer = useStore((s) => s.openPrayer)
  const openPrayerPicker = useStore((s) => s.openPrayerPicker)
  const spiritId = useStore((s) => s.spiritId)
  const prayerId = useStore((s) => s.prayerId)
  const setPraying = useStore((s) => s.setPraying)
  const playing = useStore((s) => s.playing)
  const setPlaying = useStore((s) => s.setPlaying)
  const paused = useStore((s) => s.paused)
  const setPaused = useStore((s) => s.setPaused)
  const setPlayingPrayerId = useStore((s) => s.setPlayingPrayerId)
  const pendingPlay = useStore((s) => s.pendingPlay)
  const notePrayerComplete = useStore((s) => s.notePrayerComplete)
  const getPrayerTotal = useStore((s) => s.getPrayerTotal)
  const loopOn = useStore((s) => s.loopOn)
  const setLoopOn = useStore((s) => s.setLoopOn)
  const speechRate = useStore((s) => s.speechRate)
  const setSpeechRate = useStore((s) => s.setSpeechRate)
  const setPrayerVoice = useStore((s) => s.setPrayerVoice)
  const chosenVoice = useStore((s) => (prayerId ? s.prayerVoices[prayerId] : null))
  const favorite = useStore((s) => (prayerId ? s.favorites.includes(prayerId) : false))
  const toggleFavorite = useStore((s) => s.toggleFavorite)
  const volume = useStore((s) => s.volume)
  const setVolume = useStore((s) => s.setVolume)
  const people = useStore((s) => s.peoplePraying)
  const prayerCount = useStore((s) => (prayerId ? s.prayerCounts[prayerId] || 0 : 0))
  const spiritCount = useStore((s) => (spiritId ? s.spiritCounts[spiritId] || 0 : 0))
  // Read the full objects once for the chooser chip loop (not reactive)
  const prayerCounts = useStore((s) => s.prayerCounts)

  const spirit = SPIRITUALITY_BY_ID[spiritId]
  const [active, setActive] = useState(null)
  const [prayerVoices, setPrayerVoices] = useState([])
  const [finished, setFinished] = useState(false)
  const [copied, setCopied] = useState(false)
  const [chantMode, setChantMode] = useState(false)
  const [chantReason, setChantReason] = useState(null)
  const [voiceNote, setVoiceNote] = useState(false)
  const muted = useStore((s) => s.muted)
  const [tuning, setTuning] = useState(false)
  const [starting, setStarting] = useState(false)
  const startAt = useRef(0)
  const startingRef = useRef(false)
  const [celebration, setCelebration] = useState(0)
  const celebrationTimer = useRef(null)
  const prayer = spirit ? (spirit.prayers || []).find((p) => p.id === prayerId) : null
  const [, reload] = useState(0)
  useEffect(() => {
    if (spiritId && !spirit?.prayers) loadSpirit(spiritId).then(() => reload((x) => x + 1))
  }, [spiritId])
  const rtl = RTL_LANGS.has(prayer?.lang)
  const phrases = prayer ? prayer.phrases : []
  const locale = useStore((s) => s.locale)
  const prayerToday = useStore((s) => (prayer ? s.getPrayerToday(prayer.id) : 0))
  const t = useT()

  useEffect(() => {
    if (!spirit) {
      useStore.getState().go('home')
    } else if (!prayer) {
      // Prayer texts may still be loading — no fallback yet.
    }
  }, [spirit, prayer])

  // One prayer at a time per browser: another tab starting playback pauses us.
  // BroadcastChannel also delivers to this same tab, so each message carries its
  // sender's tab id and we ignore our own.
  const TAB_ID = (window.__PE_TAB = window.__PE_TAB || Math.random().toString(36).slice(2))
  useEffect(() => {
    const ch = new BroadcastChannel('prayer-earth')
    ch.onmessage = (e) => {
      const m = e.data
      if (!m || m.type !== 'play' || m.from === TAB_ID) return
      const s = useStore.getState()
      // Another tab just started a prayer — one-at-a-time: pause us, and never
      // let our local "starting…" guard swallow it.
      if (s.playing && !s.paused) {
        speech.pause()
        s.setPaused(true)
        s.setPraying(false)
        syncClient.presenceNow()
        ambient.setLevel(0.35)
      }
    }
    return () => ch.close()
  }, [playing])

  // The footer play button from home/earth lands here ready to play. Runs both
  // when this page mounts AND when a play request arrives while already here
  // (e.g. after picking a prayer). Delayed a moment so React StrictMode's dev
  // remount (mount → unmount → mount) settles before starting.
  useEffect(() => {
    if (!pendingPlay) return
    const t = setTimeout(() => {
      if (useStore.getState().pendingPlay) {
        useStore.getState().setPendingPlay(false)
        startJob()
      }
    }, 60)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPlay])

  // Prayer keeps playing in the background even when the tab is hidden or the
  // user navigates to Home/Earth — no global pause on visibilitychange.
  useEffect(() => {
    // Reset only this page's view state when a different prayer is shown; a
    // prayer already playing in the background keeps playing (see togglePlay).
    setActive(null)
    useStore.getState().setElapsed(0)
    setFinished(false)
    setChantMode(false)
    setChantReason(null)
    setVoiceNote(false)
    setTuning(false)
  }, [prayerId])

  // Rehighlight the current phrase when the playing prayer advances, even if
  // this page mounted after playback already began (e.g. returning from Home
  // or the Earth while the prayer kept playing in the background).
  const currentPhrase = useStore((s) => s.currentPhrase)
  useEffect(() => {
    const s = useStore.getState()
    if (typeof currentPhrase === 'number' && s.playing && s.playingPrayerId === prayer?.id) {
      setActive(currentPhrase)
    }
  }, [currentPhrase, prayer?.id])

  // The static voice options for this prayer (from the pre-rendered audio).
  useEffect(() => {
    let on = true
    speech.loadAudioManifest().then((m) => {
      if (!on || !prayer) return
      const p = m && m.prayers ? m.prayers[prayer.id] : null
      setPrayerVoices(p && p.voices ? p.voices : [])
    })
    return () => {
      on = false
    }
  }, [prayer?.id])

  const startJob = (fromIndex = 0) => {
    stopJob()
    startAt.current = Date.now()
    startingRef.current = true
    setStarting(true)
    setActive(fromIndex)
    setPaused(false)
    setPlaying(true)
    setPlayingPrayerId(prayer.id)
    setFinished(false)
    setVoiceNote(false)
    setPraying(true)
    syncClient.presenceNow()
    ambient.start()
    ambient.setLevel(0.9)
    ambient.ring(0.6)
    if (fromIndex === 0) useStore.getState().setElapsed(0)
    try {
      new BroadcastChannel('prayer-earth').postMessage({ type: 'play', from: TAB_ID })
    } catch {}

    const opts = {
      phrases,
      index: fromIndex,
      lang: prayer.lang,
      prayerId: prayer.id,
      rate: speechRate,
      loop: loopOn,
      gapMs: prayer.loop ? 250 : 700,
      onPhrase: (i) => {
        // First phrase engaging means audio is actually starting — drop the
        // "starting…" spinner, but never before it has been visible ~350ms so
        // the tap always gives instant feedback even on fast devices.
        const waited = Date.now() - startAt.current
        if (waited >= 350) {
          startingRef.current = false
          setStarting(false)
        } else {
          setTimeout(() => {
            startingRef.current = false
            setStarting(false)
          }, 350 - waited)
        }
        // Track the phrase globally so returning to this page can rehighlight.
        useStore.getState().setCurrentPhrase(i)
        // Only highlight lines when this prayer is the one actually on screen.
        if (useStore.getState().prayerId === prayer.id) setActive(i)
        // A repeated mantra is one prayer per recitation, not per cycle.
        if (prayer.loop) notePrayerComplete(prayer.id)
      },
      onFallback: (reason) => {
        setChantMode(true)
        setChantReason(reason)
        if (reason !== 'chosen') setVoiceNote(true)
      },
      onCycle: () => {
        ambient.ring(0.5)
        useStore.getState().markPrayedToday()
        // each full round of a repeating prayer is a completed set too
        useStore.getState().setCompletedAt(Date.now())
        celebrateStreak()
      },
      onEnd: () => {
        useStore.getState().markPrayedToday()
        if (!prayer.loop) notePrayerComplete(prayer.id)
        useStore.getState().setCompletedAt(Date.now())
        celebrateStreak()
        setPlaying(false)
        setPraying(false)
        useStore.getState().setPlayingPrayerId(null)
        useStore.getState().setCurrentPhrase(null)
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

  // Hovering the prayer list, a vertical mouse-wheel scrolls it horizontally.
  useEffect(() => {
    const el = chooserRef.current
    if (!el) return
    const onWheel = (e) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        el.scrollLeft += e.deltaY
        e.preventDefault()
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // The voice/tune panel closes when you tap anywhere outside it.
  useEffect(() => {
    if (!tuning) return
    const onDoc = (e) => {
      if (e.target.closest && (e.target.closest('.prayer-tune') || e.target.closest('.ctrl-btn.tune'))) return
      setTuning(false)
    }
    document.addEventListener('pointerdown', onDoc)
    return () => document.removeEventListener('pointerdown', onDoc)
  }, [tuning])

  // Keyboard controls: Space play/pause, ↑/↓ volume, M mute, R repeat, S stop.
  // Handlers reference refs to avoid detaching/re-attaching on every volume
  // change or play-state toggle, which previously happened on every slider drag.
  const keysRef = useRef({})
  keysRef.current.togglePlay = togglePlay
  keysRef.current.toggleMute = toggleMute
  keysRef.current.toggleLoop = toggleLoop
  keysRef.current.stopJob = stopJob
  keysRef.current.setLiveVolume = setLiveVolume
  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target && e.target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.code === 'Space') {
        e.preventDefault()
        keysRef.current.togglePlay()
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        const s = useStore.getState()
        keysRef.current.setLiveVolume(Math.min(1, Math.round((s.volume + 0.08) * 100) / 100))
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        const s = useStore.getState()
        keysRef.current.setLiveVolume(Math.max(0, Math.round((s.volume - 0.08) * 100) / 100))
      } else if (e.key === 'm' || e.key === 'M') {
        keysRef.current.toggleMute()
      } else if (e.key === 'r' || e.key === 'R') {
        keysRef.current.toggleLoop()
      } else if (e.key === 's' || e.key === 'S') {
        keysRef.current.stopJob()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  useEffect(() => {
    const el = chooserRef.current
    if (!el) return
    const active = el.querySelector('.chip.on')
    if (active && active.scrollIntoView) {
      active.scrollIntoView({ inline: 'nearest', block: 'nearest' })
    }
  }, [prayerId, spiritId])

  // Left/right arrows make the horizontal prayer list obviously scrollable.
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(false)
  const updateArrows = () => {
    const el = chooserRef.current
    if (!el) return
    setCanLeft(el.scrollLeft > 4)
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4)
  }
  useEffect(() => {
    updateArrows()
    const el = chooserRef.current
    if (!el) return
    el.addEventListener('scroll', updateArrows, { passive: true })
    window.addEventListener('resize', updateArrows)
    return () => {
      el.removeEventListener('scroll', updateArrows)
      window.removeEventListener('resize', updateArrows)
    }
  }, [spiritId])
  const scrollChooser = (dir) => {
    const el = chooserRef.current
    if (!el) return
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: 'smooth' })
  }

  // While playing, keep the phrase being voiced centred on screen.
  const linesRef = useRef(null)
  useEffect(() => {
    if (!playing || active == null) return
    const el = linesRef.current?.querySelector('.prayer-line.on')
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [active, playing])

  const stopJob = () => {
    speech.stop()
    startingRef.current = false
    setStarting(false)
    setPlaying(false)
    setPaused(false)
    setPraying(false)
    useStore.getState().setPlayingPrayerId(null)
    useStore.getState().setCurrentPhrase(null)
    syncClient.presenceNow()
    setActive(null)
    setChantMode(false)
    setChantReason(null)
    ambient.setLevel(0.35)
  }

  // Count prayer seconds while playing, through the shared store clock so the
  // count keeps running even when this page isn't on screen.
  const elapsed = useStore((s) => s.elapsed)

  const togglePlay = () => {
    const live = useStore.getState()
    if (!live.playing) {
      // starting a fresh prayer: ignore double-taps while the engine warms
      if (startingRef.current) return
      startJob()
      return
    }
    if (live.prayerId !== live.playingPrayerId) {
      // Switching to a different prayer is always allowed, even mid-start.
      startJob()
      return
    }
    if (startingRef.current) return
    const cur = live
    if (!cur.paused) {
      speech.pause()
      setPaused(true)
      setPraying(false)
      syncClient.presenceNow()
      ambient.setLevel(0.35)
    } else {
      // Resume. If the job died (we left the tab and came back), start fresh.
      if (!speech.resume()) {
        startJob()
        return
      }
      setPaused(false)
      setPraying(true)
      syncClient.presenceNow()
      ambient.setLevel(0.9)
    }
  }

  const toggleLoop = () => {
    const next = !loopOn
    setLoopOn(next)
    if (playing) {
      // Toggling repeat must not restart the prayer — resume from the phrase
      // we're on, just with the new loop setting.
      const fromIndex = speech.currentIndex()
      stopJob()
      setTimeout(() => startJob(fromIndex), 120)
    }
  }

  const setLiveVolume = (v) => {
    setVolume(v)
    speech.setVolume(v)
    ambient.setVolume(v)
  }

  const setLiveRate = (r) => {
    setSpeechRate(r)
    speech.setRate(r)
  }

  const friendlyVoice = (v) =>
    String(v).replace(/^[a-z]{2,3}-[A-Z]{2,3}-/i, '').replace(/Neural$/, '')

  const pickVoice = (v) => {
    setPrayerVoice(prayer.id, v)
    if (playing) {
      // Continue from the current phrase instead of restarting the prayer.
      startJob(speech.currentIndex())
    }
  }

  const share = async () => {
    const url = `${window.location.origin}/#/pray/${spiritId}/${prayerId}`
    const text = `${prayerTitle(t, prayer.id, prayer.title)} · ${spirit.name}. Pray with the world: ${url}`
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Joining Palms', text, url })
        return
      }
    } catch {}
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  // Never render with an unresolved prayer: the guard effect above redirects,
  // but this avoids one crashing frame (e.g. a bad deep link with a valid
  // spirit but unknown prayer id).
  if (!prayer) return null

  return (
    <div className="view prayer-page">
      <Sparkles count={14} />
      <div className="back-row">
        <button onClick={closePrayer} aria-label={t('prayer.back')}>
          ←
        </button>
        <div>
          <div style={{ fontSize: 14, color: 'var(--ink-dim)' }}>
            {spirit.emoji} {t(`trad.${spirit.id}.name`)}
          </div>
          <div className="subtitle" style={{ fontSize: 13, marginTop: 2, color: 'rgba(226, 236, 255, 0.9)' }}>
            {t(`trad.${spirit.id}.tagline`)}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="pulse-dot" />
          <span style={{ fontSize: 13, color: 'var(--ink-dim)' }}>{t('prayer.peoplePraying', { n: Math.max(playing && !paused ? 1 : 0, people) })}</span>
          <button
            className={`fave-btn ${favorite ? 'on' : ''}`}
            onClick={() => toggleFavorite(prayer.id)}
            aria-label={t('prayer.favorite')}
            title={t('prayer.favorite')}
          >
            {favorite ? '★' : '☆'}
          </button>
          <button className="share-btn" onClick={share} aria-label={t('prayer.share')} title={t('prayer.share')}>
            ⇪
          </button>
          {copied && <span className="copied-pill">{t('settings.copied')}</span>}
        </div>
      </div>

      <div className="chooser-wrap">
        <button
          className={`chooser-arrow left ${canLeft ? '' : 'off'}`}
          onClick={() => scrollChooser(-1)}
          disabled={!canLeft}
          aria-label={t('prayer.back')}
        >
          ‹
        </button>
        <div className="chooser" ref={chooserRef}>
          <button
            className="chip chip-all"
            onClick={() => openPrayerPicker(spiritId)}
            title={t('picker.all')}
          >
            ☰ <span className="chip-all-label">{t('picker.all')}</span>
          </button>
          {(spirit.prayers || []).map((p) => (
            <button
              key={p.id}
              className={`chip ${p.id === prayerId ? 'on' : ''}`}
              onClick={() => {
                const cur = useStore.getState()
                if (cur.playingPrayerId && cur.playingPrayerId !== p.id) stopPlayback()
                openPrayer(spiritId, p.id)
              }}
            >
              {prayerTitle(t, p.id, p.title)}
              <span className={`chip-count ${p.id === prayerId ? 'on' : ''}`}>
                {prayerCounts[p.id] || 0}
              </span>
            </button>
          ))}
        </div>
        <button
          className={`chooser-arrow right ${canRight ? '' : 'off'}`}
          onClick={() => scrollChooser(1)}
          disabled={!canRight}
          aria-label={t('prayer.share')}
        >
          ›
        </button>
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

        <h1 className="prayer-title">{prayerTitle(t, prayer.id, prayer.title)}</h1>
        <div className="prayer-sub">
          <span className="prayer-lang-badge">
            {String(prayer.langLabel || '').split(' · ').slice(0, 2).join(' · ')}
          </span>
          <span className="prayer-mode">
            {prayer.loop ? t('prayer.repeated') : t('prayer.recited')}
          </span>
        </div>
        <span className="sr-live" aria-live="polite">
          {playing && active != null && phrases[active] ? phrases[active].t : ''}
        </span>

        <div className={`praying-now ${prayerCount ? 'together' : ''}`} title={t('prayer.prayingNowTitle')}>
          <span className="pulse-dot" />
          <b
            style={{
              textShadow: `0 0 ${6 + Math.min(1, Math.log10((prayerCount || 0) + 2) / 4) * 16}px rgba(232,196,122,${0.3 + Math.min(1, Math.log10((prayerCount || 0) + 2) / 4) * 0.7})`
            }}
          >
            {prayerCount || 0}
          </b>{' '}
          <span className="praying-now-rest">
            {t('prayer.prayingNowRest')}
            <span className="praying-now-sub">
              {t('prayer.across', { n: spiritCount || 0, name: spirit.name })}
            </span>
          </span>
          <span
            className="praying-now-total"
            title={t('prayer.today')}
            style={{
              textShadow: `0 0 ${5 + Math.min(1, Math.log10(prayerToday + 2) / 5) * 12}px rgba(232,196,122,${0.25 + Math.min(1, Math.log10(prayerToday + 2) / 5) * 0.6})`
            }}
          >
            {t('prayer.today', { n: prayerToday.toLocaleString() })}
          </span>
        </div>

        <div className="prayer-lines" ref={linesRef}>
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
                  {tPhrase(ph.e, locale)}
                </span>
              )}
            </div>
          ))}
        </div>

          <div className="prayer-translation">{tPrayer(prayer, locale)}</div>

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

        {chantMode && (
          <div className="chant-pill">{t('prayer.softChant')}</div>
        )}

        <PrayerStats prayerId={prayer.id} />
      </div>

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
          ♪
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
              if (muted && v > 0) applyMute(false)
            }}
            aria-label={t('prayer.volume')}
          />
        </div>
      </div>

      {tuning && (
        <div className="prayer-tune fade-in" aria-label={t('prayer.tuneLabel')}>
          <button
            className="pt-close"
            onClick={() => setTuning(false)}
            aria-label={t('prayer.tuneClose')}
            title={t('prayer.tuneClose')}
          >
            ▼
          </button>
          <button
            className="pt-help"
            onClick={() => useStore.getState().setKeyboardHelpOpen(true)}
            aria-label={t('keys.help')}
            title={t('keys.help')}
          >
            ?
          </button>
          {prayerVoices.length > 1 && (
            <div className="pt-row pt-voices">
              <label className="pt-label" id="pt-voice-label">{t('prayer.voice')}</label>
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
                      {friendlyVoice(v)}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
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
          {muted && <div className="pt-muted">🔇 {t('prayer.muted')}</div>}
          <div className="pt-row">
            <label className="pt-label" htmlFor="pt-rate">{t('prayer.speed')}</label>
            <input
              id="pt-rate"
              type="range"
              min="0.6"
              max="2.0"
              step="0.05"
              value={speechRate}
              onChange={(e) => setLiveRate(parseFloat(e.target.value))}
            />
            <span className="pt-val">{speechRate.toFixed(2)}×</span>
          </div>
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
    </div>
  )
}
