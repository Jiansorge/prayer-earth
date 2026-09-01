import React, { useEffect, useRef, useState } from 'react'
import { useStore } from '../store.js'
import { SPIRITUALITY_BY_ID, loadSpirit } from '../data/prayers.js'
import { useT, prayerTitle } from '../i18n.js'
import { stopPlayback } from '../playback.js'
import Sparkles from './Sparkles.jsx'

// Anonymous Gregorian Easter algorithm — exact Easter Sunday for any year >= 1583.
function easterDate(year) {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

// US Thanksgiving: 4th Thursday of November.
function thanksgivingDate(year) {
  const d = new Date(year, 10, 1)
  const weekday = d.getDay()
  const firstThursday = 1 + (4 - weekday + 7) % 7
  const fourthThursday = firstThursday + 21
  return `${year}-11-${String(fourthThursday).padStart(2, '0')}`
}

function matchesDate(dates, season) {
  if (season) {
    const now = new Date()
    const y = now.getFullYear()
    const mmdd = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const ymd = `${y}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    if (season === 'easter' && (ymd === easterDate(y) || ymd === easterDate(y - 1))) return true
    if (season === 'thanksgiving' && (ymd === thanksgivingDate(y) || ymd === thanksgivingDate(y - 1))) return true
    return false
  }
  if (!dates || !dates.length) return true
  const now = new Date()
  const mmdd2 = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const ymd2 = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return dates.some((d) => d === ymd2 || d === mmdd2)
}

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
        <span className="picker-total" title={t('prayer.todayTitle')}>{t('prayer.today', { n: today.toLocaleString() })}</span>
        <span className="picker-now" title={t('prayer.prayingNowTitle')}>{t('prayer.peoplePraying', { n: now })}</span>
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
  const [, reload] = useState(0)

  useEffect(() => {
    if (!spiritId) return
    // Start each tradition with an empty search.
    setQuery('')
    // Load prayer texts for this spirit if not already loaded.
    if (!SPIRITUALITY_BY_ID[spiritId]?.prayers) loadSpirit(spiritId).then(() => reload((x) => x + 1))
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
  const prayers = (spirit.prayers || []).filter((p) => matchesDate(p.dates, p.season))
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
