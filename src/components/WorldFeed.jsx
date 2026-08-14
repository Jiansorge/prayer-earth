import React, { useEffect, useMemo, useState } from 'react'
import { useStore } from '../store.js'
import { SPIRITUALITIES, getPrayerById } from '../data/prayers.js'
import { nearestPlace } from '../data/places.js'
import { useT, prayerTitle } from '../i18n.js'

const SPIRIT = Object.fromEntries(SPIRITUALITIES.map((s) => [s.id, s]))

const shortTitle = (prayerId) => {
  const p = getPrayerById(prayerId)
  return p ? p.title.split(',')[0].trim() : 'a prayer'
}

const ago = (t, tFn) => {
  const s = Math.floor((Date.now() - t) / 1000)
  if (s < 60) return tFn('feed.justNow')
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  return `${h}h`
}

function WorldFeed({ limit = 10, compact = false }) {
  const feed = useStore((s) => s.feed)
  const [, force] = useState(0)
  const t = useT()

  useEffect(() => {
    const timer = setInterval(() => force((x) => x + 1), 30000)
    return () => clearInterval(timer)
  }, [])

  const items = useMemo(
    () => (feed && feed.length ? feed.slice(-limit).reverse() : []),
    [feed, limit]
  )

  if (!items.length) return null

  return (
    <div className={`world-feed ${compact ? 'compact' : ''}`}>
      <div className="world-feed-title">
        <span className="feed-pulse" /> {t('feed.prayingNow')}
      </div>
      <div className="world-feed-scroll">
        {items.map((e) => {
          const place = e.cell
            ? nearestPlace(...e.cell.split(',').map(Number))
            : null
          return (
            <span key={e.id} className="feed-pill">
              <span className="feed-emoji">{SPIRIT[e.spiritId]?.emoji || '🕯️'}</span>
              <b>{e.name}</b>
              <span className="feed-prayer">
                {prayerTitle(t, e.prayerId, shortTitle(e.prayerId)).split(',')[0].trim()}
              </span>
              {place && <span className="feed-place">· {t('feed.near', { place })}</span>}
              <span className="feed-ago">{ago(e.t, t)}</span>
            </span>
          )
        })}
      </div>
    </div>
  )
}

export default React.memo(WorldFeed)
