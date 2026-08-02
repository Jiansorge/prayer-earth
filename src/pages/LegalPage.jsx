import React from 'react'
import { useStore } from '../store.js'
import { useT } from '../i18n.js'

// Full, linkable Privacy Policy and Terms of Service.
export default function LegalPage() {
  const legalPage = useStore((s) => s.legalPage)
  const closeLegal = useStore((s) => s.closeLegal)
  const t = useT()

  return (
    <div className="view legal-view fade-in">
      <div className="back-row">
        <button onClick={closeLegal} aria-label={t('prayer.back')}>
          ←
        </button>
        <div>
          <div style={{ fontSize: 14, color: 'var(--ink-dim)' }}>
            {legalPage === 'privacy' ? t('legal.privacyTitle') : t('legal.termsTitle')}
          </div>
          <div className="subtitle" style={{ fontSize: 13, marginTop: 2 }}>
            Prayer Earth
          </div>
        </div>
      </div>

      {legalPage === 'privacy' ? (
        <>
          <section className="legal-page-section">
            <h2>{t('legal.privacyTitle')}</h2>
            <p className="legal-p">{t('legal.pIntro')}</p>
          </section>
          <section className="legal-page-section">
            <h3>1. {t('legal.pWhatTitle')}</h3>
            <ul className="legal-list">
              <li>{t('legal.priv1')}</li>
              <li>{t('legal.priv2')}</li>
              <li>{t('legal.priv3')}</li>
              <li>{t('legal.priv4')}</li>
              <li>{t('legal.priv5')}</li>
            </ul>
          </section>
          <section className="legal-page-section">
            <h3>2. {t('legal.pUseTitle')}</h3>
            <p className="legal-p">{t('legal.pUseBody')}</p>
          </section>
          <section className="legal-page-section">
            <h3>3. {t('legal.pRightsTitle')}</h3>
            <p className="legal-p">{t('legal.pRightsBody')}</p>
          </section>
          <section className="legal-page-section">
            <h3>4. {t('legal.pContactTitle')}</h3>
            <p className="legal-p">{t('legal.pContactBody')}</p>
          </section>
        </>
      ) : (
        <>
          <section className="legal-page-section">
            <h2>{t('legal.termsTitle')}</h2>
            <p className="legal-p">{t('legal.tIntro')}</p>
          </section>
          <section className="legal-page-section">
            <h3>1. {t('legal.tUseTitle')}</h3>
            <p className="legal-p">{t('legal.tUseBody')}</p>
          </section>
          <section className="legal-page-section">
            <h3>2. {t('legal.tContentTitle')}</h3>
            <p className="legal-p">{t('legal.tContentBody')}</p>
          </section>
          <section className="legal-page-section">
            <h3>3. {t('legal.tLiabilityTitle')}</h3>
            <p className="legal-p">{t('legal.tLiabilityBody')}</p>
          </section>
          <section className="legal-page-section">
            <h3>4. {t('legal.tChangesTitle')}</h3>
            <p className="legal-p">{t('legal.tChangesBody')}</p>
          </section>
        </>
      )}
    </div>
  )
}
