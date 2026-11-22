// Pitch-preserving time stretch (WSOLA) for the recorded prayers.
//
// Why this file exists: the Web Audio route plays a decoded phrase through an
// AudioBufferSourceNode, and its `playbackRate` simply resamples - faster
// means higher pitch, so every non-1x speed sounded like a chipmunk on Safari
// (the buffer route is what Safari plays: an element joined to the AudioContext
// ignores playbackRate there, bugs.webkit.org 240405, unfixed until WebKit
// 2026 - and the 2014 iPad Air 2 is stuck on Safari 15). The element escape
// hatch (preservesPitch) needs a route that engine does not have. Stretching
// the decoded samples in JS removes the choice: the line plays at 1x - its
// real pitch, its new duration - on every engine.
//
// How (WSOLA = waveform similarity overlap-add):
//   - Cut the input into overlapping grains (Hann window, synthesis hop = half
//     the grain, so adjacent windows sum to exactly 1 - no amplitude ripple
//     from the overlap itself).
//   - Walk the input at hop = grainHop * rate: at 2x consume twice the input
//     per output grain (shorter output), at 0.6x consume less (longer output).
//   - Naively pasting grains at that schedule cuts the waveform mid-period
//     every hop - buzz. Before each grain, search +/-W samples around the
//     nominal position for the offset whose first half correlates best with
//     the PREVIOUS grain's second half: that is the similarity criterion, and
//     choosing an offset that continues the previous waveform keeps the phase
//     - which is why the pitch survives.
//   - The search runs coarse on a box-decimated copy (16x cheaper) and refines
//     at full resolution around the winner, so a 2014 A8X stretches a phrase
//     in well under a second instead of freezing the main thread.
//   - ONE set of offsets is computed on the channel downmix and applied to
//     every channel, so stereo channels stay in step with each other.
//
// Pure functions: no DOM, no AudioContext, no timers unless the chunked entry
// point asks for them. speech.js turns the result into an AudioBuffer; Node
// tests run the DSP directly.
const EPS = 1e-12

// Cosine similarity of a[..refOff+len) and a[..candOff+len) - scale
// invariant, so a loud candidate cannot win over a phase-aligned quiet one.
// Out-of-bounds candidates score -Infinity (never chosen); a silent candidate
// has no phase evidence and scores 0.
function sim(a, refOff, candOff, len, refNorm) {
  if (candOff < 0 || candOff + len > a.length) return -Infinity
  let dot = 0
  let en = 0
  for (let i = 0; i < len; i++) {
    const r = a[refOff + i]
    const s = a[candOff + i]
    dot += r * s
    en += s * s
  }
  if (en < EPS) return 0
  return dot / (refNorm * Math.sqrt(en))
}

// Box average of every `d` consecutive samples: a low-passed, d-times shorter
// copy of the signal the coarse search scans.
function decimate(src, d) {
  const n = Math.floor(src.length / d)
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    let s = 0
    const base = i * d
    for (let k = 0; k < d; k++) s += src[base + k]
    out[i] = s / d
  }
  return out
}

// Everything the grain loop needs, or null when the caller should just use the
// input as-is (a rate that barely differs from 1, a grain too short to carry a
// pitch period, or nothing to stretch).
function prepare(channels, sampleRate, rate, opts) {
  opts = opts || {}
  if (!channels || !channels.length || !channels[0] || !channels[0].length) return null
  if (!(rate > 0)) rate = 1
  const len = channels[0].length
  // Below 1% there is nothing to gain: copy instead of resynthesizing. Also a
  // floor for pathological inputs - a grain has to span several pitch periods
  // (a grain shorter than the waveform it must phase-align cannot correlate).
  if (Math.abs(rate - 1) < 0.01) return null
  let grain = Math.round(sampleRate * (opts.grainSec || 0.048))
  if (grain < 64) grain = 64
  if (grain % 2) grain++
  if (len < grain * 2) return null
  const hs = grain >> 1
  let ha = Math.round(hs * rate)
  if (ha < 1) ha = 1
  // Search reach: never less than a quarter of a grain (12ms at the default
  // grain - enough to bridge the material a 2x hop skips), more if asked.
  const w = Math.max(grain >> 2, Math.round(sampleRate * (opts.searchSec || 0)))
  const d = 4

  const outLen = Math.max(1, Math.floor(len / rate))
  const nGrains = Math.ceil(outLen / hs)
  // Padding so a nominal position near the end plus the full search reach and
  // one whole grain stays in bounds (reads past the end yield silence, which
  // is the musically right way for a phrase to run out).
  const padLen = len + grain + w + d

  const padded = []
  let down = null
  for (let c = 0; c < channels.length; c++) {
    const p = new Float32Array(padLen)
    p.set(channels[c].subarray ? channels[c].subarray(0, Math.min(len, padLen)) : channels[c])
    padded.push(p)
    if (!down) {
      down = new Float32Array(p)
    } else {
      for (let i = 0; i < padLen; i++) down[i] += p[i]
    }
  }
  if (channels.length > 1) {
    const inv = 1 / channels.length
    for (let i = 0; i < padLen; i++) down[i] *= inv
  }

  const win = new Float32Array(grain)
  // Periodic Hann: win[i] + win[i + grain/2] === 1, the COLA condition, so
  // grains on the half-grain grid reconstruct exactly.
  for (let i = 0; i < grain; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / grain)

  const outs = []
  for (let c = 0; c < padded.length; c++) outs.push(new Float32Array(outLen + grain))

  return {
    grain, hs, ha, w, d, outLen, nGrains,
    padded, down, downDec: decimate(down, d), win, outs
  }
}

