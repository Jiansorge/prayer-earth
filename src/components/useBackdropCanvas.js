import { useEffect } from 'react'

// Shared animation harness for the procedural canvas backdrops: sizes the
// canvas, runs a requestAnimationFrame loop, pauses when the tab is hidden,
// and draws a single static frame for people who prefer reduced motion.
//
// draw(ctx, dpr, t, reduced, size) is called every frame; t is seconds and
// size is a cached {w, h} (CSS px) that only changes on window resize.

const buffered = new WeakMap() // canvas -> {w, h} in CSS pixels

// Size a full-viewport canvas WITHOUT forcing work on every frame. Assigning
// canvas.width/height resets the backing store and invalidates layout (a
// forced reflow cost that previously ran 60×/second). Only touch the canvas
// when the CSS-pixel size really changed; draw() can read `w`/`h` freely.
export function fitCanvas(canvas, w, h, dpr) {
  const prev = buffered.get(canvas)
  if (prev && prev.w === w && prev.h === h) return
  canvas.width = Math.round(w * dpr)
  canvas.height = Math.round(h * dpr)
  canvas.style.width = w + 'px'
  canvas.style.height = h + 'px'
  buffered.set(canvas, { w, h })
}

// Ambient backdrops are slow-moving gradients, starfields and auroras. Running
// them at the display's full 60fps is wasted work AND actively harmful: the fixed
// nav bar has a backdrop-filter, which forces the browser to re-composite and
// re-blur that region on every frame the backdrop changes. Measured on the home
// page: the backdrop animating at 60fps gave ~15fps with 44 dropped frames per
// 3s, while the same page with the same blur and a static backdrop gave ~60fps
// and zero dropped frames.
//
// So cap the backdrops by wall-clock time rather than by hardware. Time-based
// rather than `frame & 1`, because frame counting assumes frames are arriving on
// schedule - which is exactly what stops being true once the page is struggling,
// and would then drop every frame instead of every other one.
const AMBIENT_FPS = 24
const MIN_FRAME_MS = 1000 / AMBIENT_FPS

export function useBackdropCanvas(ref, draw) {
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    // getContext('2d') returns null when the canvas already holds another
    // context type or the context has been lost. That used to turn a recoverable
    // null into an exception thrown from inside the frame callback, sixty times
    // a second, forever - see the try/catch in loop().
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const reduced = !!(
      window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
    // Low-end devices (few cores) get a lighter canvas: lower resolution and half
    // the frame budget so the animated backdrop doesn't starve the rest of the app.
    const low = typeof navigator !== 'undefined' && navigator.hardwareConcurrency <= 4
    const dpr = Math.min(window.devicePixelRatio || 1, low ? 1 : 1.5)
    const minFrameMs = low ? MIN_FRAME_MS * 2 : MIN_FRAME_MS

    // Cache the viewport once and re-measure only on resize. The animation
    // loop must NEVER query window layout props — that forces a sync layout
    // on a 60fps hot path.
    const size = { w: window.innerWidth || 1, h: window.innerHeight || 1 }
    fitCanvas(canvas, size.w, size.h, dpr)

    let raf = 0
    let lastDraw = -Infinity
    let stopped = false
    const loop = (t) => {
      // Always queue the next frame first: skipping that when we skip a draw
      // would stall the loop completely.
      raf = requestAnimationFrame(loop)
      if (t - lastDraw < minFrameMs) return
      lastDraw = t
      try {
        draw(ctx, dpr, t / 1000, reduced, size)
      } catch {
        // Because the next frame is armed above, a throw here used to be
        // re-thrown on every following frame: an unbounded exception loop
        // burning a core until the component unmounted. One failure stops the
        // loop instead, which is a blank backdrop rather than a pinned CPU.
        stopped = true
        cancelAnimationFrame(raf)
        raf = 0
      }
    }

    const onResize = () => {
      size.w = window.innerWidth || 1
      size.h = window.innerHeight || 1
      fitCanvas(canvas, size.w, size.h, dpr)
      if (!raf && !stopped && !document.hidden) {
        lastDraw = -Infinity
        raf = requestAnimationFrame(loop)
      }
    }
    const onVis = () => {
      cancelAnimationFrame(raf)
      raf = 0
      if (!document.hidden && !reduced) raf = requestAnimationFrame(loop)
    }
    if (reduced) draw(ctx, dpr, 2.5, reduced, size)
    else raf = requestAnimationFrame(loop)
    window.addEventListener('resize', onResize)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [ref, draw])
}
