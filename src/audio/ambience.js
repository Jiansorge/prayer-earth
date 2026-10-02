// A soft, endless ambient bed: warm drone, distant wind, and a singing bowl.
// Built on the Web Audio API so it works offline with no audio files.

import { useStore } from '../store.js'
import { AMBIENT_PRESETS } from './presets.js'
import { TEST_HOOKS } from '../shared/testHooks.js'

// Crossfade duration (seconds) for swapping ambient beds.
const XFADE = 0.85

export class AmbientEngine {
  constructor() {
    this.ctx = null
    this.master = null
    this.level = 0
    this.vol = 1
    this.running = false
    this.startedAt = 0
    this.presetId = 'reiki'
    this.presetStops = []
    this.presetBus = null
    this.chanBus = null
    this._noise = null
  }

  // Always returns a Promise. (It used to be `async`; when the ambient rewrite
  // made it a plain function it could return `undefined`, and callers doing
  // `ambient.ensure().catch()` threw synchronously â€” breaking the nav play
  // button.) Never rejects: a refused resume just falls through.
  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext
      if (!AC) return Promise.resolve()
      try {
        this.ctx = new AC()
      // The bed is deliberately loud now (~2.5 master) and the
      // recorded voice shares this same AudioContext, so bed + voice (+ chant)
      // can sum past 1.0 and crackle. A gentle compressor before destination
      // keeps peaks in range without audibly squashing the bed. Everything
      // routed through Web Audio (master, chantBus, the recorded voice) goes
      // through this; the native <audio> element path is OS-mixed.
      this.limiter = this.ctx.createDynamicsCompressor()
      this.limiter.threshold.value = -14
      this.limiter.knee.value = 10
      this.limiter.ratio.value = 18
      this.limiter.attack.value = 0.006
      this.limiter.release.value = 0.32
        this.limiter.connect(this.ctx.destination)
        this.master = this.ctx.createGain()
        this.master.gain.value = 0
        this.master.connect(this.limiter)
        // Chant/bell bus: routed to the limiter (not the bed fader). Gated only
        // by the true mute — so the "soft chant" fallback and welcome bell stay
        // audible even with the ambience slider at 0.
        this.chanBus = this.ctx.createGain()
        this.chanBus.gain.value = this.vol
        this.chanBus.connect(this.limiter)
      } catch {
        return Promise.resolve()
      }
    }
    if (this.ctx.state === 'suspended') {
      return this.ctx.resume().then(
        () => {},
        () => {}
      )
    }
    return Promise.resolve()
  }

  // ---- ambient preset synthesis ----
  // A single looping noise buffer, shared by every "air" layer.
  _noiseBuffer() {
    if (this._noise) return this._noise
    const ctx = this.ctx
    const len = ctx.sampleRate * 3
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = buf.getChannelData(0)
    let last = 0
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1
      last = (last + 0.02 * white) / 1.02
      d[i] = last * 3.2
    }
    this._noise = buf
    return buf
  }

  // Warm sustained chord: the body of most presets. Slow-breathing gain keeps
  // it from feeling static.
  _pad(bus, stops, { notes, gain = 0.05, filter = 340, type = 'sine', detune = 6, q = 0.6, breathe = 0.05, pulse = 0, pulseDepth = 0.35 }) {
    const ctx = this.ctx
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = filter
    lp.Q.value = q
    const g = ctx.createGain()
    g.gain.value = gain
    for (const f of notes) {
      const o = ctx.createOscillator()
      o.type = type
      o.frequency.value = f
      o.detune.value = (Math.random() - 0.5) * detune
      o.connect(lp)
      o.start()
      stops.push(o)
    }
    const br = ctx.createOscillator()
    br.frequency.value = breathe
    const brG = ctx.createGain()
    brG.gain.value = gain * 0.35
    br.connect(brG)
    brG.connect(g.gain)
    br.start()
    stops.push(br)
    // A rhythmic swell so the bed breathes with a beat instead of sitting as one
    // constant drone. A slow sine LFO gating the pad gain reads as a calm pulse
    // (like a distant tide) at these rates.
    if (pulse > 0) {
      const pl = ctx.createOscillator()
      pl.type = 'sine'
      pl.frequency.value = pulse
      const plG = ctx.createGain()
      plG.gain.value = gain * pulseDepth
      pl.connect(plG)
      plG.connect(g.gain)
      pl.start()
      stops.push(pl)
    }
    lp.connect(g)
    g.connect(bus)
  }

  // Filtered looping noise: wind, rain, surf, leaves.
  _air(bus, stops, { gain = 0.008, filter = 'bandpass', freq = 480, q = 0.7, lfo = 0.06, depth = 220 }) {
    const ctx = this.ctx
    const src = ctx.createBufferSource()
    src.buffer = this._noiseBuffer()
    src.loop = true
    const bq = ctx.createBiquadFilter()
    bq.type = filter
    bq.frequency.value = freq
    bq.Q.value = q
    const g = ctx.createGain()
    g.gain.value = gain
    const lo = ctx.createOscillator()
    lo.frequency.value = lfo
    const loG = ctx.createGain()
    loG.gain.value = depth
    lo.connect(loG)
    loG.connect(bq.frequency)
    lo.start()
    stops.push(lo)
    src.connect(bq)
    bq.connect(g)
    g.connect(bus)
    src.start()
    stops.push(src)
  }

  // Sparse singing-bowl strikes on a slow, jittery interval.
  _bells(bus, stops, { root = 196, gain = 0.05, every = 9 }) {
    const ctx = this.ctx
    const strike = () => {
      const t = ctx.currentTime
      const f = root * (0.97 + Math.random() * 0.06)
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(gain, t + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 5)
      for (const p of [{ m: 1, g: 1 }, { m: 2.756, g: 0.32 }, { m: 5.4, g: 0.1 }]) {
        const o = ctx.createOscillator()
        o.type = 'sine'
        o.frequency.value = f * p.m
        const og = ctx.createGain()
        og.gain.value = p.g
        o.connect(og)
        og.connect(g)
        o.start(t)
        o.stop(t + 5.2)
      }
      g.connect(bus)
      // Each strike's nodes are transient: disconnect them once the tail ends,
      // otherwise every 11s bell leaves a gain + 3 osc + 3 gains attached to
      // the bus forever.
      setTimeout(() => {
        try { g.disconnect() } catch {}
      }, 5400)
    }
    strike()
    const id = setInterval(strike, every * 1000)
    stops.push({ stop: () => clearInterval(id) })
  }

  // The seven beds. `b` is the preset bus (already connected to master).
  _builders() {
    return {
      // Reiki Drift — the classic warm healing pad: a broad major-9 that
      // breathes with a slow pulse, plus a midrange air layer so it's audible
      // on a phone speaker (which can't reproduce the low pad).
      reiki: (b, s) => {
        this._pad(b, s, { notes: [130.81, 196.0, 261.63, 329.63, 493.88], gain: 0.05, filter: 420, breathe: 0.04, pulse: 0.2, pulseDepth: 0.3 })
        this._air(b, s, { gain: 0.05, filter: 'bandpass', freq: 620, q: 0.4, lfo: 0.07, depth: 200 })
      },
      // Ocean Hush — low pad under a slowly breathing band of surf noise, with
      // a slow tidal swell.
      ocean: (b, s) => {
        this._pad(b, s, { notes: [65.41, 98.0, 130.81], gain: 0.05, filter: 300, breathe: 0.045, pulse: 0.13, pulseDepth: 0.4 })
        this._air(b, s, { gain: 0.075, filter: 'bandpass', freq: 500, q: 0.5, lfo: 0.05, depth: 260 })
      },
      // Temple Bowl — near-silence under rare, resonant bowl strikes; the slow
      // pad pulse keeps a gentle heartbeat under the rare bells.
      temple: (b, s) => {
        this._pad(b, s, { notes: [65.41, 98.0], gain: 0.035, filter: 240, breathe: 0.03, pulse: 0.1, pulseDepth: 0.3 })
        this._air(b, s, { gain: 0.022, filter: 'bandpass', freq: 700, q: 0.6, lfo: 0.05, depth: 180 })
        this._bells(b, s, { root: 196, gain: 0.06, every: 11 })
      },
      // Night Rain — a soft high band of rain over a low pulsing rumble.
      rain: (b, s) => {
        this._pad(b, s, { notes: [55.0, 82.41], gain: 0.04, filter: 200, breathe: 0.04, pulse: 0.25, pulseDepth: 0.3 })
        this._air(b, s, { gain: 0.055, filter: 'highpass', freq: 1400, q: 0.4, lfo: 0.2, depth: 400 })
      },
      // Forest Stillness — airy leaves and a distant mid pad, pulsing gently.
      forest: (b, s) => {
        this._pad(b, s, { notes: [98.0, 146.83, 196.0], gain: 0.035, filter: 380, breathe: 0.05, pulse: 0.14, pulseDepth: 0.35 })
        this._air(b, s, { gain: 0.045, filter: 'bandpass', freq: 950, q: 0.8, lfo: 0.08, depth: 300 })
      },
      // Deep Space — a very low, warm, wide drone with a slow deep pulse. The
      // old version had a 880/1174 Hz "shimmer" pad that read as tinny and
      // high-pitched; replaced with low-mid fifths and a darker lowpass so it
      // sits as a warm hum instead of a whistle. A gentle midrange air layer
      // keeps it present on a phone speaker.
      space: (b, s) => {
        this._pad(b, s, { notes: [55.0, 82.41, 110.0, 164.81], gain: 0.05, filter: 300, detune: 14, breathe: 0.03, pulse: 0.08, pulseDepth: 0.45 })
        this._air(b, s, { gain: 0.02, filter: 'bandpass', freq: 380, q: 0.5, lfo: 0.04, depth: 120 })
      },
      // Warming Pad — a close, mid-low chord with a steady gentle pulse.
      warm: (b, s) => {
        this._pad(b, s, { notes: [98.0, 116.54, 146.83, 196.0], gain: 0.045, filter: 460, breathe: 0.06, pulse: 0.18, pulseDepth: 0.3 })
        this._air(b, s, { gain: 0.02, filter: 'bandpass', freq: 560, q: 0.5, lfo: 0.06, depth: 160 })
      }
    }
  }

  // Tear down the current preset's nodes (switching or stopping). Fades the old
  // bus all the way to zero over `XFADE`, then stops every source AND
  // disconnects the bus itself, so repeated switching can't leave a stack of
  // live GainNodes summing into master.
  _teardownPreset() {
    const bus = this.presetBus
    const stops = this.presetStops || []
    this.presetStops = []
    this.presetBus = null
    if (!this.ctx) return
    const t = this.ctx.currentTime
    if (bus) {
      // Cancel any scheduled fade and ramp linearly to silence, so the source
      // cut below happens at zero (a setTargetAtTime tail would leave ~20%
      // audible and click when the oscillators stopped).
      const g = bus.gain
      g.cancelScheduledValues(t)
      g.setValueAtTime(g.value, t)
      g.linearRampToValueAtTime(0.0001, t + XFADE)
    }
    setTimeout(() => {
      for (const n of stops) {
        try { n.stop ? n.stop() : null } catch {}
        try { n.disconnect && n.disconnect() } catch {}
      }
      // The bus is a live node wired to master until it is disconnected.
      try { bus && bus.disconnect() } catch {}
    }, XFADE * 1000 + 60)
  }

  buildPreset(id) {
    if (!this.ctx) return
    this._teardownPreset()
    const builders = this._builders()
    const build = builders[id] || builders.reiki
    const ctx = this.ctx
    const bus = ctx.createGain()
    // Ramp the new bed in so switching is a crossfade, not a level step.
    const t = ctx.currentTime
    bus.gain.setValueAtTime(0.0001, t)
    bus.gain.linearRampToValueAtTime(1, t + XFADE)
    bus.connect(this.master)
    this.presetBus = bus
    this.presetStops = []
    build(bus, this.presetStops)
    this.presetId = id
  }

  // Switch the ambient bed with a crossfade. Safe before the context exists.
  setPreset(id) {
    const next = AMBIENT_PRESETS.includes(id) ? id : 'reiki'
    if (!this.ctx) {
      this.presetId = next
      return
    }
    if (next === this.presetId) return
    this.buildPreset(next)
  }

  // Moving the bed up is a slow swell so a prayer arrives gently; moving it down
  // is fast, because waiting several seconds for silence after pressing stop
  // reads as the app being stuck rather than as a fade.
  //
  // Both directions use setTargetAtTime. The previous fall did
  // cancelScheduledValues + setValueAtTime(gain.value) + linearRamp, which was
  // fast but risked an audible click: AudioParam.value during an active
  // automation is not reliably the instantaneous value across engines, so the
  // ramp could resume from the wrong point and jump. A short exponential
  // constant has no such discontinuity - it starts from wherever the parameter
  // actually is - and ~63% of the gap is gone in 70 ms.
  _rampMaster(target) {
    if (!this.master || !this.ctx) return
    const rising = target > this.master.gain.value
    this.master.gain.setTargetAtTime(target, this.ctx.currentTime, rising ? 0.8 : 0.07)
  }

  setLevel(level) {
    this.level = Math.max(0, Math.min(1, level))
    if (this.master && this.ctx) {
      const user = useStore.getState().ambienceLevel
      // Pushed much higher: a phone speaker rolls off hard below ~200 Hz, so the
      // low pads alone are near-inaudible on a handset no matter the gain. The
      // beds now carry broadband noise + midrange harmonics, and the master is
      // run loud behind the limiter (which is set to catch peaks). At full the
      // slider this reaches ~7 during prayer.
      // Scales from true silence at 0 to the prayer bed at 1. The previous
      // (1.0 + level * 6.5) form had a floor of 1.0, so no value of `level`
      // could ever reach silence - which is why stopping a prayer left the bed
      // at roughly half volume instead of stopping it.
      const target = this.level * 7.5 * (0.2 + 0.8 * user) * this.vol
      this._rampMaster(target)
    }
  }

  // Master loudness for everything the engine plays. Re-applies the current
  // level so the change is heard immediately.
  setVolume(volume) {
    this.vol = Math.max(0, Math.min(1, volume))
    this.setLevel(this.level)
    // Keep the chant/bell bus in step with the true mute.
    if (this.chanBus && this.ctx) {
      this.chanBus.gain.setTargetAtTime(this.vol, this.ctx.currentTime, 0.05)
    }
  }

  // A soft, low "ohm" â€” a vocal-like swell used as a chant cadence when the
  // device has no speech voice.
  hum(intensity = 0.3) {
    if (!this.ctx || !this.master) return
    const ctx = this.ctx
    const t = ctx.currentTime
    const out = ctx.createGain()
    out.gain.value = 0
    out.gain.setTargetAtTime(intensity, t, 0.15)
    out.gain.setTargetAtTime(0.0001, t + 2.0, 0.6)

    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 700

    const tones = [
      { f: 130.8, g: 0.7 },
      { f: 196.0, g: 0.35 },
      { f: 261.6, g: 0.16 }
    ]
    tones.forEach(({ f, g }, k) => {
      const o = ctx.createOscillator()
      o.type = k === 0 ? 'sine' : 'triangle'
      o.frequency.setValueAtTime(f, t)
      o.frequency.linearRampToValueAtTime(f * 1.02, t + 1.5)
      const og = ctx.createGain()
      og.gain.value = g
      o.connect(og)
      og.connect(lp)
      o.start(t)
      o.stop(t + 2.2)
    })
    lp.connect(out)
    out.connect(this.chanBus || this.master)
    // Disconnect the one-shot chant/ohm tail once it's done. The oscillators
    // become collectable after stop(), but these gain/filter nodes stay wired
    // into the bus otherwise — and hum() fires once per phrase, so a long
    // chant leaked ~8 nodes per phrase (~4,800 over an hour).
    setTimeout(() => {
      try { out.disconnect() } catch {}
    }, 3000)
  }

  ring(intensity = 1) {
    if (!this.ctx || !this.master) return
    // Respect the stored prayer volume so a first-visit welcome bell never
    // blasts at 100% while the user is set to (say) 5%.
    const volume = (useStore.getState().volume ?? 0.8) || 0.001
    const ctx = this.ctx
    const t = ctx.currentTime
    const g = ctx.createGain()
    const f = 220 + Math.random() * 40
    const partials = [
      { f, gain: 0.5, dur: 6 },
      { f: f * 2.756, gain: 0.12, dur: 3.5 },
      { f: f * 4.05, gain: 0.05, dur: 2.2 }
    ]
    const out = ctx.createGain()
    out.gain.value = 0.22 * intensity * volume
    partials.forEach(({ f: pf, gain, dur }) => {
      const o = ctx.createOscillator()
      o.type = 'sine'
      o.frequency.value = pf
      const og = ctx.createGain()
      og.gain.setValueAtTime(0.0001, t)
      og.gain.exponentialRampToValueAtTime(gain, t + 0.02)
      og.gain.exponentialRampToValueAtTime(0.0001, t + dur)
      o.connect(og)
      og.connect(out)
      o.start(t)
      o.stop(t + dur + 0.1)
    })
    out.connect(this.chanBus || this.master)
    // Disconnect the bell's output once its longest partial has rung out —
    // otherwise every ring()/hum() left its gain node permanently wired to the
    // bus (ring() fires per prayer start and per loop cycle).
    setTimeout(() => {
      try { out.disconnect() } catch {}
    }, 7000)
  }

  async start() {
    await this.ensure()
    if (!this.ctx || this.running) return
    this.running = true
    this.startedAt = this.ctx.currentTime
    // Build the ambient bed the user selected (default: Reiki Drift).
    const chosen = useStore.getState().ambientPreset || 'reiki'
    this.buildPreset(AMBIENT_PRESETS.includes(chosen) ? chosen : 'reiki')
    // Re-apply a persisted mute to the bed: nothing called setVolume at boot, so
    // a "muted" app would otherwise play the bed at full (louder now that the
    // ceiling is ~2.5).
    this.setVolume(useStore.getState().muted ? 0 : 1)
    this.setLevel(this.level)
    this.ring(0.8)
  }

  stop() {
    this.running = false
    if (this.master && this.ctx) {
      // Fast linear fade, not the old 0.5s exponential: pressing stop should
      // feel instant, and an exponential tail lingers audibly.
      this._rampMaster(0.0001)
    }
  }
}

export const ambient = new AmbientEngine()
if (TEST_HOOKS && typeof window !== 'undefined') window.__ambient = ambient
