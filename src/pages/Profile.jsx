import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { User, Settings, Music, Edit2, Loader2, Heart, DollarSign, ShoppingBag, Clock, CheckCircle, AlertTriangle, X } from 'lucide-react'
import { collection, query, where, getDocs, doc, getDoc, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../config/firebase'
import { sendTelegramMessage } from '../utils/telegram'
import { useLanguage } from '../context/LanguageContext'
import { useAuth } from '../context/AuthContext'
import styles from './Profile.module.css'

export default function Profile() {
  const { t } = useLanguage()
  const { user } = useAuth()
  const [userBeats, setUserBeats] = useState([])
  const [likedBeats, setLikedBeats] = useState([])
  const [sales, setSales] = useState([])
  const [purchases, setPurchases] = useState([])
  const [wallet, setWallet] = useState({ available: 0, hold: 0 })
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('myBeats')
  
  // Dispute modal state
  const [showDisputeModal, setShowDisputeModal] = useState(false)
  const [disputePurchase, setDisputePurchase] = useState(null)
  const [disputeContact, setDisputeContact] = useState('')
  const [disputeReason, setDisputeReason] = useState('')
  const [disputeSubmitting, setDisputeSubmitting] = useState(false)

  // Load user's beats from Firebase
  useEffect(() => {
    const loadUserBeats = async () => {
      if (!user?.id) {
        setLoading(false)
        return
      }
      
      try {
        // Simple query without orderBy to avoid needing composite index
        const beatsQuery = query(
          collection(db, 'beats'),
          where('producerId', '==', user.id)
        )
        const snapshot = await getDocs(beatsQuery)
        const beatsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        // Sort client-side by createdAt
        beatsData.sort((a, b) => {
          const aTime = a.createdAt?.toMillis?.() || 0
          const bTime = b.createdAt?.toMillis?.() || 0
          return bTime - aTime
        })
        setUserBeats(beatsData)
      } catch (err) {
        console.error('Error loading user beats:', err)
      }
      setLoading(false)
    }
    
    loadUserBeats()
  }, [user?.id])

  // Load liked beats
  useEffect(() => {
    const loadLikedBeats = async () => {
      if (!user?.id) return
      
      try {
        // Get all liked beat IDs
        const likesSnapshot = await getDocs(collection(db, `users/${user.id}/likes`))
        const likedIds = likesSnapshot.docs.map(doc => doc.id)
        
        if (likedIds.length === 0) {
          setLikedBeats([])
          return
        }
        
        // Load each beat's data
        const beatsData = []
        for (const beatId of likedIds) {
          const beatDoc = await getDoc(doc(db, 'beats', beatId))
          if (beatDoc.exists()) {
            beatsData.push({ id: beatDoc.id, ...beatDoc.data() })
          }
        }
        
        setLikedBeats(beatsData)
      } catch (err) {
        console.error('Error loading liked beats:', err)
      }
    }
    
    loadLikedBeats()
  }, [user?.id])

  // Load sales and wallet
  useEffect(() => {
    const loadSalesData = async () => {
      if (!user?.id) return

      try {
        // Load wallet
        const walletDoc = await getDoc(doc(db, 'wallets', user.id))
        if (walletDoc.exists()) {
          setWallet(walletDoc.data())
        }

        // Load sales (orders where user is seller)
        const salesQuery = query(
          collection(db, 'orders'),
          where('sellerId', '==', user.id)
        )
        const salesSnapshot = await getDocs(salesQuery)
        const salesData = salesSnapshot.docs.map(d => ({
          id: d.id,
          ...d.data()
        }))
        salesData.sort((a, b) => {
          const aTime = a.createdAt?.toMillis?.() || 0
          const bTime = b.createdAt?.toMillis?.() || 0
          return bTime - aTime
        })
        setSales(salesData)

        // Load purchases (orders where user is buyer)
        const purchasesQuery = query(
          collection(db, 'orders'),
          where('buyerId', '==', user.id)
        )
        const purchasesSnapshot = await getDocs(purchasesQuery)
        const purchasesData = purchasesSnapshot.docs.map(d => ({
          id: d.id,
          ...d.data()
        }))
        purchasesData.sort((a, b) => {
          const aTime = a.createdAt?.toMillis?.() || 0
          const bTime = b.createdAt?.toMillis?.() || 0
          return bTime - aTime
        })
        setPurchases(purchasesData)
      } catch (err) {
        console.error('Error loading sales:', err)
      }
    }

    loadSalesData()
  }, [user?.id])

  const formatDate = (timestamp) => {
    if (!timestamp?.toDate) return ''
    return timestamp.toDate().toLocaleDateString()
  }

  // Open dispute modal
  const openDispute = (purchase) => {
    setDisputePurchase(purchase)
    setDisputeContact('')
    setDisputeReason('')
    setShowDisputeModal(true)
  }

  // Validate contact (telegram or gmail)
  const isValidContact = (contact) => {
    const trimmed = contact.trim()
    // Telegram: starts with @ or t.me/
    const isTelegram = trimmed.startsWith('@') || trimmed.includes('t.me/')
    // Gmail: contains @gmail.com or any email
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)
    return isTelegram || isEmail
  }

  // Submit dispute
  const submitDispute = async () => {
    if (!disputePurchase || !disputeContact.trim() || !disputeReason.trim()) return
    if (!isValidContact(disputeContact)) {
      alert('Укажите корректный Telegram (@username) или Email')
      return
    }

    setDisputeSubmitting(true)
    try {
      // Create dispute record
      await addDoc(collection(db, 'disputes'), {
        purchaseId: disputePurchase.id,
        beatId: disputePurchase.beatId,
        beatTitle: disputePurchase.beatTitle,
        buyerId: user.id,
        buyerName: user.name,
        buyerContact: disputeContact.trim(),
        sellerId: disputePurchase.sellerId,
        sellerName: disputePurchase.sellerName,
        price: disputePurchase.price,
        reason: disputeReason.trim(),
        status: 'open',
        createdAt: serverTimestamp()
      })

      // Update order status
      await updateDoc(doc(db, 'orders', disputePurchase.id), {
        disputeStatus: 'open'
      })

      // Send Telegram notification
      await sendTelegramMessage(
        `🚨 <b>НОВЫЙ СПОР!</b>\n\n` +
        `🎵 Бит: ${disputePurchase.beatTitle}\n` +
        `💰 Сумма: $${disputePurchase.price}\n` +
        `👤 Покупатель: ${user.name}\n` +
        `📧 Контакт: ${disputeContact.trim()}\n` +
        `👤 Продавец: ${disputePurchase.sellerName}\n` +
        `📝 Причина: ${disputeReason.trim()}\n\n` +
        `🆔 ID: <code>${disputePurchase.id}</code>`
      )

      // Update local state
      setPurchases(prev => prev.map(p => 
        p.id === disputePurchase.id ? { ...p, disputeStatus: 'open' } : p
      ))

      setShowDisputeModal(false)
      alert('✅ Спор открыт! Мы свяжемся с вами.')
    } catch (err) {
      console.error('Error submitting dispute:', err)
      alert('Ошибка при открытии спора')
    }
    setDisputeSubmitting(false)
  }

  return (
    <div className={styles.profile}>
      <div className="container">
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.avatar}>
            {user?.avatar ? (
              <img src={user.avatar} alt={user.name} />
            ) : (
              <User size={48} />
            )}
          </div>
          
          <div className={styles.info}>
            <h1 className={styles.name}>{user?.name || 'Producer'}</h1>
            <div className={styles.statsRow}>
              <span>{userBeats.length} {t('beats')}</span>
              <span>•</span>
              <span>{sales.length} {t('salesCount')}</span>
            </div>
          </div>

          <div className={styles.actions}>
            {!user?.isAdmin && (
              <Link to="/upload" className="btn btn-primary">
                {t('uploadBeat')}
              </Link>
            )}
            <Link to="/settings" className="btn btn-secondary">
              <Settings size={18} />
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          <button 
            className={`${styles.tab} ${activeTab === 'myBeats' ? styles.active : ''}`}
            onClick={() => setActiveTab('myBeats')}
          >
            <Music size={18} />
            {t('myBeats')} ({userBeats.length})
          </button>
          <button 
            className={`${styles.tab} ${activeTab === 'sales' ? styles.active : ''}`}
            onClick={() => setActiveTab('sales')}
          >
            <DollarSign size={18} />
            {t('sales')} ({sales.length})
          </button>
          <button 
            className={`${styles.tab} ${activeTab === 'liked' ? styles.active : ''}`}
            onClick={() => setActiveTab('liked')}
          >
            <Heart size={18} />
            {t('liked')} ({likedBeats.length})
          </button>
          <button 
            className={`${styles.tab} ${activeTab === 'purchases' ? styles.active : ''}`}
            onClick={() => setActiveTab('purchases')}
          >
            <ShoppingBag size={18} />
            {t('purchases')} ({purchases.length})
          </button>
        </div>

        {/* Beats List */}
        <div className={styles.content}>
          {loading ? (
            <div className={styles.loading}>
              <Loader2 size={32} className={styles.spinner} />
            </div>
          ) : activeTab === 'myBeats' ? (
            userBeats.length > 0 ? (
              <div className={styles.beatsList}>
                {userBeats.map(beat => (
                  <div key={beat.id} className={styles.beatRow}>
                    <div className={styles.beatCover}>
                      {beat.coverUrl ? (
                        <img src={beat.coverUrl} alt={beat.title} />
                      ) : (
                        <Music size={20} />
                      )}
                    </div>
                    <div className={styles.beatInfo}>
                      <Link to={`/beat/${beat.id}`} className={styles.beatTitle}>
                        {beat.title}
                      </Link>
                      <span className={styles.beatMeta}>
                        {beat.genre} • {beat.bpm} BPM
                      </span>
                    </div>
                    <span className={styles.beatPrice}>${beat.price}</span>
                    <Link to={`/beat/${beat.id}/edit`} className={styles.editBtn}>
                      <Edit2 size={16} />
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.emptyState}>
                <Music size={48} className={styles.emptyIcon} />
                <h3>{t('noBeatsYet')}</h3>
                <p>{t('uploadFirstBeat')}</p>
                <Link to="/upload" className="btn btn-primary">
                  {t('uploadBeat')}
                </Link>
              </div>
            )
          ) : activeTab === 'sales' ? (
            sales.length > 0 ? (
              <div className={styles.salesList}>
                {sales.map(sale => (
                  <div key={sale.id} className={styles.saleRow}>
                    <div className={styles.beatCover}>
                      {sale.coverUrl ? (
                        <img src={sale.coverUrl} alt={sale.beatTitle} />
                      ) : (
                        <Music size={20} />
                      )}
                    </div>
                    <div className={styles.beatInfo}>
                      <Link to={`/beat/${sale.beatId}`} className={styles.beatTitle}>
                        {sale.beatTitle}
                      </Link>
                      <span className={styles.beatMeta}>
                        {t('soldTo')} {sale.buyerName} • {sale.licenseType}
                      </span>
                    </div>
                    <div className={styles.saleAmount}>
                      <span className={styles.salePrice}>+${sale.sellerAmount.toFixed(2)}</span>
                      <span className={styles.saleDate}>{formatDate(sale.createdAt)}</span>
                    </div>
                    <div className={styles.saleStatus}>
                      {sale.status === 'hold' ? (
                        <span className={styles.statusHold}>
                          <Clock size={14} />
                          {t('onHold')}
                        </span>
                      ) : (
                        <span className={styles.statusCompleted}>
                          <CheckCircle size={14} />
                          {t('completed')}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.emptyState}>
                <DollarSign size={48} className={styles.emptyIcon} />
                <h3>{t('noSalesYet')}</h3>
                <p>{t('uploadBeatsToSell')}</p>
                <Link to="/upload" className="btn btn-primary">
                  {t('uploadBeat')}
                </Link>
              </div>
            )
          ) : activeTab === 'liked' ? (
            likedBeats.length > 0 ? (
              <div className={styles.beatsList}>
                {likedBeats.map(beat => (
                  <div key={beat.id} className={styles.beatRow}>
                    <div className={styles.beatCover}>
                      {beat.coverUrl ? (
                        <img src={beat.coverUrl} alt={beat.title} />
                      ) : (
                        <Music size={20} />
                      )}
                    </div>
                    <div className={styles.beatInfo}>
                      <Link to={`/beat/${beat.id}`} className={styles.beatTitle}>
                        {beat.title}
                      </Link>
                      <span className={styles.beatMeta}>
                        {beat.genre} • {beat.bpm} BPM • {beat.producerName}
                      </span>
                    </div>
                    <span className={styles.beatPrice}>${beat.price}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.emptyState}>
                <Heart size={48} className={styles.emptyIcon} />
                <h3>{t('noLikedBeats')}</h3>
                <p>{t('exploreLikeBeats')}</p>
                <Link to="/explore" className="btn btn-primary">
                  {t('exploreCatalog')}
                </Link>
              </div>
            )
          ) : activeTab === 'purchases' ? (
            purchases.length > 0 ? (
              <div className={styles.salesList}>
                {purchases.map(purchase => (
                  <div key={purchase.id} className={styles.saleRow}>
                    <div className={styles.beatCover}>
                      {purchase.coverUrl ? (
                        <img src={purchase.coverUrl} alt={purchase.beatTitle} />
                      ) : (
                        <Music size={20} />
                      )}
                    </div>
                    <div className={styles.beatInfo}>
                      <Link to={`/beat/${purchase.beatId}`} className={styles.beatTitle}>
                        {purchase.beatTitle}
                      </Link>
                      <span className={styles.beatMeta}>
                        {t('from')} {purchase.sellerName} • {purchase.licenseType}
                      </span>
                    </div>
                    <div className={styles.saleAmount}>
                      <span className={styles.purchasePrice}>-${purchase.price.toFixed(2)}</span>
                      <span className={styles.saleDate}>{formatDate(purchase.createdAt)}</span>
                    </div>
                    <div className={styles.purchaseActions}>
                      {purchase.disputeStatus === 'open' ? (
                        <span className={styles.disputeOpen}>
                          <AlertTriangle size={14} />
                          Спор
                        </span>
                      ) : purchase.status !== 'refunded' ? (
                        <button 
                          className={styles.disputeBtn}
                          onClick={() => openDispute(purchase)}
                        >
                          Оспорить
                        </button>
                      ) : (
                        <span className={styles.refundedBadge}>Возврат</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.emptyState}>
                <ShoppingBag size={48} className={styles.emptyIcon} />
                <h3>{t('noPurchases')}</h3>
                <p>{t('exploreToBuy')}</p>
                <Link to="/explore" className="btn btn-primary">
                  {t('exploreCatalog')}
                </Link>
              </div>
            )
          ) : null}
        </div>
      </div>

      {/* Dispute Modal */}
      {showDisputeModal && disputePurchase && (
        <div className={styles.modalOverlay} onClick={() => setShowDisputeModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <button className={styles.modalClose} onClick={() => setShowDisputeModal(false)}>
              <X size={20} />
            </button>
            
            <div className={styles.modalHeader}>
              <AlertTriangle size={24} className={styles.modalIcon} />
              <h2>Открыть спор</h2>
            </div>

            <div className={styles.disputeInfo}>
              <p><strong>Бит:</strong> {disputePurchase.beatTitle}</p>
              <p><strong>Продавец:</strong> {disputePurchase.sellerName}</p>
              <p><strong>Сумма:</strong> ${disputePurchase.price}</p>
            </div>

            <div className={styles.formGroup}>
              <label>Ваш контакт для связи <span className={styles.required}>*</span></label>
              <input
                type="text"
                placeholder="@telegram или email@gmail.com"
                value={disputeContact}
                onChange={(e) => setDisputeContact(e.target.value)}
                className={styles.input}
              />
              <span className={styles.hint}>Укажите Telegram (@username) или Email для связи с вами</span>
            </div>

            <div className={styles.formGroup}>
              <label>Причина спора <span className={styles.required}>*</span></label>
              <textarea
                placeholder="Опишите проблему..."
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                className={styles.textarea}
                rows={4}
              />
            </div>

            <button 
              className={styles.submitDisputeBtn}
              onClick={submitDispute}
              disabled={!disputeContact.trim() || !disputeReason.trim() || disputeSubmitting}
            >
              {disputeSubmitting ? (
                <>
                  <Loader2 size={18} className={styles.spinner} />
                  Отправка...
                </>
              ) : (
                'Отправить спор'
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
