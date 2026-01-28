import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { 
  Package, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Eye,
  Download,
  Mail,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Shield,
  User,
  Calendar,
  FileText,
  Send,
  Scale,
  History,
  MessageCircle
} from 'lucide-react'
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp, orderBy, arrayUnion } from 'firebase/firestore'
import { db } from '../config/firebase'
import { useLanguage } from '../context/LanguageContext'
import { useAuth } from '../context/AuthContext'
import { getDownloadUrl } from '../utils/audioUrl'
import styles from './Orders.module.css'

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
  const { user, loading: authLoading } = useAuth()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedOrder, setExpandedOrder] = useState(null)
  const [filter, setFilter] = useState('all')
  const [processing, setProcessing] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!authLoading) {
      loadOrders()
    }
  }, [user?.id, authLoading])

  const loadOrders = async () => {
    if (!user?.id) {
      setLoading(false)
      return
    }
    
    setError(null)
    try {
      // Try with orderBy first, fallback to simple query if index not ready
      let ordersData = []
      try {
        const ordersQuery = query(
          collection(db, 'orders'),
          where('sellerId', '==', user.id),
          orderBy('createdAt', 'desc')
        )
        const snapshot = await getDocs(ordersQuery)
        ordersData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.() || new Date()
        }))
      } catch (indexError) {
        // Fallback: query without orderBy if index doesn't exist
        console.warn('Index not ready, falling back to simple query:', indexError.message)
        const simpleQuery = query(
          collection(db, 'orders'),
          where('sellerId', '==', user.id)
        )
        const snapshot = await getDocs(simpleQuery)
        ordersData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.() || new Date()
        }))
        // Sort manually
        ordersData.sort((a, b) => b.createdAt - a.createdAt)
      }
      setOrders(ordersData)
    } catch (err) {
      console.error('Error loading orders:', err)
      setError(err.message)
    }
    setLoading(false)
  }

  const handleApprove = async (orderId) => {
    setProcessing(orderId)
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status: ORDER_STATUS.APPROVED,
        approvedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        actionLog: arrayUnion({
          action: 'approved',
          by: user.displayName || user.email,
          byId: user.id,
          at: new Date().toISOString(),
          note: 'Seller approved payment'
        })
      })
      setOrders(prev => prev.map(o => 
        o.id === orderId ? { ...o, status: ORDER_STATUS.APPROVED } : o
      ))
    } catch (err) {
      console.error('Error approving order:', err)
      alert(t('errorApprovingOrder') || 'Failed to approve order')
    }
    setProcessing(null)
  }

  const handleReject = async (orderId, reason = '') => {
    const rejectReason = reason || prompt(t('enterRejectReason') || 'Enter reason for rejection:')
    if (rejectReason === null) return
    
    setProcessing(orderId)
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status: ORDER_STATUS.REJECTED,
        rejectReason,
        rejectedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        actionLog: arrayUnion({
          action: 'rejected',
          by: user.displayName || user.email,
          byId: user.id,
          at: new Date().toISOString(),
          note: `Seller rejected: ${rejectReason}`
        })
      })
      setOrders(prev => prev.map(o => 
        o.id === orderId ? { ...o, status: ORDER_STATUS.REJECTED, rejectReason } : o
      ))
    } catch (err) {
      console.error('Error rejecting order:', err)
      alert(t('errorRejectingOrder') || 'Failed to reject order')
    }
    setProcessing(null)
  }

  const handleMarkDelivered = async (orderId) => {
    setProcessing(orderId)
    try {
      // Find the order to confirm
      const order = orders.find(o => o.id === orderId)
      if (!order) {
        throw new Error('Order not found')
      }
      
      // Mark as delivered - buyer can now download from their purchases page
      await updateDoc(doc(db, 'orders', orderId), {
        status: ORDER_STATUS.DELIVERED,
        deliveredAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        actionLog: arrayUnion({
          action: 'delivered',
          by: user.displayName || user.email,
          byId: user.id,
          at: new Date().toISOString(),
          note: 'Seller marked order as delivered - buyer can now download'
        })
      })
      setOrders(prev => prev.map(o => 
        o.id === orderId ? { ...o, status: ORDER_STATUS.DELIVERED } : o
      ))
      alert(t('orderDelivered') || 'Order marked as delivered! Buyer can now download the beat.')
    } catch (err) {
      console.error('Error marking delivered:', err)
      alert(t('errorMarkingDelivered') || 'Failed to mark as delivered')
    }
    setProcessing(null)
  }

  const handleDispute = async (orderId) => {
    const disputeReason = prompt(t('enterDisputeReason') || 'Enter reason for dispute (explain why you believe the payment is invalid):')
    if (!disputeReason || disputeReason.trim() === '') return
    
    setProcessing(orderId)
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status: ORDER_STATUS.DISPUTED,
        disputeReason: disputeReason.trim(),
        disputedAt: serverTimestamp(),
        disputedBy: 'seller',
        updatedAt: serverTimestamp(),
        actionLog: arrayUnion({
          action: 'disputed',
          by: user.displayName || user.email,
          byId: user.id,
          at: new Date().toISOString(),
          note: `Seller disputed: ${disputeReason.trim()}`
        })
      })
      setOrders(prev => prev.map(o => 
        o.id === orderId ? { 
          ...o, 
          status: ORDER_STATUS.DISPUTED, 
          disputeReason: disputeReason.trim(),
          disputedBy: 'seller'
        } : o
      ))
      alert(t('disputeSubmitted') || 'Dispute submitted. An administrator will review this case.')
    } catch (err) {
      console.error('Error creating dispute:', err)
      alert(t('errorCreatingDispute') || 'Failed to create dispute')
    }
    setProcessing(null)
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case ORDER_STATUS.PENDING: return <Clock size={16} />
      case ORDER_STATUS.APPROVED: return <CheckCircle size={16} />
      case ORDER_STATUS.REJECTED: return <XCircle size={16} />
      case ORDER_STATUS.DELIVERED: return <Send size={16} />
      case ORDER_STATUS.DISPUTED: return <Scale size={16} />
      case ORDER_STATUS.ADMIN_DELIVERED: return <Shield size={16} />
      default: return <Clock size={16} />
    }
  }

  const getStatusLabel = (status) => {
    switch (status) {
      case ORDER_STATUS.PENDING: return t('pending') || 'Pending'
      case ORDER_STATUS.APPROVED: return t('approved') || 'Approved'
      case ORDER_STATUS.REJECTED: return t('rejected') || 'Rejected'
      case ORDER_STATUS.DELIVERED: return t('delivered') || 'Delivered'
      case ORDER_STATUS.DISPUTED: return t('disputed') || 'Disputed'
      case ORDER_STATUS.ADMIN_DELIVERED: return t('adminDelivered') || 'Admin Delivered'
      default: return status
    }
  }

  const filteredOrders = filter === 'all' 
    ? orders 
    : orders.filter(o => o.status === filter)

  const stats = {
    total: orders.length,
    pending: orders.filter(o => o.status === ORDER_STATUS.PENDING).length,
    approved: orders.filter(o => o.status === ORDER_STATUS.APPROVED).length,
    delivered: orders.filter(o => o.status === ORDER_STATUS.DELIVERED || o.status === ORDER_STATUS.ADMIN_DELIVERED).length,
    rejected: orders.filter(o => o.status === ORDER_STATUS.REJECTED).length,
    disputed: orders.filter(o => o.status === ORDER_STATUS.DISPUTED).length,
  }

  if (authLoading || loading) {
    return (
      <div className={styles.orders}>
        <div className={styles.container}>
          <div className={styles.loading}>
            <Loader2 className="spin" size={32} />
            <p>{t('loading') || 'Loading...'}</p>
          </div>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className={styles.orders}>
        <div className={styles.container}>
          <div className={styles.empty}>
            <Package size={48} />
            <h2>{t('signInRequired') || 'Sign In Required'}</h2>
            <p>{t('signInToViewOrders') || 'Please sign in to view your orders'}</p>
            <Link to="/auth" className="btn btn-primary">{t('signIn')}</Link>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={styles.orders}>
        <div className={styles.container}>
          <div className={styles.empty}>
            <AlertCircle size={48} />
            <h2>{t('error') || 'Error'}</h2>
            <p>{error}</p>
            <button onClick={loadOrders} className="btn btn-primary">{t('retry') || 'Retry'}</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.orders}>
      <div className={styles.container}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>{t('incomingOrders') || 'Incoming Orders'}</h1>
            <p className={styles.subtitle}>{t('manageYourOrders') || 'Manage orders from buyers'}</p>
          </div>
        </div>

        {/* Stats */}
        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.statValue}>{stats.total}</span>
            <span className={styles.statLabel}>{t('totalOrders') || 'Total'}</span>
          </div>
          <div className={`${styles.stat} ${styles.statPending}`}>
            <span className={styles.statValue}>{stats.pending}</span>
            <span className={styles.statLabel}>{t('pending') || 'Pending'}</span>
          </div>
          <div className={`${styles.stat} ${styles.statApproved}`}>
            <span className={styles.statValue}>{stats.approved}</span>
            <span className={styles.statLabel}>{t('approved') || 'Approved'}</span>
          </div>
          <div className={`${styles.stat} ${styles.statDelivered}`}>
            <span className={styles.statValue}>{stats.delivered}</span>
            <span className={styles.statLabel}>{t('delivered') || 'Delivered'}</span>
          </div>
          {stats.disputed > 0 && (
            <div className={`${styles.stat} ${styles.statDisputed}`}>
              <span className={styles.statValue}>{stats.disputed}</span>
              <span className={styles.statLabel}>{t('disputed') || 'Disputed'}</span>
            </div>
          )}
        </div>

        {/* Filter */}
        <div className={styles.filters}>
          <button 
            className={`${styles.filterBtn} ${filter === 'all' ? styles.active : ''}`}
            onClick={() => setFilter('all')}
          >
            {t('all') || 'All'}
          </button>
          <button 
            className={`${styles.filterBtn} ${filter === ORDER_STATUS.PENDING ? styles.active : ''}`}
            onClick={() => setFilter(ORDER_STATUS.PENDING)}
          >
            {t('pending') || 'Pending'}
          </button>
          <button 
            className={`${styles.filterBtn} ${filter === ORDER_STATUS.APPROVED ? styles.active : ''}`}
            onClick={() => setFilter(ORDER_STATUS.APPROVED)}
          >
            {t('approved') || 'Approved'}
          </button>
          <button 
            className={`${styles.filterBtn} ${filter === ORDER_STATUS.DELIVERED ? styles.active : ''}`}
            onClick={() => setFilter(ORDER_STATUS.DELIVERED)}
          >
            {t('delivered') || 'Delivered'}
          </button>
          <button 
            className={`${styles.filterBtn} ${filter === ORDER_STATUS.DISPUTED ? styles.active : ''}`}
            onClick={() => setFilter(ORDER_STATUS.DISPUTED)}
          >
            {t('disputed') || 'Disputed'}
          </button>
        </div>

        {/* Orders List */}
        {filteredOrders.length === 0 ? (
          <div className={styles.empty}>
            <Package size={48} />
            <h2>{t('noOrders') || 'No Orders'}</h2>
            <p>{t('noOrdersDesc') || 'You don\'t have any orders yet'}</p>
          </div>
        ) : (
          <div className={styles.ordersList}>
            {filteredOrders.map(order => (
              <div 
                key={order.id} 
                className={`${styles.orderCard} ${styles[`status${order.status.charAt(0).toUpperCase() + order.status.slice(1)}`]}`}
              >
                <div 
                  className={styles.orderHeader}
                  onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                >
                  <div className={styles.orderInfo}>
                    <div className={styles.orderBeat}>
                      {order.beatCover ? (
                        <img src={order.beatCover} alt={order.beatTitle} className={styles.beatThumb} />
                      ) : (
                        <div className={styles.beatThumbPlaceholder}>
                          <FileText size={16} />
                        </div>
                      )}
                      <div>
                        <h3>{order.beatTitle}</h3>
                        <span className={styles.license}>{order.licenseType}</span>
                      </div>
                    </div>
                    <div className={styles.orderMeta}>
                      <span className={`${styles.status} ${styles[order.status]}`}>
                        {getStatusIcon(order.status)}
                        {getStatusLabel(order.status)}
                      </span>
                      <span className={styles.price}>${order.price?.toFixed(2)}</span>
                    </div>
                  </div>
                  <button className={styles.expandBtn}>
                    {expandedOrder === order.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </button>
                </div>

                {expandedOrder === order.id && (
                  <div className={styles.orderDetails}>
                    {/* Buyer Info */}
                    <div className={styles.detailSection}>
                      <h4><User size={16} /> {t('buyerInfo') || 'Buyer Information'}</h4>
                      <div className={styles.detailGrid}>
                        <div className={styles.detailItem}>
                          <span>{t('name') || 'Name'}</span>
                          <strong>{order.buyerName || 'Guest'}</strong>
                        </div>
                        <div className={styles.detailItem}>
                          <span>{t('email') || 'Email'}</span>
                          <strong>{order.buyerEmail}</strong>
                        </div>
                        <div className={styles.detailItem}>
                          <span>{t('orderRef') || 'Order Ref'}</span>
                          <strong>{order.orderRef}</strong>
                        </div>
                        <div className={styles.detailItem}>
                          <span>{t('date') || 'Date'}</span>
                          <strong>{order.createdAt.toLocaleDateString()}</strong>
                        </div>
                      </div>
                    </div>

                    {/* Payment Proof */}
                    <div className={styles.detailSection}>
                      <h4><Shield size={16} /> {t('paymentProof') || 'Payment Proof'}</h4>
                      <div className={styles.proofSection}>
                        {order.paymentProof ? (
                          <a 
                            href={order.paymentProof} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className={styles.proofImage}
                          >
                            <img src={order.paymentProof} alt="Payment proof" />
                            <div className={styles.proofOverlay}>
                              <Eye size={20} />
                              <span>{t('viewFull') || 'View Full Size'}</span>
                            </div>
                          </a>
                        ) : (
                          <div className={styles.noProof}>
                            <AlertCircle size={20} />
                            <span>{t('noProofUploaded') || 'No proof uploaded'}</span>
                          </div>
                        )}
                        <div className={styles.proofDetails}>
                          <div className={styles.detailItem}>
                            <span>{t('transactionId') || 'Transaction ID'}</span>
                            <strong>{order.transactionId || '—'}</strong>
                          </div>
                          {order.paymentDate && (
                            <div className={styles.detailItem}>
                              <span>{t('paymentDate') || 'Payment Date'}</span>
                              <strong>{order.paymentDate}</strong>
                            </div>
                          )}
                          {order.paymentTime && (
                            <div className={styles.detailItem}>
                              <span>{t('paymentTime') || 'Payment Time'}</span>
                              <strong>{order.paymentTime}</strong>
                            </div>
                          )}
                          {order.cardLastFour && (
                            <div className={styles.detailItem}>
                              <span><CreditCard size={14} /> {t('cardLastFour') || 'Card Last 4'}</span>
                              <strong>•••• {order.cardLastFour}</strong>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action Log */}
                    {order.actionLog && order.actionLog.length > 0 && (
                      <div className={styles.detailSection}>
                        <h4><History size={16} /> {t('actionHistory') || 'Action History'}</h4>
                        <div className={styles.actionLog}>
                          {order.actionLog.map((log, idx) => (
                            <div key={idx} className={styles.logEntry}>
                              <span className={styles.logAction}>{log.action}</span>
                              <span className={styles.logBy}>{log.by}</span>
                              <span className={styles.logTime}>{new Date(log.at).toLocaleString()}</span>
                              {log.note && <p className={styles.logNote}>{log.note}</p>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    {order.status === ORDER_STATUS.PENDING && (
                      <div className={styles.actions}>
                        <button 
                          className={`btn btn-success ${styles.actionBtn}`}
                          onClick={() => handleApprove(order.id)}
                          disabled={processing === order.id}
                        >
                          {processing === order.id ? (
                            <Loader2 className="spin" size={16} />
                          ) : (
                            <CheckCircle size={16} />
                          )}
                          {t('approvePayment') || 'Approve Payment'}
                        </button>
                        <button 
                          className={`btn btn-warning ${styles.actionBtn}`}
                          onClick={() => handleDispute(order.id)}
                          disabled={processing === order.id}
                        >
                          <Scale size={16} />
                          {t('disputeOrder') || 'Dispute'}
                        </button>
                        <button 
                          className={`btn btn-error ${styles.actionBtn}`}
                          onClick={() => handleReject(order.id)}
                          disabled={processing === order.id}
                        >
                          <XCircle size={16} />
                          {t('rejectOrder') || 'Reject'}
                        </button>
                      </div>
                    )}

                    {order.status === ORDER_STATUS.APPROVED && (
                      <div className={styles.deliverySection}>
                        <div className={styles.deliveryNote}>
                          <AlertCircle size={18} />
                          <div>
                            <strong>{t('readyToDeliver') || 'Ready to Deliver'}</strong>
                            <p>{t('sendBeatToEmail') || 'Send the beat file to the buyer\'s email address'}</p>
                          </div>
                        </div>
                        <div className={styles.deliveryActions}>
                          <a 
                            href={`mailto:${order.buyerEmail}?subject=Your Beat Order: ${order.beatTitle}&body=Hi ${order.buyerName},%0D%0A%0D%0AThank you for your purchase! Your beat "${order.beatTitle}" (${order.licenseType} license) is attached to this email.%0D%0A%0D%0AOrder Reference: ${order.orderRef}%0D%0A%0D%0ABest regards`}
                            className="btn btn-primary"
                          >
                            <Mail size={16} />
                            {t('sendEmail') || 'Open Email'}
                          </a>
                          <button 
                            className="btn btn-secondary"
                            onClick={() => handleMarkDelivered(order.id)}
                            disabled={processing === order.id}
                          >
                            {processing === order.id ? (
                              <Loader2 className="spin" size={16} />
                            ) : (
                              <Send size={16} />
                            )}
                            {t('markDelivered') || 'Mark as Delivered'}
                          </button>
                        </div>
                      </div>
                    )}

                    {order.status === ORDER_STATUS.REJECTED && order.rejectReason && (
                      <div className={styles.rejectionNote}>
                        <XCircle size={18} />
                        <div>
                          <strong>{t('rejectionReason') || 'Rejection Reason'}</strong>
                          <p>{order.rejectReason}</p>
                        </div>
                      </div>
                    )}

                    {order.status === ORDER_STATUS.DELIVERED && (
                      <div className={styles.deliveredNote}>
                        <CheckCircle size={18} />
                        <span>{t('orderDelivered') || 'This order has been delivered'}</span>
                      </div>
                    )}

                    {order.status === ORDER_STATUS.DISPUTED && (
                      <div className={styles.disputedNote}>
                        <Scale size={18} />
                        <div>
                          <strong>{t('underAdminReview') || 'Under Admin Review'}</strong>
                          <p>{t('disputeReason') || 'Dispute Reason'}: {order.disputeReason}</p>
                          <small>{t('adminWillReview') || 'An administrator will review this case and make a final decision.'}</small>
                        </div>
                      </div>
                    )}

                    {order.status === ORDER_STATUS.ADMIN_DELIVERED && (
                      <div className={styles.adminDeliveredNote}>
                        <Shield size={18} />
                        <div>
                          <strong>{t('adminDeliveredOrder') || 'Admin Delivered'}</strong>
                          <p>{t('adminDeliveredDesc') || 'This order was delivered by an administrator after reviewing the dispute.'}</p>
                          {order.adminNotes && <small>{t('adminNotes') || 'Admin Notes'}: {order.adminNotes}</small>}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
