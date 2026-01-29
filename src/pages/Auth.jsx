import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Mail, Lock, User, ArrowLeft, Loader2, CheckCircle, AlertCircle, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import styles from './Auth.module.css'

export default function Auth() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { login, register, loginWithGoogle, linkPassword, resendVerificationEmail, checkEmailVerified, user } = useAuth()
  const { t } = useLanguage()
  const [mode, setMode] = useState('signin') // signin, signup, forgot, verify, verified
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: ''
  })
  const pollingRef = useRef(null)

  useEffect(() => {
    const urlMode = searchParams.get('mode')
    if (urlMode === 'signup') {
      setMode('signup')
    }
  }, [searchParams])

  // Redirect if already logged in and verified (but not if showing password modal)
  useEffect(() => {
    if (user && user.emailVerified && !showPasswordModal) {
      navigate('/profile')
    }
  }, [user, navigate, showPasswordModal])

  // Poll for email verification when in verify mode
  useEffect(() => {
    if (mode === 'verify') {
      // Check every 3 seconds
      pollingRef.current = setInterval(async () => {
        const result = await checkEmailVerified()
        if (result.verified) {
          clearInterval(pollingRef.current)
          setMode('verified')
          setMessage({ type: 'success', text: t('emailVerified') })
          // Redirect after showing success message
          setTimeout(() => {
            navigate('/profile')
          }, 2000)
        }
      }, 3000)
    }
    
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
      }
    }
  }, [mode, checkEmailVerified, navigate, t])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setMessage({ type: '', text: '' })
    
    try {
      if (mode === 'signin') {
        const result = await login({ email: formData.email, password: formData.password })
        
        if (result.success) {
          navigate('/profile')
        } else if (result.needsVerification) {
          setMode('verify')
          setMessage({ type: 'warning', text: t('verifyEmailFirst') })
        } else {
          setMessage({ type: 'error', text: t(result.error) || result.error })
        }
      } else if (mode === 'signup') {
        const result = await register({ 
          email: formData.email, 
          password: formData.password,
          name: formData.name 
        })
        
        if (result.success) {
          setMode('verify')
          setMessage({ type: 'success', text: t('verificationSent') })
        } else {
          setMessage({ type: 'error', text: t(result.error) || result.error })
        }
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    }
    
    setIsLoading(false)
  }

  const handleGoogleLogin = async () => {
    setIsLoading(true)
    setMessage({ type: '', text: '' })
    
    const result = await loginWithGoogle()
    
    if (result.success) {
      // If new user, show password creation modal
      if (result.isNewUser) {
        setShowPasswordModal(true)
        setIsLoading(false)
      } else {
        navigate('/profile')
      }
    } else {
      setMessage({ type: 'error', text: t(result.error) || result.error })
      setIsLoading(false)
    }
  }

  const handleCreatePassword = async (e) => {
    e.preventDefault()
    
    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: t('passwordMinLength') })
      return
    }
    
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: t('passwordsDoNotMatch') })
      return
    }
    
    setIsLoading(true)
    const result = await linkPassword(newPassword)
    
    if (result.success) {
      setShowPasswordModal(false)
      navigate('/profile')
    } else {
      setMessage({ type: 'error', text: t(result.error) || result.error })
    }
    setIsLoading(false)
  }

  const handleSkipPassword = () => {
    setShowPasswordModal(false)
    navigate('/profile')
  }

  const handleResendVerification = async () => {
    setIsLoading(true)
    const result = await resendVerificationEmail()
    
    if (result.success) {
      setMessage({ type: 'success', text: t('verificationResent') })
    } else {
      setMessage({ type: 'error', text: result.error })
    }
    
    setIsLoading(false)
  }

  return (
    <div className={styles.auth}>
      <div className={styles.container}>
        <Link to="/" className={styles.logo}>808</Link>

        {/* Message display */}
        {message.text && (
          <div className={`${styles.message} ${styles[message.type]}`}>
            {message.type === 'success' && <CheckCircle size={18} />}
            {message.type === 'error' && <AlertCircle size={18} />}
            {message.type === 'warning' && <AlertCircle size={18} />}
            <span>{message.text}</span>
          </div>
        )}

        {/* Verified success screen */}
        {mode === 'verified' && (
          <div className={styles.form}>
            <div className={styles.verifyIconSuccess}>
              <CheckCircle size={64} />
            </div>
            <h1 className={styles.title}>{t('emailVerifiedTitle')}</h1>
            <p className={styles.subtitle}>{t('emailVerifiedMessage')}</p>
            <div className={styles.redirecting}>
              <Loader2 size={18} className={styles.spinner} />
              <span>{t('redirecting')}</span>
            </div>
          </div>
        )}

        {mode === 'verify' && (
          <div className={styles.form}>
            <div className={styles.verifyIcon}>
              <Mail size={48} />
            </div>
            <h1 className={styles.title}>{t('checkYourEmail')}</h1>
            <p className={styles.subtitle}>{t('verificationSentTo')} <strong>{formData.email}</strong></p>
            
            <p className={styles.verifyText}>{t('clickLinkToVerify')}</p>
            
            <p className={styles.spamNotice}>⚠️ {t('checkSpamFolder')}</p>

            <div className={styles.checkingStatus}>
              <Loader2 size={16} className={styles.spinner} />
              <span>{t('waitingForVerification')}</span>
            </div>
            
            <button 
              onClick={handleResendVerification}
              className={`btn btn-secondary btn-lg ${styles.submitBtn}`}
              disabled={isLoading}
            >
              {isLoading ? <Loader2 size={18} className={styles.spinner} /> : t('resendEmail')}
            </button>
            
            <p className={styles.switchText}>
              <button onClick={() => { setMode('signin'); setMessage({ type: '', text: '' }) }}>
                {t('backToSignIn')}
              </button>
            </p>
          </div>
        )}

        {mode === 'signin' && (
          <div className={styles.form}>
            <h1 className={styles.title}>{t('welcomeBack')}</h1>
            <p className={styles.subtitle}>{t('signInToAccount')}</p>

            <form onSubmit={handleSubmit}>
              <div className={styles.inputGroup}>
                <Mail size={18} className={styles.inputIcon} />
                <input 
                  type="email"
                  placeholder={t('email')}
                  className={styles.input}
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                  required
                />
              </div>

              <div className={styles.inputGroup}>
                <Lock size={18} className={styles.inputIcon} />
                <input 
                  type="password"
                  placeholder={t('password')}
                  className={styles.input}
                  value={formData.password}
                  onChange={e => setFormData({...formData, password: e.target.value})}
                  required
                  minLength={6}
                />
              </div>

              <button 
                type="button" 
                className={styles.forgotLink}
                onClick={() => setMode('forgot')}
              >
                {t('forgotPassword')}
              </button>

              <button 
                type="submit" 
                className={`btn btn-primary btn-lg ${styles.submitBtn}`}
                disabled={isLoading}
              >
                {isLoading ? <Loader2 size={18} className={styles.spinner} /> : t('signIn')}
              </button>
            </form>

            <div className={styles.divider}>
              <span>{t('or')}</span>
            </div>

            <button 
              className={`btn btn-secondary btn-lg ${styles.socialBtn}`}
              onClick={handleGoogleLogin}
              disabled={isLoading}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              {t('continueWithGoogle')}
            </button>

            <p className={styles.switchText}>
              {t('dontHaveAccount')}{' '}
              <button onClick={() => setMode('signup')}>{t('signUp')}</button>
            </p>
          </div>
        )}

        {mode === 'signup' && (
          <div className={styles.form}>
            <h1 className={styles.title}>{t('createAccount')}</h1>
            <p className={styles.subtitle}>{t('startSelling')}</p>

            <form onSubmit={handleSubmit}>
              <div className={styles.inputGroup}>
                <User size={18} className={styles.inputIcon} />
                <input 
                  type="text"
                  placeholder={t('producerName')}
                  className={styles.input}
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  required
                />
              </div>

              <div className={styles.inputGroup}>
                <Mail size={18} className={styles.inputIcon} />
                <input 
                  type="email"
                  placeholder={t('email')}
                  className={styles.input}
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                  required
                />
              </div>

              <div className={styles.inputGroup}>
                <Lock size={18} className={styles.inputIcon} />
                <input 
                  type="password"
                  placeholder={t('password')}
                  className={styles.input}
                  value={formData.password}
                  onChange={e => setFormData({...formData, password: e.target.value})}
                  required
                  minLength={6}
                />
              </div>

              <p className={styles.passwordHint}>{t('passwordMinLength')}</p>

              <button 
                type="submit" 
                className={`btn btn-primary btn-lg ${styles.submitBtn}`}
                disabled={isLoading}
              >
                {isLoading ? <Loader2 size={18} className={styles.spinner} /> : t('createAccount')}
              </button>
            </form>

            <p className={styles.terms}>
              {t('termsAgree')}{' '}
              <Link to="/terms">{t('termsOfService')}</Link> {t('and')} <Link to="/terms">{t('privacyPolicy')}</Link>
            </p>

            <p className={styles.switchText}>
              {t('alreadyHaveAccount')}{' '}
              <button onClick={() => setMode('signin')}>{t('signIn')}</button>
            </p>
          </div>
        )}

        {mode === 'forgot' && (
          <div className={styles.form}>
            <button 
              className={styles.backBtn}
              onClick={() => setMode('signin')}
            >
              <ArrowLeft size={18} />
              {t('back')}
            </button>

            <h1 className={styles.title}>{t('resetPassword')}</h1>
            <p className={styles.subtitle}>{t('enterEmailReset')}</p>

            <form onSubmit={handleSubmit}>
              <div className={styles.inputGroup}>
                <Mail size={18} className={styles.inputIcon} />
                <input 
                  type="email"
                  placeholder={t('email')}
                  className={styles.input}
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                  required
                />
              </div>

              <button 
                type="submit" 
                className={`btn btn-primary btn-lg ${styles.submitBtn}`}
                disabled={isLoading}
              >
                {isLoading ? <Loader2 size={18} className={styles.spinner} /> : t('sendResetLink')}
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Password Creation Modal for Google Sign-in */}
      {showPasswordModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <button className={styles.modalClose} onClick={handleSkipPassword}>
              <X size={20} />
            </button>
            
            <h2 className={styles.modalTitle}>{t('createPasswordTitle')}</h2>
            <p className={styles.modalSubtitle}>{t('createPasswordDesc')}</p>
            
            {message.text && (
              <div className={`${styles.message} ${styles[message.type]}`}>
                {message.type === 'error' && <AlertCircle size={18} />}
                <span>{message.text}</span>
              </div>
            )}
            
            <form onSubmit={handleCreatePassword}>
              <div className={styles.inputGroup}>
                <Lock size={18} className={styles.inputIcon} />
                <input 
                  type="password"
                  placeholder={t('password')}
                  className={styles.input}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              
              <div className={styles.inputGroup}>
                <Lock size={18} className={styles.inputIcon} />
                <input 
                  type="password"
                  placeholder={t('confirmPassword')}
                  className={styles.input}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              
              <p className={styles.passwordHint}>{t('passwordMinLength')}</p>
              
              <button 
                type="submit" 
                className={`btn btn-primary btn-lg ${styles.submitBtn}`}
                disabled={isLoading}
              >
                {isLoading ? <Loader2 size={18} className={styles.spinner} /> : t('savePassword')}
              </button>
            </form>
            
            <button className={styles.skipBtn} onClick={handleSkipPassword}>
              {t('skipForNow')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
