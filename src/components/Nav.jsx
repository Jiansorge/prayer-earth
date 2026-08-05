import React from 'react'
import { useStore } from '../store.js'
import { SPIRITUALITIES } from '../data/prayers.js'
import { useT } from '../i18n.js'
import { requestPlayToggle, stopPlayback } from '../playback.js'

const ITEMS = [
  { id: 'home', icon: '🌙', labelKey: 'nav.home' },
  { id: 'prayer', icon: '🙏', labelKey: 'nav.pray' },
  { id: 'earth', icon: '🌍', labelKey: 'nav.earth' }
]

export default function Nav() {
  const view = useStore((s) => s.view)
  const go = useStore((s) => s.go)
  const openPrayer = useStore((s) => s.openPrayer)
  const praying = useStore((s) => s.praying)
  const playing = useStore((s) => s.playing)
  const paused = useStore((s) => s.paused)
  const t = useT()

  const onTap = (id) => {
    if (id === 'prayer') {
      const s = useStore.getState()
      if (!s.spiritId) {
        // Nothing chosen yet, open the first path so the view never crashes.
        openPrayer(SPIRITUALITIES[0].id, SPIRITUALITIES[0].prayers[0].id)
      } else {
        go('prayer')
      }
      return
    }
    go(id)
  }

  return (
    <nav className="nav">
      {ITEMS.map((item, idx) => {
        const label = t(item.labelKey)
        return (
          <React.Fragment key={item.id}>
            <button
              className={view === item.id ? 'active' : ''}
              onClick={() => onTap(item.id)}
              aria-label={label}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">
                {label}
                {item.id === 'prayer' && praying && (
                  <span className="pulse-dot" style={{ marginLeft: 6 }} />
                )}
              </span>
            </button>
            {item.id === 'prayer' && (
              <button
                className={`nav-play ${playing && !paused ? 'on' : ''}`}
                onClick={requestPlayToggle}
                aria-label={playing && !paused ? t('prayer.pause') : t('prayer.pray')}
              >
                {playing && !paused ? '❚❚' : '▶\uFE0E'}
              </button>
            )}
            {item.id === 'prayer' && (playing || praying) && (
              <button
                className="nav-stop"
                onClick={stopPlayback}
                aria-label={t('prayer.stop')}
                title={t('prayer.stop')}
              >
                ◼
              </button>
            )}
          </React.Fragment>
        )
      })}
    </nav>
  )
}
