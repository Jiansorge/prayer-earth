import React from 'react'
import { useStore } from '../store.js'
import { useT } from '../i18n.js'

// A gentle place for the human questions: what this app is (and isn't),
// what it knows about you, and the small print.
export default function LegalSheet({ onClose }) {
  const t = useT()
  const openLegal = useStore((s) => s.openLegal)
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet legal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <h3 className="sheet-title">{t('legal.title')}</h3>

        <div className="legal-block">
          <div className="legal-h">{t('legal.wellnessTitle')}</div>
          <p className="legal-p">{t('legal.wellnessBody')}</p>
        </div>

        <div className="legal-block">
          <div className="legal-h">{t('legal.privacyTitle')}</div>
          <ul className="legal-list">
            <li>{t('legal.priv1')}</li>
            <li>{t('legal.priv2')}</li>
            <li>{t('legal.priv3')}</li>
            <li>{t('legal.priv4')}</li>
            <li>{t('legal.priv5')}</li>
          </ul>
          <button className="field-btn legal-link" onClick={() => { onClose(); openLegal('privacy') }}>
            {t('legal.viewPrivacy')}
          </button>
        </div>

        <div className="legal-block">
          <div className="legal-h">{t('legal.termsTitle')}</div>
          <p className="legal-p">{t('legal.termsBody')}</p>
          <button className="field-btn legal-link" onClick={() => { onClose(); openLegal('terms') }}>
            {t('legal.viewTerms')}
          </button>
        </div>

        <button className="sheet-close" onClick={onClose}>
          {t('settings.done')}
        </button>
      </div>
    </div>
  )
}
