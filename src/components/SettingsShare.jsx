import React from 'react'
import { useT, prayerTitle } from '../i18n.js'
import { openExternal } from '../shared/openExternal.js'
import { PLAY_STORE_URL } from '../shared/playStore.js'

const DONATE_URL = 'https://ko-fi.com/joiningpalms'

export default function SettingsShare({ prayer, setQrOpen, shareApp, appCopied, origin }) {
  const t = useT()
  return (
    <>
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
          <button className="field-url" onClick={() => shareApp('web')} title={origin}>
            {origin}
          </button>
          {PLAY_STORE_URL ? (
            <button className="field-btn" onClick={() => shareApp('store')} style={{ marginTop: 8 }}>
              {t('settings.sharePlayStore')}
            </button>
          ) : (
            <div className="field-hint field-note" style={{ opacity: 0.6 }}>
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
    </>
  )
}
