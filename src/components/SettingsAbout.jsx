import React from 'react'
import { useT } from '../i18n.js'
import { openExternal } from '../shared/openExternal.js'
import { isAppShell, isMobile } from '../shared/mobile.js'
import { SettingsRow } from './SettingsRow.jsx'
import { REPORT_URL } from '../shared/canonical.js'

export default function SettingsAbout({ origin, shareApp, setLegalOpen, setPanel }) {
  const t = useT()
  return (
    <>
          <div className="field-divider" />
  
          <label className="field-label section">{t('settings.secAbout')}</label>
  
          <button className="field-btn" onClick={() => setLegalOpen(true)}>
            {t('settings.legal')}
          </button>
  
          {/* Attribution + a way to report a re-upload. Honest scope: the app
              ships free and stays free. This cannot stop someone repackaging an
              APK -- any Android build can be unpacked -- but it puts the author's
              name and a reporting route inside the app itself, which is what makes
              a takedown straightforward if a copy is published. */}
          <div className="field-hint field-note">{t('settings.madeBy')}</div>
          <button className="field-url" onClick={() => shareApp('web')} title={origin}>
            {origin}
          </button>
          <button type="button" className="field-report" onClick={() => openExternal(REPORT_URL)}>
            {t('settings.reportCopy')}
          </button>
  
          {!isAppShell() && !isMobile() && (
            <SettingsRow
              label={`⌨ ${t('keys.title')}`}
              onClick={() => setPanel('keys')}
              testId="row-keys"
            />
          )}
    </>
  )
}
