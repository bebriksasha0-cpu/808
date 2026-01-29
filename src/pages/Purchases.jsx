import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Music, Download, Clock, CheckCircle, AlertTriangle, Loader2, ShoppingBag, Flag, XCircle } from 'lucide-react'
import { collection, query, where, getDocs, doc, updateDoc, addDoc, serverTimestamp, arrayUnion } from 'firebase/firestore'
import { db } from '../config/firebase'
import { useLanguage } from '../context/LanguageContext'
import { useAuth } from '../context/AuthContext'
import { getDownloadUrl } from '../utils/audioUrl'
import { notifyDispute } from '../utils/telegram'
import styles from './Purchases.module.css'

// Confirmation timeout in milliseconds (10 minutes)
const CONFIRMATION_TIMEOUT = 10 * 60 * 1000

// Helper to get file extension based on license type
const getFileExtension = (licenseType) => {
  if (!licenseType) return 'mp3'
  const type = licenseType.toLowerCase()
  if (type === 'mp3') return 'mp3'
  if (type === 'wav') return 'wav'
  if (type === 'trackout' || type === 'exclusive') return 'zip'
  return 'mp3'
}

const ORDER_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
  DELIVERED: 'delivered',
  DISPUTED: 'disputed',
  ADMIN_DELIVERED: 'admin_delivered'
}

