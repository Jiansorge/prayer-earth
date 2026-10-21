import React from 'react'
import { useT } from '../i18n.js'
import { canInstall, promptInstall } from '../shared/installPrompt.js'
import { isMobile, isIos, isAppShell } from '../shared/mobile.js'

const isInstalled = () =>
  window.matchMedia('(display-mode: standalone)').matches || !!window.navigator.standalone

export default function SettingsInstall({ installed, setInstalled, showIosTip, setShowIosTip }) {
  const t = useT()
  return (
    <>
          {!isAppShell() && !isInstalled() && isMobile() && (
            <>
          <div className="field-divider" />
  
              <label className="field-label section">{t('settings.installApp')}</label>
  
  
              {canInstall() ? (
                <>
                  <div className="field-hint">{t('settings.installHint')}</div>
                  <button
                    className="field-btn"
                    onClick={async () => {
                      const ok = await promptInstall()
                      if (ok) setInstalled(true)
                    }}
                  >
                    {installed ? t('settings.done') : t('settings.installApp')}
                  </button>
                </>
              ) : (
                <>
                  <div className="field-hint">
                    {t(isIos() ? 'settings.installHintIos' : 'settings.installHintBrowser')}
                  </div>
                  <button
                    className="field-btn"
                    onClick={() => setShowIosTip(!showIosTip)}
                  >
                    {showIosTip ? t('settings.done') : t('settings.installApp')}
                  </button>
                </>
              )}
            </>
          )}
    </>
  )
}
