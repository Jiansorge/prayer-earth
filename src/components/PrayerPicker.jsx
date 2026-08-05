import React, { useEffect, useRef, useState } from 'react'
import { useStore } from '../store.js'
import { SPIRITUALITY_BY_ID } from '../data/prayers.js'
import { useT } from '../i18n.js'

// A quiet sheet that lists every prayer of a chosen tradition, so a person
// can see and choose any of them instead of always landing on the first one.
function PickerRow({ p, i, spirit, openPrayer, close, t }) {
  const today = useStore((s) => s.getPrayerToday(p.id))
  const now = useStore((s) => s.prayerCounts[p.id] || 0)
  return (
    <button
      className="picker-row"
      onClick={() => {
        openPrayer(spirit.id, p.id)
        close()
      }}
    >
      <span className="picker-num">{i + 1}</span>
      <span className="picker-main">
        <span className="picker-row-title">{p.title}</span>
        <span className="picker-row-sub">{p.langLabel}</span>
      </span>
      <span className="picker-meta">
        <span className="picker-total">{t('prayer.today', { n: today.toLocaleString() })}</span>
        <span className="picker-now">{t('prayer.peoplePraying', { n: now })}</span>
      </span>
      <span className="picker-go">→</span>
    </button>
  )
}

export default function PrayerPicker() {
  const spiritId = useStore((s) => s.prayerPickerSpiritId)
  const close = useStore((s) => s.closePrayerPicker)
  const openPrayer = useStore((s) => s.openPrayer)
  const sheetRef = useRef(null)
  const t = useT()
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!spiritId) return
    // Start each tradition with an empty search.
    setQuery('')
    const onKey = (e) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    const t2 = setTimeout(() => sheetRef.current && sheetRef.current.focus(), 40)
    return () => {
      clearTimeout(t2)
      window.removeEventListener('keydown', onKey)
    }
  }, [spiritId, close])

  if (!spiritId) return null
  const spirit = SPIRITUALITY_BY_ID[spiritId]
  if (!spirit) return null

  const q = query.trim().toLowerCase()
  const shown = q
    ? spirit.prayers.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          (p.langLabel || '').toLowerCase().includes(q)
      )
    : spirit.prayers

  return (
    <div className="picker-overlay" onClick={close} role="dialog" aria-modal="true">
      <div className="picker-sheet" onClick={(e) => e.stopPropagation()} tabIndex={-1} ref={sheetRef}>
        <div className="picker-head">
          <span className="picker-emoji">{spirit.emoji}</span>
          <div>
            <div className="picker-title">{t('picker.title')}</div>
            <div className="picker-sub">{t(`trad.${spirit.id}.name`)} · {t(`trad.${spirit.id}.tagline`)}</div>
          </div>
          <button className="picker-x" onClick={close} aria-label={t('picker.close')}>
            ✕
          </button>
        </div>
        {spirit.prayers.length > 8 && (
          <div className="picker-search">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('picker.search')}
              aria-label={t('picker.search')}
            />
          </div>
        )}
        <div className="picker-list">
          {shown.length === 0 && (
            <div className="picker-empty">{t('picker.none')}</div>
          )}
          {shown.map((p, i) => (
            <PickerRow key={p.id} p={p} i={i} spirit={spirit} openPrayer={openPrayer} close={close} t={t} />
          ))}
        </div>
      </div>
    </div>
  )
}
