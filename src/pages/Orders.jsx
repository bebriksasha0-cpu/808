import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { 
  Music, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Loader2, 
  Package, 
  Eye, 
  Send,
  ThumbsUp,
  ThumbsDown
} from 'lucide-react'
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp, arrayUnion } from 'firebase/firestore'
import { db } from '../config/firebase'
import { useLanguage } from '../context/LanguageContext'
import { useAuth } from '../context/AuthContext'
import styles from './Purchases.module.css'

const ORDER_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  DELIVERED: 'delivered',
  DISPUTED: 'disputed',
  ADMIN_DELIVERED: 'admin_delivered'
}

export default function Orders() {
  const { t } = useLanguage()
  const { user } = useAuth()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [showProof, setShowProof] = useState(null)
  const [processing, setProcessing] = useState(null)

  useEffect(() => {
    const loadOrders = async () => {
      if (!user?.id) {
        setLoading(false)
        return
      }

      try {
        const ordersQuery = query(
          collection(db, 'orders'),
          where('sellerId', '==', user.id)
        )
        const snapshot = await getDocs(ordersQuery)
        
        const ordersData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.() || new Date()
        }))
        ordersData.sort((a, b) => b.createdAt - a.createdAt)
        setOrders(ordersData)
      } catch (err) {
        console.error('Error loading orders:', err)
      }
      setLoading(false)
    }

    loadOrders()
  }, [user?.id])

  const formatDate = (date) => {
    if (!date) return ''
    if (date.toDate) return date.toDate().toLocaleDateString()
    if (date instanceof Date) return date.toLocaleDateString()
    return ''
  }

  const handleApproveAndDeliver = async (orderId) => {
    if (!confirm('Подтвердить оплату и отправить бит покупателю?')) return
    
    setProcessing(orderId)
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status: ORDER_STATUS.DELIVERED,
        approvedAt: serverTimestamp(),
        deliveredAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        actionLog: arrayUnion({
          action: 'delivered',
          by: user.name || user.email,
          byId: user.id,
          at: new Date().toISOString(),
          note: 'Продавец подтвердил оплату и отправил бит'
        })
      })
      
      setOrders(prev => prev.map(o => 
        o.id === orderId ? { ...o, status: ORDER_STATUS.DELIVERED } : o
      ))
      
      alert('✅ Бит отправлен! Покупатель теперь может скачать его.')
    } catch (err) {
      console.error('Error delivering order:', err)
      alert('Ошибка: ' + err.message)
    }
    setProcessing(null)
  }

  const handleReject = async (orderId) => {
    const reason = prompt('Укажите причину отклонения:')
    if (!reason) return
    
    setProcessing(orderId)
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status: ORDER_STATUS.REJECTED,
        rejectReason: reason,
        rejectedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        actionLog: arrayUnion({
          action: 'rejected',
          by: user.name || user.email,
          byId: user.id,
          at: new Date().toISOString(),
          note: `Отклонено: ${reason}`
        })
      })
      
      setOrders(prev => prev.map(o => 
        o.id === orderId ? { ...o, status: ORDER_STATUS.REJECTED, rejectReason: reason } : o
      ))
    } catch (err) {
      console.error('Error rejecting order:', err)
      alert('Ошибка: ' + err.message)
    }
    setProcessing(null)
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case ORDER_STATUS.PENDING:
        return (
          <span className={`${styles.status} ${styles.pending}`}>
            <Clock size={14} />
            Ожидает
          </span>
        )
      case ORDER_STATUS.APPROVED:
        return (
          <span className={`${styles.status} ${styles.approved}`}>
            <CheckCircle size={14} />
            Подтверждено
          </span>
        )
      case ORDER_STATUS.DELIVERED:
      case ORDER_STATUS.ADMIN_DELIVERED:
        return (
          <span className={`${styles.status} ${styles.completed}`}>
            <Send size={14} />
            Отправлено
          </span>
        )
      case ORDER_STATUS.REJECTED:
        return (
          <span className={`${styles.status} ${styles.rejected}`}>
            <XCircle size={14} />
            Отклонено
          </span>
        )
      case ORDER_STATUS.DISPUTED:
        return (
          <span className={`${styles.status} ${styles.disputed}`}>
            <AlertTriangle size={14} />
            Спор
          </span>
        )
      default:
        return (
          <span className={`${styles.status} ${styles.pending}`}>
            <Clock size={14} />
            {status}
          </span>
        )
    }
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

  if (!user) {
    return (
      <div className={styles.purchases}>
        <div className="container">
          <div className={styles.emptyState}>
            <Package size={48} />
            <h3>Войдите в аккаунт</h3>
            <p>Чтобы видеть заказы на ваши биты</p>
            <Link to="/auth" className="btn btn-primary">Войти</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.purchases}>
      <div className="container">
        <h1 className={styles.title}>Продажи</h1>

        {orders.length > 0 ? (
          <div className={styles.purchasesList}>
            {orders.map(order => (
              <div key={order.id} className={styles.purchaseCard}>
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
                    Покупатель: {order.buyerName}
                  </span>
                  <span className={styles.orderRef}>#{order.orderRef}</span>
                </div>

                <div className={styles.license}>
                  <span className={styles.licenseType}>{order.licenseType}</span>
                </div>

                <div className={styles.meta}>
                  <span className={styles.price}>${order.price?.toFixed(2)}</span>
                  <span className={styles.date}>{formatDate(order.createdAt)}</span>
                </div>

                <div className={styles.statusCol}>
                  {getStatusBadge(order.status)}
                </div>

                <div className={styles.actions}>
                  {order.paymentProof && (
                    <button 
                      className={styles.viewBtn}
                      onClick={() => setShowProof(order.paymentProof)}
                      title="Посмотреть чек"
                    >
                      <Eye size={18} />
                    </button>
                  )}
                  
                  {order.status === ORDER_STATUS.PENDING && (
                    <>
                      <button 
                        className={styles.downloadBtn}
                        onClick={() => handleApproveAndDeliver(order.id)}
                        disabled={processing === order.id}
                        title="Подтвердить и отправить бит"
                      >
                        {processing === order.id ? (
                          <Loader2 size={18} className={styles.spinner} />
                        ) : (
                          <ThumbsUp size={18} />
                        )}
                      </button>
                      <button 
                        className={styles.reportBtn}
                        onClick={() => handleReject(order.id)}
                        disabled={processing === order.id}
                        title="Отклонить заказ"
                      >
                        <ThumbsDown size={16} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <Package size={48} />
            <h3>Пока нет заказов</h3>
            <p>Когда кто-то купит ваш бит, заказ появится здесь</p>
            <Link to="/upload" className="btn btn-primary">
              Загрузить бит
            </Link>
          </div>
        )}

        {showProof && (
          <div className={styles.modalOverlay} onClick={() => setShowProof(null)}>
            <div className={styles.proofModal} onClick={e => e.stopPropagation()}>
              <h3 className={styles.modalTitle}>Чек оплаты</h3>
              <img src={showProof} alt="Payment proof" className={styles.proofImage} />
              <button 
                className="btn btn-secondary"
                onClick={() => setShowProof(null)}
              >
                Закрыть
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
