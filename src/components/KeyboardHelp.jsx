import React, { useEffect } from 'react'
import { useStore } from '../store.js'
import { useT } from '../i18n.js'

// A compact sheet listing every keyboard shortcut in the app. Opened with the
// ? key, the "?" button in the nav, or from settings.
export default function KeyboardHelp() {
  const open = useStore((s) => s.keyboardHelpOpen)
  const setOpen = useStore((s) => s.setKeyboardHelpOpen)
  const t = useT()

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setOpen])

  if (!open) return null
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
    <div className="sheet-backdrop" onClick={() => setOpen(false)}>
      <div className="sheet keys-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={t('keys.title')}>
        <div className="sheet-head">
          <div className="sheet-title-row">
            <h3 className="sheet-title">⌨ {t('keys.title')}</h3>
            <button className="sheet-x" onClick={() => setOpen(false)} aria-label={t('keys.close')} title={t('keys.close')}>✕</button>
          </div>
          <div className="sheet-handle" />
        </div>
        <div className="sheet-body">
          {rows.map((r) => (
            <div className="keys-row" key={r.k}>
              <kbd className="keys-kbd">{r.k}</kbd>
              <span className="keys-val">{r.v}</span>
            </div>
          ))}
          <p className="hint">{t('keys.hint')}</p>
        </div>
      </div>
    </div>
  )
}
