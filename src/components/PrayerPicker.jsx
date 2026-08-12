import React, { useEffect, useRef, useState } from 'react'
import { useStore } from '../store.js'
import { SPIRITUALITY_BY_ID, loadSpirit } from '../data/prayers.js'
import { useT, prayerTitle } from '../i18n.js'
import { stopPlayback } from '../playback.js'
import Sparkles from './Sparkles.jsx'

// A quiet sheet that lists every prayer of a chosen tradition, so a person
// can see and choose any of them instead of always landing on the first one.
function PickerRow({ p, i, spirit, openPrayer, close, t }) {
  const today = useStore((s) => s.getPrayerToday(p.id))
  const now = useStore((s) => s.prayerCounts[p.id] || 0)
  const fav = useStore((s) => s.favorites.includes(p.id))
  const toggleFavorite = useStore((s) => s.toggleFavorite)
  const open = () => {
    const cur = useStore.getState()
    if (cur.playingPrayerId && cur.playingPrayerId !== p.id) {
      // Choosing a different prayer stops the one playing in the background.
      stopPlayback()
    }
    openPrayer(spirit.id, p.id)
    close()
  }
  return (
    <div
      className="picker-row"
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          open()
        }
      }}
    >
      <span className="picker-num">{i + 1}</span>
      <span className="picker-main">
        <span className="picker-row-title">{prayerTitle(t, p.id, p.title)}</span>
        <span className="picker-row-sub">{p.langLabel}</span>
      </span>
      <span className="picker-meta">
        <span className="picker-total">{t('prayer.today', { n: today.toLocaleString() })}</span>
        <span className="picker-now">{t('prayer.peoplePraying', { n: now })}</span>
      </span>
      <button
        className={`picker-fav ${fav ? 'on' : ''}`}
        onClick={(e) => {
          e.stopPropagation()
          toggleFavorite(p.id)
        }}
        aria-label={t('prayer.favorite')}
        title={t('prayer.favorite')}
      >
        {fav ? '★' : '☆'}
      </button>
      <span className="picker-go">→</span>
    </div>
  )
}
const PickerRowMemo = React.memo(PickerRow)

export default function PrayerPicker() {
  const spiritId = useStore((s) => s.prayerPickerSpiritId)
  const close = useStore((s) => s.closePrayerPicker)
  const openPrayer = useStore((s) => s.openPrayer)
  const favorites = useStore((s) => s.favorites)
  const sheetRef = useRef(null)
  const t = useT()
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!spiritId) return
    // Start each tradition with an empty search.
    setQuery('')
    // Load prayer texts for this spirit if not already loaded.
    if (!SPIRITUALITY_BY_ID[spiritId]?.prayers) loadSpirit(spiritId)
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

  // Fold away diacritics so searching "gayatri" finds "Gāyatrī", "s" finds
  // "ṣ", etc. (NFD decomposes the accent, then we strip combining marks).
  const norm = (s) =>
    String(s || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()

  const q = norm(query)
  const prayers = spirit.prayers || []
  const shown = q
    ? prayers.filter(
        (p) =>
          norm(p.title).includes(q) ||
          norm(p.langLabel || '').includes(q) ||
          norm(p.translation || '').includes(q)
      )
    : prayers

  const loading = !spirit.prayers

  return (
    <div className="picker-overlay" onClick={close} role="dialog" aria-modal="true" aria-labelledby="picker-title">
      <div className="picker-sheet" onClick={(e) => e.stopPropagation()} tabIndex={-1} ref={sheetRef}>
        <Sparkles count={10} />
        <div className="picker-head">
          <span className="picker-emoji">{spirit.emoji}</span>
          <div>
            <div id="picker-title" className="picker-title">{t('picker.title')}</div>
            <div className="picker-sub">{t(`trad.${spirit.id}.name`)} · {t(`trad.${spirit.id}.tagline`)}</div>
          </div>
          <button className="picker-x" onClick={close} aria-label={t('picker.close')}>
            ✕
          </button>
        </div>
        {loading ? (
          <div className="picker-loading">
            <span className="play-spinner" aria-hidden="true" />&ensp;{t('picker.loading')}
          </div>
        ) : (
          <>
        {prayers.length > 8 && (
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
        {!q && prayers.some((p) => favorites.includes(p.id)) && (
          <div className="picker-favs">
            {prayers
              .filter((p) => favorites.includes(p.id))
              .map((p) => (
                <button
                  key={p.id}
                  className="picker-fav-chip"
                  onClick={() => {
                    const cur = useStore.getState()
                    if (cur.playingPrayerId && cur.playingPrayerId !== p.id) stopPlayback()
                    openPrayer(spirit.id, p.id)
                    close()
                  }}
                >
                  ★ {prayerTitle(t, p.id, p.title).split(',')[0]}
                </button>
              ))}
          </div>
        )}
        <div className="picker-list">
          {shown.length === 0 && (
            <div className="picker-empty">{t('picker.none')}</div>          )}
          {shown.map((p, i) => (
            <PickerRowMemo key={p.id} p={p} i={i} spirit={spirit} openPrayer={openPrayer} close={close} t={t} />
          ))}
        </div>
          </>
        )}
      </div>
    </div>
  )
}
