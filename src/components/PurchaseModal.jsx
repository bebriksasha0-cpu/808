import { useState } from 'react'
import { 
  X, 
  CreditCard, 
  Clock, 
  Shield, 
  AlertTriangle, 
  Upload, 
  CheckCircle, 
  ArrowRight, 
  Mail,
  FileText,
  Copy,
  Check,
  MessageCircle,
  Loader2,
  Scale,
  Info,
  Send
} from 'lucide-react'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../config/firebase'
import { useLanguage } from '../context/LanguageContext'
import { useAuth } from '../context/AuthContext'
import styles from './PurchaseModal.module.css'
import { Link } from 'react-router-dom'

const STEPS = {
  INFO: 'info',
  PAYMENT: 'payment',
  PROOF: 'proof',
  SUCCESS: 'success'
}

// Seller payment info - this should be configured per seller in production
const PAYMENT_METHODS = {
  card: {
    name: 'Bank Card',
    details: 'Card number will be shown after you proceed',
    icon: CreditCard
  }
}

export default function PurchaseModal({ beat, license, onClose }) {
  const { t } = useLanguage()
  const { user } = useAuth()
  const [step, setStep] = useState(STEPS.INFO)
  const [proofFile, setProofFile] = useState(null)
  const [proofPreview, setProofPreview] = useState(null)
  const [email, setEmail] = useState(user?.email || '')
  const [submitting, setSubmitting] = useState(false)
  const [orderId, setOrderId] = useState(null)
  const [copied, setCopied] = useState(false)

  // Generate order reference
  const generateOrderRef = () => {
    const timestamp = Date.now().toString(36).toUpperCase()
    const random = Math.random().toString(36).substring(2, 6).toUpperCase()
    return `808-${timestamp}-${random}`
  }

  const handleProofUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        alert(t('fileTooLarge') || 'File too large. Max 10MB.')
        return
      }
      setProofFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setProofPreview(reader.result)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSubmitOrder = async () => {
    if (!proofFile || !email.trim()) {
      alert(t('fillAllFields') || 'Please fill all required fields')
      return
    }

    setSubmitting(true)
    try {
      const orderRef = generateOrderRef()
      
      // Convert proof image to base64 for storage
      const proofBase64 = proofPreview

      const orderData = {
        orderRef,
        beatId: beat.id,
        beatTitle: beat.title,
        beatCover: beat.coverUrl || null,
        licenseType: license.type,
        licenseKey: license.key,
        price: license.price,
        
        buyerId: user?.id || null,
        buyerName: user?.name || 'Guest',
        buyerEmail: email,
        
        sellerId: beat.producerId,
        sellerName: beat.producerName,
        sellerTelegram: beat.producerTelegram || null,
        buyerTelegram: user?.telegram || null,
        
        paymentProof: proofBase64,
        
        status: 'pending', // pending, approved, disputed, delivered, rejected, admin_delivered
        disputeReason: null,
        adminNotes: null,
        actionLog: [{
          action: 'created',
          by: user?.name || 'Guest',
          byId: user?.id || null,
          at: new Date().toISOString(),
          note: 'Order created by buyer'
        }],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }

      await addDoc(collection(db, 'orders'), orderData)
      setOrderId(orderRef)
      setStep(STEPS.SUCCESS)

    } catch (err) {
      console.error('Error submitting order:', err)
      alert(t('orderSubmitError') || 'Failed to submit order. Please try again.')
    }
    setSubmitting(false)
  }

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const renderInfoStep = () => (
    <div className={styles.step}>
      <div className={styles.beatPreview}>
        {beat.coverUrl ? (
          <img src={beat.coverUrl} alt={beat.title} className={styles.beatCover} />
        ) : (
          <div className={styles.beatCoverPlaceholder}>
            <FileText size={24} />
          </div>
        )}
        <div className={styles.beatDetails}>
          <h3>{beat.title}</h3>
          <p>{t('by')} {beat.producerName || beat.producer}</p>
        </div>
      </div>

      <div className={styles.orderSummary}>
        <div className={styles.summaryRow}>
          <span>{t('license')}</span>
          <span className={styles.licenseType}>{license.type}</span>
        </div>
        <div className={styles.summaryRow}>
          <span>{t('price')}</span>
          <span className={styles.price}>${license.price.toFixed(2)}</span>
        </div>
      </div>

      <div className={styles.infoCards}>
        <div className={styles.infoCard}>
          <Clock size={20} />
          <div>
            <strong>{t('deliveryTime') || 'Delivery Time'}</strong>
            <p>{t('deliveryTimeDesc') || 'Within 30 minutes after payment confirmation'}</p>
          </div>
        </div>
        
        <div className={styles.infoCard}>
          <Shield size={20} />
          <div>
            <strong>{t('manualVerification') || 'Manual Verification'}</strong>
            <p>{t('manualVerificationDesc') || 'Seller verifies payment before delivery'}</p>
          </div>
        </div>
        
        <div className={styles.infoCard}>
          <Scale size={20} />
          <div>
            <strong>{t('adminArbitration') || 'Admin Protection'}</strong>
            <p>{t('adminArbitrationDesc') || 'Admin can review disputes and override seller if proof is valid'}</p>
          </div>
        </div>

        <div className={`${styles.infoCard} ${styles.warning}`}>
          <AlertTriangle size={20} />
          <div>
            <strong>{t('noRefunds') || 'No Refunds'}</strong>
            <p>{t('noRefundsDesc') || 'Digital goods are non-refundable after delivery'}</p>
          </div>
        </div>
      </div>

      <div className={styles.legalNotice}>
        <Info size={18} />
        <div>
          <strong>{t('importantNotice') || 'Important Notice'}</strong>
          <ul>
            <li>{t('legal1') || 'The website never handles or stores money'}</li>
            <li>{t('legal2') || 'All payments are made directly between buyer and seller'}</li>
            <li>{t('legal3') || 'Digital goods are delivered only after proof of payment verification'}</li>
            <li>{t('legal4') || 'Administrator can override seller to deliver product if valid proof is provided'}</li>
            <li>{t('legal5') || 'All sales are final due to the digital nature of goods'}</li>
          </ul>
        </div>
      </div>

      <button 
        className={`btn btn-primary btn-lg ${styles.continueBtn}`}
        onClick={() => setStep(STEPS.PAYMENT)}
      >
        {t('iUnderstandContinue') || 'I Understand, Continue'}
        <ArrowRight size={18} />
      </button>
    </div>
  )

  const renderPaymentStep = () => (
    <div className={styles.step}>
      <div className={styles.stepHeader}>
        <h3>{t('paymentInstructions') || 'Payment Instructions'}</h3>
        <p>{t('paymentInstructionsDesc') || 'Send payment using one of the methods below'}</p>
      </div>

      <div className={styles.amountToPay}>
        <span>{t('amountToPay') || 'Amount to Pay'}</span>
        <strong>${license.price.toFixed(2)} USD</strong>
      </div>

      <div className={styles.paymentMethods}>
        <div className={styles.paymentMethod}>
          <div className={styles.paymentHeader}>
            <Send size={20} />
            <span>{t('contactSeller') || 'Contact Seller'}</span>
          </div>
          <p className={styles.paymentDesc}>
            {t('contactSellerDesc') || 'Contact the seller via Telegram to get payment details'}
          </p>
          <div className={styles.sellerInfo}>
            <strong>{beat.producerName || beat.producer}</strong>
            {beat.producerTelegram && (
              <a 
                href={`https://t.me/${beat.producerTelegram.replace('@', '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.telegramBtn}
              >
                <Send size={14} />
                {beat.producerTelegram}
              </a>
            )}
          </div>
        </div>
      </div>

      <div className={styles.importantNote}>
        <AlertTriangle size={18} />
        <div>
          <strong>{t('important') || 'Important'}</strong>
          <p>{t('includeOrderRef') || 'Include this reference in your payment message:'}</p>
          <div className={styles.orderRefPreview}>
            <code>{beat.title} - {license.type}</code>
          </div>
        </div>
      </div>

      <div className={styles.stepActions}>
        <button 
          className="btn btn-secondary"
          onClick={() => setStep(STEPS.INFO)}
        >
          {t('back') || 'Back'}
        </button>
        <button 
          className="btn btn-primary"
          onClick={() => setStep(STEPS.PROOF)}
        >
          {t('iHavePaid') || "I've Made Payment"}
          <ArrowRight size={18} />
        </button>
      </div>
    </div>
  )

  const renderProofStep = () => (
    <div className={styles.step}>
      <div className={styles.stepHeader}>
        <h3>{t('submitPaymentProof') || 'Submit Payment Proof'}</h3>
        <p>{t('submitPaymentProofDesc') || 'Upload a screenshot of your payment confirmation'}</p>
      </div>

      <div className={styles.proofUpload}>
        <label className={styles.uploadArea}>
          <input 
            type="file" 
            accept="image/*" 
            onChange={handleProofUpload}
            hidden
          />
          {proofPreview ? (
            <div className={styles.proofPreview}>
              <img src={proofPreview} alt="Payment proof" />
              <button 
                className={styles.removeProof}
                onClick={(e) => {
                  e.preventDefault()
                  setProofFile(null)
                  setProofPreview(null)
                }}
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <div className={styles.uploadPlaceholder}>
              <Upload size={32} />
              <span>{t('uploadScreenshot') || 'Click to upload screenshot / receipt'}</span>
              <small>{t('maxFileSize') || 'Max file size: 10MB'}</small>
            </div>
          )}
        </label>
      </div>

      <div className={styles.formGroup}>
        <label>{t('yourEmail') || 'Your Email'} *</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('emailPlaceholder') || 'Enter your email address'}
          className={styles.input}
          required
        />
        <small>{t('emailNote') || 'We\'ll send the beat to this email after confirmation'}</small>
      </div>

      <div className={styles.stepActions}>
        <button 
          className="btn btn-secondary"
          onClick={() => setStep(STEPS.PAYMENT)}
        >
          {t('back') || 'Back'}
        </button>
        <button 
          className="btn btn-primary"
          onClick={handleSubmitOrder}
          disabled={!proofFile || !email.trim() || submitting}
        >
          {submitting ? (
            <>
              <Loader2 size={18} className="spin" />
              {t('submitting') || 'Submitting...'}
            </>
          ) : (
            <>
              {t('submitOrder') || 'Submit Order'}
              <CheckCircle size={18} />
            </>
          )}
        </button>
      </div>
    </div>
  )

  const renderSuccessStep = () => (
    <div className={styles.step}>
      <div className={styles.successContent}>
        <div className={styles.successIcon}>
          <CheckCircle size={48} />
        </div>
        <h3>{t('orderSubmitted') || 'Order Submitted!'}</h3>
        <p>{t('orderSubmittedDesc') || 'Your order is being reviewed by the seller'}</p>
        
        <div className={styles.orderInfo}>
          <div className={styles.orderInfoRow}>
            <span>{t('orderReference') || 'Order Reference'}</span>
            <strong>{orderId}</strong>
          </div>
          <div className={styles.orderInfoRow}>
            <span>{t('status')}</span>
            <span className={styles.statusPending}>{t('pendingVerification') || 'Pending Verification'}</span>
          </div>
        </div>

        <div className={styles.nextSteps}>
          <h4>{t('whatHappensNext') || 'What happens next?'}</h4>
          <ol>
            <li>{t('nextStep1') || 'The seller will verify your payment'}</li>
            <li>{t('nextStep2') || 'Once confirmed, you\'ll receive the beat via email'}</li>
            <li>{t('nextStep3') || 'Delivery usually takes up to 30 minutes'}</li>
          </ol>
        </div>

        <div className={styles.contactNote}>
          <Mail size={18} />
          <span>{t('checkEmail') || 'Check your email for order updates'}</span>
        </div>

        <button 
          className="btn btn-primary"
          onClick={onClose}
        >
          {t('done') || 'Done'}
        </button>
      </div>
    </div>
  )

  // If user doesn't have Telegram, show requirement message
  if (user && !user.telegram) {
    return (
      <div className={styles.overlay} onClick={onClose}>
        <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={20} />
          </button>
          
          <div className={styles.telegramRequired}>
            <Send size={48} />
            <h2>{t('telegramRequiredTitle') || 'Telegram Required'}</h2>
            <p>{t('telegramRequiredBuyDesc') || 'You need to add your Telegram username before making purchases. This allows sellers to contact you for delivery.'}</p>
            <Link to="/settings" className="btn btn-primary" onClick={onClose}>
              {t('goToSettings') || 'Go to Settings'}
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={onClose}>
          <X size={20} />
        </button>

        <div className={styles.header}>
          <h2>{t('purchaseBeat') || 'Purchase Beat'}</h2>
          
          {/* Progress Steps */}
          {step !== STEPS.SUCCESS && (
            <div className={styles.progress}>
              <div className={`${styles.progressStep} ${step === STEPS.INFO ? styles.active : ''} ${[STEPS.PAYMENT, STEPS.PROOF].includes(step) ? styles.completed : ''}`}>
                <span>1</span>
                <p>{t('review') || 'Review'}</p>
              </div>
              <div className={styles.progressLine} />
              <div className={`${styles.progressStep} ${step === STEPS.PAYMENT ? styles.active : ''} ${step === STEPS.PROOF ? styles.completed : ''}`}>
                <span>2</span>
                <p>{t('payment') || 'Payment'}</p>
              </div>
              <div className={styles.progressLine} />
              <div className={`${styles.progressStep} ${step === STEPS.PROOF ? styles.active : ''}`}>
                <span>3</span>
                <p>{t('proof') || 'Proof'}</p>
              </div>
            </div>
          )}
        </div>

        <div className={styles.content}>
          {step === STEPS.INFO && renderInfoStep()}
          {step === STEPS.PAYMENT && renderPaymentStep()}
          {step === STEPS.PROOF && renderProofStep()}
          {step === STEPS.SUCCESS && renderSuccessStep()}
        </div>
      </div>
    </div>
  )
}
