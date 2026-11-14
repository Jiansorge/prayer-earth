// Opt-in diagnostics for a device we cannot drive from CI.
//
// Open https://joining-palms.app/?diag=1 (or /#/?diag=1) and the numbers below
// appear over the app. Nothing here runs for a normal visitor: main.jsx imports
// this file dynamically and only when the address asks for it, so it is not
// part of the initial download.
//
// It exists because the report it was built for - Safari with the speed control
// inert, words skipped mid-line, a continuous ambient crackle under load, a
// coarser Earth and no location ring - has several different plausible causes,
// and every one of them is a number the page can read about itself:
//
//   tier      did this device get the reduced Earth, and on what evidence?
//   earth     is a WebGL scene on screen at all, or the static fallback?
//   speech    what rate does the element CLAIM, and how fast is it really
//             playing? Those two disagreeing is the whole mid-line skip.
//   audio     is the context running, and how big is its output buffer? A bed
//             that crackles only when the device is busy is a buffer underrun,
//             not a scheduling bug.
//
// This is a support tool, not a debug menu: it reads state, it copies to the
// clipboard, it can reload. It changes nothing.
import { useStore } from './store.js'
import { ambient } from './audio/ambience.js'
import { speech } from './audio/speech.js'
import { supportsWebGL2 } from './three/EarthScene.js'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const num = (v, digits = 2) =>
  typeof v === 'number' && isFinite(v) ? v.toFixed(digits) : '—'

function buildName() {
  const s = [...document.querySelectorAll('script[src]')]
    .map((n) => n.getAttribute('src') || '')
    .find((src) => /\/assets\/index-[^/]+\.js$/.test(src))
  return s ? s.split('/').pop() : '—'
}

function env() {
  const nav = navigator
  const standalone =
    window.matchMedia?.('(display-mode: standalone)')?.matches === true ||
    nav.standalone === true
  const ua = nav.userAgent || ''
  const touchMac = /Macintosh/.test(ua) && (nav.maxTouchPoints || 0) > 1
  const device = /iPhone/.test(ua)
    ? 'iPhone'
    : /iPad/.test(ua)
      ? 'iPad'
      : touchMac
        ? 'iPad (desktop UA)'
        : /Macintosh/.test(ua)
          ? 'Mac'
          : 'other'
  return { device, ua, standalone }
}

function coarse(what) {
  try {
    return window.matchMedia(`(${what})`).matches
  } catch {
    return null
  }
}

