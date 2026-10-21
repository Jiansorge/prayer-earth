import React, { startTransition } from 'react'
import { useT } from '../i18n.js'
import LocaleSelect from './LocaleSelect.jsx'

export default function SettingsLook({ theme, setTheme, locale, setLocale }) {
  const t = useT()
  return (
    <>
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
          <LocaleSelect id="locale-picker" locale={locale} setLocale={setLocale} />
    </>
  )
}
