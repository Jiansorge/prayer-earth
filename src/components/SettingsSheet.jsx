import React, { startTransition, useEffect, useRef, useState } from 'react'
import { useStore } from '../store.js'
import { speech, CHANT_VOICE } from '../audio/speech.js'
import { openExternal } from '../shared/openExternal.js'
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
import { CANONICAL_ORIGIN, REPORT_URL } from '../shared/canonical.js'
import { shareLink, showManualCopy } from '../shared/share.js'
import { PrivacyPanel, BackupPanel, DataPanel, SettingsRow } from './SettingsPanels.jsx'

const isInstalled = () =>
  window.matchMedia('(display-mode: standalone)').matches || !!window.navigator.standalone

// Nature avatars and light colours for your presence on the Earth.
const AVATARS = ['🌿', '🌙', '🌺', '🕊️', '🌊', '⛰️', '🌾', '🦋', '☀️', '🍃', '🐚', '🌟', '🌸', '🍁', '🪷', '🔥']
const COLORS = ['#7fc9a0', '#dfb05c', '#7aa2ff', '#ff9e4f', '#ffd166', '#b09dff', '#e8b06f', '#7fd488']
const DONATE_URL = 'https://ko-fi.com/joiningpalms'

// Scroll memory for the settings sheet.
//
// Module-level on purpose: the sheet returns null when closed, so a ref inside
// the component is recreated from scratch on the next open and remembers
// nothing. Someone who scrolled to the delete button, closed the sheet to check
// something, and came back should land where they were, not at the top.
//
// Keyed by panel so that going into Privacy and pressing Back also returns you
// to where you were in the list behind it.
const scrollMemory = { main: 0, privacy: 0, backup: 0, data: 0 }

// Share links must point at the canonical production origin, never at the
// localhost/dev/standalone host the app happens to be running on — a copied
// `window.location.origin` would hand someone a dead "localhost" link.
const APP_ORIGIN = CANONICAL_ORIGIN
// Play-Store listing URL, supplied at build time via VITE_PLAY_STORE_URL once
// the listing is live (the deploy sets it alongside VITE_SYNC_ENGINE). When it
// is unset (null) the share row shows a "coming soon" note instead of a dead
// link, so nothing is hardcoded to a placeholder.
const PLAY_STORE_URL = import.meta.env.VITE_PLAY_STORE_URL || null

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

  // Restore this panel's scroll position on open, and bank it on the way out.
  //
  // This must sit ABOVE the `if (!open) return null` below. A hook after an
  // early return is a conditional hook, React throws on it, and the settings
  // sheet stops rendering entirely - which is exactly what happened the first
  // time this was written.
  //
  // The bodyRef is null while closed, so the effect no-ops then and does its real
  // work on the open. Keyed on `panel` so going into Privacy and pressing Back
  // restores the list's place rather than the sub-panel's.
  useEffect(() => {
    const el = bodyRef.current
    if (!el) return undefined
    const key = panel || 'main'
    const wanted = scrollMemory[key]

    // Bank the position as the user scrolls, not on the way out.
    //
    // Reading it in the cleanup does not work: the cleanup runs when `open`
    // flips to false, and by then React has already removed .sheet-body from
    // the DOM, so el.scrollTop is 0 no matter where the sheet had been left.
    // That was measured, not assumed - the banked value came back as 0 from a
    // sheet scrolled to 400.
    const onScroll = () => {
      scrollMemory[key] = el.scrollTop
    }
    el.addEventListener('scroll', onScroll, { passive: true })

    // Restore after layout, not during the commit: the sheet moves focus into
    // itself shortly after opening, and a focused element is scrolled into
    // view; lazy images are still growing the content, so the clamp is computed
    // against a shorter scrollHeight than the offset was taken from.
    let frame = 0
    if (wanted) {
      frame = requestAnimationFrame(() => {
        if (bodyRef.current === el) el.scrollTop = wanted
      })
    }
    return () => {
      if (frame) cancelAnimationFrame(frame)
      el.removeEventListener('scroll', onScroll)
    }
  }, [panel, open])

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
        {panel === 'data' && (
          <DataPanel onBack={() => setPanel(null)} onOpenLegal={() => setLegalOpen(true)} />
        )}

        {panel === null && (
        <>
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

        {/* Support sits directly under sharing the app: both are "get the word
            out", and keeping them together puts the donate button where
            someone who just shared a link is already looking.

            No wrap: the Ko-fi badge is 36px tall and the label is one line, and
            letting this wrap put the badge on a line of its own under the text,
            which read as two unrelated buttons. The label shrinks instead. */}
        <label className="field-label section">{t('settings.secSupport')}</label>
        <div className="donate-row">
          <button type="button" className="field-btn donate-label" onClick={() => openExternal(DONATE_URL)}>
            {t('settings.donateButton')}
          </button>
          <button type="button" className="field-btn donate-badge-btn" onClick={() => openExternal(DONATE_URL)} aria-label="Ko-fi — joiningpalms" title="Ko-fi — joiningpalms">
            <img src="/kofi6.png" alt="Support on Ko-fi" style={{ height: 36, border: 0, display: 'block' }} loading="lazy" />
          </button>
        </div>

        {/* No field-divider here on purpose. .settings-row already draws its own
            border-top, so a divider immediately above it produced two 1px lines a
            few pixels apart - a double rule that read as a mistake. The row's own
            border is the separator. */}

        {/* The three things that used to be one very long section. Privacy,
            backup and deletion are each something a person looks for on its
            own, and burying the delete button under five other controls is how
            it gets tapped by accident. */}
        <SettingsRow
          label={t('settings.privacyRow')}
          onClick={() => setPanel('privacy')}
          testId="row-privacy"
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
        <button type="button" className="field-report" onClick={() => openExternal(REPORT_URL)}>
          {t('settings.reportCopy')}
        </button>

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
