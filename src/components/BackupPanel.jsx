import React, { useEffect, useRef, useState } from 'react'
import { useStore } from '../store.js'
import { useT } from '../i18n.js'
import { isAppShell } from '../shared/mobile.js'
import { copyText } from '../shared/share.js'
import { buildBackupCode, parseBackupCode, applyBackup } from '../shared/backup.js'
import { syncClient } from '../sync/client.js'
import PanelShell from './PanelShell.jsx'

// Restore summary readout. "Restored." alone tells the user nothing about
// whether they pasted the right code, so spell out what came back.
const fmtDuration = (secs) => {
  const total = Math.max(0, Math.floor(Number(secs) || 0))
  if (total < 60) return `${total}s`
  const m = Math.floor(total / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ${m % 60}m`
  return `${Math.floor(h / 24)}d ${h % 24}h`
}

// Backup and restore, together: they are two halves of the same recovery code,
// and splitting them across a long scrolling sheet is what made them hard to
// find.
export function BackupPanel({ onBack }) {
  const t = useT()
  const [backupCopied, setBackupCopied] = useState(false)
  const [restoreText, setRestoreText] = useState('')
  const [backupCode, setBackupCode] = useState('') // shown when copy/download can't work
  const [backupMsg, setBackupMsg] = useState(null) // { ok: bool, key: string }
  const [backupSummary, setBackupSummary] = useState(null)
  const fileRef = useRef(null)

  const flashBackup = (ok, key) => {
    setBackupMsg({ ok, key })
    setTimeout(() => setBackupMsg(null), 4000)
  }

  const copyBackup = async () => {
    const code = buildBackupCode()
    // Use the same WebView-hardened copyText() the share row uses: it falls
    // back to the legacy execCommand path, which is what still works inside the
    // Android/iOS app shell. Calling navigator.clipboard directly is unreliable
    // there, and window.prompt -- the old last resort -- is NOT implemented by
    // the Android WebView, so a blocked copy used to look like success while the
    // recovery code was silently lost. That is the worst possible failure for a
    // backup feature, so fall through to the share sheet and only then to a
    // visible, selectable <textarea>.
    const copied = await copyText(code)
    if (copied) {
      setBackupCopied(true)
      setTimeout(() => setBackupCopied(false), 2000)
      flashBackup(true, 'settings.backupCopied')
      return
    }
    // Native share sheet lets the user send the code to Notes/Drive/mail, which
    // is a genuinely durable save on a phone (and works in the app shell).
    let shared = false
    try {
      if (navigator.share) {
        await navigator.share({ title: t('settings.backupCopyTitle'), text: code })
        shared = true
      }
    } catch (err) {
      shared = err?.name === 'AbortError'
    }
    if (shared) {
      flashBackup(true, 'settings.backupShared')
      return
    }
    // Genuine last resort: show it in a real, selectable field rather than a
    // prompt() the WebView swallows.
    setBackupCode(code)
  }

  const downloadBackup = () => {
    const code = buildBackupCode()
    // Measured on a Pixel 7: the Android WebView has NO download listener, so a
    // blob + <a download> does nothing at all while the old code still reported
    // success. It also has no navigator.share and no async clipboard. The only
    // mechanism that works there is the legacy execCommand copy, which needs a
    // real user gesture. So on Android the code is always shown inline, and the
    // download button is not offered at all rather than being a dead control.
    if (isAppShell()) {
      setBackupCode(code)
      return
    }
    try {
      const blob = new Blob([code], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'joining-palms-backup.txt'
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      flashBackup(true, 'settings.backupDownloaded')
    } catch {
      setBackupCode(code)
    }
  }

  const doRestore = (code) => {
    const before = useStore.getState().anonId
    try {
      const payload = parseBackupCode(code)
      const summary = applyBackup(payload)
      setRestoreText('')
      setBackupSummary(summary)
      flashBackup(true, summary.wasNoop ? 'settings.backupNoop' : 'settings.backupRestored')
      // Restoring can adopt a different anonId, but the live socket has already
      // handshook under the old one. Without a re-handshake the connection would
      // keep pushing to the previous identity while local state claims the new
      // one. Bounce it so the next handshake uses the restored identity.
      if (useStore.getState().anonId !== before) {
        try {
          syncClient.stop()
          syncClient.start()
        } catch {}
      }
    } catch (e) {
      // Distinguish "this isn't a backup at all" from "this backup got damaged
      // in transit" -- the second is recoverable by pasting a fresh copy, so
      // saying so is the difference between a dead end and a fix.
      const key =
        e?.message === 'notBackup' ? 'settings.backupInvalid'
        : e?.message === 'damaged' ? 'settings.backupDamaged'
        : 'settings.backupCorrupt'
      flashBackup(false, key)
    }
  }

  const restoreFromFile = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => doRestore(String(reader.result || ''))
    reader.onerror = () => flashBackup(false, 'settings.backupCorrupt')
    reader.readAsText(file)
  }

  // In the app shell the recovery code is shown as soon as this panel opens,
  // rather than only after a copy failure. The Android WebView can only copy it
  // via a legacy execCommand path that needs a real tap, so leaving the code
  // hidden behind that one button meant a user whose tap did not register saw
  // nothing at all.
  useEffect(() => {
    if (isAppShell()) setBackupCode(buildBackupCode())
  }, [])

  return (
    <PanelShell title={t('settings.secBackup')} onBack={onBack} testId="panel-backup">
      <div className="field-hint">{t('settings.backupHint')}</div>
      <button className="field-btn" onClick={copyBackup}>
        {backupCopied ? t('settings.copied') : t('settings.backupCopy')}
      </button>
      {/* The app shell cannot download files (no download listener in the
          Android WebView), so offering the button there would be a control that
          silently does nothing. In a browser it works, so it stays. */}
      {!isAppShell() && (
        <button className="field-btn" onClick={downloadBackup} style={{ marginTop: 8 }}>
          {t('settings.backupDownload')}
        </button>
      )}
      {isAppShell() && (
        <div className="field-hint field-note">{t('settings.backupWhereToSave')}</div>
      )}
      {(backupCode || isAppShell()) && (
        <>
          {!isAppShell() && (
            <div className="field-hint field-note">{t('settings.backupShowHint')}</div>
          )}
          <textarea
            className="field-textarea"
            value={backupCode}
            readOnly
            rows={4}
            placeholder={t('settings.backupShowPlaceholder')}
            onFocus={(e) => e.target.select()}
            data-testid="backup-code"
          />
        </>
      )}

      <label className="field-label" style={{ marginTop: 18 }}>{t('settings.backupRestoreLabel')}</label>
      <div className="field-hint">{t('settings.backupRestoreHint')}</div>
      <textarea
        className="field-textarea"
        value={restoreText}
        onChange={(e) => setRestoreText(e.target.value)}
        placeholder={t('settings.backupPlaceholder')}
        rows={3}
      />
      <button
        className="field-btn"
        disabled={!restoreText.trim()}
        onClick={() => doRestore(restoreText)}
        style={{ marginTop: 8 }}
      >
        {t('settings.backupRestore')}
      </button>
      <button className="field-btn" onClick={() => fileRef.current?.click()} style={{ marginTop: 8 }}>
        {t('settings.backupRestoreFile')}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".txt,text/plain"
        onChange={restoreFromFile}
        style={{ display: 'none' }}
      />

      {backupMsg && (
        <div
          className="field-hint"
          role="status"
          style={{ marginTop: 10, color: backupMsg.ok ? 'var(--ok,#7fc9a0)' : 'var(--warn,#ffb4a2)' }}
        >
          {t(backupMsg.key)}
        </div>
      )}
      {backupSummary && (
        <div className="backup-summary" data-testid="backup-summary">
          <div className="backup-summary-title">{t('settings.backupSummaryTitle')}</div>
          <div className="backup-summary-grid">
            <div>
              <span className="backup-summary-value">{backupSummary.backup.completions}</span>
              <span className="backup-summary-label">{t('settings.backupSumCompletions')}</span>
            </div>
            <div>
              <span className="backup-summary-value">{fmtDuration(backupSummary.backup.seconds)}</span>
              <span className="backup-summary-label">{t('settings.backupSumTime')}</span>
            </div>
            <div>
              <span className="backup-summary-value">{backupSummary.backup.distinctPrayers}</span>
              <span className="backup-summary-label">{t('settings.backupSumPrayers')}</span>
            </div>
            <div>
              <span className="backup-summary-value">{backupSummary.backup.bestStreak}</span>
              <span className="backup-summary-label">{t('settings.backupSumStreak')}</span>
            </div>
          </div>
          {backupSummary.backup.days > 0 && (
            <div className="backup-summary-note">
              {t('settings.backupSumDays', { n: backupSummary.backup.days })}
            </div>
          )}
          {backupSummary.identityChanged && (
            <div className="backup-summary-note">{t('settings.backupSumIdentity')}</div>
          )}
          {!backupSummary.wasNoop && backupSummary.gainedSeconds > 0 && (
            <div className="backup-summary-note">
              {t('settings.backupSumGained', { time: fmtDuration(backupSummary.gainedSeconds) })}
            </div>
          )}
        </div>
      )}
    </PanelShell>
  )
}
