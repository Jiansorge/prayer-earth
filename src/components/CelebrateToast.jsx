import React, { useEffect, useRef, useState } from 'react'
import { useStore } from '../store.js'
import { useT } from '../i18n.js'

// A brief, gentle toast when a full prayer completes: a soft gold shimmer and
// a line that fades by itself, so finishing a prayer always feels seen.
export default function CelebrateToast() {
  const completedAt = useStore((s) => s.completedAt)
  const [show, setShow] = useState(false)
  const timer = useRef(null)
  const t = useT()

  useEffect(() => {
    if (!completedAt) return
    setShow(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setShow(false), 2600)
    return () => clearTimeout(timer.current)
  }, [completedAt])

  if (!show) return null
  return (
    <div className="celebrate-toast" role="status" aria-live="polite">
      <span className="celebrate-spark">✨</span>
      <span>{t('prayer.doneToast')}</span>
    </div>
  )
}
