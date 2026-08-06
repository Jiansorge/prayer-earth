import React, { useEffect, useRef, useState } from 'react'
import { useStore } from '../store.js'

// When a prayer finishes there's no loud toast — just a soft gold sparkle that
// pops near the top and a gentle glow that washes over the page, then fades.
export default function CelebrateToast() {
  const completedAt = useStore((s) => s.completedAt)
  const [show, setShow] = useState(false)
  const timer = useRef(null)

  useEffect(() => {
    if (!completedAt) return
    setShow(false)
    requestAnimationFrame(() => setShow(true))
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setShow(false), 1800)
    return () => clearTimeout(timer.current)
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
