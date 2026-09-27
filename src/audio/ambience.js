// A soft, endless ambient bed: warm drone, distant wind, and a singing bowl.
// Built on the Web Audio API so it works offline with no audio files.

import { useStore } from '../store.js'
import { AMBIENT_PRESETS } from './presets.js'

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
    this._noise = null
  }

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext
      if (!AC) return
      this.ctx = new AC()
      this.master = this.ctx.createGain()
      this.master.gain.value = 0
      this.master.connect(this.ctx.destination)
    }
    if (this.ctx.state === 'suspended') return this.ctx.resume().then(() => {})
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
  _pad(bus, stops, { notes, gain = 0.05, filter = 340, type = 'sine', detune = 6, q = 0.6, breathe = 0.05 }) {
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
    }
    strike()
    const id = setInterval(strike, every * 1000)
    stops.push({ stop: () => clearInterval(id) })
  }

  // The seven beds. `b` is the preset bus (already connected to master).
  _builders() {
    return {
      // Reiki Drift — the classic warm healing pad: a broad major-9 with slow
      // shimmer, the closest thing here to soft "reiki" music.
      reiki: (b, s) => {
        this._pad(b, s, { notes: [130.81, 196.0, 261.63, 329.63, 493.88], gain: 0.05, filter: 420, breathe: 0.04 })
        this._pad(b, s, { notes: [392.0], gain: 0.006, filter: 900 })
      },
      // Ocean Hush — low pad under a slowly breathing band of surf noise.
      ocean: (b, s) => {
        this._pad(b, s, { notes: [65.41, 98.0, 130.81], gain: 0.05, filter: 300, breathe: 0.045 })
        this._air(b, s, { gain: 0.02, filter: 'bandpass', freq: 420, q: 0.5, lfo: 0.05, depth: 260 })
      },
      // Temple Bowl — near-silence under rare, resonant bowl strikes.
      temple: (b, s) => {
        this._pad(b, s, { notes: [65.41, 98.0], gain: 0.035, filter: 240, breathe: 0.03 })
        this._bells(b, s, { root: 196, gain: 0.05, every: 11 })
      },
      // Night Rain — a soft high band of rain over a low rumble.
      rain: (b, s) => {
        this._pad(b, s, { notes: [55.0, 82.41], gain: 0.04, filter: 200, breathe: 0.04 })
        this._air(b, s, { gain: 0.014, filter: 'highpass', freq: 1400, q: 0.4, lfo: 0.2, depth: 400 })
      },
      // Forest Stillness — airy leaves and a distant mid pad; very quiet.
      forest: (b, s) => {
        this._pad(b, s, { notes: [98.0, 146.83, 196.0], gain: 0.035, filter: 380, breathe: 0.05 })
        this._air(b, s, { gain: 0.01, filter: 'bandpass', freq: 900, q: 0.8, lfo: 0.08, depth: 300 })
      },
      // Deep Space — a very low, wide detuned drone with a high shimmer.
      space: (b, s) => {
        this._pad(b, s, { notes: [55.0, 82.41, 110.0], gain: 0.05, filter: 260, detune: 14, breathe: 0.03 })
        this._pad(b, s, { notes: [880.0, 1174.66], gain: 0.004, filter: 1600, breathe: 0.02 })
      },
      // Warming Pad — a close, mid-low chord, like a gentle heater.
      warm: (b, s) => {
        this._pad(b, s, { notes: [98.0, 116.54, 146.83, 196.0], gain: 0.045, filter: 460, breathe: 0.06 })
      }
    }
  }

  // Tear down the current preset's nodes (switching or stopping).
  _teardownPreset() {
    if (this.presetBus && this.ctx) {
      this.presetBus.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.6)
    }
    const stops = this.presetStops || []
    this.presetStops = []
    // Let the fade play out before physically stopping, so switching is smooth.
    setTimeout(() => {
      for (const n of stops) {
        try { n.stop ? n.stop() : null } catch {}
        try { n.disconnect && n.disconnect() } catch {}
      }
    }, 900)
    this.presetBus = null
  }

  buildPreset(id) {
    if (!this.ctx) return
    this._teardownPreset()
    const builders = this._builders()
    const build = builders[id] || builders.reiki
    const ctx = this.ctx
    const bus = ctx.createGain()
    bus.gain.value = 1
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

  setLevel(level) {
    this.level = Math.max(0, Math.min(1, level))
    if (this.master && this.ctx) {
      const user = useStore.getState().ambienceLevel
      const target = (0.1 + this.level * 0.14) * (0.2 + 0.8 * user) * this.vol
      this.master.gain.setTargetAtTime(target, this.ctx.currentTime, 0.8)
    }
  }

  // Master loudness for everything the engine plays. Re-applies the current
  // level so the change is heard immediately.
  setVolume(volume) {
    this.vol = Math.max(0, Math.min(1, volume))
    this.setLevel(this.level)
  }

  // A soft, low "ohm" — a vocal-like swell used as a chant cadence when the
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
    out.connect(this.master)
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
    out.connect(this.master)
  }

  async start() {
    await this.ensure()
    if (!this.ctx || this.running) return
    this.running = true
    this.startedAt = this.ctx.currentTime
    // Build the ambient bed the user selected (default: Reiki Drift).
    const chosen = useStore.getState().ambientPreset || 'reiki'
    this.buildPreset(AMBIENT_PRESETS.includes(chosen) ? chosen : 'reiki')
    this.setLevel(this.level)
    this.ring(0.8)
  }

  stop() {
    this.running = false
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.5)
    }
  }
}

export const ambient = new AmbientEngine()
if (typeof window !== 'undefined') window.__ambient = ambient
