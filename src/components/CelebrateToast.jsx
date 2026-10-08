import React, { useEffect, useRef, useState } from 'react'
import { useStore } from '../store.js'

// When a prayer finishes there's no loud toast — just a soft gold sparkle that
// pops near the top and a gentle glow that washes over the page, then fades.
export default function CelebrateToast() {
  const completedAt = useStore((s) => s.completedAt)
  const [show, setShow] = useState(false)
  const timer = useRef(null)
  const raf = useRef(0)

  useEffect(() => {
    if (!completedAt) return
    setShow(false)
    // The handle is stored and cancelled. It used to be discarded, which left a
    // frame that could fire setShow(true) after this effect had already been
    // cleaned up - two prayer completions in one frame armed two of them, and the
    // fade and the 1.8s dismissal timer then drifted out of phase.
    raf.current = requestAnimationFrame(() => setShow(true))
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setShow(false), 1800)
    return () => {
      cancelAnimationFrame(raf.current)
      raf.current = 0
      clearTimeout(timer.current)
    }
  }, [completedAt])

  if (!show) return null
  return (
    <div className="celebrate-wrap" aria-hidden="true">
      <span className="celebrate-sparkle">✦</span>
      <span className="celebrate-sparkle s2">✦</span>
      <span className="celebrate-sparkle s3">✦</span>
    </div>
  )
}
