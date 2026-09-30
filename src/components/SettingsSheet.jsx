import React, { startTransition, useEffect, useRef, useState } from 'react'
import { useStore } from '../store.js'
import { speech, CHANT_VOICE } from '../audio/speech.js'
import { ambient } from '../audio/ambience.js'
import SoundControls from './SoundControls.jsx'
import { SPIRITUALITY_BY_ID } from '../data/prayers.js'
import { useT, LOCALES, prayerTitle } from '../i18n.js'
import { sanitizeName } from '../shared/profanity.js'
import useFocusTrap from '../shared/useFocusTrap.js'
import QRCard from './QRCard.jsx'
import LegalSheet from './LegalSheet.jsx'
import { canInstall, promptInstall } from '../shared/installPrompt.js'
import { isMobile, isIos, isAppShell } from '../shared/mobile.js'
import { CANONICAL_ORIGIN } from '../shared/canonical.js'
import { shareLink, copyText } from '../shared/share.js'
import { buildBackupCode, parseBackupCode, applyBackup } from '../shared/backup.js'
import { syncClient } from '../sync/client.js'

const isInstalled = () =>
  window.matchMedia('(display-mode: standalone)').matches || !!window.navigator.standalone

// Nature avatars and light colours for your presence on the Earth.
const AVATARS = ['🌿', '🌙', '🌺', '🕊️', '🌊', '⛰️', '🌾', '🦋', '☀️', '🍃', '🐚', '🌟', '🌸', '🍁', '🪷', '🔥']
const COLORS = ['#7fc9a0', '#dfb05c', '#7aa2ff', '#ff9e4f', '#ffd166', '#b09dff', '#e8b06f', '#7fd488']
const DONATE_URL = 'https://ko-fi.com/joiningpalms'

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

// Share links must point at the canonical production origin, never at the
// localhost/dev/standalone host the app happens to be running on — a copied
// `window.location.origin` would hand someone a dead "localhost" link.
const APP_ORIGIN = 'https://joining-palms.app'
// Where someone goes if they find a re-upload of this app. Free and open, so it
// works for anyone who needs it.
const REPORT_URL = 'https://joining-palms.app/legal#report'
// Play-Store listing URL, supplied at build time via VITE_PLAY_STORE_URL once
// the listing is live (the deploy sets it alongside VITE_SYNC_ENGINE). When it
// is unset (null) the share row shows a "coming soon" note instead of a dead
// link, so nothing is hardcoded to a placeholder.
const PLAY_STORE_URL = import.meta.env.VITE_PLAY_STORE_URL || null

