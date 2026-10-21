import React, { useEffect, useRef, useState } from 'react'
import { useStore } from '../store.js'
import { SPIRITUALITY_BY_ID, loadSpirit, isLoaded } from '../data/prayers.js'
import { speech } from '../audio/speech.js'
import { ambient } from '../audio/ambience.js'
import { syncClient } from '../sync/client.js'
import { useT, prayerTitle } from '../i18n.js'
import Sparkles from '../components/Sparkles.jsx'
import { applyVolumes } from '../audio/volumes.js'
import { shareLink, showManualCopy } from '../shared/share.js'
import { CANONICAL_ORIGIN } from '../shared/canonical.js'
import PrayerToasts from '../components/PrayerToasts.jsx'
import PrayerBackRow from '../components/PrayerBackRow.jsx'
import PrayerChooser from '../components/PrayerChooser.jsx'
import PrayerStage from '../components/PrayerStage.jsx'
import PrayerControls from '../components/PrayerControls.jsx'
import PrayerTuneSheet from '../components/PrayerTuneSheet.jsx'
import PrayerNotes from '../components/PrayerNotes.jsx'
import usePrayerKeys from './usePrayerKeys.js'
import usePrayerSync, { broadcastPlayStarted } from './usePrayerSync.js'

// Scripts that read right-to-left, their original text must flow RTL even
// though the transliteration and meaning below stay left-to-right.
const RTL_LANGS = new Set(['ar', 'he', 'fa', 'ur', 'sd', 'dv'])
const newPlaybackSessionId = () =>
  typeof crypto?.randomUUID === 'function'
    ? crypto.randomUUID()
    : `play-${Date.now()}-${Math.random().toString(36).slice(2)}`

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
  const setPlayingSpiritId = useStore((s) => s.setPlayingSpiritId)
  const setPlayingSessionId = useStore((s) => s.setPlayingSessionId)
  const pendingPlay = useStore((s) => s.pendingPlay)
  const notePrayerComplete = useStore((s) => s.notePrayerComplete)
  const loopOn = useStore((s) => s.loopOn)
  const setLoopOn = useStore((s) => s.setLoopOn)
  const speechRate = useStore((s) => s.speechRate)
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
  const yourToday = useStore((s) => s.getYourToday())

  const spirit = SPIRITUALITY_BY_ID[spiritId]
  const [active, setActive] = useState(null)
  const [prayerVoices, setPrayerVoices] = useState([])
  const [finished, setFinished] = useState(false)
  const [copied, setCopied] = useState(false)
  const [chantMode, setChantMode] = useState(false)
  const [chantReason, setChantReason] = useState(null)
  const [voiceNote, setVoiceNote] = useState(false)
  const [joinedToast, setJoinedToast] = useState(false)
  const [reflection, setReflection] = useState(null)
  const muted = useStore((s) => s.muted)
  const [tuning, setTuning] = useState(false)
  const [starting, setStarting] = useState(false)
  const startAt = useRef(0)
