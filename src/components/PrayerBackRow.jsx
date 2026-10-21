// The row above the chooser: back button, tradition identity, live headcount,
// favorite and share - the page's persistent chrome.
import React from 'react'
import { useT } from '../i18n.js'

export default function PrayerBackRow({ spirit, prayer, closePrayer, playing, paused, people, favorite, toggleFavorite, share, copied }) {
  const t = useT()
  return (
     <div className="back-row">
      <button onClick={closePrayer} aria-label={t('prayer.back')}>
        ←
      </button>
      <div>
        <div style={{ fontSize: 14, color: 'var(--ink-dim)' }}>
          {spirit.emoji} {t(`trad.${spirit.id}.name`)}
        </div>
        <div className="subtitle subline">
          {t(`trad.${spirit.id}.tagline`)}
        </div>
      </div>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span className="pulse-dot" />
        <span style={{ fontSize: 13, color: 'var(--ink-dim)' }}>{t('prayer.peoplePraying', { n: Math.max(playing && !paused ? 1 : 0, people) })}</span>
        <button
          className={`fave-btn ${favorite ? 'on' : ''}`}
          onClick={() => toggleFavorite(prayer.id)}
          aria-label={t('prayer.favorite')}
          title={t('prayer.favorite')}
        >
          {favorite ? '★' : '☆'}
        </button>
        <button className="share-btn" onClick={share} aria-label={t('prayer.share')} title={t('prayer.share')}>
          ⇪
        </button>
        {copied && <span className="copied-pill">{t('settings.copied')}</span>}
      </div>
    </div>
  )
}
