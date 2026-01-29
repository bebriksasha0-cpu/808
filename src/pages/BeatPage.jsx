import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { Play, Pause, ArrowLeft, Check, ShoppingCart, Loader2, Download, CheckCircle, MessageCircle } from 'lucide-react'
import { doc, getDoc, query, where, getDocs, collection } from 'firebase/firestore'
import { db } from '../config/firebase'
import { useAudio } from '../context/AudioContext'
import { useLanguage } from '../context/LanguageContext'
import { useAuth } from '../context/AuthContext'
import { getDownloadUrl } from '../utils/audioUrl'
import PurchaseModal from '../components/PurchaseModal'
import styles from './BeatPage.module.css'

// Helper to get file extension based on license type
const getFileExtension = (licenseType) => {
  if (!licenseType) return 'mp3'
  const type = licenseType.toLowerCase()
  if (type === 'mp3') return 'mp3'
  if (type === 'wav') return 'wav'
  if (type === 'trackout' || type === 'exclusive') return 'zip'
  return 'mp3'
}

export default function BeatPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { currentBeat, isPlaying, play } = useAudio()
  const { t } = useLanguage()
  const { user } = useAuth()
  const [beat, setBeat] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedLicense, setSelectedLicense] = useState(0)
  const [purchasedLicenses, setPurchasedLicenses] = useState({})
  const [showPurchaseModal, setShowPurchaseModal] = useState(false)

  // Load beat from Firebase
  useEffect(() => {
    const loadBeat = async () => {
      try {
        const beatDoc = await getDoc(doc(db, 'beats', id))
        if (beatDoc.exists()) {
          setBeat({
            id: beatDoc.id,
            ...beatDoc.data(),
            producer: beatDoc.data().producerName || 'Unknown'
          })
        }
      } catch (err) {
        console.error('Error loading beat:', err)
      }
      setLoading(false)
    }
    loadBeat()
  }, [id])

  // Load wallet and check if already purchased
  useEffect(() => {
    const loadUserData = async () => {
      if (!user?.id || !id) return

      try {
        // Check which licenses already purchased
        const purchasesQuery = query(
          collection(db, 'purchases'),
          where('buyerId', '==', user.id),
          where('beatId', '==', id)
        )
        const purchasesSnapshot = await getDocs(purchasesQuery)
        if (!purchasesSnapshot.empty) {
          const licenses = {}
          purchasesSnapshot.docs.forEach(doc => {
            const data = doc.data()
            licenses[data.licenseType] = data
          })
          setPurchasedLicenses(licenses)
        }
      } catch (err) {
        console.error('Error loading user data:', err)
      }
    }

    loadUserData()
  }, [user?.id, id])

  const handleBuyClick = () => {
    if (!user) {
      navigate('/auth')
      return
    }
    setShowPurchaseModal(true)
  }

  if (loading) {
    return (
      <div className={styles.notFound}>
        <div className="container">
          <Loader2 size={32} className={styles.spinner} />
        </div>
      </div>
    )
  }

  if (!beat) {
    return (
      <div className={styles.notFound}>
        <div className="container">
          <h1>{t('noBeatsFound')}</h1>
          <Link to="/explore" className="btn btn-primary">
            {t('back')}
          </Link>
        </div>
      </div>
    )
  }

  const isCurrentBeat = currentBeat?.id === beat.id
  const isOwnBeat = user?.id === beat.producerId
  
  // Build licenses from prices - only show available licenses
  const allLicenses = [
    { type: 'MP3', key: 'mp3', price: beat.prices?.mp3 || beat.price || 29.99, description: 'MP3 file, basic license' },
    { type: 'WAV', key: 'wav', price: beat.prices?.wav || 49.99, description: 'WAV file, standard license' },
    { type: 'Trackout', key: 'trackout', price: beat.prices?.trackout || 99.99, description: 'Stems + WAV, premium license' },
    { type: 'Exclusive', key: 'exclusive', price: beat.prices?.exclusive || 499.99, description: 'Full ownership, exclusive rights' },
  ]
  
  // Filter to only show available licenses
  const licenses = allLicenses.filter(license => {
    // If beat has availableLicenses defined, check it
    if (beat.availableLicenses) {
      return beat.availableLicenses[license.key] === true
    }
    // Legacy beats - show all licenses
    return true
  })

  return (
    <div className={styles.beatPage}>
      <div className="container">
        <Link to="/explore" className={styles.backLink}>
          <ArrowLeft size={18} />
          {t('back')}
        </Link>

        <div className={styles.content}>
          {/* Left - Player */}
          <div className={styles.playerSection}>
            <div className={styles.cover}>
              {beat.coverUrl ? (
                <img src={beat.coverUrl} alt={beat.title} className={styles.coverImg} />
              ) : (
                <div className={styles.waveform}>
                  {Array.from({ length: 60 }).map((_, i) => (
                    <div 
                      key={i} 
                      className={styles.bar}
                      style={{ 
                        height: `${20 + Math.random() * 60}%`,
                        opacity: 0.3 + Math.random() * 0.7
                      }}
                    />
                  ))}
                </div>
              )}
              
              <button 
                className={styles.playBtn}
                onClick={() => play(beat)}
              >
                {isCurrentBeat && isPlaying ? (
                  <Pause size={32} />
                ) : (
                  <Play size={32} />
                )}
              </button>
            </div>

            <div className={styles.beatInfo}>
              <h1 className={styles.title}>{beat.title}</h1>
              <p className={styles.producer}>
                {t('by')} <Link to={`/producer/${beat.producerId}`} className={styles.producerLink}>{beat.producer}</Link>
              </p>
              
              <div className={styles.tags}>
                <span className={styles.tag}>{beat.genre}</span>
                <span className={styles.tag}>{beat.bpm} BPM</span>
                <span className={styles.tag}>{beat.key}</span>
                <span className={styles.tag}>{beat.mood}</span>
              </div>

              <div className={styles.stats}>
                <span>{beat.plays.toLocaleString()} {t('plays')}</span>
              </div>
            </div>
          </div>

          {/* Right - Licenses */}
          <div className={styles.licenseSection}>
            <h2 className={styles.licenseTitle}>{t('selectLicense')}</h2>
            
            <div className={styles.licenses}>
              {licenses.map((license, index) => {
                const isPurchased = !!purchasedLicenses[license.type]
                return (
                  <div 
                    key={license.type}
                    className={`${styles.licenseCard} ${selectedLicense === index ? styles.selected : ''} ${isPurchased ? styles.licensePurchased : ''}`}
                    onClick={() => !isPurchased && setSelectedLicense(index)}
                  >
                    <div className={styles.licenseHeader}>
                      <span className={styles.licenseType}>{license.type}</span>
                      {isPurchased ? (
                        <span className={styles.purchasedTag}>
                          <CheckCircle size={14} />
                          {t('purchased')}
                        </span>
                      ) : selectedLicense === index ? (
                        <span className={styles.selectedPrice}>
                          <Check size={14} />
                          ${license.price}
                        </span>
                      ) : (
                        <span className={styles.licensePrice}>${license.price}</span>
                      )}
                    </div>
                    <p className={styles.licenseDesc}>{license.description}</p>
                    {isPurchased && (
                      <a 
                        href={getDownloadUrl(purchasedLicenses[license.type]?.beatUrl || beat.audioUrl, `${beat.title}.${getFileExtension(license.type)}`)}
                        className={styles.downloadLicenseBtn}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Download size={14} />
                        {t('download')}
                      </a>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Show buy button if selected license is not purchased */}
            {isOwnBeat ? (
              <div className={styles.ownBeatNotice}>
                <p>{t('ownBeat')}</p>
                <Link to={`/beat/${beat.id}/edit`} className="btn btn-secondary">
                  {t('editBeat')}
                </Link>
              </div>
            ) : !purchasedLicenses[licenses[selectedLicense]?.type] ? (
              <>
                <button 
                  className={`btn btn-primary btn-lg ${styles.buyBtn}`}
                  onClick={handleBuyClick}
                >
                  <MessageCircle size={20} />
                  {t('contactToBuy') || 'Contact to Buy'} — ${licenses[selectedLicense].price}
                </button>
                
                <p className={styles.manualPurchaseNote}>
                  {t('directPayment') || 'Direct payment to seller • Manual verification'}
                </p>
              </>
            ) : (
              <div className={styles.allPurchasedNote}>
                <CheckCircle size={18} />
                <span>{t('licenseOwned')}</span>
              </div>
            )}

            <p className={styles.terms}>
              {t('digitalGoodsNotice') || 'Digital goods • No refunds after delivery'}
            </p>

            {/* Free MP3 Download */}
            <div className={styles.freeDownloadSection}>
              <a 
                href={getDownloadUrl(beat.audioUrl, `${beat.title}.mp3`)}
                className={styles.freeDownloadBtn}
                download={`${beat.title}.mp3`}
              >
                <Download size={18} />
                {t('downloadFreeMP3') || 'Download MP3 Free'}
              </a>
            </div>
          </div>
        </div>

        {/* Purchase Modal */}
        {showPurchaseModal && (
          <PurchaseModal 
            beat={beat}
            license={licenses[selectedLicense]}
            onClose={() => setShowPurchaseModal(false)}
          />
        )}
      </div>
    </div>
  )
}
