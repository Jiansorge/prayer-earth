import React from 'react'
import { useT } from '../i18n.js'
import PanelShell from './PanelShell.jsx'
import ShortcutList from './KeyboardShortcuts.jsx'

// The shortcut list, as a settings sub-panel. It used to close the whole sheet
// and open the separate "?" modal on top, which threw away the scroll position
// and every other control, and left no way back into settings. From here Back
// returns to the list you came from, like Privacy and the rest.
export function KeysPanel({ onBack }) {
  const t = useT()
  return (
    <PanelShell title={`⌨ ${t('keys.title')}`} onBack={onBack} testId="panel-keys">
      <div className="keys-panel-list">
        <ShortcutList />
      </div>
    </PanelShell>
  )
}
