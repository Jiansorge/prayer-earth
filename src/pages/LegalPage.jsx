import React from 'react'
import { useStore } from '../store.js'
import { useT } from '../i18n.js'
import ObfuscatedEmail from '../components/ObfuscatedEmail.jsx'

// Full, linkable Privacy Policy and Terms of Service.
export default function LegalPage() {
  const legalPage = useStore((s) => s.legalPage)
  const closeLegal = useStore((s) => s.closeLegal)
  const locale = useStore((s) => s.locale)
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
            Joining Palms
          </div>
        </div>
      </div>

      {locale !== 'en' && <p className="legal-p legal-lang-note">{t('legal.langNote')}</p>}

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
              <li>{t('legal.priv6')}</li>
              <li>{t('legal.priv7')}</li>
              <li>{t('legal.priv8')}</li>
              <li>{t('legal.priv9')}</li>
            </ul>
          </section>
          <section className="legal-page-section">
            <h3>2. {t('legal.pUseTitle')}</h3>
            <p className="legal-p">{t('legal.pUseBody')}</p>
          </section>
          <section className="legal-page-section">
            <h3>3. {t('legal.pBasisTitle')}</h3>
            <p className="legal-p">{t('legal.pBasisBody')}</p>
          </section>
          <section className="legal-page-section">
            <h3>4. {t('legal.pRightsTitle')}</h3>
            <p className="legal-p">{t('legal.pRightsBody')}</p>
          </section>
          <section className="legal-page-section">
            <h3>5. {t('legal.pGdprTitle')}</h3>
            <p className="legal-p">{t('legal.pRightsEu')}</p>
            <p className="legal-p">{t('legal.pRightsCa')}</p>
            <p className="legal-p">{t('legal.pRightsIntl')}</p>
            <p className="legal-p" style={{ marginTop: 8 }}>{t('legal.pLgpdBody')}</p>
          </section>
          <section className="legal-page-section">
            <h3>6. {t('legal.pCookTitle')}</h3>
            <p className="legal-p">{t('legal.cookBody')}</p>
          </section>
          <section className="legal-page-section">
            <h3>7. {t('legal.pKidsTitle')}</h3>
            <p className="legal-p">{t('legal.ageBody')}</p>
          </section>
          <section className="legal-page-section">
            <h3>8. {t('legal.pProcTitle')}</h3>
            <p className="legal-p">{t('legal.processingBody')}</p>
          </section>
          <section className="legal-page-section">
            <h3>9. {t('legal.pBreachTitle')}</h3>
            <p className="legal-p">{t('legal.pBreachBody')}</p>
          </section>
          <section className="legal-page-section">
            <h3>10. {t('legal.pDpoTitle')}</h3>
            <p className="legal-p">{t('legal.pDpoBody')}</p>
          </section>
          <section className="legal-page-section">
            <h3>11. {t('legal.pContactTitle')}</h3>
            <p className="legal-p">
              {t('legal.pContactBody')}
              <ObfuscatedEmail className="legal-email" />
              {t('legal.pContactBody2')}
            </p>
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
          <section className="legal-page-section">
            <h3>5. {t('legal.tAbuseTitle')}</h3>
            <p className="legal-p">{t('legal.tAbuseBody')}</p>
          </section>
          <section className="legal-page-section">
            <h3>6. {t('legal.tGoverningTitle')}</h3>
            <p className="legal-p">{t('legal.tGoverningBody')}</p>
          </section>
          <section className="legal-page-section">
            <h3>7. {t('legal.tDisputeTitle')}</h3>
            <p className="legal-p">{t('legal.tDisputeBody')}</p>
          </section>
          <section className="legal-page-section">
            <h3>8. {t('legal.tSeverTitle')}</h3>
            <p className="legal-p">{t('legal.tSeverBody')}</p>
          </section>
          <section className="legal-page-section">
            <h3>9. {t('legal.tForceTitle')}</h3>
            <p className="legal-p">{t('legal.tForceBody')}</p>
          </section>
          <section className="legal-page-section">
            <h3>10. {t('legal.tDmcaTitle')}</h3>
            <p className="legal-p">{t('legal.tDmcaBody')}</p>
          </section>
          <section className="legal-page-section">
            <h3>11. {t('legal.tAiTitle')}</h3>
            <p className="legal-p">{t('legal.tAiBody')}</p>
          </section>
          <section className="legal-page-section">
            <h3>12. {t('legal.tTransTitle')}</h3>
            <p className="legal-p">{t('legal.tTransBody')}</p>
          </section>
          <section className="legal-page-section">
            <h3>13. {t('legal.tChangesTitle2')}</h3>
            <p className="legal-p">{t('legal.tChangesBody2')}</p>
          </section>
          <section className="legal-page-section">
            <h3>14. {t('legal.tEffectiveTitle')}</h3>
            <p className="legal-p">{t('legal.tEffectiveBody')}</p>
          </section>
        </>
      )}
    </div>
  )
}
