import { Outlet } from 'react-router-dom'
import Header from './Header'
import GlobalPlayer from './GlobalPlayer'
import { useAudio } from '../context/AudioContext'
import { useAuth } from '../context/AuthContext'
import styles from './Layout.module.css'

export default function Layout() {
  const { currentBeat } = useAudio()
  const { user, logout } = useAuth()

  // Show banned screen if user is banned
  if (user?.banned) {
    return (
      <div className={styles.bannedScreen}>
        <div className={styles.bannedContent}>
          <div className={styles.bannedIcon}>🚫</div>
          <h1>Аккаунт заблокирован</h1>
          <p>Ваш аккаунт был заблокирован администратором.</p>
          <p>Если вы считаете, что это ошибка, свяжитесь с поддержкой.</p>
          <button onClick={logout} className={styles.bannedLogout}>
            Выйти
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.layout}>
      <Header />
      <main className={styles.main}>
        <Outlet />
      </main>
      {currentBeat && <GlobalPlayer />}
    </div>
  )
}
