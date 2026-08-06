import { useEffect } from 'react'

// Shared animation harness for the procedural canvas backdrops: sizes the
// canvas, runs a requestAnimationFrame loop, pauses when the tab is hidden,
// and draws a single static frame for people who prefer reduced motion.
//
// draw(ctx, dpr, t, reduced) is called every frame; t is seconds.
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

    let raf = 0
    let frame = 0
    const loop = (t) => {
      frame++
      if (low && (frame & 1)) {
        raf = requestAnimationFrame(loop)
        return
      }
      draw(ctx, dpr, t / 1000, reduced)
      if (!reduced) raf = requestAnimationFrame(loop)
    }
    if (reduced) draw(ctx, dpr, 2.5, reduced)
    else raf = requestAnimationFrame(loop)

    const onResize = () => {
      if (!raf) raf = requestAnimationFrame(loop)
    }
    const onVis = () => {
      cancelAnimationFrame(raf)
      raf = 0
      if (!document.hidden && !reduced) raf = requestAnimationFrame(loop)
    }
    window.addEventListener('resize', onResize)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [ref, draw])
}
