import { Link, useLocation } from 'react-router-dom'
import { Sun, Moon, User, Upload, Shield, Package } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import CountrySelector from './CountrySelector'
import styles from './Header.module.css'

export default function Header() {
  const { theme, toggleTheme } = useTheme()
  const { user } = useAuth()
  const { t } = useLanguage()
  const location = useLocation()

  return (
    <header className={styles.header}>
      <div className={`container ${styles.container}`}>
        <Link to="/" className={styles.logo}>
          808
        </Link>

        <nav className={styles.nav}>
        </nav>

        <div className={styles.actions}>
          <CountrySelector />
          
          <button 
            className={styles.iconBtn} 
            onClick={toggleTheme}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          
          {user && !user.isAdmin && (
            <>
              <Link to="/orders" className={styles.iconBtn} aria-label="Orders" title={t('orders') || 'Orders'}>
                <Package size={20} />
              </Link>
              <Link to="/upload" className={styles.iconBtn} aria-label="Upload beat">
                <Upload size={20} />
              </Link>
            </>
          )}

          {user?.isAdmin && (
            <Link to="/admin" className={styles.adminBtn} aria-label="Admin panel">
              <Shield size={20} />
            </Link>
          )}
          
          {user ? (
            <Link to="/profile" className={styles.iconBtn} aria-label="Profile">
              <User size={20} />
            </Link>
          ) : (
            <Link to="/auth" className="btn btn-primary">
              {t('signIn')}
            </Link>
          )}
        </div>

        {/* Mobile Menu */}
        <div className={styles.mobileActions}>
          <CountrySelector />
          
          <button 
            className={styles.iconBtn} 
            onClick={toggleTheme}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          
          {user && !user.isAdmin && (
            <>
              <Link to="/orders" className={styles.iconBtn} aria-label="Orders">
                <Package size={20} />
              </Link>
              <Link to="/upload" className={styles.iconBtn} aria-label="Upload">
                <Upload size={20} />
              </Link>
            </>
          )}
          
          {user?.isAdmin && (
            <Link to="/admin" className={styles.iconBtn} aria-label="Admin">
              <Shield size={20} />
            </Link>
          )}
          
          {user ? (
            <Link to="/profile" className={styles.iconBtn} aria-label="Profile">
              <User size={20} />
            </Link>
          ) : (
            <Link to="/auth" className={styles.iconBtn} aria-label="Sign in">
              <User size={20} />
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
