import React from 'react'
import { useT } from '../i18n.js'

// Every keyboard shortcut the app answers to, in the order they matter while
// praying. Kept in its own module because there are two places that show it:
// the "?" sheet (opened from the nav or the ? key) and the Keyboard panel
// inside settings. Duplicating the list would let the two drift, and a shortcut
// documented in one place and missing from the other is worse than neither.
export default function ShortcutList() {
  const t = useT()
  const rows = [
    { k: 'Space', v: t('keys.playPause') },
    { k: '↑ / ↓', v: t('keys.volume') },
    { k: 'M', v: t('keys.mute') },
    { k: 'R', v: t('keys.repeat') },
    { k: 'S', v: t('keys.stop') },
    { k: '1 / 2 / 3', v: t('keys.tabs') },
    { k: '?', v: t('keys.help') },
    { k: 'Esc', v: t('keys.close') }
  ]
  return (
    <>
      {rows.map((r) => (
        <div className="keys-row" key={r.k}>
          <kbd className="keys-kbd">{r.k}</kbd>
          <span className="keys-val">{r.v}</span>
        </div>
      ))}
      <p className="hint">{t('keys.hint')}</p>
    </>
  )
}