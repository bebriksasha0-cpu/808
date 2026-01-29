import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Save, Trash2, Loader2, AlertCircle, Image, X, Plus } from 'lucide-react'
import { doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../config/firebase'
import { uploadToCloudinary } from '../config/cloudinary'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { styles as beatStyles } from '../data/beats'
import styles from './Upload.module.css'

export default function EditBeat() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t } = useLanguage()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [coverFile, setCoverFile] = useState(null)
  const [coverPreview, setCoverPreview] = useState(null)
  const [formData, setFormData] = useState({
    title: '',
    styles: [],
    customStyle: '',
    bpm: '',
    key: '',
    coverUrl: '',
    mp3Price: '',
    wavPrice: '',
    trackoutPrice: '',
    exclusivePrice: ''
  })

  // Toggle style selection
  const toggleStyle = (style) => {
    setFormData(prev => ({
      ...prev,
      styles: prev.styles.includes(style) 
        ? prev.styles.filter(s => s !== style)
        : [...prev.styles, style]
    }))
  }

  // Load beat data
  useEffect(() => {
    const loadBeat = async () => {
      try {
        const beatDoc = await getDoc(doc(db, 'beats', id))
        if (beatDoc.exists()) {
          const data = beatDoc.data()
          // Check if user owns this beat
          if (data.producerId !== user?.id) {
            navigate('/profile')
            return
          }
          setFormData({
            title: data.title || '',
            styles: data.styles || [],
            customStyle: data.customStyle || '',
            bpm: data.bpm?.toString() || '',
            key: data.key || '',
            coverUrl: data.coverUrl || '',
            mp3Price: data.prices?.mp3?.toString() || data.price?.toString() || '29.99',
            wavPrice: data.prices?.wav?.toString() || '49.99',
            trackoutPrice: data.prices?.trackout?.toString() || '99.99',
            exclusivePrice: data.prices?.exclusive?.toString() || '499.99'
          })
          if (data.coverUrl) {
            setCoverPreview(data.coverUrl)
          }
        } else {
          navigate('/profile')
        }
      } catch (err) {
        console.error('Error loading beat:', err)
        setError('Failed to load beat')
      }
      setLoading(false)
    }
    
    if (user?.id) {
      loadBeat()
    }
  }, [id, user?.id, navigate])

  const handleCoverChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setCoverFile(file)
      const reader = new FileReader()
      reader.onloadend = () => setCoverPreview(reader.result)
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)

    try {
      let coverUrl = formData.coverUrl

      // Upload new cover if file selected
      if (coverFile) {
        const coverResult = await uploadToCloudinary(coverFile, 'image')
        coverUrl = coverResult.url
      }

      // Build combined genre from styles for backwards compatibility
      const primaryStyle = formData.styles[0] || formData.customStyle || ''

      await updateDoc(doc(db, 'beats', id), {
        title: formData.title,
        styles: formData.styles,
        customStyle: formData.customStyle.trim(),
        genre: primaryStyle,
        bpm: parseInt(formData.bpm) || 0,
        key: formData.key,
        coverUrl: coverUrl || null,
        price: parseFloat(formData.mp3Price) || 29.99,
        prices: {
          mp3: parseFloat(formData.mp3Price) || 29.99,
          wav: parseFloat(formData.wavPrice) || 49.99,
          trackout: parseFloat(formData.trackoutPrice) || 99.99,
          exclusive: parseFloat(formData.exclusivePrice) || 499.99
        }
      })
      navigate('/profile')
    } catch (err) {
      console.error('Error updating beat:', err)
      setError('Failed to update beat')
    }
    setSaving(false)
  }

  const handleDelete = async () => {
    try {
      await deleteDoc(doc(db, 'beats', id))
      navigate('/profile')
    } catch (err) {
      console.error('Error deleting beat:', err)
      setError('Failed to delete beat')
    }
  }

  if (loading) {
    return (
      <div className={styles.upload}>
        <div className="container">
          <div className={styles.loading}>
            <Loader2 size={32} className={styles.spinner} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.upload}>
      <div className="container">
        <Link to="/profile" className={styles.backLink}>
          <ArrowLeft size={18} />
          {t('back')}
        </Link>

        <h1 className={styles.title}>{t('editBeat')}</h1>

        {error && (
          <div className={styles.error}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.form}>
          {/* Cover Image Upload */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>
              <Image size={20} />
              {t('coverImage')} <span className={styles.optional}>({t('optional')})</span>
            </h2>
            
            <div className={styles.coverUpload}>
              {coverPreview ? (
                <div className={styles.coverPreviewBox}>
                  <img src={coverPreview} alt="Cover" />
                  <button 
                    type="button"
                    className={styles.removeCover}
                    onClick={() => { 
                      setCoverFile(null)
                      setCoverPreview(null)
                      setFormData({...formData, coverUrl: ''})
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <label className={styles.coverLabel}>
                  <Image size={24} />
                  <span>{t('addCover')}</span>
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={handleCoverChange}
                    className={styles.fileInput}
                  />
                </label>
              )}
            </div>
          </div>

          {/* Beat Info */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>{t('beatInfo')}</h2>
            
            <div className={styles.grid}>
              <div className={styles.inputGroup}>
                <label className={styles.label}>{t('title')} *</label>
                <input 
                  type="text"
                  className="input"
                  value={formData.title}
                  onChange={e => setFormData({...formData, title: e.target.value})}
                  required
                />
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.label}>{t('bpm')}</label>
                <input 
                  type="number"
                  className="input"
                  value={formData.bpm}
                  onChange={e => setFormData({...formData, bpm: e.target.value})}
                />
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.label}>Key</label>
                <select 
                  className="input"
                  value={formData.key}
                  onChange={e => setFormData({...formData, key: e.target.value})}
                >
                  <option value="">{t('selectKey')}</option>
                  <option value="Am">Am</option>
                  <option value="Bm">Bm</option>
                  <option value="Cm">Cm</option>
                  <option value="Dm">Dm</option>
                  <option value="Em">Em</option>
                  <option value="Fm">Fm</option>
                  <option value="Gm">Gm</option>
                </select>
              </div>
            </div>

            {/* Styles Multi-Select */}
            <div className={styles.inputGroup}>
              <label className={styles.label}>{t('style')} *</label>
              <div className={styles.stylesGrid}>
                {beatStyles.map(style => (
                  <button
                    key={style}
                    type="button"
                    className={`${styles.styleTag} ${formData.styles.includes(style) ? styles.styleTagActive : ''}`}
                    onClick={() => toggleStyle(style)}
                  >
                    {style}
                  </button>
                ))}
              </div>
              
              {/* Custom Style Input */}
              <div className={styles.customStyleRow}>
                <Plus size={16} />
                <input
                  type="text"
                  className={styles.customStyleInput}
                  placeholder={t('customStyle')}
                  value={formData.customStyle}
                  onChange={e => setFormData({...formData, customStyle: e.target.value.slice(0, 30)})}
                  maxLength={30}
                />
              </div>
              {formData.customStyle && (
                <span className={styles.customStyleHint}>{formData.customStyle.length}/30</span>
              )}
            </div>
          </div>

          {/* Pricing */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>{t('pricing')}</h2>
            <div className={styles.priceGrid}>
              <div className={styles.priceCard}>
                <span className={styles.priceLabel}>MP3</span>
                <div className={styles.priceInput}>
                  <span>$</span>
                  <input 
                    type="number"
                    step="0.01"
                    value={formData.mp3Price}
                    onChange={e => setFormData({...formData, mp3Price: e.target.value})}
                  />
                </div>
              </div>

              <div className={styles.priceCard}>
                <span className={styles.priceLabel}>WAV</span>
                <div className={styles.priceInput}>
                  <span>$</span>
                  <input 
                    type="number"
                    step="0.01"
                    value={formData.wavPrice}
                    onChange={e => setFormData({...formData, wavPrice: e.target.value})}
                  />
                </div>
              </div>

              <div className={styles.priceCard}>
                <span className={styles.priceLabel}>{t('trackout')}</span>
                <div className={styles.priceInput}>
                  <span>$</span>
                  <input 
                    type="number"
                    step="0.01"
                    value={formData.trackoutPrice}
                    onChange={e => setFormData({...formData, trackoutPrice: e.target.value})}
                  />
                </div>
              </div>

              <div className={styles.priceCard}>
                <span className={styles.priceLabel}>{t('exclusive')}</span>
                <div className={styles.priceInput}>
                  <span>$</span>
                  <input 
                    type="number"
                    step="0.01"
                    value={formData.exclusivePrice}
                    onChange={e => setFormData({...formData, exclusivePrice: e.target.value})}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className={styles.actions}>
            <button 
              type="button" 
              className="btn btn-secondary" 
              style={{ color: '#ef4444' }}
              onClick={() => setShowDeleteConfirm(true)}
            >
              <Trash2 size={18} />
              {t('delete')}
            </button>
            <button type="submit" className="btn btn-primary btn-lg" disabled={saving}>
              {saving ? (
                <Loader2 size={18} className={styles.spinner} />
              ) : (
                <>
                  <Save size={18} />
                  {t('saveChanges')}
                </>
              )}
            </button>
          </div>
        </form>

        {/* Delete Confirmation */}
        {showDeleteConfirm && (
          <div className={styles.modal}>
            <div className={styles.modalContent}>
              <h3>{t('deleteBeatConfirm')}</h3>
              <p>{t('deleteBeatWarning')}</p>
              <div className={styles.modalActions}>
                <button className="btn btn-secondary" onClick={() => setShowDeleteConfirm(false)}>
                  {t('cancel')}
                </button>
                <button className="btn btn-primary" style={{ background: '#ef4444' }} onClick={handleDelete}>
                  {t('delete')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
