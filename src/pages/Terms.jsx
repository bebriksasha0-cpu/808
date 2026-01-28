import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useLanguage } from '../context/LanguageContext'
import styles from './Terms.module.css'

export default function Terms() {
  const { t } = useLanguage()
  const [activeTab, setActiveTab] = useState('terms')

  return (
    <div className={styles.terms}>
      <div className="container">
        <Link to="/" className={styles.backLink}>
          <ArrowLeft size={18} />
          {t('back')}
        </Link>

        <div className={styles.tabs}>
          <button 
            className={`${styles.tab} ${activeTab === 'terms' ? styles.active : ''}`}
            onClick={() => setActiveTab('terms')}
          >
            {t('termsOfService')}
          </button>
          <button 
            className={`${styles.tab} ${activeTab === 'privacy' ? styles.active : ''}`}
            onClick={() => setActiveTab('privacy')}
          >
            {t('privacyPolicy')}
          </button>
          <button 
            className={`${styles.tab} ${activeTab === 'license' ? styles.active : ''}`}
            onClick={() => setActiveTab('license')}
          >
            {t('licensingTitle')}
          </button>
        </div>

        <div className={styles.content}>
          {activeTab === 'terms' && (
            <article className={styles.article}>
              <h1>{t('termsTitle')}</h1>
              <p className={styles.date}>{t('effectiveDate')}</p>
              
              <p>{t('termsIntro')}</p>
              <p>{t('termsAgreeIntro')}</p>

              <h2>{t('eligibilityTitle')}</h2>
              <p>{t('eligibilityText')}</p>

              <h2>{t('accountsTitle')}</h2>
              <ul>
                <li>{t('accountsSecurity')}</li>
                <li>{t('accountsActivity')}</li>
                <li>{t('accountsAccurate')}</li>
              </ul>

              <h2>{t('platformTitle')}</h2>
              <p>{t('platformText')}</p>

              <h2>{t('ownershipTitle')}</h2>
              <ul>
                <li>{t('ownershipRetain')}</li>
                <li>{t('ownershipConfirm')}</li>
                <li>{t('ownershipNoClaim')}</li>
                <li>{t('ownershipGrant')}</li>
              </ul>

              <h2>{t('copyrightTitle')}</h2>
              <p>{t('copyrightRespect')}</p>
              <p>{t('copyrightNotice')} <a href="mailto:contact@808.com">contact@808.com</a>.</p>
              <p>{t('copyrightViolation')}</p>

              <h2>{t('licensesTitle')}</h2>
              <ul>
                <li>{t('licensesGrant')}</li>
                <li>{t('licensesDefined')}</li>
                <li>{t('licensesBinding')}</li>
                <li>{t('licensesFinal')}</li>
              </ul>

              <h2>{t('paymentsTitle')}</h2>
              <ul>
                <li>{t('paymentsProcessed')}</li>
                <li>{t('paymentsFee')}</li>
                <li>{t('paymentsTax')}</li>
                <li>{t('paymentsErrors')}</li>
              </ul>

              <h2>{t('prohibitedTitle')}</h2>
              <p>{t('prohibitedIntro')}</p>
              <ul>
                <li>{t('prohibitedStolen')}</li>
                <li>{t('prohibitedIllegal')}</li>
                <li>{t('prohibitedExploit')}</li>
              </ul>

              <h2>{t('terminationTitle')}</h2>
              <p>{t('terminationText')}</p>

              <h2>{t('disclaimerTitle')}</h2>
              <p>{t('disclaimerText')}</p>

              <h2>{t('liabilityTitle')}</h2>
              <p>{t('liabilityText')}</p>

              <h2>{t('governingTitle')}</h2>
              <p>{t('governingText')}</p>

              <h2>{t('changesTitle')}</h2>
              <p>{t('changesText')}</p>
            </article>
          )}

          {activeTab === 'privacy' && (
            <article className={styles.article}>
              <h1>{t('privacyTitle')}</h1>
              <p className={styles.date}>{t('effectiveDate')}</p>

              <h2>{t('dataCollectTitle')}</h2>
              <ul>
                <li>{t('dataAccount')}</li>
                <li>{t('dataPayment')}</li>
                <li>{t('dataUsage')}</li>
              </ul>

              <h2>{t('dataUseTitle')}</h2>
              <ul>
                <li>{t('dataOperate')}</li>
                <li>{t('dataProcess')}</li>
                <li>{t('dataCommunicate')}</li>
              </ul>

              <h2>{t('dataSharingTitle')}</h2>
              <p>{t('dataSharingText')}</p>

              <h2>{t('legalComplianceTitle')}</h2>
              <p>{t('legalComplianceText')}</p>

              <h2>{t('securityTitle')}</h2>
              <p>{t('securityText')}</p>

              <h2>{t('yourRightsTitle')}</h2>
              <p>{t('yourRightsText')} <a href="mailto:contact@808.com">contact@808.com</a>.</p>
            </article>
          )}

          {activeTab === 'license' && (
            <article className={styles.article}>
              <h1>{t('licensingTitle')}</h1>
              <p className={styles.date}>{t('effectiveDate')}</p>
              
              <p>{t('licensingIntro')}</p>

              <h2>{t('licenseGrantTitle')}</h2>
              <p>{t('licenseGrantText')}</p>

              <h2>{t('restrictionsTitle')}</h2>
              <p>{t('restrictionsIntro')}</p>
              <ul>
                <li>{t('restrictionsClaim')}</li>
                <li>{t('restrictionsResell')}</li>
                <li>{t('restrictionsRegister')}</li>
              </ul>

              <h2>{t('creditTitle')}</h2>
              <p>{t('creditText')}</p>

              <h2>{t('licenseTerminationTitle')}</h2>
              <p>{t('licenseTerminationText')}</p>

              <div className={styles.notice}>
                <p><strong>{t('agreementNotice')}</strong></p>
              </div>
            </article>
          )}
        </div>
      </div>
    </div>
  )
}
