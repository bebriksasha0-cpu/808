import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { 
  Shield, Users, Music, DollarSign, Trash2, Eye, Ban, 
  CheckCircle, XCircle, TrendingUp, Activity, AlertTriangle,
  Search, Filter, RefreshCw, MoreVertical, Undo2, Copy, Clock, Wifi,
  ArrowUpRight, CreditCard, Scale, Send, History, ChevronDown, ChevronUp, User, FileText
} from 'lucide-react'
import { 
  collection, getDocs, doc, deleteDoc, updateDoc, 
  query, orderBy, limit, getDoc, where, setDoc, addDoc, serverTimestamp, arrayUnion
} from 'firebase/firestore'
import { db } from '../config/firebase'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import styles from './Admin.module.css'

export default function Admin() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const [activeTab, setActiveTab] = useState('overview')
  const [beats, setBeats] = useState([])
  const [users, setUsers] = useState([])
  const [purchases, setPurchases] = useState([])
  const [withdrawals, setWithdrawals] = useState([])
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalBeats: 0,
    totalSales: 0,
    totalRevenue: 0,
    pendingWithdrawals: 0,
    disputedOrders: 0
  })
  const [refunding, setRefunding] = useState(null)
  const [searchPurchaseId, setSearchPurchaseId] = useState('')
  const [onlineUsers, setOnlineUsers] = useState([])
  const [expandedOrder, setExpandedOrder] = useState(null)
  const [processingOrder, setProcessingOrder] = useState(null)

  // Load all data
  useEffect(() => {
    if (user?.isAdmin) {
      loadData()
    }
  }, [user?.isAdmin])

  // Calculate online users (active in last 5 minutes)
  const getOnlineUsers = (usersData) => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
    return usersData.filter(u => {
      if (!u.lastSeen) return false
      const lastSeen = u.lastSeen.toDate ? u.lastSeen.toDate() : new Date(u.lastSeen)
      return lastSeen > fiveMinutesAgo || u.isOnline
    })
  }

  const loadData = async () => {
    setLoading(true)
    try {
      // Load users
      const usersSnapshot = await getDocs(collection(db, 'users'))
      const usersData = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      setUsers(usersData)

      // Load beats
      const beatsSnapshot = await getDocs(collection(db, 'beats'))
      const beatsData = beatsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      setBeats(beatsData)

      // Load purchases
      const purchasesSnapshot = await getDocs(collection(db, 'purchases'))
      const purchasesData = purchasesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      setPurchases(purchasesData)

      // Load withdrawals
      const withdrawalsSnapshot = await getDocs(collection(db, 'withdrawals'))
      const withdrawalsData = withdrawalsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      withdrawalsData.sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() || 0
        const bTime = b.createdAt?.toMillis?.() || 0
        return bTime - aTime
      })
      setWithdrawals(withdrawalsData)

      // Load orders
      const ordersSnapshot = await getDocs(collection(db, 'orders'))
      const ordersData = ordersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || new Date()
      }))
      ordersData.sort((a, b) => b.createdAt - a.createdAt)
      setOrders(ordersData)

      // Calculate stats
      const totalRevenue = purchasesData.reduce((sum, p) => sum + (p.price || 0), 0)
      const pendingWithdrawals = withdrawalsData.filter(w => w.status === 'pending').length
      const disputedOrders = ordersData.filter(o => o.status === 'disputed').length
      const online = getOnlineUsers(usersData)
      setOnlineUsers(online)
      setStats({
        totalUsers: usersData.length,
        totalBeats: beatsData.length,
        totalSales: purchasesData.length,
        totalRevenue,
        onlineCount: online.length,
        pendingWithdrawals,
        disputedOrders
      })

    } catch (err) {
      console.error('Error loading admin data:', err)
    }
    setLoading(false)
  }

  // Delete beat
  const handleDeleteBeat = async (beatId) => {
    if (!confirm('Удалить этот бит?')) return
    
    try {
      await deleteDoc(doc(db, 'beats', beatId))
      setBeats(prev => prev.filter(b => b.id !== beatId))
      setStats(prev => ({ ...prev, totalBeats: prev.totalBeats - 1 }))
    } catch (err) {
      console.error('Error deleting beat:', err)
      alert('Ошибка при удалении')
    }
  }

  // Delete user
  const handleDeleteUser = async (userId) => {
    if (!confirm('Удалить этого пользователя? Это действие нельзя отменить.')) return
    
    try {
      await deleteDoc(doc(db, 'users', userId))
      setUsers(prev => prev.filter(u => u.id !== userId))
      setStats(prev => ({ ...prev, totalUsers: prev.totalUsers - 1 }))
    } catch (err) {
      console.error('Error deleting user:', err)
      alert('Ошибка при удалении')
    }
  }

  // Refund purchase - return money to buyer from seller's hold
  const handleRefund = async (purchase) => {
    if (!confirm(`Вернуть $${purchase.price} покупателю ${purchase.buyerName}?\n\nЭто снимет деньги с холда продавца и вернёт покупателю.`)) return
    
    setRefunding(purchase.id)
    try {
      // 1. Get buyer's wallet and add money back
      const buyerWalletDoc = await getDoc(doc(db, 'wallets', purchase.buyerId))
      const buyerWallet = buyerWalletDoc.exists() ? buyerWalletDoc.data() : { available: 0, hold: 0 }
      await setDoc(doc(db, 'wallets', purchase.buyerId), {
        ...buyerWallet,
        available: (buyerWallet.available || 0) + purchase.price
      })

      // 2. Get seller's wallet and remove from hold
      const sellerWalletDoc = await getDoc(doc(db, 'wallets', purchase.sellerId))
      const sellerWallet = sellerWalletDoc.exists() ? sellerWalletDoc.data() : { available: 0, hold: 0 }
      await setDoc(doc(db, 'wallets', purchase.sellerId), {
        ...sellerWallet,
        hold: Math.max(0, (sellerWallet.hold || 0) - (purchase.sellerAmount || purchase.price * 0.9))
      })

      // 3. Update purchase status to refunded
      await updateDoc(doc(db, 'purchases', purchase.id), {
        status: 'refunded',
        refundedAt: serverTimestamp(),
        refundedBy: user.name
      })

      // 4. Create refund transaction for buyer
      await addDoc(collection(db, 'transactions'), {
        userId: purchase.buyerId,
        type: 'refund',
        beatId: purchase.beatId,
        beatTitle: purchase.beatTitle,
        purchaseId: purchase.id,
        amount: purchase.price,
        description: `Refund: ${purchase.beatTitle}`,
        status: 'completed',
        createdAt: serverTimestamp()
      })

      // 5. Create refund transaction for seller
      await addDoc(collection(db, 'transactions'), {
        userId: purchase.sellerId,
        type: 'refund_deduct',
        beatId: purchase.beatId,
        beatTitle: purchase.beatTitle,
        purchaseId: purchase.id,
        amount: -(purchase.sellerAmount || purchase.price * 0.9),
        description: `Refund deducted: ${purchase.beatTitle}`,
        status: 'completed',
        createdAt: serverTimestamp()
      })

      // Update local state
      setPurchases(prev => prev.map(p => 
        p.id === purchase.id ? { ...p, status: 'refunded' } : p
      ))

      alert(`✅ Возврат выполнен! $${purchase.price} возвращено покупателю.`)
    } catch (err) {
      console.error('Error refunding:', err)
      alert('Ошибка при возврате: ' + err.message)
    }
    setRefunding(null)
  }

  // Approve withdrawal
  const handleApproveWithdrawal = async (withdrawal) => {
    if (!confirm(`Подтвердить вывод $${withdrawal.amount} для ${withdrawal.userEmail}?\n\nМетод: ${withdrawal.method}\n${withdrawal.cardNumber ? 'Карта: ****' + withdrawal.cardNumber : ''}`)) return
    
    try {
      await updateDoc(doc(db, 'withdrawals', withdrawal.id), {
        status: 'completed',
        processedAt: serverTimestamp(),
        processedBy: user.name
      })
      
      // Update transaction status
      const txQuery = query(
        collection(db, 'transactions'),
        where('userId', '==', withdrawal.userId),
        where('type', '==', 'withdrawal'),
        where('status', '==', 'pending')
      )
      const txSnapshot = await getDocs(txQuery)
      for (const txDoc of txSnapshot.docs) {
        await updateDoc(doc(db, 'transactions', txDoc.id), { status: 'completed' })
      }
      
      setWithdrawals(prev => prev.map(w => 
        w.id === withdrawal.id ? { ...w, status: 'completed' } : w
      ))
      setStats(prev => ({ ...prev, pendingWithdrawals: prev.pendingWithdrawals - 1 }))
      
      alert(`✅ Вывод $${withdrawal.amount} подтверждён!`)
    } catch (err) {
      console.error('Error approving withdrawal:', err)
      alert('Ошибка: ' + err.message)
    }
  }

  // Reject withdrawal - return money to user's balance
  const handleRejectWithdrawal = async (withdrawal) => {
    const reason = prompt('Причина отклонения:')
    if (!reason) return
    
    try {
      // Return money to user's balance
      const walletDoc = await getDoc(doc(db, 'wallets', withdrawal.userId))
      const wallet = walletDoc.exists() ? walletDoc.data() : { available: 0, hold: 0 }
      await setDoc(doc(db, 'wallets', withdrawal.userId), {
        ...wallet,
        available: (wallet.available || 0) + withdrawal.amount
      })
      
      // Update withdrawal status
      await updateDoc(doc(db, 'withdrawals', withdrawal.id), {
        status: 'rejected',
        rejectedAt: serverTimestamp(),
        rejectedBy: user.name,
        rejectReason: reason
      })
      
      // Update transaction
      const txQuery = query(
        collection(db, 'transactions'),
        where('userId', '==', withdrawal.userId),
        where('type', '==', 'withdrawal'),
        where('status', '==', 'pending')
      )
      const txSnapshot = await getDocs(txQuery)
      for (const txDoc of txSnapshot.docs) {
        await updateDoc(doc(db, 'transactions', txDoc.id), { 
          status: 'rejected',
          description: `Withdrawal rejected: ${reason}`
        })
      }
      
      // Create refund transaction
      await addDoc(collection(db, 'transactions'), {
        userId: withdrawal.userId,
        type: 'withdrawal_refund',
        amount: withdrawal.amount,
        description: `Withdrawal rejected: ${reason}`,
        status: 'completed',
        createdAt: serverTimestamp()
      })
      
      setWithdrawals(prev => prev.map(w => 
        w.id === withdrawal.id ? { ...w, status: 'rejected' } : w
      ))
      setStats(prev => ({ ...prev, pendingWithdrawals: prev.pendingWithdrawals - 1 }))
      
      alert(`Вывод отклонён. $${withdrawal.amount} возвращено на баланс.`)
    } catch (err) {
      console.error('Error rejecting withdrawal:', err)
      alert('Ошибка: ' + err.message)
    }
  }

  // Copy purchase ID to clipboard
  const copyPurchaseId = (id) => {
    navigator.clipboard.writeText(id)
    alert('ID скопирован!')
  }

  // Ban/Unban user
  const handleToggleBan = async (userId, currentBanned) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        banned: !currentBanned
      })
      setUsers(prev => prev.map(u => 
        u.id === userId ? { ...u, banned: !currentBanned } : u
      ))
    } catch (err) {
      console.error('Error toggling ban:', err)
    }
  }

  // Admin: Force deliver order (override seller)
  const handleAdminDeliver = async (order) => {
    const adminNotes = prompt(t('enterAdminNotes') || 'Enter admin notes explaining your decision:')
    if (!adminNotes || adminNotes.trim() === '') return
    
    if (!confirm(`Deliver order "${order.beatTitle}" to buyer ${order.buyerEmail}?\n\nThis will override the seller\'s decision.`)) return
    
    setProcessingOrder(order.id)
    try {
      await updateDoc(doc(db, 'orders', order.id), {
        status: 'admin_delivered',
        adminDeliveredAt: serverTimestamp(),
        adminDeliveredBy: user.displayName || user.email,
        adminNotes: adminNotes.trim(),
        updatedAt: serverTimestamp(),
        actionLog: arrayUnion({
          action: 'admin_delivered',
          by: user.displayName || user.email,
          byId: user.id,
          at: new Date().toISOString(),
          note: `Admin delivered: ${adminNotes.trim()}`
        })
      })
      
      setOrders(prev => prev.map(o => 
        o.id === order.id ? { 
          ...o, 
          status: 'admin_delivered',
          adminNotes: adminNotes.trim() 
        } : o
      ))
      setStats(prev => ({ ...prev, disputedOrders: Math.max(0, prev.disputedOrders - 1) }))
      
      alert(`✅ Order delivered by admin. Buyer will receive the beat.`)
    } catch (err) {
      console.error('Error admin delivering:', err)
      alert('Error: ' + err.message)
    }
    setProcessingOrder(null)
  }

  // Admin: Approve order (confirm seller's approval)
  const handleAdminApprove = async (order) => {
    const adminNotes = prompt(t('enterAdminNotes') || 'Enter admin notes (optional):') || ''
    
    setProcessingOrder(order.id)
    try {
      await updateDoc(doc(db, 'orders', order.id), {
        status: 'approved',
        adminApprovedAt: serverTimestamp(),
        adminNotes: adminNotes.trim() || null,
        updatedAt: serverTimestamp(),
        actionLog: arrayUnion({
          action: 'admin_approved',
          by: user.displayName || user.email,
          byId: user.id,
          at: new Date().toISOString(),
          note: adminNotes.trim() ? `Admin approved: ${adminNotes.trim()}` : 'Admin approved order'
        })
      })
      
      setOrders(prev => prev.map(o => 
        o.id === order.id ? { ...o, status: 'approved' } : o
      ))
      setStats(prev => ({ ...prev, disputedOrders: Math.max(0, prev.disputedOrders - 1) }))
      
      alert(`✅ Order approved. Seller can now deliver the beat.`)
    } catch (err) {
      console.error('Error approving order:', err)
      alert('Error: ' + err.message)
    }
    setProcessingOrder(null)
  }

  // Admin: Reject order 
  const handleAdminReject = async (order) => {
    const adminNotes = prompt(t('enterRejectReason') || 'Enter rejection reason:')
    if (!adminNotes || adminNotes.trim() === '') return
    
    setProcessingOrder(order.id)
    try {
      await updateDoc(doc(db, 'orders', order.id), {
        status: 'rejected',
        adminRejectedAt: serverTimestamp(),
        adminRejectedBy: user.displayName || user.email,
        adminNotes: adminNotes.trim(),
        updatedAt: serverTimestamp(),
        actionLog: arrayUnion({
          action: 'admin_rejected',
          by: user.displayName || user.email,
          byId: user.id,
          at: new Date().toISOString(),
          note: `Admin rejected: ${adminNotes.trim()}`
        })
      })
      
      setOrders(prev => prev.map(o => 
        o.id === order.id ? { 
          ...o, 
          status: 'rejected',
          adminNotes: adminNotes.trim() 
        } : o
      ))
      setStats(prev => ({ ...prev, disputedOrders: Math.max(0, prev.disputedOrders - 1) }))
      
      alert(`Order rejected. Buyer has been notified.`)
    } catch (err) {
      console.error('Error rejecting order:', err)
      alert('Error: ' + err.message)
    }
    setProcessingOrder(null)
  }

  const getOrderStatusLabel = (status) => {
    switch (status) {
      case 'pending': return 'Pending'
      case 'approved': return 'Approved'
      case 'rejected': return 'Rejected'
      case 'delivered': return 'Delivered'
      case 'disputed': return 'Disputed'
      case 'admin_delivered': return 'Admin Delivered'
      default: return status
    }
  }

  // NUCLEAR OPTION: Clear all data except admin
  const handleClearAllData = async () => {
    if (!confirm('⚠️ ВНИМАНИЕ! Это удалит ВСЁ:\n\n- Все биты\n- Все заказы/покупки\n- Все транзакции\n- Все кошельки\n- Все споры\n- Всех пользователей (кроме админа)\n\nПродолжить?')) {
      return
    }
    
    if (!confirm('Ты точно уверен? Это нельзя отменить!')) {
      return
    }

    setLoading(true)
    try {
      // Delete all beats
      const beatsSnapshot = await getDocs(collection(db, 'beats'))
      for (const beatDoc of beatsSnapshot.docs) {
        await deleteDoc(doc(db, 'beats', beatDoc.id))
      }

      // Delete all orders (new collection)
      const ordersSnapshot = await getDocs(collection(db, 'orders'))
      for (const orderDoc of ordersSnapshot.docs) {
        await deleteDoc(doc(db, 'orders', orderDoc.id))
      }

      // Delete all purchases (old collection)
      const purchasesSnapshot = await getDocs(collection(db, 'purchases'))
      for (const purchaseDoc of purchasesSnapshot.docs) {
        await deleteDoc(doc(db, 'purchases', purchaseDoc.id))
      }

      // Delete all disputes
      const disputesSnapshot = await getDocs(collection(db, 'disputes'))
      for (const disputeDoc of disputesSnapshot.docs) {
        await deleteDoc(doc(db, 'disputes', disputeDoc.id))
      }

      // Delete all transactions
      const transactionsSnapshot = await getDocs(collection(db, 'transactions'))
      for (const txDoc of transactionsSnapshot.docs) {
        await deleteDoc(doc(db, 'transactions', txDoc.id))
      }

      // Delete all wallets
      const walletsSnapshot = await getDocs(collection(db, 'wallets'))
      for (const walletDoc of walletsSnapshot.docs) {
        await deleteDoc(doc(db, 'wallets', walletDoc.id))
      }

      // Delete all withdrawals
      const withdrawalsSnapshot = await getDocs(collection(db, 'withdrawals'))
      for (const withdrawalDoc of withdrawalsSnapshot.docs) {
        await deleteDoc(doc(db, 'withdrawals', withdrawalDoc.id))
      }

      // Delete all users from Firestore except admin (L)
      const usersSnapshot = await getDocs(collection(db, 'users'))
      for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data()
        if (userData.name !== 'L' && userData.name !== 'l') {
          await deleteDoc(doc(db, 'users', userDoc.id))
        }
      }

      // Reset local state
      setBeats([])
      setPurchases([])
      setOrders([])
      setWithdrawals([])
      setUsers(users.filter(u => u.name === 'L' || u.name === 'l'))
      setStats({
        totalUsers: 1,
        totalBeats: 0,
        totalSales: 0,
        totalRevenue: 0,
        pendingWithdrawals: 0,
        disputedOrders: 0
      })

      alert('✅ Все данные очищены! Сайт как новый.')
    } catch (err) {
      console.error('Error clearing data:', err)
      alert('Ошибка: ' + err.message)
    }
    setLoading(false)
  }

  // Filter data by search
  const filteredBeats = beats.filter(b => 
    b.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.producerName?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredUsers = users.filter(u =>
    u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const formatDate = (timestamp) => {
    if (!timestamp) return '-'
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
    return date.toLocaleDateString('ru-RU')
  }

  // Redirect if not admin
  if (!user?.isAdmin) {
    return <Navigate to="/" replace />
  }

  return (
    <div className={styles.admin}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Shield className={styles.headerIcon} />
          <div>
            <h1>Админ-панель</h1>
            <p>Управление платформой 808</p>
          </div>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.refreshBtn} onClick={loadData} disabled={loading}>
            <RefreshCw className={loading ? styles.spinning : ''} />
            Обновить
          </button>
          <button className={styles.dangerBtn} onClick={handleClearAllData} disabled={loading}>
            <Trash2 size={18} />
            Очистить всё
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'rgba(99, 102, 241, 0.1)' }}>
            <Users style={{ color: '#6366f1' }} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statValue}>{stats.totalUsers}</span>
            <span className={styles.statLabel}>Пользователей</span>
          </div>
        </div>
        
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'rgba(236, 72, 153, 0.1)' }}>
            <Music style={{ color: '#ec4899' }} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statValue}>{stats.totalBeats}</span>
            <span className={styles.statLabel}>Битов</span>
          </div>
        </div>
        
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'rgba(16, 185, 129, 0.1)' }}>
            <TrendingUp style={{ color: '#10b981' }} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statValue}>{stats.totalSales}</span>
            <span className={styles.statLabel}>Продаж</span>
          </div>
        </div>
        
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'rgba(245, 158, 11, 0.1)' }}>
            <DollarSign style={{ color: '#f59e0b' }} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statValue}>${stats.totalRevenue}</span>
            <span className={styles.statLabel}>Выручка</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button 
          className={`${styles.tab} ${activeTab === 'overview' ? styles.active : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <Activity size={18} />
          Обзор
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'users' ? styles.active : ''}`}
          onClick={() => setActiveTab('users')}
        >
          <Users size={18} />
          Пользователи ({users.length})
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'beats' ? styles.active : ''}`}
          onClick={() => setActiveTab('beats')}
        >
          <Music size={18} />
          Биты ({beats.length})
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'sales' ? styles.active : ''}`}
          onClick={() => setActiveTab('sales')}
        >
          <DollarSign size={18} />
          Продажи ({purchases.length})
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'withdrawals' ? styles.active : ''}`}
          onClick={() => setActiveTab('withdrawals')}
        >
          <ArrowUpRight size={18} />
          Выводы {stats.pendingWithdrawals > 0 && <span className={styles.badge}>{stats.pendingWithdrawals}</span>}
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'orders' ? styles.active : ''}`}
          onClick={() => setActiveTab('orders')}
        >
          <Scale size={18} />
          Заказы {stats.disputedOrders > 0 && <span className={styles.badge}>{stats.disputedOrders}</span>}
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'activity' ? styles.active : ''}`}
          onClick={() => setActiveTab('activity')}
        >
          <Wifi size={18} />
          Онлайн ({onlineUsers.length})
        </button>
      </div>

      {/* Search */}
      {(activeTab === 'users' || activeTab === 'beats') && (
        <div className={styles.searchBar}>
          <Search size={20} />
          <input
            type="text"
            placeholder={activeTab === 'users' ? 'Поиск по имени или email...' : 'Поиск по названию...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      )}

      {/* Content */}
      <div className={styles.content}>
        {loading ? (
          <div className={styles.loading}>
            <RefreshCw className={styles.spinning} />
            <p>Загрузка данных...</p>
          </div>
        ) : (
          <>
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className={styles.overview}>
                <div className={styles.recentSection}>
                  <h3>Последние пользователи</h3>
                  <div className={styles.recentList}>
                    {users.slice(0, 5).map(u => (
                      <div key={u.id} className={styles.recentItem}>
                        <div className={styles.avatar}>
                          {u.avatar ? (
                            <img src={u.avatar} alt={u.name} />
                          ) : (
                            <Users size={20} />
                          )}
                        </div>
                        <div className={styles.recentInfo}>
                          <span className={styles.recentName}>{u.name}</span>
                          <span className={styles.recentMeta}>{u.email}</span>
                        </div>
                        <span className={styles.recentDate}>{formatDate(u.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className={styles.recentSection}>
                  <h3>Последние биты</h3>
                  <div className={styles.recentList}>
                    {beats.slice(0, 5).map(b => (
                      <div key={b.id} className={styles.recentItem}>
                        <div className={styles.beatThumb}>
                          {b.coverUrl ? (
                            <img src={b.coverUrl} alt={b.title} />
                          ) : (
                            <Music size={20} />
                          )}
                        </div>
                        <div className={styles.recentInfo}>
                          <span className={styles.recentName}>{b.title}</span>
                          <span className={styles.recentMeta}>{b.producerName}</span>
                        </div>
                        <span className={styles.recentPrice}>${b.price}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Users Tab */}
            {activeTab === 'users' && (
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Пользователь</th>
                      <th>Email</th>
                      <th>Дата регистрации</th>
                      <th>Статус</th>
                      <th>Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map(u => (
                      <tr key={u.id} className={u.banned ? styles.banned : ''}>
                        <td>
                          <div className={styles.userCell}>
                            <div className={styles.avatar}>
                              {u.avatar ? (
                                <img src={u.avatar} alt={u.name} />
                              ) : (
                                <Users size={16} />
                              )}
                            </div>
                            <span>{u.name}</span>
                          </div>
                        </td>
                        <td>{u.email}</td>
                        <td>{formatDate(u.createdAt)}</td>
                        <td>
                          {u.banned ? (
                            <span className={styles.statusBanned}>
                              <XCircle size={14} /> Заблокирован
                            </span>
                          ) : (
                            <span className={styles.statusActive}>
                              <CheckCircle size={14} /> Активен
                            </span>
                          )}
                        </td>
                        <td>
                          <div className={styles.actions}>
                            <button 
                              className={styles.actionBtn}
                              onClick={() => handleToggleBan(u.id, u.banned)}
                              title={u.banned ? 'Разблокировать' : 'Заблокировать'}
                            >
                              <Ban size={16} />
                            </button>
                            <button 
                              className={`${styles.actionBtn} ${styles.danger}`}
                              onClick={() => handleDeleteUser(u.id)}
                              title="Удалить"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredUsers.length === 0 && (
                  <div className={styles.empty}>
                    <Users size={40} />
                    <p>Пользователи не найдены</p>
                  </div>
                )}
              </div>
            )}

            {/* Beats Tab */}
            {activeTab === 'beats' && (
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Бит</th>
                      <th>Продюсер</th>
                      <th>Цена</th>
                      <th>BPM</th>
                      <th>Жанр</th>
                      <th>Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBeats.map(b => (
                      <tr key={b.id}>
                        <td>
                          <div className={styles.beatCell}>
                            <div className={styles.beatThumb}>
                              {b.coverUrl ? (
                                <img src={b.coverUrl} alt={b.title} />
                              ) : (
                                <Music size={16} />
                              )}
                            </div>
                            <span>{b.title}</span>
                          </div>
                        </td>
                        <td>{b.producerName}</td>
                        <td>${b.price}</td>
                        <td>{b.bpm}</td>
                        <td>{b.genre}</td>
                        <td>
                          <div className={styles.actions}>
                            <button 
                              className={`${styles.actionBtn} ${styles.danger}`}
                              onClick={() => handleDeleteBeat(b.id)}
                              title="Удалить"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredBeats.length === 0 && (
                  <div className={styles.empty}>
                    <Music size={40} />
                    <p>Биты не найдены</p>
                  </div>
                )}
              </div>
            )}

            {/* Sales Tab */}
            {activeTab === 'sales' && (
              <>
                {/* Search by Purchase ID */}
                <div className={styles.searchBar} style={{ margin: '1rem' }}>
                  <Search size={20} />
                  <input
                    type="text"
                    placeholder="Поиск по ID покупки (из Telegram)..."
                    value={searchPurchaseId}
                    onChange={(e) => setSearchPurchaseId(e.target.value)}
                  />
                </div>

                <div className={styles.tableWrapper}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Бит</th>
                        <th>Покупатель</th>
                        <th>Продавец</th>
                        <th>Цена</th>
                        <th>Статус</th>
                        <th>Дата</th>
                        <th>Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {purchases
                        .filter(p => searchPurchaseId ? p.id.includes(searchPurchaseId) : true)
                        .map(p => (
                        <tr key={p.id} className={p.status === 'refunded' ? styles.refunded : ''}>
                          <td>
                            <div className={styles.idCellWrapper}>
                              <span className={styles.idCell}>{p.id.slice(0, 8)}...</span>
                              <button 
                                className={styles.copyBtn}
                                onClick={() => copyPurchaseId(p.id)}
                                title="Копировать полный ID"
                              >
                                <Copy size={12} />
                              </button>
                            </div>
                          </td>
                          <td>{p.beatTitle || p.beatId}</td>
                          <td>{p.buyerName || p.buyerId?.slice(0, 8)}</td>
                          <td>{p.sellerName || p.sellerId?.slice(0, 8)}</td>
                          <td>${p.price}</td>
                          <td>
                            {p.status === 'refunded' ? (
                              <span className={styles.statusRefunded}>
                                <Undo2 size={14} /> Возврат
                              </span>
                            ) : p.status === 'hold' ? (
                              <span className={styles.statusHold}>
                                <Clock size={14} /> Холд
                              </span>
                            ) : (
                              <span className={styles.statusCompleted}>
                                <CheckCircle size={14} /> Завершено
                              </span>
                            )}
                          </td>
                          <td>{formatDate(p.createdAt)}</td>
                          <td>
                            <div className={styles.actions}>
                              {p.status !== 'refunded' && (
                                <button 
                                  className={`${styles.actionBtn} ${styles.refundBtn}`}
                                  onClick={() => handleRefund(p)}
                                  disabled={refunding === p.id}
                                  title="Вернуть деньги покупателю"
                                >
                                  {refunding === p.id ? (
                                    <RefreshCw size={16} className={styles.spinning} />
                                  ) : (
                                    <Undo2 size={16} />
                                  )}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {purchases.filter(p => searchPurchaseId ? p.id.includes(searchPurchaseId) : true).length === 0 && (
                    <div className={styles.empty}>
                      <DollarSign size={40} />
                      <p>{searchPurchaseId ? 'Покупка не найдена' : 'Продаж пока нет'}</p>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Activity Tab */}
            {activeTab === 'activity' && (
              <div className={styles.activityTab}>
                <div className={styles.onlineHeader}>
                  <div className={styles.onlineIndicator}>
                    <span className={styles.onlineDot}></span>
                    <span className={styles.onlineCount}>{onlineUsers.length}</span>
                    <span className={styles.onlineLabel}>пользователей онлайн</span>
                  </div>
                  <span className={styles.onlineHint}>Активны в последние 5 минут</span>
                </div>

                {onlineUsers.length > 0 ? (
                  <div className={styles.onlineList}>
                    {onlineUsers.map(u => (
                      <div key={u.id} className={styles.onlineUser}>
                        <div className={styles.onlineAvatar}>
                          {u.avatar ? (
                            <img src={u.avatar} alt={u.name} />
                          ) : (
                            <Users size={20} />
                          )}
                          <span className={styles.onlineStatus}></span>
                        </div>
                        <div className={styles.onlineInfo}>
                          <span className={styles.onlineName}>{u.name}</span>
                          <span className={styles.onlineEmail}>{u.email}</span>
                        </div>
                        <span className={styles.onlineTime}>
                          {u.lastSeen?.toDate ? new Date(u.lastSeen.toDate()).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '-'}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={styles.empty}>
                    <Wifi size={40} />
                    <p>Сейчас никого нет онлайн</p>
                  </div>
                )}
              </div>
            )}

            {/* Withdrawals Tab */}
            {activeTab === 'withdrawals' && (
              <div className={styles.withdrawalsTab}>
                <div className={styles.withdrawalsHeader}>
                  <h3>Заявки на вывод</h3>
                  <div className={styles.withdrawalStats}>
                    <span className={styles.pendingCount}>
                      <Clock size={16} />
                      {withdrawals.filter(w => w.status === 'pending').length} ожидают
                    </span>
                    <span className={styles.totalAmount}>
                      Всего: ${withdrawals.filter(w => w.status === 'pending').reduce((sum, w) => sum + w.amount, 0).toFixed(2)}
                    </span>
                  </div>
                </div>

                {withdrawals.length > 0 ? (
                  <div className={styles.tableContainer}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Пользователь</th>
                          <th>Сумма</th>
                          <th>Метод</th>
                          <th>Реквизиты</th>
                          <th>Статус</th>
                          <th>Дата</th>
                          <th>Действия</th>
                        </tr>
                      </thead>
                      <tbody>
                        {withdrawals.map(w => (
                          <tr key={w.id}>
                            <td>
                              <div className={styles.userCell}>
                                <span className={styles.userName}>{w.userEmail}</span>
                                <span className={styles.userId}>{w.userId?.slice(0, 8)}...</span>
                              </div>
                            </td>
                            <td className={styles.amountCell}>${w.amount?.toFixed(2)}</td>
                            <td>
                              <span className={styles.methodBadge}>
                                {w.method === 'card' ? <CreditCard size={14} /> : null}
                                {w.method === 'card' ? 'Card' : 'PayPal'}
                              </span>
                            </td>
                            <td>
                              {w.method === 'card' ? (
                                <div className={styles.cardDetails}>
                                  <span>****{w.cardNumber}</span>
                                  <span className={styles.cardHolder}>{w.cardHolder}</span>
                                </div>
                              ) : (
                                <span>{w.userEmail}</span>
                              )}
                            </td>
                            <td>
                              {w.status === 'pending' ? (
                                <span className={styles.statusPending}>
                                  <Clock size={14} /> Ожидает
                                </span>
                              ) : w.status === 'completed' ? (
                                <span className={styles.statusCompleted}>
                                  <CheckCircle size={14} /> Выполнено
                                </span>
                              ) : (
                                <span className={styles.statusRefunded}>
                                  <XCircle size={14} /> Отклонено
                                </span>
                              )}
                            </td>
                            <td>{formatDate(w.createdAt)}</td>
                            <td>
                              {w.status === 'pending' && (
                                <div className={styles.actions}>
                                  <button 
                                    className={`${styles.actionBtn} ${styles.approveBtn}`}
                                    onClick={() => handleApproveWithdrawal(w)}
                                    title="Подтвердить вывод"
                                  >
                                    <CheckCircle size={16} />
                                  </button>
                                  <button 
                                    className={`${styles.actionBtn} ${styles.rejectBtn}`}
                                    onClick={() => handleRejectWithdrawal(w)}
                                    title="Отклонить"
                                  >
                                    <XCircle size={16} />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className={styles.empty}>
                    <ArrowUpRight size={40} />
                    <p>Заявок на вывод пока нет</p>
                  </div>
                )}
              </div>
            )}

            {/* Orders Tab */}
            {activeTab === 'orders' && (
              <div className={styles.ordersTab}>
                <div className={styles.ordersHeader}>
                  <h3>{t('orderArbitration') || 'Order Arbitration'}</h3>
                  <div className={styles.orderStats}>
                    <span className={styles.disputedCount}>
                      <Scale size={16} />
                      {orders.filter(o => o.status === 'disputed').length} {t('disputed') || 'disputed'}
                    </span>
                    <span className={styles.pendingOrdersCount}>
                      <Clock size={16} />
                      {orders.filter(o => o.status === 'pending').length} {t('pending') || 'pending'}
                    </span>
                  </div>
                </div>

                {orders.length > 0 ? (
                  <div className={styles.ordersList}>
                    {orders.map(order => (
                      <div 
                        key={order.id} 
                        className={`${styles.orderCard} ${order.status === 'disputed' ? styles.disputed : ''}`}
                      >
                        <div 
                          className={styles.orderHeader}
                          onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                        >
                          <div className={styles.orderInfo}>
                            <div className={styles.orderBeat}>
                              {order.beatCover ? (
                                <img src={order.beatCover} alt={order.beatTitle} className={styles.orderThumb} />
                              ) : (
                                <div className={styles.orderThumbPlaceholder}>
                                  <FileText size={16} />
                                </div>
                              )}
                              <div>
                                <h4>{order.beatTitle}</h4>
                                <span className={styles.orderLicense}>{order.licenseType}</span>
                              </div>
                            </div>
                            <div className={styles.orderMeta}>
                              <span className={`${styles.orderStatus} ${styles[order.status]}`}>
                                {order.status === 'disputed' && <Scale size={14} />}
                                {order.status === 'pending' && <Clock size={14} />}
                                {order.status === 'approved' && <CheckCircle size={14} />}
                                {order.status === 'delivered' && <Send size={14} />}
                                {order.status === 'rejected' && <XCircle size={14} />}
                                {order.status === 'admin_delivered' && <Shield size={14} />}
                                {getOrderStatusLabel(order.status)}
                              </span>
                              <span className={styles.orderPrice}>${order.price?.toFixed(2)}</span>
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
                              <h5><User size={16} /> {t('buyerInfo') || 'Buyer Information'}</h5>
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
                                  <strong>{order.createdAt?.toLocaleDateString?.() || new Date(order.createdAt).toLocaleDateString()}</strong>
                                </div>
                              </div>
                            </div>

                            {/* Seller Info */}
                            <div className={styles.detailSection}>
                              <h5><User size={16} /> {t('sellerInfo') || 'Seller Information'}</h5>
                              <div className={styles.detailGrid}>
                                <div className={styles.detailItem}>
                                  <span>{t('sellerId') || 'Seller ID'}</span>
                                  <strong>{order.sellerId?.slice(0, 12)}...</strong>
                                </div>
                                <div className={styles.detailItem}>
                                  <span>{t('beatId') || 'Beat ID'}</span>
                                  <strong>{order.beatId?.slice(0, 12)}...</strong>
                                </div>
                              </div>
                            </div>

                            {/* Payment Proof */}
                            <div className={styles.detailSection}>
                              <h5><Shield size={16} /> {t('paymentProof') || 'Payment Proof'}</h5>
                              <div className={styles.proofSection}>
                                {order.paymentProof ? (
                                  <a 
                                    href={order.paymentProof} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className={styles.proofImage}
                                  >
                                    <img src={order.paymentProof} alt="Payment proof" />
                                    <span className={styles.viewProof}>
                                      <Eye size={16} /> {t('viewFull') || 'View Full'}
                                    </span>
                                  </a>
                                ) : (
                                  <div className={styles.noProof}>
                                    <AlertTriangle size={20} />
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
                                      <span>{t('cardLastFour') || 'Card Last 4'}</span>
                                      <strong>•••• {order.cardLastFour}</strong>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Dispute Reason */}
                            {order.disputeReason && (
                              <div className={`${styles.detailSection} ${styles.disputeSection}`}>
                                <h5><AlertTriangle size={16} /> {t('disputeReason') || 'Dispute Reason'}</h5>
                                <p className={styles.disputeReason}>{order.disputeReason}</p>
                                <small>{t('disputedBy') || 'Disputed by'}: {order.disputedBy === 'seller' ? 'Seller' : 'Buyer'}</small>
                              </div>
                            )}

                            {/* Action Log */}
                            {order.actionLog && order.actionLog.length > 0 && (
                              <div className={styles.detailSection}>
                                <h5><History size={16} /> {t('actionHistory') || 'Action History'}</h5>
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

                            {/* Admin Actions */}
                            {(order.status === 'pending' || order.status === 'disputed') && (
                              <div className={styles.adminActions}>
                                <h5><Shield size={16} /> {t('adminActions') || 'Admin Actions'}</h5>
                                <div className={styles.actionButtons}>
                                  <button 
                                    className={`btn btn-primary ${styles.adminBtn}`}
                                    onClick={() => handleAdminDeliver(order)}
                                    disabled={processingOrder === order.id}
                                  >
                                    <Send size={16} />
                                    {t('forceDeliver') || 'Force Deliver to Buyer'}
                                  </button>
                                  <button 
                                    className={`btn btn-success ${styles.adminBtn}`}
                                    onClick={() => handleAdminApprove(order)}
                                    disabled={processingOrder === order.id}
                                  >
                                    <CheckCircle size={16} />
                                    {t('approveOrder') || 'Approve Order'}
                                  </button>
                                  <button 
                                    className={`btn btn-error ${styles.adminBtn}`}
                                    onClick={() => handleAdminReject(order)}
                                    disabled={processingOrder === order.id}
                                  >
                                    <XCircle size={16} />
                                    {t('rejectOrder') || 'Reject Order'}
                                  </button>
                                </div>
                                <p className={styles.adminNote}>
                                  <AlertTriangle size={14} />
                                  {t('adminActionNote') || 'All admin actions are logged and visible to both buyer and seller.'}
                                </p>
                              </div>
                            )}

                            {/* Admin Notes */}
                            {order.adminNotes && (
                              <div className={`${styles.detailSection} ${styles.adminNotesSection}`}>
                                <h5><Shield size={16} /> {t('adminNotes') || 'Admin Notes'}</h5>
                                <p>{order.adminNotes}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={styles.empty}>
                    <Scale size={40} />
                    <p>{t('noOrders') || 'No orders yet'}</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