// Which drawing path is on screen: a live WebGL canvas (the real scene) or the
// flat static globe. Calling getContext with a type the canvas already owns
// returns that same context, so this reads the scene's real context rather than
// creating one; on a 2D canvas it returns null and has no effect.
function canvasReport() {
  const list = [...document.querySelectorAll('canvas')]
  const out = { count: list.length, webgl2: 0, renderer: '—', version: '—' }
  for (const c of list) {
    try {
      const gl = c.getContext('webgl2')
      if (!gl) continue
      out.webgl2 += 1
      if (out.renderer !== '—') continue
      const dbg = gl.getExtension('WEBGL_debug_renderer_info')
      out.renderer = String(
        gl.getParameter(dbg ? dbg.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || '—'
      )
      out.version = String(gl.getParameter(gl.VERSION) || '—')
    } catch {}
  }
  return out
}

function audioReport() {
  const ctx = ambient.ctx
  if (!ctx) return { present: false }
  const master = ambient.master
  return {
    present: true,
    state: ctx.state,
    sampleRate: Math.round(ctx.sampleRate),
    base: ctx.baseLatency,
    out: ctx.outputLatency,
    clock: ctx.currentTime,
    running: ambient.running,
    preset: ambient.presetId,
    bedLevel: ambient.level,
    gate: ambient.gate,
    master: master ? master.gain.value : null,
    aim: ambient._lastRampTarget
  }
}

function elementOf() {
  return speech.cloudAudio || document.getElementById('__speechAudio') || null
}

function speechReport(el) {
  const job = speech.job
  return {
    mode: job ? job.mode : '—',
    rate: job ? job.rate : null,
    paused: job ? !!job.paused : null,
    phrase: job ? `${(job.index ?? 0) + 1}/${job.phrases?.length ?? 0}` : '—',
    el: el
      ? {
          paused: el.paused,
          ended: el.ended,
          ready: el.readyState,
          rate: el.playbackRate,
          defaultRate: el.defaultPlaybackRate,
          pitch: !!(el.preservesPitch ?? el.webkitPreservesPitch),
          duration: el.duration,
          time: el.currentTime,
          src: (el.currentSrc || el.src || '').split('/').pop()
        }
      : null,
    bufferSource: speech.cloudSource ? 'yes' : 'no'
  }
}

async function geoReport() {
  let permission = 'unknown'
  try {
    const p = await navigator.permissions.query({ name: 'geolocation' })
    permission = p.state
  } catch {
    permission = navigator.geolocation ? 'query unsupported' : 'unsupported'
  }
  const s = useStore.getState()
  return { permission, youLoc: s.youLoc, presence: !!s.sharePresence }
}

async function report() {
  const el = elementOf()
  const before = el && !el.paused && !el.ended ? el.currentTime : null
  let observed = null
  if (before !== null) {
    await sleep(1200)
    if (!el.paused && !el.ended) observed = (el.currentTime - before) / 1.2
  }
  const e = env()
  const tier = {
    lowPowerClass: document.documentElement.classList.contains('low-power'),
    cores: navigator.hardwareConcurrency,
    mem: navigator.deviceMemory,
    coarse: coarse('pointer: coarse'),
    fine: coarse('pointer: fine'),
    touchPoints: navigator.maxTouchPoints,
    reducedMotion: coarse('prefers-reduced-motion: reduce'),
    webgl2: supportsWebGL2()
  }
  let sw = 'none'
  try {
    const keys = await caches.keys()
    sw = `${navigator.serviceWorker?.controller ? 'controlled' : 'uncontrolled'} [${keys.join(',')}]`
  } catch {}
  return {
    build: buildName(),
    ...e,
    screen: `${window.innerWidth}x${window.innerHeight} @${num(window.devicePixelRatio, 1)}`,
    tier,
    canvas: canvasReport(),
    audio: audioReport(),
    speech: speechReport(el),
    observed,
    geo: await geoReport(),
    net: navigator.onLine ? 'online' : 'offline',
    visibility: document.visibilityState,
    sw
  }
}

function lines(r) {
  const t = r.tier
  const a = r.audio
  const sp = r.speech
  const el = sp.el
  const obs = r.observed
  const real =
    obs === null
      ? 'not playing'
      : `${num(obs)}x observed${sp.rate && Math.abs(obs - sp.rate) > 0.2 ? '  ← MISMATCH' : ''}`
  return [
    `Joining Palms diagnostics`,
    `build    ${r.build}`,
    `env      ${r.device} · ${r.standalone ? 'standalone app' : 'browser tab'} · ${r.net} · ${r.visibility}`,
    `ua       ${r.ua}`,
    `screen   ${r.screen}`,
    `device   cores ${t.cores} · memory ${t.mem ?? '—'} · pointer coarse ${t.coarse} fine ${t.fine} · touch ${t.touchPoints} · reduced-motion ${t.reducedMotion}`,
    `tier     low-power ${t.lowPowerClass ? 'YES' : 'no'} · webgl2 ${t.webgl2} · canvases ${r.canvas.count} (webgl2 ${r.canvas.webgl2})`,
    `earth    ${r.canvas.webgl2 ? 'live scene' : 'STATIC fallback'} · ${r.canvas.version}`,
    `gpu      ${r.canvas.renderer}`,
    a.present
      ? `audio    ${a.state} · ${a.sampleRate} Hz · base ${num(a.base, 3)} · out ${num(a.out, 3)} · bed ${num(a.bedLevel)} × gate ${a.gate} = ${num(a.master)} · aim ${num(a.aim)} · ${a.preset}`
      : `audio    no context yet (nothing has played)`,
    `speech   mode ${sp.mode} · asked ${num(sp.rate)}x · phrase ${sp.phrase} · ${sp.bufferSource === 'yes' ? 'decoded buffer' : 'audio element'}`,
    el
      ? `element  claims ${num(el.rate)}x (default ${num(el.defaultRate)}x) · pitch ${el.pitch ? 'on' : 'off'} · ${num(el.time, 1)}/${num(el.duration, 1)}s · ${el.paused ? 'paused' : 'playing'} · ${el.src}`
      : `element  none`,
    `         ${real}`,
    `geo      permission ${r.geo.permission} · youLoc ${r.geo.youLoc ? `${r.geo.youLoc.lat},${r.geo.youLoc.lon}` : 'null'} · sharing ${r.geo.presence ? 'on' : 'off'}`,
    `sw       ${r.sw}`,
    ``,
    `tap Copy to put this on the clipboard, Reload to fetch a fresh build.`
  ].join('\n')
}

export function mountDiag() {
  const host = document.createElement('div')
  host.id = 'pe-diag'
  host.setAttribute('role', 'dialog')
  host.setAttribute('aria-label', 'Diagnostics')
  host.style.cssText = [
    'position:fixed',
    'left:0',
    'right:0',
    'bottom:0',
    'z-index:2147483000',
    'max-height:72%',
    'overflow:auto',
    'padding:10px 12px 14px',
    'background:rgba(4,10,7,.94)',
    'color:#d9ffe9',
    'border-top:1px solid rgba(120,255,190,.35)',
    'font:11px/1.45 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace',
    '-webkit-text-size-adjust:100%'
  ].join(';')

  const pre = document.createElement('pre')
  pre.style.cssText = 'margin:0 0 8px;white-space:pre-wrap;word-break:break-word'
  pre.textContent = 'reading…'

  const bar = document.createElement('div')
  bar.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap'
  const button = (label, onClick) => {
    const b = document.createElement('button')
    b.type = 'button'
    b.textContent = label
    b.style.cssText =
      'font:inherit;padding:6px 12px;border-radius:8px;border:1px solid rgba(120,255,190,.45);background:transparent;color:inherit'
    b.addEventListener('click', onClick)
    return b
  }

  let text = ''
  bar.append(
    button('Copy', async () => {
      try {
        await navigator.clipboard.writeText(text)
        bar.lastChild.textContent = 'Copied'
      } catch {
        // Clipboard needs permission in some contexts; selecting the block is
        // the fallback that always works.
        const range = document.createRange()
        range.selectNodeContents(pre)
        const sel = window.getSelection()
        sel.removeAllRanges()
        sel.addRange(range)
      }
    }),
    button('Reload', () => window.location.reload()),
    button('Close', () => host.remove())
  )

  host.append(pre, bar)
  document.body.append(host)

  const paint = async () => {
    try {
      const r = await report()
      text = lines(r)
      pre.textContent = text
      // Published for the browser test suite, which cannot tap the Copy button.
      window.__diagReport = r
    } catch (err) {
      pre.textContent = `diagnostics failed: ${err && err.message ? err.message : err}`
    }
  }
  paint()
  // A second pass once audio has been playing long enough to measure: the first
  // paint is what a reader sees immediately, the second carries the observed
  // rate that tells a lying playbackRate from a working one.
  setTimeout(paint, 2500)
}
