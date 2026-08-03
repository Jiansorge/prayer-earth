import React, { useEffect, useState } from 'react'
import { useStore } from '../store.js'
import { SPIRITUALITIES } from '../data/prayers.js'
import { nearestPlace } from '../data/places.js'
import { useT } from '../i18n.js'

const SPIRIT = Object.fromEntries(SPIRITUALITIES.map((s) => [s.id, s]))
const SHORT = {}
for (const s of SPIRITUALITIES) {
  for (const p of s.prayers) {
    SHORT[p.id] = p.title.split('—')[0].trim()
  }
}

const ago = (t, tFn) => {
  const s = Math.floor((Date.now() - t) / 1000)
  if (s < 60) return tFn('feed.justNow')
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  return `${h}h`
}

export default function WorldFeed({ limit = 10, compact = false }) {
  const feed = useStore((s) => s.feed)
  const [, force] = useState(0)
  const t = useT()

  useEffect(() => {
    const timer = setInterval(() => force((x) => x + 1), 30000)
    return () => clearInterval(timer)
  }, [])

  if (!feed || feed.length === 0) return null

  const items = feed.slice(-limit).reverse()

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
              <span className="feed-prayer">{SHORT[e.prayerId] || 'a prayer'}</span>
              {place && <span className="feed-place">· {t('feed.near', { place })}</span>}
              <span className="feed-ago">{ago(e.t, t)}</span>
            </span>
          )
        })}
      </div>
    </div>
  )
}