export default function SettingsSheet() {
  const open = useStore((s) => s.settingsOpen)
  const setOpen = useStore((s) => s.setSettingsOpen)
  const persistFailed = useStore((s) => s.persistFailed)
  const voiceURI = useStore((s) => s.voiceURI)
  const setVoiceURI = useStore((s) => s.setVoiceURI)
  const speechRate = useStore((s) => s.speechRate)
  const ambienceLevel = useStore((s) => s.ambienceLevel)
  const locale = useStore((s) => s.locale)
  const setLocale = useStore((s) => s.setLocale)
  const theme = useStore((s) => s.theme)
  const setTheme = useStore((s) => s.setTheme)
  const profile = useStore((s) => s.profile)
  const setProfile = useStore((s) => s.setProfile)
  const spiritId = useStore((s) => s.spiritId)
  const prayerId = useStore((s) => s.prayerId)
  const t = useT()

  const [voices, setVoices] = useState([])
  const [qrOpen, setQrOpen] = useState(false)
  const [legalOpen, setLegalOpen] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [appCopied, setAppCopied] = useState(false)
  const [backupCopied, setBackupCopied] = useState(false)
  const [backupMsg, setBackupMsg] = useState(null) // { ok: bool, key: string }
  const [restoreText, setRestoreText] = useState('')
  const [backupCode, setBackupCode] = useState('') // shown when copy/download can't work
  const [backupSummary, setBackupSummary] = useState(null) // what a restore actually did
  const fileRef = useRef(null)
  const [installed, setInstalled] = useState(false)
  const [showIosTip, setShowIosTip] = useState(false)
  const previewTimer = useRef(null)
  const sheetRef = useFocusTrap(open)

  const spirit = SPIRITUALITY_BY_ID[spiritId]
  const prayer = spirit?.prayers?.find((p) => p.id === prayerId) || null

  const preview = () => {
    speech.preview()
    setPreviewing(true)
    clearTimeout(previewTimer.current)
    previewTimer.current = setTimeout(() => setPreviewing(false), 1800)
  }

  const shareApp = async (target = 'web') => {
    const url = target === 'store' && PLAY_STORE_URL ? PLAY_STORE_URL : CANONICAL_ORIGIN
    const text = target === 'store' && PLAY_STORE_URL
      ? `Joining Palms on Play Store: ${url}`
      : `Joining Palms, join us in prayer. ${url}`
    const result = await shareLink({ title: 'Joining Palms', text, url })
    if (result === 'shared' || result === 'copied') {
      setAppCopied(true)
      setTimeout(() => setAppCopied(false), 2000)
    } else if (result === 'failed') {
      // Last resort so the button is never a dead end: surface the link for a
      // manual copy. (The app-shell WebView can block both the share sheet and
      // the clipboard; without this the tap would silently do nothing.)
      window.prompt(t('settings.shareAppLabel'), url)
    }
  }

  const flashBackup = (ok, key) => {
    setBackupMsg({ ok, key })
    setTimeout(() => setBackupMsg(null), 4000)
  }

  const copyBackup = async () => {
    const code = buildBackupCode()
    // Use the same WebView-hardened copyText() the share row uses: it falls
    // back to the legacy execCommand path, which is what still works inside the
    // Android/iOS app shell. Calling navigator.clipboard directly (as this did
    // first) is unreliable there, and window.prompt -- the old last resort -- is
    // NOT implemented by the Android WebView, so a blocked copy used to look
    // like success while the recovery code was silently lost. That is the worst
    // possible failure for a backup feature, so fall through to the share sheet
    // and only then to a visible, selectable <textarea>.
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
    // A blob + <a download> does nothing in the Android WebView (no download
    // listener), and the old code still reported success -- so a user backing up
    // before losing a phone was told "downloaded" and got no file at all. Only
    // claim success when the browser actually took it; otherwise show the code
    // in a selectable field, which always works.
    let downloaded = false
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
      downloaded = true
    } catch {}
    if (downloaded && !isAppShell()) {
      flashBackup(true, 'settings.backupDownloaded')
      return
    }
    setBackupCode(code)
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

  useEffect(() => () => clearTimeout(previewTimer.current), [])

  useEffect(() => {
    const load = () => setVoices([...speech.voices])
    load()
    if (window.speechSynthesis?.addEventListener) {
      window.speechSynthesis.addEventListener('voiceschanged', load)
      return () => window.speechSynthesis.removeEventListener('voiceschanged', load)
    }
  }, [])

  // Soften the bed while the sheet is open, then restore the prayer level on
  // close. Without the restore, opening Settings mid-prayer left the bed at the
  // idle 0.4 for the rest of the prayer (and the ambience slider, which
  // re-applies ambient.level, could no longer climb back up).
  const prevLevelRef = useRef(null)
  useEffect(() => {
    if (!ambient.ctx) return
    if (open) {
      prevLevelRef.current = ambient.level
      ambient.setLevel(0.4)
    } else if (prevLevelRef.current != null) {
      ambient.setLevel(prevLevelRef.current)
      prevLevelRef.current = null
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    // Move focus into the dialog so keyboard/screen-reader users land inside it.
    const t = setTimeout(() => sheetRef.current && sheetRef.current.focus(), 40)
    return () => {
      clearTimeout(t)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!open) return null

  const local = voices.filter((v) => v.localService)
  const remote = voices.filter((v) => !v.localService)
  const grouped = [...local, ...remote]

  return (
    <div className="sheet-backdrop" onClick={() => setOpen(false)}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={t('settings.title')} tabIndex={-1} ref={sheetRef}>
        <div className="sheet-head">
          <div className="sheet-title-row">
            <h3 className="sheet-title">{t('settings.title')}</h3>
            <button className="sheet-x" onClick={() => setOpen(false)} aria-label={t('settings.done')} title={t('settings.done')}>
              ✕
            </button>
          </div>
          <div className="sheet-handle" />
        </div>
        <div className="sheet-body">

        <label className="field-label section">{t('profile.title')}</label>

        <div className="field-hint">{t('profile.nameHint')}</div>
        <input
          id="profile-name"
          className="field-input"
          maxLength={20}
          value={profile.name}
          placeholder={t('profile.namePlaceholder')}
          onChange={(e) => {
            const v = e.target.value
            // block vulgar or profane display names
            if (sanitizeName(v) === '' && v.trim() !== '') return
            setProfile({ name: v.slice(0, 20) })
          }}
        />

        <label className="field-label" htmlFor="avatar-grid">{t('profile.avatar')}</label>
        <div id="avatar-grid" className="avatar-grid">
          {AVATARS.map((a) => (
            <button
              key={a}
              type="button"
              className={`avatar-btn ${profile.avatar === a ? 'on' : ''}`}
              onClick={() => setProfile({ avatar: a })}
            >
              {a}
            </button>
          ))}
        </div>

        <label className="field-label">{t('profile.color')}</label>
        <div className="swatch-row">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={`swatch ${profile.color === c ? 'on' : ''}`}
              style={{ background: c }}
              onClick={() => setProfile({ color: c })}
              aria-label={c}
            />
          ))}
        </div>

        <div className="field-divider" />

        <label className="field-label section">{t('settings.secPraying')}</label>

        {/* If localStorage writes are failing, the user's prayer counts are not
            being saved — warn them (durability: never lose a prayer silently). */}
        {persistFailed && (
          <div className="save-warning" role="alert">
            {t('settings.saveFailed')}
          </div>
        )}

        {/* The sound controls (prayer voice volume, ambient sound volume, speed,
            ambient bed picker) are shared verbatim with the prayer mini panel so
            the two surfaces stay identical. */}
        <SoundControls layout="field" />

        <div className="field-divider" />

        <label className="field-label section">{t('settings.secLook')}</label>

        <label className="field-label">{t('settings.theme')}</label>
        <div className="field-hint">{t('settings.themeHint')}</div>
        <div className="theme-pick">
          {[
            { id: 'mystic', emoji: '🌌', label: t('theme.mystic') },
            { id: 'nature', emoji: '🌲', label: t('theme.nature') },
            { id: 'space', emoji: '🚀', label: t('theme.space') },
            { id: 'temple', emoji: '🏛️', label: t('theme.temple') },
            { id: 'ocean', emoji: '🌊', label: t('theme.ocean') },
            { id: 'dawn', emoji: '🌅', label: t('theme.dawn') }
          ].map((th) => (
            <button
              key={th.id}
              type="button"
              className={`theme-opt ${theme === th.id ? 'on' : ''}`}
              onClick={() => startTransition(() => setTheme(th.id))}
              aria-pressed={theme === th.id}
            >
              <span className="theme-emoji">{th.emoji}</span>
              <span>{th.label}</span>
            </button>
          ))}
        </div>

        <label className="field-label" htmlFor="locale-picker">{t('settings.languageLabel')}</label>
        <select
          id="locale-picker"
          className="field-select"
          value={locale}
          onChange={(e) => setLocale(e.target.value)}
        >
          {LOCALES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>

        <label className="field-label" htmlFor="voice-picker">{t('settings.voiceLabel')}</label>
        <div className="field-hint">
          {t('settings.voiceHint')}
        </div>
        <select
          id="voice-picker"
          className="field-select"
          value={voiceURI || ''}
          onChange={(e) => setVoiceURI(e.target.value || null)}
        >
          <option value="">{t('settings.automatic')}</option>
          <option value={CHANT_VOICE}>{t('settings.softChant')}</option>
          {grouped.map((v) => (
            <option key={v.voiceURI} value={v.voiceURI}>
              {v.name} ({v.lang})
            </option>
          ))}
        </select>
        {voiceURI ? null : <div className="field-hint">{t('settings.automaticHint')}</div>}
        {grouped.length === 0 && (
          <div className="field-hint">{t('settings.noVoices')}</div>
        )}
        <button
          className="field-preview"
          onClick={preview}
          aria-label={t('settings.hearSample')}
        >
          {previewing ? t('settings.listening') : t('settings.hearSample')}
        </button>

        <div className="field-divider" />

        <label className="field-label section">{t('settings.secShare')}</label>

        <label className="field-label">{t('settings.sharePrayerLabel')}</label>
        <div className="field-hint">
          {prayer
            ? t('settings.sharePrayerHint', { title: prayerTitle(t, prayer.id, prayer.title) })
            : t('settings.sharePrayerHintNone')}
        </div>
        <button
          className="field-btn"
          disabled={!prayer}
          onClick={() => setQrOpen(true)}
        >
          {t('settings.showQr')}
        </button>

        <label className="field-label">{t('settings.shareAppLabel')}</label>
        <div className="field-hint">
          {t('settings.shareAppHint')}
        </div>
        <button className="field-btn" onClick={() => shareApp('web')}>
          {appCopied ? t('settings.copied') : t('settings.shareApp')}
        </button>
        <button className="field-url" onClick={() => shareApp('web')} title={APP_ORIGIN}>
          {APP_ORIGIN}
        </button>
        {PLAY_STORE_URL ? (
          <button className="field-btn" onClick={() => shareApp('store')} style={{ marginTop: 8 }}>
            {t('settings.sharePlayStore')}
          </button>
        ) : (
          <div className="field-hint" style={{ marginTop: 8, opacity: 0.6 }}>
            {t('settings.playStoreComingSoon')}
          </div>
        )}

        <div className="field-divider" />

        <label className="field-label section">{t('settings.secBackup')}</label>
        <div className="field-hint">{t('settings.backupHint')}</div>
        <button className="field-btn" onClick={copyBackup}>
          {backupCopied ? t('settings.copied') : t('settings.backupCopy')}
        </button>
        <button className="field-btn" onClick={downloadBackup} style={{ marginTop: 8 }}>
          {t('settings.backupDownload')}
        </button>
        {backupCode && (
          <>
            <div className="field-hint" style={{ marginTop: 10 }}>{t('settings.backupShowHint')}</div>
            <textarea
              className="field-textarea"
              value={backupCode}
              readOnly
              rows={4}
              onFocus={(e) => e.target.select()}
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
          <div className="field-hint" style={{ marginTop: 10, color: backupMsg.ok ? 'var(--ok,#7fc9a0)' : 'var(--warn,#ffb4a2)' }}>
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

        <div className="field-divider" />

        <label className="field-label section">{t('settings.donateLabel')}</label>
        <div className="field-hint">{t('settings.donateHint')}</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <a className="field-btn" href={DONATE_URL} target="_blank" rel="noopener noreferrer" style={{ flex: 1 }}>
            {t('settings.donateButton')}
          </a>
          <a href={DONATE_URL} target="_blank" rel="noopener noreferrer" aria-label="Ko-fi — joiningpalms" title="Ko-fi — joiningpalms" style={{ flex: '0 0 auto', display: 'inline-flex' }}>
            <img src="/kofi6.png" alt="Support on Ko-fi" style={{ height: 36, border: 0, display: 'block' }} loading="lazy" />
          </a>
        </div>

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
        <div className="field-hint" style={{ marginTop: 14 }}>{t('settings.madeBy')}</div>
        <button className="field-url" onClick={() => shareApp('web')} title={APP_ORIGIN}>
          {APP_ORIGIN}
        </button>
        <a className="field-report" href={REPORT_URL} target="_blank" rel="noreferrer noopener">
          {t('settings.reportCopy')}
        </a>

        {!isAppShell() && !isMobile() && (
          <button
            className="field-btn"
            onClick={() => {
              setOpen(false)
              useStore.getState().setKeyboardHelpOpen(true)
            }}
          >
            ⌨ {t('keys.title')}
          </button>
        )}

        <button className="sheet-close" onClick={() => setOpen(false)}>
          {t('settings.done')}
        </button>
        </div>
      </div>

      {legalOpen && <LegalSheet onClose={() => setLegalOpen(false)} />}

      {qrOpen && spirit && prayer && (
        <QRCard spirit={spirit} prayer={prayer} onClose={() => setQrOpen(false)} />
      )}
    </div>
  )
}
