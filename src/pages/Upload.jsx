import { useState } from 'react'
import { useNavigate, Navigate, Link } from 'react-router-dom'
import { Upload as UploadIcon, Music, X, AlertCircle, Loader2, Image, FileAudio, Archive, Check, Send, Plus } from 'lucide-react'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../config/firebase'
import { uploadToCloudinary } from '../config/cloudinary'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { styles as beatStyles } from '../data/beats'
import styles from './Upload.module.css'

export default function Upload() {
  const navigate = useNavigate()
  const { t } = useLanguage()
  const { user } = useAuth()
  
  // Redirect to auth if not logged in
  if (!user) {
    return <Navigate to="/auth?mode=signup" replace />
  }
  
  // Admin account can't upload beats
  if (user?.isAdmin) {
    return <Navigate to="/admin" replace />
  }
  
  // Telegram required to upload
  if (user && !user.telegram) {
    return (
      <div className={styles.upload}>
        <div className={styles.container}>
          <div className={styles.telegramRequired}>
            <Send size={48} />
            <h2>{t('telegramRequiredTitle') || 'Telegram Required'}</h2>
            <p>{t('telegramRequiredDesc') || 'You need to add your Telegram username before uploading beats. This allows buyers to contact you.'}</p>
            <Link to="/settings" className="btn btn-primary">
              {t('goToSettings') || 'Go to Settings'}
            </Link>
          </div>
        </div>
      </div>
    )
  }
  
  const [error, setError] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadStatus, setUploadStatus] = useState('')
  const [coverFile, setCoverFile] = useState(null)
  const [coverPreview, setCoverPreview] = useState(null)
  
  // Files for each license type
  const [mp3File, setMp3File] = useState(null)
  const [wavFile, setWavFile] = useState(null)
  const [trackoutFile, setTrackoutFile] = useState(null)
  const [exclusiveFile, setExclusiveFile] = useState(null)
  
  // Which licenses are enabled for sale
  const [enabledLicenses, setEnabledLicenses] = useState({
    mp3: true,
    wav: false,
    trackout: false,
    exclusive: false
  })
  
  const toggleLicense = (license) => {
    if (license === 'mp3') return // MP3 is always required
    setEnabledLicenses(prev => ({ ...prev, [license]: !prev[license] }))
    // Clear file if license is disabled
    if (enabledLicenses[license]) {
      if (license === 'wav') setWavFile(null)
      if (license === 'trackout') setTrackoutFile(null)
      if (license === 'exclusive') setExclusiveFile(null)
    }
  }
  
  const [formData, setFormData] = useState({
    title: '',
    styles: [],
    customStyle: '',
    bpm: '',
    key: '',
    tags: [],
    mp3Price: '29.99',
    wavPrice: '49.99',
    trackoutPrice: '99.99',
    exclusivePrice: '499.99'
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

  // Validate file type
  const validateFileType = (file, allowedExtensions) => {
    if (!file) return false
    const extension = file.name.split('.').pop().toLowerCase()
    return allowedExtensions.includes(extension)
  }

  // Handle file selection for specific license
  const handleLicenseFileChange = async (e, type) => {
    if (!e.target.files || !e.target.files[0]) return
    
    const file = e.target.files[0]
    
    switch (type) {
      case 'mp3':
        if (!validateFileType(file, ['mp3'])) {
          setError(t('onlyMp3Allowed'))
          return
        }
        setMp3File(file)
        break
      case 'wav':
        if (!validateFileType(file, ['wav'])) {
          setError(t('onlyWavAllowed'))
          return
        }
        setWavFile(file)
        break
      case 'trackout':
        if (!validateFileType(file, ['zip', 'rar'])) {
          setError(t('onlyZipAllowed'))
          return
        }
        setTrackoutFile(file)
        break
      case 'exclusive':
        if (!validateFileType(file, ['zip', 'rar', 'wav'])) {
          setError(t('onlyZipWavAllowed'))
          return
        }
        setExclusiveFile(file)
        break
    }
    setError('')
  }

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
    
    // MP3 is always required
    if (!mp3File) {
      setError(t('mp3FileRequired'))
      return
    }
    
    // Check that all enabled licenses have files
    if (enabledLicenses.wav && !wavFile) {
      setError(t('wavFileRequired'))
      return
    }
    if (enabledLicenses.trackout && !trackoutFile) {
      setError(t('trackoutFileRequired'))
      return
    }
    if (enabledLicenses.exclusive && !exclusiveFile) {
      setError(t('exclusiveFileRequired'))
      return
    }

    if (!formData.title.trim()) {
      setError(t('titleRequired'))
      return
    }

    if (!user) {
      setError('Please sign in to upload beats')
      return
    }

    setIsUploading(true)
    setUploadProgress(0)
    
    try {
      const fileUrls = {
        mp3: null,
        wav: null,
        trackout: null,
        exclusive: null
      }

      // 1. Upload MP3 (required)
      setUploadStatus(t('uploadingMp3'))
      const mp3Result = await uploadToCloudinary(mp3File, 'video', (progress) => {
        setUploadProgress(progress)
      })
      fileUrls.mp3 = mp3Result.url

      // 2. Upload WAV if provided
      if (wavFile) {
        setUploadStatus(t('uploadingWav'))
        setUploadProgress(0)
        const wavResult = await uploadToCloudinary(wavFile, 'video', (progress) => {
          setUploadProgress(progress)
        })
        fileUrls.wav = wavResult.url
      }

      // 3. Upload Trackout if provided
      if (trackoutFile) {
        setUploadStatus(t('uploadingTrackout'))
        setUploadProgress(0)
        const trackoutResult = await uploadToCloudinary(trackoutFile, 'raw', (progress) => {
          setUploadProgress(progress)
        })
        fileUrls.trackout = trackoutResult.url
      }

      // 4. Upload Exclusive if provided
      if (exclusiveFile) {
        setUploadStatus(t('uploadingExclusive'))
        setUploadProgress(0)
        const exclusiveResult = await uploadToCloudinary(exclusiveFile, 'raw', (progress) => {
          setUploadProgress(progress)
        })
        fileUrls.exclusive = exclusiveResult.url
      }

      // 5. Upload cover if provided
      let coverUrl = null
      if (coverFile) {
        setUploadStatus(t('uploadingCover'))
        setUploadProgress(0)
        const coverResult = await uploadToCloudinary(coverFile, 'image', (progress) => {
          setUploadProgress(progress)
        })
        coverUrl = coverResult.url
      }

      // 6. Save to Firestore
      setUploadStatus(t('savingBeat'))
      
      // Build combined genre from styles for backwards compatibility
      const primaryStyle = formData.styles[0] || formData.customStyle || ''
      
      const beatData = {
        title: formData.title,
        // New styles system
        styles: formData.styles,
        customStyle: formData.customStyle.trim(),
        // Legacy genre field for backwards compatibility
        genre: primaryStyle,
        bpm: parseInt(formData.bpm) || 0,
        key: formData.key,
        price: parseFloat(formData.mp3Price) || 29.99,
        prices: {
          mp3: parseFloat(formData.mp3Price) || 29.99,
          wav: parseFloat(formData.wavPrice) || 49.99,
          trackout: parseFloat(formData.trackoutPrice) || 99.99,
          exclusive: parseFloat(formData.exclusivePrice) || 499.99
        },
        // Store all file URLs (only for enabled licenses)
        files: {
          mp3: fileUrls.mp3,
          wav: enabledLicenses.wav ? fileUrls.wav : null,
          trackout: enabledLicenses.trackout ? fileUrls.trackout : null,
          exclusive: enabledLicenses.exclusive ? fileUrls.exclusive : null
        },
        // Which licenses are available for purchase
        availableLicenses: {
          mp3: true,
          wav: enabledLicenses.wav,
          trackout: enabledLicenses.trackout,
          exclusive: enabledLicenses.exclusive
        },
        // For preview/listening (MP3)
        audioUrl: fileUrls.mp3,
        coverUrl: coverUrl,
        producerId: user.id,
        producerName: user.name,
        producerTelegram: user.telegram,
        plays: 0,
        createdAt: serverTimestamp()
      }

      await addDoc(collection(db, 'beats'), beatData)

      // Success - redirect to profile
      navigate('/profile')
    } catch (err) {
      console.error('Upload error:', err)
      setError(err.message || 'Upload failed. Please try again.')
    }
    
    setIsUploading(false)
    setUploadStatus('')
    setUploadProgress(0)
  }

  return (
    <div className={styles.upload}>
      <div className="container">
        <h1 className={styles.title}>{t('uploadBeatTitle')}</h1>

        {/* Error message */}
        {error && (
          <div className={styles.error}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.form}>
          {/* License Files Upload */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>
              <FileAudio size={20} />
              {t('licenseFiles')}
            </h2>
            <p className={styles.sectionNote}>{t('selectLicensesToSell')}</p>
            
            <div className={styles.filesGrid}>
              {/* MP3 File - Always required */}
              <div className={`${styles.fileCard} ${mp3File ? styles.hasFile : ''} ${styles.licenseEnabled}`}>
                <div className={styles.fileCardHeader}>
                  <div className={styles.licenseToggle}>
                    <div className={`${styles.checkbox} ${styles.checkboxLocked}`}>
                      <Check size={12} />
                    </div>
                    <span className={styles.fileType}>MP3</span>
                  </div>
                  <span className={styles.fileRequired}>*</span>
                </div>
                {mp3File ? (
                  <div className={styles.fileSelected}>
                    <Check size={16} className={styles.checkIcon} />
                    <span className={styles.selectedName}>{mp3File.name}</span>
                    <button type="button" className={styles.removeBtn} onClick={() => setMp3File(null)}>
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <label className={styles.fileLabel}>
                    <Music size={20} />
                    <span>{t('selectMp3')}</span>
                    <span className={styles.fileHint}>.mp3</span>
                    <input 
                      type="file" 
                      accept=".mp3,audio/mpeg"
                      onChange={(e) => handleLicenseFileChange(e, 'mp3')}
                      className={styles.fileInput}
                    />
                  </label>
                )}
              </div>

              {/* WAV File */}
              <div className={`${styles.fileCard} ${wavFile ? styles.hasFile : ''} ${enabledLicenses.wav ? styles.licenseEnabled : styles.licenseDisabled}`}>
                <div className={styles.fileCardHeader}>
                  <div className={styles.licenseToggle} onClick={() => toggleLicense('wav')}>
                    <div className={`${styles.checkbox} ${enabledLicenses.wav ? styles.checkboxChecked : ''}`}>
                      {enabledLicenses.wav && <Check size={12} />}
                    </div>
                    <span className={styles.fileType}>WAV</span>
                  </div>
                  {enabledLicenses.wav && <span className={styles.fileRequired}>*</span>}
                </div>
                {enabledLicenses.wav ? (
                  wavFile ? (
                    <div className={styles.fileSelected}>
                      <Check size={16} className={styles.checkIcon} />
                      <span className={styles.selectedName}>{wavFile.name}</span>
                      <button type="button" className={styles.removeBtn} onClick={() => setWavFile(null)}>
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <label className={styles.fileLabel}>
                      <Music size={20} />
                      <span>{t('selectWav')}</span>
                      <span className={styles.fileHint}>.wav</span>
                      <input 
                        type="file" 
                        accept=".wav,audio/wav"
                        onChange={(e) => handleLicenseFileChange(e, 'wav')}
                        className={styles.fileInput}
                      />
                    </label>
                  )
                ) : (
                  <div className={styles.licenseDisabledHint}>{t('clickToEnable')}</div>
                )}
              </div>

              {/* Trackout/Stems File */}
              <div className={`${styles.fileCard} ${trackoutFile ? styles.hasFile : ''} ${enabledLicenses.trackout ? styles.licenseEnabled : styles.licenseDisabled}`}>
                <div className={styles.fileCardHeader}>
                  <div className={styles.licenseToggle} onClick={() => toggleLicense('trackout')}>
                    <div className={`${styles.checkbox} ${enabledLicenses.trackout ? styles.checkboxChecked : ''}`}>
                      {enabledLicenses.trackout && <Check size={12} />}
                    </div>
                    <span className={styles.fileType}>Trackout</span>
                  </div>
                  {enabledLicenses.trackout && <span className={styles.fileRequired}>*</span>}
                </div>
                {enabledLicenses.trackout ? (
                  trackoutFile ? (
                    <div className={styles.fileSelected}>
                      <Check size={16} className={styles.checkIcon} />
                      <span className={styles.selectedName}>{trackoutFile.name}</span>
                      <button type="button" className={styles.removeBtn} onClick={() => setTrackoutFile(null)}>
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <label className={styles.fileLabel}>
                      <Archive size={20} />
                      <span>{t('selectStems')}</span>
                      <span className={styles.fileHint}>.zip, .rar</span>
                      <input 
                        type="file" 
                        accept=".zip,.rar,application/zip,application/x-rar-compressed"
                        onChange={(e) => handleLicenseFileChange(e, 'trackout')}
                        className={styles.fileInput}
                      />
                    </label>
                  )
                ) : (
                  <div className={styles.licenseDisabledHint}>{t('clickToEnable')}</div>
                )}
              </div>

              {/* Exclusive File */}
              <div className={`${styles.fileCard} ${exclusiveFile ? styles.hasFile : ''} ${enabledLicenses.exclusive ? styles.licenseEnabled : styles.licenseDisabled}`}>
                <div className={styles.fileCardHeader}>
                  <div className={styles.licenseToggle} onClick={() => toggleLicense('exclusive')}>
                    <div className={`${styles.checkbox} ${enabledLicenses.exclusive ? styles.checkboxChecked : ''}`}>
                      {enabledLicenses.exclusive && <Check size={12} />}
                    </div>
                    <span className={styles.fileType}>Exclusive</span>
                  </div>
                  {enabledLicenses.exclusive && <span className={styles.fileRequired}>*</span>}
                </div>
                {enabledLicenses.exclusive ? (
                  exclusiveFile ? (
                    <div className={styles.fileSelected}>
                      <Check size={16} className={styles.checkIcon} />
                      <span className={styles.selectedName}>{exclusiveFile.name}</span>
                      <button type="button" className={styles.removeBtn} onClick={() => setExclusiveFile(null)}>
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <label className={styles.fileLabel}>
                      <Archive size={20} />
                      <span>{t('selectExclusive')}</span>
                      <span className={styles.fileHint}>.zip, .rar, .wav</span>
                      <input 
                        type="file" 
                        accept=".zip,.rar,.wav,application/zip,application/x-rar-compressed,audio/wav"
                        onChange={(e) => handleLicenseFileChange(e, 'exclusive')}
                        className={styles.fileInput}
                      />
                    </label>
                  )
                ) : (
                  <div className={styles.licenseDisabledHint}>{t('clickToEnable')}</div>
                )}
              </div>
            </div>
          </div>

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
                    onClick={() => { setCoverFile(null); setCoverPreview(null) }}
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
                  placeholder={t('beatName')}
                  value={formData.title}
                  onChange={e => setFormData({...formData, title: e.target.value})}
                  required
                />
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.label}>{t('bpm')} *</label>
                <input 
                  type="number"
                  className="input"
                  placeholder="120"
                  value={formData.bpm}
                  onChange={e => setFormData({...formData, bpm: e.target.value})}
                  required
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
                  <optgroup label="Minor">
                    <option value="A Minor">Am</option>
                    <option value="A# Minor">A#m</option>
                    <option value="B Minor">Bm</option>
                    <option value="C Minor">Cm</option>
                    <option value="C# Minor">C#m</option>
                    <option value="D Minor">Dm</option>
                    <option value="D# Minor">D#m</option>
                    <option value="E Minor">Em</option>
                    <option value="F Minor">Fm</option>
                    <option value="F# Minor">F#m</option>
                    <option value="G Minor">Gm</option>
                    <option value="G# Minor">G#m</option>
                  </optgroup>
                  <optgroup label="Major">
                    <option value="A Major">A</option>
                    <option value="A# Major">A#</option>
                    <option value="B Major">B</option>
                    <option value="C Major">C</option>
                    <option value="C# Major">C#</option>
                    <option value="D Major">D</option>
                    <option value="D# Major">D#</option>
                    <option value="E Major">E</option>
                    <option value="F Major">F</option>
                    <option value="F# Major">F#</option>
                    <option value="G Major">G</option>
                    <option value="G# Major">G#</option>
                  </optgroup>
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
                <span className={styles.priceLabel}>{t('mp3Lease')}</span>
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
                <span className={styles.priceLabel}>{t('wavLease')}</span>
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

          {/* Submit */}
          <div className={styles.actions}>
            <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)} disabled={isUploading}>
              {t('cancel')}
            </button>
            <button type="submit" className="btn btn-primary btn-lg" disabled={isUploading}>
              {isUploading ? (
                <>
                  <Loader2 size={18} className={styles.spinner} />
                  {uploadStatus} {uploadProgress > 0 && `${uploadProgress}%`}
                </>
              ) : (
                t('publishBeat')
              )}
            </button>
          </div>
          
          {/* Progress bar */}
          {isUploading && uploadProgress > 0 && (
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: `${uploadProgress}%` }} />
            </div>
          )}
        </form>
      </div>
    </div>
  )
}