const startingRef = useRef(false)
const startingWatchdog = useRef(null)
const joinedTimer = useRef(null)
const prevCountRef = useRef(null)
const prevPrayerRef = useRef(null)
// Counts the person's own recitation once per play session (reset on each start).
const countedRef = useRef(false)
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
    } else if (!prayer && isLoaded(spiritId) && (spirit.prayers || []).length) {
      // The spirit finished loading but this prayer id doesn't exist in it — a
      // stale/renamed/typo'd shared link or hand-edited hash. Don't spin forever;
      // drop back to the picker for that tradition.
      useStore.getState().go('home')
    }
  }, [spirit, prayer, spiritId])

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

  // A gentle "you're not alone" moment: when someone else joins the same prayer
  // while you're engaged, surface a brief, quiet notice. Only fires on an
  // increase above 1 (so your own start never triggers it), and resets cleanly
  // when you switch prayers.
  useEffect(() => {
    const prev = prevCountRef.current
    const prevPrayer = prevPrayerRef.current
    prevPrayerRef.current = prayerId
    prevCountRef.current = prayerCount
    if (prevPrayer !== prayerId) return
    if (prev !== null && prayerCount > prev && prev >= 1 && playing && !paused) {
      setJoinedToast(true)
      clearTimeout(joinedTimer.current)
      joinedTimer.current = setTimeout(() => setJoinedToast(false), 4500)
    }
  }, [prayerCount, prayerId, playing, paused])
  useEffect(
    () => () => {
      clearTimeout(joinedTimer.current)
      clearTimeout(startingWatchdog.current)
    },
    []
  )
  const reflectionTimer = useRef(null)
  useEffect(() => {
    if (reflectionTimer.current) clearTimeout(reflectionTimer.current)
    if (reflection !== null) {
      reflectionTimer.current = setTimeout(() => setReflection(null), 4500)
    }
  }, [reflection])

  const startJob = (fromIndex = 0) => {
    stopJob()
    countedRef.current = false
    startAt.current = Date.now()
    startingRef.current = true
    // A start must never silently deadlock the play button: if the engine
    // never engages (voices stuck, an exception in speech.start), clear the
    // "starting" guard so the next tap can try again.
    clearTimeout(startingWatchdog.current)
    startingWatchdog.current = setTimeout(() => {
      if (startingRef.current) {
        startingRef.current = false
        setStarting(false)
      }
    }, 6000)
    setStarting(true)
    setActive(fromIndex)
    setPaused(false)
    setPlaying(true)
    setPlayingPrayerId(prayer.id)
    setPlayingSpiritId(spirit.id)
    setPlayingSessionId(newPlaybackSessionId())
    setFinished(false)
    setVoiceNote(false)
    setPraying(true)
    syncClient.presenceNow()
    ambient.start().catch(() => {})
    ambient.setLevel(0.9)
    ambient.ring(0.6)
    if (fromIndex === 0) useStore.getState().setElapsed(0)
    broadcastPlayStarted()

    const opts = {
      phrases,
      index: fromIndex,
      lang: prayer.lang,
      prayerId: prayer.id,
      // A prayer with no recording and no voice for its own script can say which
      // of its own texts to fall back to. Mantras want the transliteration read
      // the way it sounds; a sutra with a full English rendering wants English,
      // because pinyin read by an English voice is not the sentence anyone is
      // trying to hear. altLang names a second recitation this prayer ships,
      // so the listener's voice choice can switch between the two.
      speakLang: prayer.speakLang || null,
      altLang: prayer.altLang || null,
      rate: speechRate,
      // Read off the store at the moment of the start, not the render-time
      // binding: a start scheduled while the switch was being pressed (the
      // pendingPlay queue, a resume after the job died) would otherwise carry
      // the flag as it was before the click.
      loop: useStore.getState().loopOn,
      gapMs: prayer.loop ? 250 : 700,
      onPhrase: (i) => {
        // First phrase engaging means audio is actually starting — drop the
        // "starting…" spinner, but never before it has been visible ~350ms so
        // the tap always gives instant feedback even on fast devices.
        const waited = Date.now() - startAt.current
        if (waited >= 350) {
          clearTimeout(startingWatchdog.current)
          startingRef.current = false
          setStarting(false)
        } else {
          setTimeout(() => {
            clearTimeout(startingWatchdog.current)
            startingRef.current = false
            setStarting(false)
          }, 350 - waited)
        }
        // Track the phrase globally so returning to this page can rehighlight.
        useStore.getState().setCurrentPhrase(i)
        // Only highlight lines when this prayer is the one actually on screen.
        if (useStore.getState().prayerId === prayer.id) setActive(i)
        // Count the person's own recitation:
        //  - a repeating mantra counts once per repetition (each phrase that
        //    actually speaks), so "today" reflects how many times it was said;
        //  - a non-loop prayer counts the moment it starts (first phrase), so it
        //    never reads 0 just because the person paused or stopped early.
        if (prayer.loop) {
          notePrayerComplete(prayer.id)
        } else if (!countedRef.current) {
          countedRef.current = true
          useStore.getState().markPrayedToday()
          notePrayerComplete(prayer.id)
        }
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
        useStore.getState().setCompletedAt(Date.now())
        celebrateStreak()
        setReflection(yourToday)
        setPlaying(false)
        setPraying(false)
        useStore.getState().setPlayingPrayerId(null)
        useStore.getState().setPlayingSpiritId(null)
        useStore.getState().setPlayingSessionId(null)
        syncClient.presenceNow()
        useStore.getState().setCurrentPhrase(null)
        setFinished(true)
        setActive(null)
setChantMode(false)
    setChantReason(null)
    // The prayer is over, so the bed goes quiet - and released, not just
    // muted. The completion bell is a one-shot through its own bus and is
    // unaffected by the bed level or its teardown.
    ambient.setLevel(0)
    ambient.stop()
    ambient.ring(0.8)
      }
    }
    speech.start(opts)
  }

  usePrayerSync({ playing, pendingPlay, prayer, startJob })

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

  const stopJob = () => {
    speech.stop()
    clearTimeout(startingWatchdog.current)
    startingRef.current = false
    setStarting(false)
    setPlaying(false)
    setPaused(false)
    setPraying(false)
    useStore.getState().setPlayingPrayerId(null)
    useStore.getState().setPlayingSpiritId(null)
    useStore.getState().setPlayingSessionId(null)
    useStore.getState().setCurrentPhrase(null)
    // Stop beats a queued start: pendingPlay's effect can still be sitting on
    // its 60ms timer when stop is pressed (a pick just armed it), and without
    // clearing the flag here the effect would run startJob right after the
    // stop - speaking on a button whose whole meaning is silence.
    useStore.getState().setPendingPlay(false)
    syncClient.presenceNow()
    setActive(null)
    setChantMode(false)
    setChantReason(null)
    ambient.setLevel(0)
    // The page's stop ends the bed for real - same release as the footer stop -
    // so a stopped prayer costs nothing to sit behind, and the next play
    // rebuilds the bed from the store's choice.
    ambient.stop()
  }

  // Count prayer seconds while playing, through the shared store clock so the
  // count keeps running even when this page isn't on screen. The page itself
  // only ever shows the number after the prayer finishes (the clock is stopped
  // by then), so the selector yields a constant while it plays: subscribing to
  // the live value re-rendered this whole page on every one-second tick - a
  // full React pass inside the only frames scrolling is already fighting for.
  const elapsed = useStore((s) => (finished ? s.elapsed : -1))

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
      ambient.setLevel(0)
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
    // Repeat is read live off the running job, so the switch flips it in
    // place. It used to stop the job and start a new one 120ms later, which
    // re-spoke the current line from its top - and the restart was scheduled
    // through a closure built before this click, so the new job inherited the
    // flag from BEFORE the toggle: switch off and the prayer kept looping,
    // switch on and the prayer stopped at the end of its cycle.
    speech.setLoop(next)
  }

  const setLiveVolume = (v) => {
    setVolume(v)
    // This fader is labelled volume and sits beside the main control, so it is
    // the master: it moves the voice and the ambient bed together.
    //
    // It used to be voice-only, deliberately, because routing it into the
    // ambient engine meant dragging it to 0 silenced the bed with no way back -
    // the Settings ambience slider only called setLevel, and setLevel
    // multiplied by a volume that was already zero. applyVolumes() is shared
    // with the Settings slider, so either one raises the bed again.
    applyVolumes()
  }

  usePrayerKeys({ tuning, setTuning, togglePlay, toggleLoop, stopJob, setLiveVolume })

  const pickVoice = (v) => {
    setPrayerVoice(prayer.id, v)
    if (playing) {
      // Continue from the current phrase instead of restarting the prayer.
      startJob(speech.currentIndex())
    }
  }

  const share = async () => {
    const url = `${CANONICAL_ORIGIN}/#/pray/${spiritId}/${prayerId}`
    const text = `${prayerTitle(t, prayer.id, prayer.title)} · ${spirit.name}. Pray with the world: ${url}`
    // Through shareLink, not a hand-rolled copy. This used to call
    // navigator.clipboard.writeText directly and await it, which has three
    // problems the shared helper already solved:
    //   - writeText can stay pending forever where the permission prompt is
    //     suppressed, so the tap gave no feedback and threw no error
    //   - it has no legacy execCommand fallback, which is the only copy path
    //     that works in the Android/iOS WebView
    //   - a blocked copy failed silently, leaving no way to get the link out
    const result = await shareLink({ title: 'Joining Palms', text, url })
    if (result === 'shared' || result === 'copied') {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } else if (result === 'failed') {
      showManualCopy(url, t('prayer.share'))
    }
  }

  // Never render with an unresolved prayer: the guard effect above redirects,
  // but this avoids one crashing frame (e.g. a bad deep link with a valid
  // spirit but unknown prayer id).
  if (!prayer) return (
    <div className="view" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div className="earth-loading-inner">
        <img className="earth-loading-icon" src="/icons/icon-prayer-128.webp" srcSet="/icons/icon-prayer-128.webp 128w, /icons/icon-prayer-256.webp 256w" sizes="104px" alt="" />
        <p className="subtitle" style={{ marginTop: 16 }}>{t('picker.loading')}</p>
      </div>
    </div>
  )

  return (
    <div className="view prayer-page">
      <Sparkles count={14} />
      <PrayerToasts joinedToast={joinedToast} prayerCount={prayerCount} reflection={reflection} prayerToday={prayerToday} />
      <PrayerBackRow spirit={spirit} prayer={prayer} closePrayer={closePrayer} playing={playing} paused={paused} people={people} favorite={favorite} toggleFavorite={toggleFavorite} share={share} copied={copied} />

      <PrayerChooser spirit={spirit} spiritId={spiritId} prayerId={prayerId} prayerCounts={prayerCounts} stopJob={stopJob} openPrayer={openPrayer} openPrayerPicker={openPrayerPicker} />

      <PrayerStage key={prayer.id} prayer={prayer} phrases={phrases} active={active} rtl={rtl} locale={locale} chantMode={chantMode} chantReason={chantReason} playing={playing} finished={finished} elapsed={elapsed} setFinished={setFinished} prayerCount={prayerCount} spiritCount={spiritCount} spirit={spirit} prayerToday={prayerToday} />

      <PrayerControls loopOn={loopOn} toggleLoop={toggleLoop} starting={starting} playing={playing} paused={paused} togglePlay={togglePlay} stopJob={stopJob} tuning={tuning} setTuning={setTuning} volume={volume} muted={muted} setLiveVolume={setLiveVolume} />

      <PrayerTuneSheet tuning={tuning} setTuning={setTuning} prayer={prayer} prayerVoices={prayerVoices} chosenVoice={chosenVoice} pickVoice={pickVoice} muted={muted} loopOn={loopOn} toggleLoop={toggleLoop} />

      <PrayerNotes celebration={celebration} voiceNote={voiceNote} setVoiceNote={setVoiceNote} chantMode={chantMode} />
    </div>
  )
}
