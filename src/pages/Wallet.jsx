import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { 
  Wallet as WalletIcon, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
  Construction
} from 'lucide-react'
import { doc, getDoc, setDoc, collection, query, where, getDocs, onSnapshot } from 'firebase/firestore'
import { db } from '../config/firebase'
import { useLanguage } from '../context/LanguageContext'
import { useAuth } from '../context/AuthContext'
import styles from './Wallet.module.css'

export default function Wallet() {
  const { t } = useLanguage()
  const { user } = useAuth()
  
  const [wallet, setWallet] = useState({ available: 0, hold: 0 })
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)

  const loadWalletData = useCallback(async () => {
    if (!user?.id) {
      setLoading(false)
      return
    }
    try {
      const walletDoc = await getDoc(doc(db, 'wallets', user.id))
      if (walletDoc.exists()) {
        setWallet(walletDoc.data())
      } else {
        const newWallet = { available: 0, hold: 0 }
        await setDoc(doc(db, 'wallets', user.id), newWallet)
        setWallet(newWallet)
      }
      const txQuery = query(collection(db, 'transactions'), where('userId', '==', user.id))
      const txSnapshot = await getDocs(txQuery)
      const txData = txSnapshot.docs.map(d => ({ id: d.id, ...d.data() }))
      txData.sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() || 0
        const bTime = b.createdAt?.toMillis?.() || 0
        return bTime - aTime
      })
      setTransactions(txData)
    } catch (err) {
      console.error('Error loading wallet:', err)
    }
    setLoading(false)
  }, [user?.id])

  useEffect(() => {
    loadWalletData()
    if (user?.id) {
      const unsubscribe = onSnapshot(doc(db, 'wallets', user.id), (doc) => {
        if (doc.exists()) {
          setWallet(doc.data())
        }
      })
      return () => unsubscribe()
    }
  }, [loadWalletData, user?.id])

  const formatDate = (timestamp) => {
    if (!timestamp) return ''
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const getTransactionIcon = (type, status) => {
    if (status === 'pending') return <Clock size={16} className={styles.txPending} />
    if (status === 'failed' || status === 'rejected') return <XCircle size={16} className={styles.txFailed} />
    if (type === 'topup' || type === 'sale' || type === 'refund') return <ArrowDownLeft size={16} className={styles.txIn} />
    return <ArrowUpRight size={16} className={styles.txOut} />
  }

  if (!user) {
    return (
      <div className={styles.wallet}>
        <div className={styles.container}>
          <div className={styles.empty}>
            <WalletIcon size={48} />
            <h2>{t('signInRequired')}</h2>
            <p>{t('signInToAccessWallet')}</p>
            <Link to="/auth" className="btn btn-primary">{t('signIn')}</Link>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className={styles.wallet}>
        <div className={styles.container}>
          <div className={styles.loading}>
            <Loader2 className="spin" size={32} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.wallet}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>{t('myWallet') || 'Мой кошелёк'}</h1>
        </div>

        {/* Balance Card */}
        <div className={styles.balanceCard}>
          <div className={styles.balanceHeader}>
            <WalletIcon size={24} />
            <span>{t('availableBalance') || 'Доступный баланс'}</span>
          </div>
          <div className={styles.balanceAmount}>
            ${wallet.available.toFixed(2)}
          </div>
          {wallet.hold > 0 && (
            <div className={styles.holdAmount}>
              <Clock size={14} />
              <span>{t('onHold') || 'На удержании'}: ${wallet.hold.toFixed(2)}</span>
            </div>
          )}
          
          {/* Coming Soon Notice */}
          <div className={styles.comingSoon}>
            <Construction size={20} />
            <div>
              <strong>{t('comingSoon') || 'Скоро'}</strong>
              <p>{t('paymentMethodsComingSoon') || 'Способы пополнения и вывода скоро будут доступны'}</p>
            </div>
          </div>
        </div>

        {/* Transactions */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('transactionHistory') || 'История транзакций'}</h2>
          
          {transactions.length === 0 ? (
            <div className={styles.emptyTx}>
              <AlertCircle size={32} />
              <p>{t('noTransactions') || 'Транзакций пока нет'}</p>
            </div>
          ) : (
            <div className={styles.txList}>
              {transactions.map(tx => (
                <div key={tx.id} className={styles.txItem}>
                  <div className={styles.txIcon}>
                    {getTransactionIcon(tx.type, tx.status)}
                  </div>
                  <div className={styles.txInfo}>
                    <span className={styles.txDesc}>{tx.description}</span>
                    <span className={styles.txDate}>{formatDate(tx.createdAt)}</span>
                  </div>
                  <div className={`${styles.txAmount} ${tx.type === 'topup' || tx.type === 'sale' || tx.type === 'refund' ? styles.txIn : styles.txOut}`}>
                    {tx.type === 'topup' || tx.type === 'sale' || tx.type === 'refund' ? '+' : '-'}${tx.amount?.toFixed(2) || '0.00'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
