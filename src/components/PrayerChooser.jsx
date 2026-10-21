// The horizontal prayer list: chips, arrows, wheel-scroll, and keeping the
// chosen chip in view. Owns its own scroll ref and arrow state because every
// piece of it exists to move that one list.
import React, { useEffect, useRef, useState } from 'react'
import { useT, prayerTitle } from '../i18n.js'
import { useStore } from '../store.js'

export default function PrayerChooser({ spirit, spiritId, prayerId, prayerCounts, stopJob, openPrayer, openPrayerPicker }) {
  const t = useT()

  // Keep the chosen prayer's chip in view when switching prayers or traditions.
  const chooserRef = useRef(null)

  // Hovering the prayer list, a vertical mouse-wheel scrolls it horizontally.
  useEffect(() => {
    const el = chooserRef.current
    if (!el) return
    const onWheel = (e) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        el.scrollLeft += e.deltaY
        e.preventDefault()
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  useEffect(() => {
    const el = chooserRef.current
    if (!el) return
    const active = el.querySelector('.chip.on')
    if (active && active.scrollIntoView) {
      active.scrollIntoView({ inline: 'nearest', block: 'nearest' })
    }
  }, [prayerId, spiritId])

  // Left/right arrows make the horizontal prayer list obviously scrollable.
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(false)
  const updateArrows = () => {
    const el = chooserRef.current
    if (!el) return
    setCanLeft(el.scrollLeft > 4)
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4)
  }
  useEffect(() => {
    updateArrows()
    const el = chooserRef.current
    if (!el) return
    el.addEventListener('scroll', updateArrows, { passive: true })
    window.addEventListener('resize', updateArrows)
    return () => {
      el.removeEventListener('scroll', updateArrows)
      window.removeEventListener('resize', updateArrows)
    }
  }, [spiritId])
  const scrollChooser = (dir) => {
    const el = chooserRef.current
    if (!el) return
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: 'smooth' })
  }
  return (
    <div className="chooser-wrap">
      <button
        className={`chooser-arrow left ${canLeft ? '' : 'off'}`}
        onClick={() => scrollChooser(-1)}
        disabled={!canLeft}
aria-label={t('prayer.prev')}
      >
        ‹
      </button>
      <div className="chooser" ref={chooserRef}>
        <button
          className="chip chip-all"
          onClick={() => openPrayerPicker(spiritId)}
          title={t('picker.all')}
        >
          ☰ <span className="chip-all-label">{t('picker.all')}</span>
        </button>
        {(spirit.prayers || []).map((p) => (
          <button
            key={p.id}
            className={`chip ${p.id === prayerId ? 'on' : ''}`}
            onClick={() => {
              const cur = useStore.getState()
              if (cur.playingPrayerId && cur.playingPrayerId !== p.id) stopJob()
              openPrayer(spiritId, p.id)
            }}
          >
            {prayerTitle(t, p.id, p.title)}
            <span className={`chip-count ${p.id === prayerId ? 'on' : ''}`}>
              {prayerCounts[p.id] || 0}
            </span>
          </button>
        ))}
      </div>
      <button
        className={`chooser-arrow right ${canRight ? '' : 'off'}`}
        onClick={() => scrollChooser(1)}
        disabled={!canRight}
        aria-label={t('prayer.next')}
      >
        ›
      </button>
    </div>
  )
}
