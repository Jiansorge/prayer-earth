import React, { useEffect, useRef, useState } from 'react'
import { useStore } from '../store.js'
import { SPIRITUALITY_BY_ID, loadSpirit } from '../data/prayers.js'
import { useT, prayerTitle } from '../i18n.js'
import { stopPlayback, playChosenPrayer } from '../playback.js'
import useFocusTrap from '../shared/useFocusTrap.js'
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
function PickerRow({ p, i, spirit, t }) {
  const today = useStore((s) => s.getPrayerToday(p.id))
  const now = useStore((s) => s.prayerCounts[p.id] || 0)
  const fav = useStore((s) => s.favorites.includes(p.id))
  const toggleFavorite = useStore((s) => s.toggleFavorite)
  const open = async () => {
    const cur = useStore.getState()
    if (cur.playingPrayerId && cur.playingPrayerId !== p.id) {
      // Choosing a different prayer stops the one playing in the background.
      // Awaited: stopPlayback clears pendingPlay as part of stopping, and it
      // settles after an await of its own - firing the pick before that lands
      // would let the stop's clear wipe the pick's freshly armed flag, and the
      // chosen prayer would never speak.
      await stopPlayback()
    }
    // Picking a prayer means hearing it - arm the same pendingPlay path the
    // footer play button uses so the prayer page starts it on mount. The
    // store action closes the picker in the same set, so a double-tap is one
    // nav key and the throttle drops the duplicate start.
    playChosenPrayer(spirit.id, p.id)
  }
  return (
    <div
      className="picker-row"
      onClick={(e) => {
        // Whole-row tap/click convenience for mouse users; the inner button is
        // what keyboard + screen-reader users activate. Ignore fav clicks.
        if (e.target.closest && e.target.closest('.picker-fav')) return
        open()
      }}
    >
      <button
        className="picker-open"
        onClick={(e) => {
          e.stopPropagation()
          open()
        }}
        aria-label={prayerTitle(t, p.id, p.title)}
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
        <span className="picker-go">→</span>
      </button>
      <button
        className={`picker-fav ${fav ? 'on' : ''}`}
        onClick={(e) => {
          e.stopPropagation()
          toggleFavorite(p.id)
        }}
        aria-label={t('prayer.favorite')}
        aria-pressed={!!fav}
        title={t('prayer.favorite')}
      >
        {fav ? '★' : '☆'}
      </button>
    </div>
  )
}
const PickerRowMemo = React.memo(PickerRow)

// Scroll memory for the prayer list, keyed by tradition.
//
// Module-level for the same reason SettingsSheet's is: the picker renders null
// while closed, so by the next open the list element - and any offset kept on
// the instance - is gone. Scrolling thirty prayers down, tapping one, and
// coming back should land where the reader was, not at the top.
//
// Keyed by spirit rather than one shared value, so opening a different
// tradition starts at its own top instead of inheriting a stranger's offset.
const listScrollMemory = Object.create(null)

export default function PrayerPicker() {
  const spiritId = useStore((s) => s.prayerPickerSpiritId)
  const close = useStore((s) => s.closePrayerPicker)
  const favorites = useStore((s) => s.favorites)
  const sheetRef = useFocusTrap(!!spiritId)
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
    return () => {
      window.removeEventListener('keydown', onKey)
    }
  }, [spiritId, close])

  const listRef = useRef(null)
  // Read during render, above the early return: a hook below it is a
  // conditional hook, and React throws on those. This also has to be checked
  // here because the list only renders once a tradition has loaded.
  const spiritLoaded = !!(spiritId && SPIRITUALITY_BY_ID[spiritId]?.prayers)

  // Restore only. Banking is the element's own onScroll, further down - see the
  // comment there for why an addEventListener here was not good enough.
  //
  // Keyed on the load as well as the tradition: on a first open the picker is
  // still on its loading row, listRef.current is null, and the restore would be
  // attempted against nothing - so the effect simply runs again when the
  // prayers land and the list is really there.
  useEffect(() => {
    if (!spiritId || !spiritLoaded) return undefined
    const el = listRef.current
    if (!el) return undefined
    const wanted = listScrollMemory[spiritId] || 0

    // Restore after layout, not during the commit: the focus trap moves focus
    // into the sheet shortly after opening, and a focused row is scrolled into
    // view - which would land on top of any offset set earlier.
    const frame = requestAnimationFrame(() => {
      if (listRef.current !== el) return
      el.scrollTop = wanted
    })
    return () => cancelAnimationFrame(frame)
  }, [spiritId, spiritLoaded])

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

  // Banking lives here rather than on an effect's addEventListener.
  //
  // An effect's listener is attached once, to whatever listRef.current was when
  // that effect last ran, and it dies with that node. Anything that remounts the
  // list between tradition changes - and nothing re-attaches it until the next
  // load - would silently stop banking, so every close would land at the top.
  // A React handler is re-bound on every render to the element actually on
  // screen, and it closes over this render's `q` rather than reading a ref that
  // may not have been updated yet.
  //
  // Ignored while a search is active: the filtered list is a different list, and
  // the browser clamping it on every keystroke would overwrite the place the
  // reader was in the full one - so a search never loses their position.
  const onListScroll = () => {
    if (q || !spiritId) return
    const el = listRef.current
    if (el) listScrollMemory[spiritId] = el.scrollTop
  }
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
            <span className="play-spinner" aria-hidden="true" />{t('picker.loading')}
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
                  onClick={async () => {
                    const cur = useStore.getState()
                    if (cur.playingPrayerId && cur.playingPrayerId !== p.id) {
                      await stopPlayback()
                    }
                    playChosenPrayer(spirit.id, p.id)
                  }}
                >
                  ★ {prayerTitle(t, p.id, p.title).split(',')[0]}
                </button>
              ))}
          </div>
        )}
        <div className="picker-list" ref={listRef} onScroll={onListScroll}>
          {shown.length === 0 && (
            <div className="picker-empty">{t('picker.none')}</div>          )}
          {shown.map((p, i) => (
            <PickerRowMemo key={p.id} p={p} i={i} spirit={spirit} t={t} />
          ))}
        </div>
          </>
        )}
      </div>
    </div>
  )
}
