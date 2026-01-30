import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Sun, Moon, User, Upload, Shield, Users } from 'lucide-react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../config/firebase'
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
  const [userCount, setUserCount] = useState(0)

  // Real-time user count listener
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      setUserCount(snapshot.size)
    })
    return () => unsubscribe()
  }, [])

  return (
    <header className={styles.header}>
      <div className={`container ${styles.container}`}>
        <Link to="/" className={styles.logo}>
          808
        </Link>

        <nav className={styles.nav}>
        </nav>

        <div className={styles.actions}>
          <div className={styles.userCount}>
            <Users size={16} />
            <span>{userCount.toLocaleString()}</span>
          </div>
          
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
          <div className={styles.userCount}>
            <Users size={14} />
            <span>{userCount.toLocaleString()}</span>
          </div>
          
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
