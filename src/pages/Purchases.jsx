import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Music, Download, Clock, CheckCircle, AlertTriangle, Loader2, ShoppingBag, Flag } from 'lucide-react'
import { collection, query, where, getDocs, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore'
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
        const purchasesQuery = query(
          collection(db, 'purchases'),
          where('buyerId', '==', user.id)
        )
        const snapshot = await getDocs(purchasesQuery)
        const purchasesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        // Sort by createdAt
        purchasesData.sort((a, b) => {
          const aTime = a.createdAt?.toMillis?.() || 0
          const bTime = b.createdAt?.toMillis?.() || 0
          return bTime - aTime
        })
        setPurchases(purchasesData)
      } catch (err) {
        console.error('Error loading purchases:', err)
      }
      setLoading(false)
    }

    loadPurchases()
  }, [user?.id])

  const formatDate = (timestamp) => {
    if (!timestamp?.toDate) return ''
    return timestamp.toDate().toLocaleDateString()
  }

  const handleDispute = async (purchaseId) => {
    if (!disputeReason.trim()) return

    setSubmitting(true)
    try {
      // Find the purchase
      const purchase = purchases.find(p => p.id === purchaseId)
      
      // Update purchase status
      await updateDoc(doc(db, 'purchases', purchaseId), {
        status: 'disputed',
        disputeReason: disputeReason,
        disputedAt: serverTimestamp()
      })

      // Create dispute record
      const disputeData = {
        purchaseId: purchaseId,
        beatId: purchase?.beatId,
        beatTitle: purchase?.beatTitle,
        amount: purchase?.price,
        buyerId: user.id,
        buyerName: user.name,
        sellerId: purchase?.sellerId,
        sellerName: purchase?.sellerName,
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
        p.id === purchaseId ? { ...p, status: 'disputed' } : p
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
      case 'completed':
        return (
          <span className={`${styles.status} ${styles.completed}`}>
            <CheckCircle size={14} />
            {t('completed')}
          </span>
        )
      case 'hold':
        return (
          <span className={`${styles.status} ${styles.hold}`}>
            <Clock size={14} />
            {t('onHold')}
          </span>
        )
      case 'disputed':
        return (
          <span className={`${styles.status} ${styles.disputed}`}>
            <AlertTriangle size={14} />
            {t('disputed')}
          </span>
        )
      default:
        return null
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
            {purchases.map(purchase => (
              <div key={purchase.id} className={styles.purchaseCard}>
                <div className={styles.cover}>
                  {purchase.coverUrl ? (
                    <img src={purchase.coverUrl} alt={purchase.beatTitle} />
                  ) : (
                    <Music size={24} />
                  )}
                </div>

                <div className={styles.info}>
                  <Link to={`/beat/${purchase.beatId}`} className={styles.beatTitle}>
                    {purchase.beatTitle}
                  </Link>
                  <span className={styles.seller}>
                    {t('by')} {purchase.sellerName}
                  </span>
                </div>

                <div className={styles.license}>
                  <span className={styles.licenseType}>{purchase.licenseType}</span>
                </div>

                <div className={styles.meta}>
                  <span className={styles.price}>${purchase.price.toFixed(2)}</span>
                  <span className={styles.date}>{formatDate(purchase.createdAt)}</span>
                </div>

                <div className={styles.statusCol}>
                  {getStatusBadge(purchase.status)}
                </div>

                <div className={styles.actions}>
                  <a 
                    href={getDownloadUrl(purchase.beatUrl, `${purchase.beatTitle}.${getFileExtension(purchase.licenseType)}`)}
                    className={styles.downloadBtn}
                  >
                    <Download size={18} />
                  </a>
                  {purchase.status !== 'disputed' && (
                    <button 
                      className={styles.reportBtn}
                      onClick={() => setShowDispute(purchase.id)}
                      title={t('reportProblem')}
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
      </div>
    </div>
  )
}
