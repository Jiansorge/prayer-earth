import React, { useEffect, useState } from 'react'
import { useStore } from '../store.js'
import { SPIRITUALITIES, getPrayerWithSpirit, loadSpirit, isLoaded } from '../data/prayers.js'
import { useT, prayerTitle } from '../i18n.js'

export default function HomeFavs() {
  const favorites = useStore((s) => s.favorites)
  const openPrayer = useStore((s) => s.openPrayer)
  const t = useT()
  const [, bump] = useState(0)

  useEffect(() => {
    if (!favorites.length) return
    const missing = favorites.filter((id) => !getPrayerWithSpirit(id))
    if (!missing.length) return
    let dead = false
    const toLoad = SPIRITUALITIES.filter((s) => !isLoaded(s.id)).map((s) => loadSpirit(s.id))
    Promise.all(toLoad).then(() => {
      if (!dead) bump((x) => x + 1)
    })
    return () => {
      dead = true
    }
  }, [favorites.join(',')])

  const items = favorites.length ? favorites.map((id) => getPrayerWithSpirit(id)).filter(Boolean) : []
  const hasFavs = items.length > 0
  const showHint = !favorites.length || (!hasFavs && favorites.length > 0)

  if (showHint) {
    return (
      <div className="home-favs home-favs-empty">
        <div className="home-favs-head">
          <span className="home-favs-title">☆ {t('home.favorites')}</span>
        </div>
        <div className="home-favs-hint">{t('home.favoritesHint')}</div>
      </div>
    )
  }
  if (!hasFavs) return null

  return (
    <div className="home-favs">
      <div className="home-favs-head">
        <span className="home-favs-title">★ {t('home.favorites')}</span>
      </div>
      <div className="home-favs-scroll">
        {items.map(({ prayer, spirit }) => (
          <button
            key={prayer.id}
            className="home-fav-chip"
            onClick={() => openPrayer(spirit.id, prayer.id)}
            aria-label={prayerTitle(t, prayer.id, prayer.title)}
          >
            <span className="home-fav-emoji" aria-hidden="true">{spirit.emoji}</span>
            <span className="home-fav-label">{prayerTitle(t, prayer.id, prayer.title).split(',')[0].trim()}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