// Timer component for pending orders
function CountdownTimer({ createdAt, onExpired, orderId }) {
  const [timeLeft, setTimeLeft] = useState(null)

  useEffect(() => {
    const calculateTimeLeft = () => {
      const created = createdAt instanceof Date ? createdAt : createdAt?.toDate?.() || new Date()
      const expiresAt = created.getTime() + CONFIRMATION_TIMEOUT
      const now = Date.now()
      const remaining = expiresAt - now
      
      if (remaining <= 0) {
        onExpired(orderId)
        return 0
      }
      return remaining
    }

    setTimeLeft(calculateTimeLeft())

    const timer = setInterval(() => {
      const remaining = calculateTimeLeft()
      setTimeLeft(remaining)
      if (remaining <= 0) {
        clearInterval(timer)
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [createdAt, onExpired, orderId])

  if (timeLeft === null) return null

  const minutes = Math.floor(timeLeft / 60000)
  const seconds = Math.floor((timeLeft % 60000) / 1000)

  return (
    <div className={styles.countdown}>
      <Clock size={16} />
      <span>Продавец должен подтвердить: {minutes}:{seconds.toString().padStart(2, '0')}</span>
    </div>
  )
}

export default function Purchases() {
  const { t } = useLanguage()
  const { user } = useAuth()
  const [purchases, setPurchases] = useState([])
  const [loading, setLoading] = useState(true)
  const [showDispute, setShowDispute] = useState(null)
  const [disputeReason, setDisputeReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const loadPurchases = async () => {
      if (!user?.id) {
        setLoading(false)
        return
      }

      try {
        const ordersQuery = query(
          collection(db, 'orders'),
          where('buyerId', '==', user.id)
        )
        const snapshot = await getDocs(ordersQuery)
        
        const ordersData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.() || new Date()
        }))
        ordersData.sort((a, b) => b.createdAt - a.createdAt)
        setPurchases(ordersData)
      } catch (err) {
        console.error('Error loading purchases:', err)
      }
      setLoading(false)
    }

    loadPurchases()
  }, [user?.id])

  // Handle timer expiration - auto-cancel order
  const handleTimerExpired = useCallback(async (orderId) => {
    const order = purchases.find(p => p.id === orderId)
    if (!order || order.status !== ORDER_STATUS.PENDING) return

    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status: ORDER_STATUS.CANCELLED,
        cancelledAt: serverTimestamp(),
        cancelReason: 'Время подтверждения истекло',
        updatedAt: serverTimestamp()
      })

      setPurchases(prev => prev.map(p => 
        p.id === orderId ? { ...p, status: ORDER_STATUS.CANCELLED } : p
      ))
    } catch (err) {
      console.error('Error auto-cancelling order:', err)
    }
  }, [purchases])

  const formatDate = (date) => {
    if (!date) return ''
    if (date.toDate) return date.toDate().toLocaleDateString()
    if (date instanceof Date) return date.toLocaleDateString()
    return ''
  }

  const handleDispute = async (orderId) => {
    if (!disputeReason.trim()) return

    setSubmitting(true)
    try {
      const order = purchases.find(p => p.id === orderId)
      
      await updateDoc(doc(db, 'orders', orderId), {
        status: ORDER_STATUS.DISPUTED,
        disputeReason: disputeReason,
        disputedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        actionLog: arrayUnion({
          action: 'disputed',
          by: user.name || user.email,
          byId: user.id,
          at: new Date().toISOString(),
          note: `Dispute opened: ${disputeReason}`
        })
      })

      const disputeData = {
        orderId: orderId,
        beatId: order?.beatId,
        beatTitle: order?.beatTitle,
        amount: order?.price,
        buyerId: user.id,
        buyerName: user.name,
        sellerId: order?.sellerId,
        sellerName: order?.sellerName,
        reason: disputeReason,
        description: disputeReason,
        status: 'open',
        createdAt: serverTimestamp()
      }
      
      await addDoc(collection(db, 'disputes'), disputeData)
      await notifyDispute(disputeData)

      setPurchases(prev => prev.map(p => 
        p.id === orderId ? { ...p, status: ORDER_STATUS.DISPUTED } : p
      ))
      setShowDispute(null)
      setDisputeReason('')
    } catch (err) {
      console.error('Error creating dispute:', err)
    }
    setSubmitting(false)
  }

  if (loading) {
    return (
      <div className={styles.purchases}>
        <div className="container">
          <div className={styles.loading}>
            <Loader2 size={32} className={styles.spinner} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.purchases}>
      <div className="container">
        <h1 className={styles.title}>{t('myPurchases') || 'Мои покупки'}</h1>

        {purchases.length > 0 ? (
          <div className={styles.purchasesList}>
            {purchases.map(order => {
              const isPending = order.status === ORDER_STATUS.PENDING
              const isDelivered = order.status === ORDER_STATUS.DELIVERED || order.status === ORDER_STATUS.ADMIN_DELIVERED
              const isCancelled = order.status === ORDER_STATUS.CANCELLED || order.status === ORDER_STATUS.REJECTED
              const isDisputed = order.status === ORDER_STATUS.DISPUTED

              return (
                <div key={order.id} className={`${styles.purchaseCard} ${isPending ? styles.pendingCard : ''}`}>
                  <div className={styles.cover}>
                    {order.beatCover ? (
                      <img src={order.beatCover} alt={order.beatTitle} />
                    ) : (
                      <Music size={24} />
                    )}
                  </div>

                  <div className={styles.info}>
                    <Link to={`/beat/${order.beatId}`} className={styles.beatTitle}>
                      {order.beatTitle}
                    </Link>
                    <span className={styles.seller}>
                      {t('by') || 'от'} {order.sellerName}
                    </span>
                    <span className={styles.orderRef}>#{order.orderRef}</span>
                  </div>

                  <div className={styles.license}>
                    <span className={styles.licenseType}>{order.licenseType}</span>
                  </div>

                  {/* Show price only for completed orders */}
                  <div className={styles.meta}>
                    {isDelivered ? (
                      <span className={styles.price}>-${order.price?.toFixed(2)}</span>
                    ) : isPending ? (
                      <span className={styles.priceHidden}>Ожидание...</span>
                    ) : isCancelled ? (
                      <span className={styles.priceRefund}>Возврат</span>
                    ) : (
                      <span className={styles.price}>${order.price?.toFixed(2)}</span>
                    )}
                    <span className={styles.date}>{formatDate(order.createdAt)}</span>
                  </div>

                  <div className={styles.statusCol}>
                    {isPending ? (
                      <span className={`${styles.status} ${styles.pending}`}>
                        <Clock size={14} />
                        Ожидание подтверждения
                      </span>
                    ) : isDelivered ? (
                      <span className={`${styles.status} ${styles.completed}`}>
                        <CheckCircle size={14} />
                        Завершено
                      </span>
                    ) : isCancelled ? (
                      <span className={`${styles.status} ${styles.cancelled}`}>
                        <XCircle size={14} />
                        Отменено
                      </span>
                    ) : isDisputed ? (
                      <span className={`${styles.status} ${styles.disputed}`}>
                        <AlertTriangle size={14} />
                        Спор открыт
                      </span>
                    ) : (
                      <span className={`${styles.status} ${styles.pending}`}>
                        <Clock size={14} />
                        {order.status}
                      </span>
                    )}
                  </div>

                  <div className={styles.actions}>
                    {/* Pending: show countdown timer */}
                    {isPending && (
                      <CountdownTimer 
                        createdAt={order.createdAt} 
                        onExpired={handleTimerExpired}
                        orderId={order.id}
                      />
                    )}

                    {/* Delivered: show download button */}
                    {isDelivered && order.beatFileUrl && (
                      <a 
                        href={getDownloadUrl(order.beatFileUrl, `${order.beatTitle}.${getFileExtension(order.licenseKey || order.licenseType)}`)}
                        className={styles.downloadBtn}
                        title="Скачать"
                      >
                        <Download size={18} />
                        <span>Скачать {(order.licenseKey || order.licenseType || 'MP3').toUpperCase()}</span>
                      </a>
                    )}
                    
                    {/* Cancelled: show dispute button */}
                    {isCancelled && !isDisputed && (
                      <button 
                        className={styles.disputeBtn}
                        onClick={() => setShowDispute(order.id)}
                      >
                        <Flag size={16} />
                        <span>Оспорить</span>
                      </button>
                    )}

                    {/* Disputed: show status */}
                    {isDisputed && (
                      <span className={styles.disputedNote}>
                        <AlertTriangle size={14} />
                        Спор на рассмотрении
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <ShoppingBag size={48} />
            <h3>{t('noPurchases') || 'Нет покупок'}</h3>
            <p>{t('startBuying') || 'Начните покупать биты'}</p>
            <Link to="/explore" className="btn btn-primary">
              {t('exploreCatalog') || 'Каталог'}
            </Link>
          </div>
        )}

        {/* Dispute Modal */}
        {showDispute && (
          <div className={styles.modalOverlay} onClick={() => setShowDispute(null)}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
              <h3 className={styles.modalTitle}>Открыть спор</h3>
              <p className={styles.modalText}>Опишите проблему. Мы разберёмся в ситуации.</p>
              
              <textarea
                className={styles.textarea}
                placeholder="Опишите причину спора..."
                value={disputeReason}
                onChange={e => setDisputeReason(e.target.value)}
                rows={4}
              />

              <div className={styles.modalActions}>
                <button 
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowDispute(null)
                    setDisputeReason('')
                  }}
                >
                  Отмена
                </button>
                <button 
                  className="btn btn-primary"
                  onClick={() => handleDispute(showDispute)}
                  disabled={submitting || !disputeReason.trim()}
                >
                  {submitting ? <Loader2 size={16} className={styles.spinner} /> : 'Отправить'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
