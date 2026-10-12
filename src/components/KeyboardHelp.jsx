import React, { useEffect } from 'react'
import { useStore } from '../store.js'
import { useT } from '../i18n.js'
import useFocusTrap from '../shared/useFocusTrap.js'
import ShortcutList from './KeyboardShortcuts.jsx'

// A compact sheet listing every keyboard shortcut in the app. Opened with the
// ? key, the "?" button in the nav, or from settings.
export default function KeyboardHelp() {
  const open = useStore((s) => s.keyboardHelpOpen)
  const setOpen = useStore((s) => s.setKeyboardHelpOpen)
  const t = useT()
  const sheetRef = useFocusTrap(open)

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setOpen])

  if (!open) return null
  return (
    <div className="sheet-backdrop" onClick={() => setOpen(false)}>
      <div className="sheet keys-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={t('keys.title')} tabIndex={-1} ref={sheetRef}>
        <div className="sheet-head">
          <div className="sheet-title-row">
            <h3 className="sheet-title">⌨ {t('keys.title')}</h3>
            <button className="sheet-x" onClick={() => setOpen(false)} aria-label={t('keys.close')} title={t('keys.close')}>✕</button>
          </div>
          <div className="sheet-handle" />
        </div>
        <div className="sheet-body">
          <ShortcutList />
        </div>
      </div>
    </div>
  )
}
