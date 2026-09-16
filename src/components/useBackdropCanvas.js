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

export function useBackdropCanvas(ref, draw) {
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const reduced = !!(
      window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
    // Low-end devices (few cores) get a lighter canvas: lower resolution and a
    // ~30fps cap so the animated backdrop doesn't starve the rest of the app.
    const low = typeof navigator !== 'undefined' && navigator.hardwareConcurrency <= 4
    const dpr = Math.min(window.devicePixelRatio || 1, low ? 1 : 1.5)

    // Cache the viewport once and re-measure only on resize. The animation
    // loop must NEVER query window layout props — that forces a sync layout
    // on a 60fps hot path.
    const size = { w: window.innerWidth || 1, h: window.innerHeight || 1 }
    fitCanvas(canvas, size.w, size.h, dpr)

    let raf = 0
    let frame = 0
    const loop = (t) => {
      frame++
      if (low && (frame & 1)) {
        raf = requestAnimationFrame(loop)
        return
      }
      draw(ctx, dpr, t / 1000, reduced, size)
      if (!reduced) raf = requestAnimationFrame(loop)
    }

    const onResize = () => {
      size.w = window.innerWidth || 1
      size.h = window.innerHeight || 1
      fitCanvas(canvas, size.w, size.h, dpr)
      if (!raf) raf = requestAnimationFrame(loop)
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
