import React from 'react'
import { useT } from '../i18n.js'
import { isAppShell } from '../shared/mobile.js'

export default function SettingsWarnings({ persistFailed, dataQuarantined, dataPreservationFailed, storagePersisted }) {
  const t = useT()
  return (
    <>
          {/* If localStorage writes are failing, the user's prayer counts are not
              being saved — warn them (durability: never lose a prayer silently). */}
          {persistFailed && (
            <div className="save-warning" role="alert">
              {t('settings.saveFailed')}
            </div>
          )}
  
          {dataQuarantined && (
            <div className="save-warning" role="alert">
              {dataPreservationFailed
                ? t('settings.dataPreservationFailed')
                : t('settings.dataQuarantined')}
            </div>
          )}
  
          {storagePersisted === false && !isAppShell() && (
            <div className="save-warning" role="status">
              {t('settings.storageNotPersisted')}
            </div>
          )}
    </>
  )
}
