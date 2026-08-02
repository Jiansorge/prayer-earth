// A soft, endless ambient bed: warm drone, distant wind, and a singing bowl.
// Built on the Web Audio API so it works offline with no audio files.

import { useStore } from '../store.js'

export class AmbientEngine {
  constructor() {
    this.ctx = null
    this.master = null
    this.level = 0
    this.vol = 1
    this.running = false
    this.startedAt = 0
  }

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext
      if (!AC) return
      this.ctx = new AC()
      this.master = this.ctx.createGain()
      this.master.gain.value = 0
      this.master.connect(this.ctx.destination)
      this.buildPad()
      this.buildWind()
    }
    if (this.ctx.state === 'suspended') this.ctx.resume()
  }

  buildPad() {
    const ctx = this.ctx
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 340
    filter.Q.value = 0.6

    const g = ctx.createGain()
    g.gain.value = 0.05

    const notes = [65.41, 98.0, 130.81, 196.0] // C2 G2 C3 G3
    for (const f of notes) {
      const o = ctx.createOscillator()
      o.type = 'sine'
      o.frequency.value = f
      o.detune.value = (Math.random() - 0.5) * 6
      const og = ctx.createGain()
      og.gain.value = 1
      o.connect(og)
      og.connect(filter)
      o.start()
    }

    // gentle shimmer on top
    const shim = ctx.createOscillator()
    shim.type = 'sine'
    shim.frequency.value = 392
    const shimG = ctx.createGain()
    shimG.gain.value = 0.006
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.11
    const lfoG = ctx.createGain()
    lfoG.gain.value = 0.0045
    lfo.connect(lfoG)
    lfoG.connect(shimG.gain)
    shim.connect(shimG)
    shimG.connect(filter)
    shim.start()
    lfo.start()

    // slow breathing of the whole pad
    const breathe = ctx.createOscillator()
    breathe.frequency.value = 0.05
    const breatheG = ctx.createGain()
    breatheG.gain.value = 0.018
    breathe.connect(breatheG)
    breatheG.connect(g.gain)
    breathe.start()

    filter.connect(g)
    g.connect(this.master)
    this.padNodes = { filter, breathe }
  }

  buildWind() {
    const ctx = this.ctx
    const len = ctx.sampleRate * 2
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = buf.getChannelData(0)
    let last = 0
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1
      last = (last + 0.02 * white) / 1.02
      data[i] = last * 3.2
    }
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.loop = true
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 480
    bp.Q.value = 0.7
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.06
    const lfoG = ctx.createGain()
    lfoG.gain.value = 220
    lfo.connect(lfoG)
    lfoG.connect(bp.frequency)
    const wg = ctx.createGain()
    wg.gain.value = 0.008
    src.connect(bp)
    bp.connect(wg)
    wg.connect(this.master)
    src.start()
    lfo.start()
    this.windNodes = { src, lfo }
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
    out.gain.value = 0.22 * intensity
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

  start() {
    this.ensure()
    if (!this.ctx || this.running) return
    this.running = true
    this.startedAt = this.ctx.currentTime
    this.setLevel(this.level)
    // welcome bell
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
