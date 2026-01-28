import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import styles from './Home.module.css'

export default function Home() {
  const { user } = useAuth()
  const { t } = useLanguage()

  return (
    <div className={styles.home}>
      {/* Hero Section */}
      <section className={styles.hero}>
        <div className={`container ${styles.heroContainer}`}>
          <h1 className={styles.logo}>808</h1>
          <p className={styles.tagline}>{t('tagline')}</p>
          
          <div className={styles.actions}>
            <Link to="/explore" className={styles.heroBtn}>
              {t('buyBeat')}
            </Link>
            <Link to={user ? "/upload" : "/auth?mode=signup"} className={styles.heroBtnSecondary}>
              {t('sellBeat')}
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
