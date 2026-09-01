// Speaks prayers phrase-by-phrase so the UI can highlight exactly the phrase
// being voiced right now. One utterance per phrase = reliable phrase sync.
//
// Hardened for the real world:
//  - waits for voices to load (Chrome returns them asynchronously)
//  - falls back to the transliteration with an English voice when the prayer's
//    language has no installed voice, so mantras are always audible
//  - the highlight moves as each phrase finishes (the onend chain) and re-syncs
//    to the voice via onstart; a per-phrase stall guard keeps things moving if
//    the engine ever drops or freezes an utterance, and a broken engine that
//    errors on several phrases in a row hands off to a timed chant.

import { ambient } from './ambience.js'
import { useStore } from '../store.js'

// Sentinel "voice" in the settings picker meaning: no spoken voice, chant only.
export const CHANT_VOICE = '__chant__'

// Flatten sacred transliterations into something a fallback English voice can
// read sensibly: strip diacritics, map the special consonants used in these
// texts, and drop glottal marks — far closer to the real sound than the raw
// diacritic-heavy text.
function phoneticForSpeech(text) {
  if (!text) return text
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ḍ/g, 'd')
    .replace(/ṭ/g, 't')
    .replace(/ṣ/g, 's')
    .replace(/ḥ/g, 'h')
    .replace(/ġ/g, 'g')
    .replace(/ṛ/g, 'r')
    .replace(/ṅ/g, 'ng')
    .replace(/ñ/g, 'ny')
    .replace(/ṁ/g, 'm')
    .replace(/ṃ/g, 'm')
    .replace(/[ʼʿʔ']/g, '')
    .replace(/\s+/g, ' ')
}

// The user can hear what a real voice will sound like, quietly.
const SAMPLE_TEXT = 'May peace be with you.'

class SpeechEngine {
  constructor() {
    this.synth = window.speechSynthesis
    this.job = null
    this.kicker = null
    this.voices = []
    this.primed = false
    this.lastCancel = 0
    this.voiceDead = false
    this.tabPause = false
    // The deployed worker exposes no /api/tts proxy (static audio + browser
    // voices cover every prayer), so keep the cloud path off to avoid probing a
    // URL that 404s on every load.
    this.cloud = false
    this.cloudCache = new Map()
    this.cloudAudio = null
    // One <audio> element per recorded file, reused across repeated phrases
    // (mantras repeat the same line many times) so the MP3 is fetched once.
    this._audioByUrl = new Map()

    if (this.synth) {
      this.refreshVoices()
      if (window.speechSynthesis.addEventListener) {
        window.speechSynthesis.addEventListener('voiceschanged', () =>
          this.refreshVoices()
        )
      }
    }
    // After the machine sleeps / the tab is hidden while a prayer is playing,
    // the audio engine dies silently. We don't auto-restart on return (that
    // would resume prayer without the user asking) — instead we pause on hide so
    // the prayer stays silent until they press play, and resume() then revives
    // the dead engine with a fresh phrase.
    this.bindVisibility()
  }

  // Pause playback when the tab is hidden (sleep / switching away). This keeps
  // the prayer silent until the user explicitly presses play again, and —
  // crucially — corrects the state after a sleep so the play button revives the
  // dead engine instead of doing nothing. Active-play hiccups are still
  // recovered by the stall guard / kicker watchdog (they only act while not
  // paused).
  bindVisibility() {
    if (this._visBound) return
    this._visBound = true
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) return
      const j = this.job
      const s = useStore.getState()
      if (j && j.active && !j.paused && s.playing && !s.paused) {
        this.pause()
        useStore.setState({ paused: true, praying: false })
      }
    })
  }

  // Ask the server whether the Google TTS proxy is available (once).
  async probeCloud() {
    try {
      const res = await fetch('/api/tts?text=hi&lang=en')
      this.cloud = res.ok
    } catch {
      this.cloud = false
    }
    if (!this.cloud) {
      try {
        this.synth.cancel()
      } catch {}
    }
  }

  cloudText(phrase, lang) {
    return phrase.t || ''
  }

  // Load the static audio manifest once; caches the promise so it's fetched a
  // single time for the whole session.
  loadAudioManifest() {
    if (this._manifestPromise) return this._manifestPromise
    this._manifestPromise = fetch('/audio/manifest.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => {
        this._manifestData = m
        return m
      })
      .catch(() => null)
    return this._manifestPromise
  }

  // Whether this prayer has pre-rendered audio. While the manifest is still
  // loading, assume it might, so speakCloud gets a chance to use it.
  hasStaticFor(job) {
    const m = this._manifestData
    if (!m) return true
    const p = m.prayers && m.prayers[job.prayerId]
    return !!(p && p.voices && p.voices.length)
  }

  // A gentle, warm space for the spoken prayer — a soft hall tail with a
  // slight warmth curve and a whisper of echo. Subtle by design: the voice
  // stays clear and front, the room just softens the edges.
  buildReverb(ctx) {
    try {
      const seconds = 1.5
      const len = Math.floor(ctx.sampleRate * seconds)
      const ir = ctx.createBuffer(2, len, ctx.sampleRate)
      for (let ch = 0; ch < 2; ch++) {
        const data = ir.getChannelData(ch)
        for (let i = 0; i < len; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5)
        }
      }
      const convolver = ctx.createConvolver()
      convolver.buffer = ir
      this._revConvolver = convolver
    } catch {}
  }

  applyReverb(audio) {
    try {
      const ctx = ambient.ctx
      if (!ctx || ctx.state !== 'running') return
      if (!this._revConvolver) this.buildReverb(ctx)
      if (!this._revConvolver) return
      // Tear down the previous phrase's connection first so its audio can't
      // keep ringing into the shared reverb and stack up on every repeat.
      this.teardownReverb()
      const src = ctx.createMediaElementSource(audio)
      this._revSource = src
      this._revAudio = audio
      // A very gentle warmth curve — darkens just the top, keeps the voice clear.
      const lowpass = ctx.createBiquadFilter()
      lowpass.type = 'lowpass'
      lowpass.frequency.value = 2600
      lowpass.Q.value = 0.2
      // Voice stays dry and forward; the room is barely a whisper now.
      const dry = ctx.createGain()
      dry.gain.value = 0.98
      const wet = ctx.createGain()
      wet.gain.value = 0.01
      // A barely-there echo, more spacious than musical.
      const delay = ctx.createDelay(2)
      delay.delayTime.value = 0.26
      const feedback = ctx.createGain()
      feedback.gain.value = 0.2
      const echo = ctx.createGain()
      echo.gain.value = 0.003
      src.connect(dry)
      dry.connect(lowpass)
      src.connect(this._revConvolver)
      this._revConvolver.connect(wet)
      wet.connect(lowpass)
      src.connect(delay)
      delay.connect(feedback)
      feedback.connect(delay)
      delay.connect(echo)
      echo.connect(lowpass)
      lowpass.connect(ctx.destination)
    } catch {}
  }

  // Fully release the current phrase's audio from the graph and pause it, so
  // nothing keeps playing after advance, stop, or finish.
  teardownReverb() {
    if (this._revSource) {
      try {
        this._revSource.disconnect()
      } catch {}
      this._revSource = null
    }
    if (this._revAudio) {
      try {
        this._revAudio.pause()
      } catch {}
      this._revAudio = null
    }
  }

  async staticAudioUrl(job, i) {
    try {
      const m = await this.loadAudioManifest()
      const p = m && m.prayers ? m.prayers[job.prayerId] : null
      if (!p || !p.voices || !p.voices.length) return null
      const prefs = useStore.getState().prayerVoices || {}
      const chosen = prefs[job.prayerId]
      const voice = p.voices.indexOf(chosen) >= 0 ? chosen : p.voices[0]
      return `/audio/${job.prayerId}/${i}-${voice}.mp3`
    } catch {
      return null
    }
  }

  async speakCloud(i) {
    const job = this.job
    if (!job || !job.active || job.mode !== 'tts') return false
    const phrase = job.phrases[i]
    if (!phrase) {
      this.finishJob()
      return true
    }
    try {
      const text = this.cloudText(phrase, job.lang)
      const staticUrl = await this.staticAudioUrl(job, i)
      // Static pre-rendered audio is used when it exists; otherwise fall back
      // to the live cloud proxy. The cache key is the URL itself so a prayer
      // with static audio is shared across every playback rate.
      const key = staticUrl || `${job.lang}:${job.rate}:${text}`
      let url = this.cloudCache.get(key)
      if (!url) {
        if (staticUrl) {
          url = staticUrl
        } else {
          const res = await fetch(
            `/api/tts?text=${encodeURIComponent(text)}&lang=${encodeURIComponent(job.lang)}`
          )
          if (!res.ok) return false
          const blob = await res.blob()
          url = URL.createObjectURL(blob)
        }
        this.cloudCache.set(key, url)
        if (this.cloudCache.size > 128) {
          const oldest = this.cloudCache.keys().next().value
          URL.revokeObjectURL(oldest)
          this.cloudCache.delete(oldest)
        }
      }
      let audio = this._audioByUrl.get(url)
      if (!audio) {
        audio = new Audio(url)
        audio.volume = Math.min(0.85, (useStore.getState().volume ?? 0.8) * 0.75)
        // Play directly, never through the WebAudio graph: an element routed
        // through createMediaElementSource can't play on its own again, so a
        // suspended AudioContext (mobile/background) would silence it forever.
        this._audioByUrl.set(url, audio)
      }
      audio.playbackRate = job.rate ?? 1
      audio.currentTime = 0
      this.cloudAudio = audio
      clearTimeout(job.guard)
      clearTimeout(job.advTimer)
      job.index = i
      job.phraseStart = Date.now()
      job.phraseHold = this.estimateMs(phrase)
      const token = ++job.token
      if (job.onPhrase) job.onPhrase(i, phrase)
      const finish = () => {
        const j = this.job
        if (!j || !j.active || j !== job || j.mode !== 'tts') return
        if (job.done.has(token)) return
        job.done.add(token)
        this.advance(i)
      }
      audio.onended = finish
      audio.onerror = finish
      // Safety net set BEFORE play() so a stalled file or a muted environment
      // can never hang a prayer — the phrase always advances.
      job.advTimer = setTimeout(finish, job.phraseHold * 2 + 1200)
      await audio.play()
      const next = i + 1
      const np = job.phrases[next]
      if (next < job.phrases.length && np && np.t) {
        const ns = await this.staticAudioUrl(job, next)
        const nk = ns || `${job.lang}:${job.rate}:${np.t}`
        if (!this.cloudCache.has(nk)) {
          if (this.cloudCache.size >= 100) {
            const fk = this.cloudCache.keys().next().value
            const fv = this.cloudCache.get(fk)
            if (typeof fv === 'string' && fv.startsWith('blob:')) URL.revokeObjectURL(fv)
            this.cloudCache.delete(fk)
          }
          if (ns) {
            this.cloudCache.set(nk, ns)
          } else {
            fetch(
              `/api/tts?text=${encodeURIComponent(np.t)}&lang=${encodeURIComponent(job.lang)}`
            )
              .then((r) => (r.ok ? r.blob() : null))
              .then((b) => {
                if (b) {
                  if (this.cloudCache.size >= 100) {
                    const fk = this.cloudCache.keys().next().value
                    const fv = this.cloudCache.get(fk)
                    if (typeof fv === 'string' && fv.startsWith('blob:')) URL.revokeObjectURL(fv)
                    this.cloudCache.delete(fk)
                  }
                  const nu = URL.createObjectURL(b)
                  this.cloudCache.set(nk, nu)
                }
              })
              .catch(() => {})
          }
        }
      }
      return true
    } catch {
      return false
    }
  }

  refreshVoices() {
    try {
      this.voices = this.synth.getVoices() || []
    } catch {
      this.voices = []
    }
    // If voices ever come back (a device that loads them late), the platform is
    // alive again and we should re-probe before falling back to the chant.
    if (this.voices.length) this.voiceDead = false
  }

  waitForVoices() {
    return new Promise((res) => {
      if (this.voices.length) return res()
      const t = Date.now()
      const check = () => {
        this.refreshVoices()
        if (this.voices.length || Date.now() - t > 2500) {
          if (!this.voices.length) this.voiceDead = true
          return res()
        }
        setTimeout(check, 120)
      }
      check()
    })
  }

  pickVoice(lang) {
    const preferred = useStore.getState().voiceURI
    if (preferred) {
      const p = this.voices.find((v) => v.voiceURI === preferred)
      if (p) return p
    }
    const base = lang.split('-')[0]
    const exact = this.voices.find((v) => v.lang && v.lang.toLowerCase() === lang.toLowerCase())
    if (exact) return exact
    return (
      this.voices.find((v) => v.lang && v.lang.split('-')[0].toLowerCase() === base) ||
      null
    )
  }

  // Chrome sometimes drops the very first utterance — speak a tiny pause first.
  prime() {
    if (this.primed || !this.synth) return
    this.primed = true
    try {
      const u = new SpeechSynthesisUtterance(' ')
      u.volume = 0
      u.rate = 2
      this.synth.speak(u)
    } catch {}
  }

  // Starts a job. opts: { phrases, lang, rate, loop, gapMs, index, onPhrase,
  // onCycle, onEnd }. `index` lets a resumed job start at the current phrase
  // instead of the top (e.g. after switching voices mid-prayer).
  async start(opts) {
    this.stop()
    this.job = {
      ...opts,
      index: opts.index || 0,
      active: true,
      warm: false,
      mode: 'tts',
      token: 0,
      done: new Set(),
      advTimer: null
    }

    if (!this.synth) {
      this.timedLoop(opts, true)
      return
    }

    // The user can pick "Soft chant" as their voice — no spoken voice at all.
    if (useStore.getState().voiceURI === CHANT_VOICE) {
      this.job.chantReason = 'chosen'
      this.notifyFallback('chosen')
      this.timedLoop(this.job, true)
      return
    }

    // Prefer authentic server-proxied neural voices (Google Cloud TTS).
    if (this.cloud === null) await this.probeCloud()
    if (this.cloud) {
      this.speakIndex(opts.index || 0)
      return
    }

    // We already probed once and the platform reported no voices (Firefox's
    // Fingerprinting Protection blanks them, or the device has no TTS) — go
    // straight to the chant instead of waiting the probe window every play.
    if (!this.voiceDead) {
      await this.waitForVoices()
      if (!this.job || !this.job.active) return
    }

    // No voices at all means the platform can't talk: Firefox's Fingerprinting
    // Protection blanks the voice list and speak() then hangs forever silently,
    // and some devices have no TTS voices. Skip the dead engine entirely and go
    // straight to the audible chant so prayer is still heard in the room.
    if (!this.voices.length) {
      this.job.chantReason = 'no-voices'
      this.notifyFallback('no-voices')
      this.timedLoop(this.job, true)
      return
    }

    this.prime()
    this.primeKicker()
    this.speakIndex(this.job ? this.job.index || 0 : 0)
  }

  // Lets the UI know speech gave up and the audible chant took over.
  notifyFallback(reason) {
    const j = this.job
    if (j && j.onFallback) {
      try {
        j.onFallback(reason)
      } catch {}
    }
  }

  // Adjusts the speaking rate while a prayer is underway; the next phrase (and
  // the chant pacing) picks it up. Safe to call when idle too.
  setRate(rate) {
    if (this.job) this.job.rate = rate
  }

  // Re-tune loudness immediately, even mid-phrase. The cloud voice is an Audio
  // element, so its volume can change live; speechSynthesis has no live control
  // (the next utterance picks it up).
  setVolume(volume) {
    const vol = Math.max(0, Math.min(1, volume ?? 0.8))
    if (this.cloudAudio) {
      try {
        this.cloudAudio.volume = Math.min(0.85, vol * 0.75)
      } catch {}
    }
  }

  // Plays a short spoken sample of the currently-chosen voice so the user can
  // hear it before committing. Falls back to a soft chime for the chant option
  // or when the platform has no voices (e.g. Fingerprinting Protection).
  preview() {
    const chosen = useStore.getState().voiceURI
    if (chosen === CHANT_VOICE || !this.synth) {
      ambient.ring(0.7)
      return
    }
    // Prefer the authentic cloud voice for the sample.
    if (this.cloud !== false) {
      fetch(`/api/tts?text=${encodeURIComponent(SAMPLE_TEXT)}&lang=en`)
        .then((r) => (r.ok ? r.blob() : null))
        .then((b) => {
          if (!b) return
          const url = URL.createObjectURL(b)
      // Stop the previous phrase's element too, so a safety-timer advance can
      // never leave the old audio overlapping the new phrase.
      if (this.cloudAudio) {
        try {
          this.cloudAudio.pause()
        } catch {}
      }
      const audio = new Audio(url)
          audio.volume = Math.min(0.5, (useStore.getState().volume ?? 0.8) * 0.6)
          audio.play()
        })
        .catch(() => {})
      return
    }
    if (!this.voices.length) {
      ambient.ring(0.7)
      return
    }
    const voice = this.voices.find((v) => v.voiceURI === chosen) || this.voices[0]
    if (!voice) {
      ambient.ring(0.7)
      return
    }
    try {
      // Don't cancel an active prayer's voice — the sample will follow it.
      if (!this.job?.active) this.synth.cancel()
      const u = new SpeechSynthesisUtterance(SAMPLE_TEXT)
      u.lang = voice.lang
      u.voice = voice
      u.volume = Math.min(0.5, (useStore.getState().volume ?? 0.8) * 0.6)
      u.rate = useStore.getState().speechRate || 1
      this.synth.speak(u)
    } catch {}
  }

  // How long a phrase should at least stay on screen (and in the timed loop).
  // Scaled by the speaking-rate setting so a fast voice doesn't outrun the
  // highlight and a slow one isn't clipped.
  estimateMs(phrase) {
    const words = (phrase.t || '').split(/\s+/).length
    const base = Math.max(1000, words * 300 + 350)
    const rate = this.job?.rate ?? 1
    return Math.max(750, base / rate)
  }

  // text: { t, s } phrase; choose the speakable form for this device's voices.
  utteranceText(phrase, lang) {
    const voice = this.pickVoice(lang)
    if (voice) return { text: phrase.t, lang, voice }
    if (phrase.s) return { text: phoneticForSpeech(phrase.s), lang: 'en-US', voice: null }
    return { text: phrase.t, lang, voice: null }
  }

  speakIndex(i) {
    const job = this.job
    if (!job || !job.active || job.mode !== 'tts') return
    const phrase = job.phrases[i]
    if (!phrase) {
      this.finishJob()
      return
    }
    // Prefer recorded audio — it needs no server or API key. The live Google
    // proxy is a fallback inside speakCloud for prayers without a recording.
    // `job.noCloud` is set after repeated cloud/static failures so a dead audio
    // element (e.g. after a long sleep the element can no longer play) hands
    // off to browser voices instead of re-entering the cloud path forever.
    if ((this.cloud || this.hasStaticFor(job)) && !job.noCloud) {
      this.speakCloud(i).then((ok) => {
        const j = this.job
        if (!ok && j && j.active && j === job && j.mode === 'tts' && j.index === i) {
          j.cloudFails = (j.cloudFails || 0) + 1
          if (j.cloudFails >= 2) {
            // The recorded/proxy audio keeps failing — never spin on it. Block
            // this job's cloud path so the next call uses browser voices (which
            // have their own stall/error fallbacks down to the timed chant).
            j.noCloud = true
            this.cloud = false
          }
          this.speakIndex(i)
        }
      })
      return
    }
    clearTimeout(job.guard)
    clearTimeout(job.advTimer)
    const { text, lang, voice } = this.utteranceText(phrase, job.lang)
    const u = new SpeechSynthesisUtterance(text)
    u.lang = lang
    u.rate = job.rate ?? 1
    // Speech sits gently under the ambient bed rather than shouting over it.
    u.volume = Math.min(0.85, (useStore.getState().volume ?? 0.8) * 0.75)
    u.pitch = 1.0
    if (voice) u.voice = voice

    job.index = i
    const est = this.estimateMs(phrase)
    job.phraseStart = Date.now()
    job.phraseHold = est
    const token = ++job.token
    // Highlight right away so the on-screen phrase always advances; onstart
    // re-confirms it the moment the voice truly begins (no visual change).
    if (job.onPhrase) job.onPhrase(i, phrase)

    u.onstart = () => {
      const j = this.job
      if (!j || !j.active || j !== job || j.mode !== 'tts') return
      j.errors = 0
      j.warm = true
    }
    u.onend = () => {
      const j = this.job
      if (!j || !j.active || j !== job || j.mode !== 'tts') return
      if (job.done.has(token)) return
      job.done.add(token)
      // Completed far faster than it could possibly be spoken — the engine is
      // not actually voicing (no usable voice / instant completion). Fall back
      // to the paced, audible chant so prayer still sounds in the room.
      if (Date.now() - job.phraseStart < 400) {
        j.mode = 'timed'
        j.chantReason = 'instant'
        this.notifyFallback('instant')
        try {
          this.synth.cancel()
        } catch {}
        this.timedLoop(j, true)
        return
      }
      this.advance(i)
    }
    u.onerror = () => {
      const j = this.job
      if (!j || !j.active || j !== job || j.mode !== 'tts') return
      if (job.done.has(token)) return
      job.done.add(token)
      j.errors = (j.errors || 0) + 1
      // An engine that errors on several phrases in a row without ever
      // starting one can't talk — hand off to the timed chant.
      if (j.errors >= 3) {
        j.mode = 'timed'
        j.chantReason = 'errors'
        this.notifyFallback('errors')
        try {
          this.synth.cancel()
        } catch {}
        this.timedLoop(j, true)
        return
      }
      this.advance(i)
    }
    this.synth.speak(u)

    // Stall guard: if this utterance never actually starts (Chrome can drop
    // or stall one), hand off to the timer so the highlight keeps moving
    // instead of freezing on a single phrase. A voice that has never produced
    // sound yet (cold start, real machines can take several seconds) gets a
    // few long chances first — canceling a slow-but-fine voice is exactly the
    // bug that made playback appear to stop after a couple of seconds.
    const takeover = () => {
      const j = this.job
      if (!j || !j.active || j !== job) return
      if (job.index !== i) return
      // The phrase has been on screen far longer than its estimate. A healthy
      // voice advances via onend/advTimer near `phraseHold`, so anything past
      // ~2x means the engine is silent — speechSynthesis can report
      // speaking=true while actually dead after a sleep/hibernation, so we must
      // not trust that flag. Hand off to the timed chant so prayer is still
      // heard.
      const elapsed = Date.now() - (j.phraseStart || 0)
      if (elapsed < (j.phraseHold || 4000) * 2 + 3000) {
        job.guard = setTimeout(takeover, 3000)
        return
      }
      j.mode = 'timed'
      j.chantReason = 'stall'
      this.notifyFallback('stall')
      try {
        this.synth.cancel()
      } catch {}
      this.timedLoop(j, true)
    }
    job.guard = setTimeout(takeover, (j.phraseHold || 4000) * 2 + 3000)
  }

  // Moves on to the next phrase (or loops / finishes). Shared by onend and
  // onerror so a real voice and the timer always share one clock. Each phrase
  // stays on screen at least its estimated duration, so a fast or silent
  // engine can never make the highlight blaze through the prayer.
  advance(i) {
    const job = this.job
    if (!job || !job.active || job.paused) return
    const since = Date.now() - (job.phraseStart || 0)
    const hold = job.phraseHold || 0
    if (since < hold) {
      clearTimeout(job.advTimer)
      job.advTimer = setTimeout(() => {
        const j = this.job
        if (!j || !j.active) return
        this.advance(i)
      }, hold - since)
      return
    }
    const next = i + 1
    if (next < job.phrases.length) {
      this.speakIndex(next)
    } else if (job.loop) {
      if (job.onCycle) job.onCycle()
      this.gap(() => this.speakIndex(0))
    } else {
      this.finishJob()
    }
  }

  gap(fn) {
    const j = this.job
    const delay = (j && j.gapMs) || 900
    setTimeout(() => {
      if (this.job === j && j.active) fn()
    }, delay)
  }

  // iOS sometimes pauses synthesis; a gentle resume keeps the voice going. A
  // mobile OS can also suspend the shared AudioContext in the background — if
  // it is still suspended while a prayer is meant to be audible, resume it and
  // re-kick the current phrase so sound always comes back.
  primeKicker() {
    clearInterval(this.kicker)
    this.kicker = setInterval(() => {
      const j = this.job
      if (!j || !j.active) return
      try {
        if (this.synth.paused) this.synth.resume()
      } catch {}
      try {
        const ctx = ambient.ctx
        if (ctx && ctx.state === 'suspended' && !document.hidden && !j.paused) {
          ctx.resume().then(() => {
            const k = this.job
            if (k && k.active && !k.paused) this.speakIndex(k.index)
          }).catch(() => {})
        }
      } catch {}
      // Watchdog: if a phrase has been on screen far past its estimate with no
      // advance (speechSynthesis died after sleep but reports speaking=true),
      // restart the current phrase so the prayer never sits silently dead. This
      // also covers a foreground sleep that never fires visibilitychange/focus.
      if (j.mode === 'tts' && !j.paused && !document.hidden) {
        const elapsed = Date.now() - (j.phraseStart || 0)
        if (elapsed > (j.phraseHold || 4000) * 2 + 4000) {
          try {
            this.synth.cancel()
          } catch {}
          try {
            if (this.cloudAudio) this.cloudAudio.pause()
          } catch {}
          this.speakIndex(j.index)
        }
      }
    }, 6000)
  }

  // No speech engine (or one that stalled) — highlight by estimated reading
  // time, and keep an audible cadence with a soft chant so prayer can still be
  // heard. Resumes from the phrase currently on screen so it never jumps back.
  timedLoop(opts, chant) {
    const j = this.job
    if (!j) return
    j.mode = 'timed'
    clearInterval(this.kicker)
    clearTimeout(j.guard)
    clearTimeout(j.advTimer)
    let i = j.index || 0
    const step = () => {
      if (!j.active || this.job !== j) return
      if (j.paused) {
        j.timer = setTimeout(step, 300)
        return
      }
      if (chant) ambient.hum(0.65)
      j.onPhrase(i, opts.phrases[i])
      const dur = this.estimateMs(opts.phrases[i])
      if (i < opts.phrases.length - 1) {
        i += 1
        j.timer = setTimeout(step, dur)
      } else if (opts.loop) {
        if (opts.onCycle) opts.onCycle()
        i = 0
        j.timer = setTimeout(step, opts.gapMs || 900)
      } else {
        this.finishJob()
      }
    }
    step()
  }

  finishJob() {
    const j = this.job
    this.job = null
    clearInterval(this.kicker)
    this.teardownReverb()
    if (j) {
      clearTimeout(j.guard)
      clearTimeout(j.advTimer)
      if (j.onEnd) j.onEnd()
    }
  }

  // Which phrase the active job is on, so a caller can resume from here.
  currentIndex() {
    return this.job ? this.job.index || 0 : 0
  }

  // Gracefully pause mid-utterance. The job survives so it can be resumed.
  pause() {
    // Remember whether this pause came from the tab going away — resuming after
    // that needs a fresh audio element, not a resume() of a suspended one.
    this.tabPause = !!document.hidden
    if (this.cloudAudio) {
      try {
        this.cloudAudio.pause()
      } catch {}
    }
    if (this.job) {
      this.job.paused = true
      // Drop any pending stall/advance timers so a paused job can't be revived
      // by the takeover guard while it's meant to be silent.
      clearTimeout(this.job.guard)
      clearTimeout(this.job.advTimer)
    }
    try {
      this.synth.pause()
    } catch {}
  }

  // Resume a paused job, or report that there is nothing left to resume.
  resume() {
    const j = this.job
    if (!j || !j.active) return false
    j.paused = false
    this.tabPause = false
    // A dead engine (after sleep/hibernation, or a backgrounded tab) can report
    // speaking=true while silent, so speechSynthesis.resume() is unreliable.
    // Always restart the current phrase fresh under this user gesture so sound
    // always comes back — the safest resume after switching away.
    if (j.mode === 'tts') {
      try {
        this.synth.cancel()
      } catch {}
      try {
        if (this.cloudAudio) this.cloudAudio.pause()
      } catch {}
      clearTimeout(j.guard)
      clearTimeout(j.advTimer)
      try {
        this.speakIndex(j.index)
      } catch {}
      return true
    }
    if (this.cloudAudio) {
      try {
        const p = this.cloudAudio.play()
        // If the tab switch interrupted the element (mobile browsers suspend
        // audio), play() rejects — re-speak the current phrase so a fresh
        // element starts under this user gesture.
        if (p && p.catch) p.catch(() => this.speakIndex(j.index))
      } catch {
        try {
          this.speakIndex(j.index)
        } catch {}
      }
    }
    try {
      this.synth.resume()
    } catch {}
    return true
  }

  stop() {
    this.lastCancel = Date.now()
    if (this.job) {
      clearTimeout(this.job.guard)
      clearTimeout(this.job.advTimer)
    }
    this.job = null
    clearInterval(this.kicker)
    clearTimeout(this.timer)
    this.teardownReverb()
    if (this.cloudAudio) {
      try {
        this.cloudAudio.pause()
        this.cloudAudio = null
      } catch {}
    }
    if (this._audioByUrl) {
      for (const a of this._audioByUrl.values()) {
        try {
          a.pause()
          a.onended = null
          a.onerror = null
        } catch {}
      }
      this._audioByUrl.clear()
    }
    try {
      this.synth.cancel()
    } catch {}
  }
}

export const speech = new SpeechEngine()
if (typeof window !== 'undefined') window.__speech = speech