// Synthesize output grain n. Keeps the previous grain's chosen input position
// on the plan (p.prevPos) - the reference the similarity search aligns to.
function grainStep(p, n) {
  const outPos = n * p.hs
  const nominal = n * p.ha
  let pos = nominal
  const half = p.hs

  if (n > 0) {
    const refOff = p.prevPos + half
    let refNorm = 0
    for (let i = 0; i < half; i++) {
      const r = p.down[refOff + i]
      refNorm += r * r
    }
    refNorm = Math.sqrt(refNorm)
    if (refNorm > EPS) {
      // Coarse: decimated reference against every decimated candidate in
      // reach. Decimated sample k stands for samples [k*d, k+d), so a
      // candidate at decimated index (base + m) sits at sample (base + m)*d.
      const d = p.d
      const nRef = Math.floor(half / d)
      const refIdx = Math.floor(refOff / d)
      const refDec = new Float32Array(nRef)
      let refDecNorm = 0
      for (let j = 0; j < nRef; j++) {
        const v = p.downDec[refIdx + j]
        refDec[j] = v
        refDecNorm += v * v
      }
      refDecNorm = Math.sqrt(refDecNorm)
      const base = Math.floor(nominal / d)
      const mMax = Math.floor(p.w / d)
      let bestM = 0
      let bestScore = -Infinity
      if (refDecNorm > EPS) {
        for (let m = -mMax; m <= mMax; m++) {
          const off = base + m
          if (off < 0 || off + nRef > p.downDec.length) continue
          let dot = 0
          let en = 0
          for (let j = 0; j < nRef; j++) {
            const r = refDec[j]
            const s = p.downDec[off + j]
            dot += r * s
            en += s * s
          }
          const score = en < EPS ? 0 : dot / (refDecNorm * Math.sqrt(en))
          if (score > bestScore) {
            bestScore = score
            bestM = m
          }
        }
      }
      // Refine at full resolution around the coarse winner (decimated buckets
      // can place it up to d samples off the true phase peak), staying inside
      // the same +/-W reach the coarse pass used.
      const coarse = (base + bestM) * d
      const lo = Math.max(Math.max(0, nominal - p.w), coarse - d)
      const hi = Math.min(Math.min(p.down.length - half, nominal + p.w), coarse + d)
      let bestPos = -1
      let bestFull = -Infinity
      for (let c = lo; c <= hi; c++) {
        const s = sim(p.down, refOff, c, half, refNorm)
        if (s > bestFull) {
          bestFull = s
          bestPos = c
        }
      }
      if (bestPos >= 0) {
        pos = bestPos
      } else if (coarse >= nominal - p.w && coarse <= nominal + p.w) {
        pos = coarse
      }
    }
  }

  // Windowed overlap-add onto the fixed output grid. Input reads are padded,
  // so a grain that runs past the phrase fades into silence naturally.
  for (let c = 0; c < p.padded.length; c++) {
    const src = p.padded[c]
    const out = p.outs[c]
    for (let i = 0; i < p.grain; i++) out[outPos + i] += src[pos + i] * p.win[i]
  }
  p.prevPos = pos
}

function finish(p) {
  const res = []
  for (let c = 0; c < p.outs.length; c++) res.push(p.outs[c].subarray(0, p.outLen))
  return res
}

// Synchronous stretch - for tests and anything that can afford to block.
// Returns one Float32Array per channel, length floor(input / rate), or the
// input copied unchanged when no stretching was needed.
export function stretch(channels, sampleRate, rate, opts) {
  const p = prepare(channels, sampleRate, rate, opts)
  if (!p) return channels.map((c) => c.slice())
  for (let n = 0; n < p.nGrains; n++) grainStep(p, n)
  return finish(p)
}

// The entry point playback uses: same result, but the work is cut into
// batches that hand the event loop back in between. A phrase is a handful of
// grains on a desktop; on the A8X a long mantra is tens of thousands of
// correlations, and running those in one turn would freeze every button on the
// page mid-prayer.
export async function stretchChunked(channels, sampleRate, rate, opts) {
  const p = prepare(channels, sampleRate, rate, opts)
  if (!p) return channels.map((c) => c.slice())
  const every = (opts && opts.yieldEvery) || 40
  for (let n = 0; n < p.nGrains; n++) {
    grainStep(p, n)
    if ((n + 1) % every === 0 && n + 1 < p.nGrains) {
      await (opts && opts.yield ? opts.yield() : new Promise((r) => setTimeout(r, 0)))
    }
  }
  return finish(p)
}
