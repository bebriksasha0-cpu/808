import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Music, Download, Clock, CheckCircle, AlertTriangle, Loader2, ShoppingBag, Flag, XCircle, Eye, Send, Shield } from 'lucide-react'
import { collection, query, where, getDocs, doc, updateDoc, addDoc, serverTimestamp, orderBy, arrayUnion } from 'firebase/firestore'
import { db } from '../config/firebase'
import { useLanguage } from '../context/LanguageContext'
import { useAuth } from '../context/AuthContext'
import { getDownloadUrl } from '../utils/audioUrl'
import { notifyDispute } from '../utils/telegram'
import styles from './Purchases.module.css'

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
  DELIVERED: 'delivered',
  DISPUTED: 'disputed',
  ADMIN_DELIVERED: 'admin_delivered'
}

export default function Purchases() {
  const { t } = useLanguage()
  const { user } = useAuth()
  const [purchases, setPurchases] = useState([])
  const [loading, setLoading] = useState(true)
  const [showDispute, setShowDispute] = useState(null)
  const [disputeReason, setDisputeReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [expandedOrder, setExpandedOrder] = useState(null)
  const [showProof, setShowProof] = useState(null)

  useEffect(() => {
    const loadPurchases = async () => {
      if (!user?.id) {
        setLoading(false)
        return
      }

      try {
        // Load from orders collection where user is the buyer
        const ordersQuery = query(
          collection(db, 'orders'),
          where('buyerId', '==', user.id),
          orderBy('createdAt', 'desc')
        )
        const snapshot = await getDocs(ordersQuery)
        const ordersData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.() || new Date()
        }))
        setPurchases(ordersData)
      } catch (err) {
        console.error('Error loading purchases:', err)
      }
      setLoading(false)
    }

    loadPurchases()
  }, [user?.id])

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
      // Find the order
      const order = purchases.find(p => p.id === orderId)
      
      // Update order status
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

      // Create dispute record
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

      // Send Telegram notification
      await notifyDispute(disputeData)

      // Update local state
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

  const getStatusBadge = (status) => {
    switch (status) {
      case ORDER_STATUS.PENDING:
        return (
          <span className={`${styles.status} ${styles.pending}`}>
            <Clock size={14} />
            {t('pending') || 'Ожидание'}
          </span>
        )
      case ORDER_STATUS.APPROVED:
        return (
          <span className={`${styles.status} ${styles.approved}`}>
            <CheckCircle size={14} />
            {t('approved') || 'Подтверждено'}
          </span>
        )
      case ORDER_STATUS.DELIVERED:
      case ORDER_STATUS.ADMIN_DELIVERED:
        return (
          <span className={`${styles.status} ${styles.completed}`}>
            <CheckCircle size={14} />
            {t('delivered') || 'Доставлено'}
          </span>
        )
      case ORDER_STATUS.REJECTED:
        return (
          <span className={`${styles.status} ${styles.rejected}`}>
            <XCircle size={14} />
            {t('rejected') || 'Отклонено'}
          </span>
        )
      case ORDER_STATUS.DISPUTED:
        return (
          <span className={`${styles.status} ${styles.disputed}`}>
            <AlertTriangle size={14} />
            {t('disputed') || 'Спор'}
          </span>
        )
      default:
        return (
          <span className={`${styles.status} ${styles.pending}`}>
            <Clock size={14} />
            {status || t('pending')}
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

  return (
    <div className={styles.purchases}>
      <div className="container">
        <h1 className={styles.title}>{t('myPurchases')}</h1>

        {purchases.length > 0 ? (
          <div className={styles.purchasesList}>
            {purchases.map(order => (
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
                    {t('by')} {order.sellerName}
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
                  {/* View proof button */}
                  {order.paymentProof && (
                    <button 
                      className={styles.viewBtn}
                      onClick={() => setShowProof(order.paymentProof)}
                      title={t('viewProof') || 'Просмотр чека'}
                    >
                      <Eye size={18} />
                    </button>
                  )}
                  
                  {/* Download available only for delivered orders */}
                  {(order.status === ORDER_STATUS.DELIVERED || order.status === ORDER_STATUS.ADMIN_DELIVERED) && order.beatFileUrl && (
                    <a 
                      href={getDownloadUrl(order.beatFileUrl, `${order.beatTitle}.${getFileExtension(order.licenseKey || order.licenseType)}`)}
                      className={styles.downloadBtn}
                      title={t('download') || 'Скачать'}
                    >
                      <Download size={18} />
                    </a>
                  )}
                  
                  {/* Dispute button - not for already disputed or delivered */}
                  {order.status !== ORDER_STATUS.DISPUTED && 
                   order.status !== ORDER_STATUS.DELIVERED && 
                   order.status !== ORDER_STATUS.ADMIN_DELIVERED && (
                    <button 
                      className={styles.reportBtn}
                      onClick={() => setShowDispute(order.id)}
                      title={t('reportProblem') || 'Открыть спор'}
                    >
                      <Flag size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <ShoppingBag size={48} />
            <h3>{t('noPurchases')}</h3>
            <p>{t('startBuying')}</p>
            <Link to="/explore" className="btn btn-primary">
              {t('exploreCatalog')}
            </Link>
          </div>
        )}

        {/* Dispute Modal */}
        {showDispute && (
          <div className={styles.modalOverlay} onClick={() => setShowDispute(null)}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
              <h3 className={styles.modalTitle}>{t('reportProblem')}</h3>
              <p className={styles.modalText}>{t('describeIssue')}</p>
              
              <textarea
                className={styles.textarea}
                placeholder={t('disputeReasonPlaceholder')}
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
                  {t('cancel')}
                </button>
                <button 
                  className="btn btn-primary"
                  onClick={() => handleDispute(showDispute)}
                  disabled={submitting || !disputeReason.trim()}
                >
                  {submitting ? <Loader2 size={16} className={styles.spinner} /> : t('submitDispute')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Proof Image Modal */}
        {showProof && (
          <div className={styles.modalOverlay} onClick={() => setShowProof(null)}>
            <div className={styles.proofModal} onClick={e => e.stopPropagation()}>
              <h3 className={styles.modalTitle}>{t('paymentProof') || 'Чек оплаты'}</h3>
              <img src={showProof} alt="Payment proof" className={styles.proofImage} />
              <button 
                className="btn btn-secondary"
                onClick={() => setShowProof(null)}
              >
                {t('close') || 'Закрыть'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
