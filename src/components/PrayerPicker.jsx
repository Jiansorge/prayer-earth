import React from 'react'
import { useStore } from '../store.js'
import { SPIRITUALITY_BY_ID } from '../data/prayers.js'
import { useT } from '../i18n.js'

// A quiet sheet that lists every prayer of a chosen tradition, so a person
// can see and choose any of them instead of always landing on the first one.
function PickerRow({ p, i, spirit, openPrayer, close, t }) {
  const total = useStore((s) => s.getPrayerTotal(p.id))
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
        <span className="picker-total">{t('prayer.allTime', { n: total.toLocaleString() })}</span>
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
  const t = useT()

  if (!spiritId) return null
  const spirit = SPIRITUALITY_BY_ID[spiritId]
  if (!spirit) return null

  return (
    <div className="picker-overlay" onClick={close} role="dialog" aria-modal="true">
      <div className="picker-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="picker-head">
          <span className="picker-emoji">{spirit.emoji}</span>
          <div>
            <div className="picker-title">{t('picker.title')}</div>
            <div className="picker-sub">{spirit.name} · {spirit.tagline}</div>
          </div>
          <button className="picker-x" onClick={close} aria-label={t('picker.close')}>
            ✕
          </button>
        </div>
        <div className="picker-list">
          {spirit.prayers.map((p, i) => (
            <PickerRow key={p.id} p={p} i={i} spirit={spirit} openPrayer={openPrayer} close={close} t={t} />
          ))}
        </div>
      </div>
    </div>
  )
}
