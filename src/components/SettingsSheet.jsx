import React, { useEffect, useRef, useState } from 'react'
import { useStore } from '../store.js'
import { speech } from '../audio/speech.js'
import SoundControls from './SoundControls.jsx'
import { SPIRITUALITY_BY_ID } from '../data/prayers.js'
import { useT } from '../i18n.js'
import useFocusTrap from '../shared/useFocusTrap.js'
import QRCard from './QRCard.jsx'
import LegalSheet from './LegalSheet.jsx'
import { CANONICAL_ORIGIN } from '../shared/canonical.js'
import { shareLink, showManualCopy } from '../shared/share.js'
import { PLAY_STORE_URL } from '../shared/playStore.js'
import SettingsProfile from './SettingsProfile.jsx'
import SettingsWarnings from './SettingsWarnings.jsx'
import SettingsLook from './SettingsLook.jsx'
import SettingsShare from './SettingsShare.jsx'
import SettingsInstall from './SettingsInstall.jsx'
import SettingsAbout from './SettingsAbout.jsx'
import { SettingsRow } from './SettingsRow.jsx'
import { PrivacyPanel } from './PrivacyPanel.jsx'
import { BackupPanel } from './BackupPanel.jsx'
import { DataPanel } from './DataPanel.jsx'
import { KeysPanel } from './KeysPanel.jsx'
import useSheetBed from '../shared/useSheetBed.js'
import useSheetScroll from '../shared/useSheetScroll.js'


// Share links must point at the canonical production origin, never at the
// localhost/dev/standalone host the app happens to be running on — a copied
// `window.location.origin` would hand someone a dead "localhost" link.
const APP_ORIGIN = CANONICAL_ORIGIN

export default function SettingsSheet() {
  const open = useStore((s) => s.settingsOpen)
  const setOpen = useStore((s) => s.setSettingsOpen)
  const persistFailed = useStore((s) => s.persistFailed)
  const dataQuarantined = useStore((s) => s.dataQuarantined)
  const dataPreservationFailed = useStore((s) => s.dataPreservationFailed)
  const storagePersisted = useStore((s) => s.storagePersisted)
  const voiceURI = useStore((s) => s.voiceURI)
  const setVoiceURI = useStore((s) => s.setVoiceURI)
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
  const [installed, setInstalled] = useState(false)
  const [showIosTip, setShowIosTip] = useState(false)
  // Which sub-panel is open, or null for the main list. Keeping this as one
  // value rather than three booleans means "open a panel" always closes the
  // others, and Back has a single obvious meaning.
  const [panel, setPanel] = useState(null)
  const bodyRef = useRef(null)
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
      // Last resort so the button is never a dead end: surface the link in a
      // real, selectable field for a manual copy.
      //
      // The app-shell WebView can block both the share sheet and the clipboard;
      // without this the tap would silently do nothing. Not window.prompt: it
      // blocks the renderer and is not implemented in that WebView at all.
      showManualCopy(url, t('settings.shareAppLabel'))
    }
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

  const { onBedPick } = useSheetBed({ open, panel, legalOpen })

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

  useSheetScroll({ open, panel, bodyRef })

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
        <div className="sheet-body" ref={bodyRef}>

        {/* One panel or the other, never both: the main list is replaced rather
            than pushed, so Back and the ✕ always mean the same thing. */}
        {panel === 'privacy' && (
          <PrivacyPanel onBack={() => setPanel(null)} onOpenLegal={() => setLegalOpen(true)} />
        )}
        {panel === 'backup' && <BackupPanel onBack={() => setPanel(null)} />}
        {panel === 'keys' && <KeysPanel onBack={() => setPanel(null)} />}
        {panel === 'data' && (
          <DataPanel onBack={() => setPanel(null)} onOpenLegal={() => setLegalOpen(true)} />
        )}

        {panel === null && (
        <>
      <SettingsProfile profile={profile} setProfile={setProfile} />

        <div className="field-divider" />

        <label className="field-label section">{t('settings.secPraying')}</label>

      <SettingsWarnings persistFailed={persistFailed} dataQuarantined={dataQuarantined} dataPreservationFailed={dataPreservationFailed} storagePersisted={storagePersisted} />

        {/* The sound controls (prayer voice volume, ambient sound volume, speed,
            ambient bed picker) are shared verbatim with the prayer mini panel so
            the two surfaces stay identical. previewBeds makes the sheet's chips
            audition the bed (start if nothing is playing) - the panel keeps its
            plain switch-if-already-running behavior. */}
        <SoundControls
          layout="field"
          previewBeds
          onBedPick={onBedPick}
        />

        <div className="field-divider" />

      <SettingsLook theme={theme} setTheme={setTheme} locale={locale} setLocale={setLocale} voiceURI={voiceURI} setVoiceURI={setVoiceURI} grouped={grouped} previewing={previewing} preview={preview} />

        <div className="field-divider" />

      <SettingsShare prayer={prayer} setQrOpen={setQrOpen} shareApp={shareApp} appCopied={appCopied} origin={APP_ORIGIN} />

        {/* The three things that used to be one very long section. Privacy,
            backup and deletion are each something a person looks for on its
            own, and burying the delete button under five other controls is how
            it gets tapped by accident.

            The gap above Privacy is deliberate. .settings-row draws its own
            border-top, and flush against the section above that line read as a
            stray rule rather than the start of a group. Space above it makes the
            existing border the separator, which is the effect the removed
            divider was trying to produce without the double line. */}
        <SettingsRow
          label={t('settings.privacyRow')}
          onClick={() => setPanel('privacy')}
          testId="row-privacy"
          className="settings-row-group-start"
        />
        <SettingsRow
          label={t('settings.secBackup')}
          hint={t('settings.backupRowHint')}
          onClick={() => setPanel('backup')}
          testId="row-backup"
        />
        <SettingsRow
          label={t('settings.yourDataRow')}
          hint={t('settings.yourDataRowHint')}
          onClick={() => setPanel('data')}
          testId="row-data"
        />

      <SettingsInstall installed={installed} setInstalled={setInstalled} showIosTip={showIosTip} setShowIosTip={setShowIosTip} />

      <SettingsAbout origin={APP_ORIGIN} shareApp={shareApp} setLegalOpen={setLegalOpen} setPanel={setPanel} />

        <button className="sheet-close" onClick={() => setOpen(false)}>
          {t('settings.done')}
        </button>
        </>
        )}
        </div>
      </div>

      {legalOpen && <LegalSheet onClose={() => setLegalOpen(false)} />}

      {qrOpen && spirit && prayer && (
        <QRCard spirit={spirit} prayer={prayer} onClose={() => setQrOpen(false)} />
      )}
    </div>
  )
}
