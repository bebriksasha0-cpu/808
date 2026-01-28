import { useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, User, Camera, AlertCircle, Check, Send } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import styles from './Settings.module.css'

export default function Settings() {
  const navigate = useNavigate()
  const { user, updateProfile, canChangeName, logout } = useAuth()
  const { t } = useLanguage()
  const fileInputRef = useRef(null)
  
  const [name, setName] = useState(user?.name || '')
  const [telegram, setTelegram] = useState(user?.telegram || '')
  const [avatar, setAvatar] = useState(user?.avatar || null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  const { canChange, daysLeft } = canChangeName()

  const handleAvatarClick = () => {
    fileInputRef.current?.click()
  }

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setAvatar(reader.result)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    
    const result = updateProfile({ name, avatar, telegram: telegram.trim() })
    
    if (result.success) {
      setSuccess(t('settingsSaved'))
      setTimeout(() => setSuccess(''), 3000)
    } else {
      setError(result.error)
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  if (!user) {
    navigate('/auth')
    return null
  }

  return (
    <div className={styles.settings}>
      <div className="container">
        <Link to="/profile" className={styles.backLink}>
          <ArrowLeft size={18} />
          {t('back')}
        </Link>

        <h1 className={styles.title}>{t('settings')}</h1>

        <form onSubmit={handleSubmit} className={styles.form}>
          {/* Avatar */}
          <div className={styles.avatarSection}>
            <div className={styles.avatarWrapper} onClick={handleAvatarClick}>
              {avatar ? (
                <img src={avatar} alt={name} className={styles.avatarImage} />
              ) : (
                <div className={styles.avatarPlaceholder}>
                  <User size={48} />
                </div>
              )}
              <div className={styles.avatarOverlay}>
                <Camera size={24} />
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className={styles.fileInput}
            />
            <p className={styles.avatarHint}>{t('clickToChangeAvatar')}</p>
          </div>

          {/* Name */}
          <div className={styles.inputGroup}>
            <label className={styles.label}>{t('producerName')}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={styles.input}
              disabled={!canChange}
            />
            {!canChange && (
              <p className={styles.nameWarning}>
                <AlertCircle size={14} />
                {t('canChangeNameIn')} {daysLeft} {t('days')}
              </p>
            )}
          </div>

          {/* Email (read-only) */}
          <div className={styles.inputGroup}>
            <label className={styles.label}>{t('email')}</label>
            <input
              type="email"
              value={user.email || ''}
              className={styles.input}
              disabled
            />
          </div>

          {/* Telegram */}
          <div className={styles.inputGroup}>
            <label className={styles.label}>
              <Send size={16} />
              Telegram *
            </label>
            <input
              type="text"
              value={telegram}
              onChange={(e) => setTelegram(e.target.value)}
              placeholder="@username"
              className={styles.input}
            />
            <p className={styles.hint}>
              {t('telegramRequired') || 'Required for buying and selling beats. Buyers and sellers will contact each other via Telegram.'}
            </p>
          </div>

          {error && (
            <div className={styles.error}>
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {success && (
            <div className={styles.success}>
              <Check size={16} />
              {success}
            </div>
          )}

          <div className={styles.actions}>
            <button type="submit" className="btn btn-primary">
              {t('saveChanges')}
            </button>
          </div>
        </form>

        <div className={styles.dangerZone}>
          <h2 className={styles.dangerTitle}>{t('dangerZone')}</h2>
          <button onClick={handleLogout} className={styles.logoutBtn}>
            {t('signOut')}
          </button>
        </div>
      </div>
    </div>
  )
}
