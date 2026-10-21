import React, { useState } from 'react'
import { useStore } from '../store.js'
import { useT } from '../i18n.js'
import { openExternal } from '../shared/openExternal.js'
import { copyText } from '../shared/share.js'
import { requestDeletion, forgetIdentity } from '../shared/deletion.js'
import { DELETE_DATA_URL, REPORT_URL } from '../shared/canonical.js'
import PanelShell from './PanelShell.jsx'

// Your data: the anonymous ID, and the deletion that cannot be undone.
export function DataPanel({ onBack, onOpenLegal }) {
  const t = useT()
  const [anonCopied, setAnonCopied] = useState(false)
  const [deleteArmed, setDeleteArmed] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteResult, setDeleteResult] = useState(null)

  const copyAnonId = async () => {
    const id = useStore.getState().getAnonId()
    const ok = await copyText(id)
    setAnonCopied(ok)
    return ok
  }

  // Self-service deletion. The request only leaves the device after an explicit
  // confirmation, and the local wipe happens ONLY once the server has confirmed
  // - so a failed or offline request never costs the user their data.
  const doDelete = async () => {
    setDeleteBusy(true)
    const outcome = await requestDeletion()
    setDeleteBusy(false)
    // 'local_only' also wipes: there was no synced record to erase, so the only
    // data that exists is the local copy and the user asked for it to go.
    if (outcome === 'deleted' || outcome === 'local_only') forgetIdentity()
    setDeleteArmed(false)
    setDeleteResult(outcome)
  }

  // The escape hatch for someone who cannot reach the server. This clears only
  // this device and says so plainly: whatever the server still holds is
  // untouched, and we will say so rather than implying a full deletion.
  const doDeleteLocalOnly = () => {
    forgetIdentity()
    setDeleteArmed(false)
    setDeleteResult('device_only')
  }

  return (
    <PanelShell title={t('settings.secData')} onBack={onBack} testId="panel-data">
      {/* The data-deletion page on our Play listing tells people to copy this
          ID, so it must exist here. The anonymous ID is the only way we can
          identify a record to erase, and the user is the only one who has it. */}
      <div className="field-hint">{t('settings.myDataHint')}</div>
      <button
        className="field-btn"
        onClick={copyAnonId}
        data-testid="copy-anon-id"
      >
        {anonCopied ? t('settings.copied') : t('settings.copyAnonId')}
      </button>

      {/* The manual route stays visible whether or not the delete button is
          armed. It is not a destructive control - it opens a webpage - and
          burying an escape hatch behind two taps would leave anyone who cannot
          use the in-app flow with no way to ask. */}
      <button type="button" className="field-report" onClick={() => openExternal(DELETE_DATA_URL)}>
        {t('settings.deleteDataLink')}
      </button>

      <div className="field-divider" />

      {/* Two deliberate steps. Arming says plainly that this is permanent and
          that the next tap asks again, so nobody loses a record to a stray tap
          in a long scrolling sheet. */}
      {!deleteArmed && !deleteResult && (
        <button
          className="field-btn field-btn-danger"
          onClick={() => setDeleteArmed(true)}
          data-testid="delete-arm"
        >
          {t('settings.deleteDataButton')}
        </button>
      )}

      {deleteArmed && !deleteResult && (
        <div className="delete-panel" role="alertdialog" aria-label={t('settings.deleteDataButton')}>
          <div className="field-hint" data-testid="delete-armed-hint">
            {t('settings.deleteDataArmedHint')}
          </div>
          <div className="field-hint">{t('settings.deleteDataConfirmHint')}</div>
          <button
            className="field-btn field-btn-danger"
            disabled={deleteBusy}
            onClick={doDelete}
            data-testid="delete-confirm"
          >
            {deleteBusy ? t('settings.deleteDataWorking') : t('settings.deleteDataConfirm')}
          </button>
          <button
            className="field-btn"
            onClick={() => setDeleteArmed(false)}
            style={{ marginTop: 8 }}
            data-testid="delete-cancel"
          >
            {t('settings.deleteDataCancel')}
          </button>
        </div>
      )}

      {deleteResult && (
        <>
          <div
            className="field-hint"
            role="status"
            style={{
              marginTop: 10,
              color:
                deleteResult === 'deleted' ||
                deleteResult === 'local_only' ||
                deleteResult === 'device_only'
                  ? 'var(--ok,#7fc9a0)'
                  : 'var(--warn,#ffb4a2)'
            }}
          >
            {t(`settings.deleteResult.${deleteResult}`)}
          </div>
          {/* Being offline left a user with no way to erase anything at all -
              the server could not be reached, and the only other route was
              emailing us. The local copy is entirely theirs, so offer it
              explicitly rather than refusing. */}
          {deleteResult === 'offline' && (
            <button className="field-btn" onClick={doDeleteLocalOnly} style={{ marginTop: 8 }}>
              {t('settings.deleteDeviceOnly')}
            </button>
          )}
        </>
      )}

      <div className="field-divider" />

      <button type="button" className="field-btn" onClick={onOpenLegal}>
        {t('settings.legal')}
      </button>
      <button type="button" className="field-report" onClick={() => openExternal(REPORT_URL)}>
        {t('settings.reportCopyLink')}
      </button>
    </PanelShell>
  )
}
