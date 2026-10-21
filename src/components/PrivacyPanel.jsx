import React from 'react'
import { useStore } from '../store.js'
import { useT } from '../i18n.js'
import { syncClient } from '../sync/client.js'
import PanelShell from './PanelShell.jsx'

// Privacy: the one place another person can see you, so the toggle lives here
// with a plain statement of what is and is not sent.
export function PrivacyPanel({ onBack, onOpenLegal }) {
  const t = useT()
  const sharePresence = useStore((s) => s.sharePresence)

  return (
    <PanelShell title={t('settings.secPrivacy')} onBack={onBack} testId="panel-privacy">
      <div className="presence-row">
        <input
          id="share-presence"
          type="checkbox"
          className="presence-toggle"
          checked={!!sharePresence}
          onChange={(e) => syncClient.setPresenceSharing(e.target.checked)}
          data-testid="privacy-presence-toggle"
        />
        <label htmlFor="share-presence" className="presence-label">
          <span className="presence-title">{t('settings.sharePresence')}</span>
          <span className="field-hint">{t('settings.sharePresenceHint')}</span>
        </label>
      </div>

      {/* Say what is happening right now, not only what the toggle does. */}
      <div className="field-hint" data-testid="privacy-state">
        {sharePresence ? t('settings.privacyOn') : t('settings.privacyOff')}
      </div>

      <button type="button" className="field-btn" onClick={onOpenLegal}>
        {t('settings.legal')}
      </button>
    </PanelShell>
  )
}
