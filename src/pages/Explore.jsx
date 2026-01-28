import { useState, useMemo, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Play, Pause, Search, ChevronDown, Loader2, Heart } from 'lucide-react'
import { collection, query, orderBy, getDocs, doc, setDoc, deleteDoc, getDoc } from 'firebase/firestore'
import { db } from '../config/firebase'
import { genres, moods, bpmRanges, priceRanges } from '../data/beats'
import { useAudio } from '../context/AudioContext'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import styles from './Explore.module.css'

export default function Explore() {
  const { currentBeat, isPlaying, play } = useAudio()
  const { user } = useAuth()
  const { t } = useLanguage()
  const [beats, setBeats] = useState([])
  const [likedBeats, setLikedBeats] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedGenre, setSelectedGenre] = useState('All')
  const [selectedMood, setSelectedMood] = useState('All')
  const [selectedBpm, setSelectedBpm] = useState('All')
  const [selectedPrice, setSelectedPrice] = useState('All')

  // Load beats from Firebase
  useEffect(() => {
    const loadBeats = async () => {
      try {
        const beatsQuery = query(collection(db, 'beats'), orderBy('createdAt', 'desc'))
        const snapshot = await getDocs(beatsQuery)
        const beatsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          producer: doc.data().producerName || 'Unknown'
        }))
        setBeats(beatsData)
      } catch (err) {
        console.error('Error loading beats:', err)
      }
      setLoading(false)
    }
    loadBeats()
  }, [])

  // Load user's liked beats
  useEffect(() => {
    const loadLikes = async () => {
      if (!user?.id) return
      try {
        const likesQuery = query(collection(db, 'users', user.id, 'likes'))
        const snapshot = await getDocs(likesQuery)
        const likes = new Set(snapshot.docs.map(doc => doc.id))
        setLikedBeats(likes)
      } catch (err) {
        console.error('Error loading likes:', err)
      }
    }
    loadLikes()
  }, [user?.id])

  const toggleLike = async (beatId, e) => {
    e.preventDefault()
    e.stopPropagation()
    if (!user?.id) return

    const likeRef = doc(db, 'users', user.id, 'likes', beatId)
    const newLiked = new Set(likedBeats)

    if (likedBeats.has(beatId)) {
      await deleteDoc(likeRef)
      newLiked.delete(beatId)
    } else {
      await setDoc(likeRef, { beatId, likedAt: new Date() })
      newLiked.add(beatId)
    }
    setLikedBeats(newLiked)
  }

  const filteredBeats = useMemo(() => {
    return beats.filter(beat => {
      const matchesSearch = beat.title?.toLowerCase().includes(search.toLowerCase()) ||
                           beat.producer?.toLowerCase().includes(search.toLowerCase())
      const matchesGenre = selectedGenre === 'All' || beat.genre === selectedGenre
      const matchesMood = selectedMood === 'All' || beat.mood === selectedMood
      
      let matchesBpm = true
      if (selectedBpm !== 'All') {
        const [min, max] = selectedBpm.replace('+', '').split('-').map(Number)
        matchesBpm = max ? (beat.bpm >= min && beat.bpm <= max) : beat.bpm >= min
      }

      let matchesPrice = true
      if (selectedPrice !== 'All') {
        const priceStr = selectedPrice.replace('$', '').replace('+', '')
        const [min, max] = priceStr.split('-').map(Number)
        matchesPrice = max ? (beat.price >= min && beat.price <= max) : beat.price >= min
      }

      return matchesSearch && matchesGenre && matchesMood && matchesBpm && matchesPrice
    })
  }, [beats, search, selectedGenre, selectedMood, selectedBpm, selectedPrice])

  return (
    <div className={styles.explore}>
      <div className="container">
        {/* Header */}
        <div className={styles.header}>
          <h1 className={styles.title}>{t('explore')}</h1>
          <span className={styles.count}>{filteredBeats.length} {t('beats')}</span>
        </div>

        {/* Search & Filters */}
        <div className={styles.filters}>
          <div className={styles.searchWrapper}>
            <Search size={18} className={styles.searchIcon} />
            <input
              type="text"
              placeholder={t('searchPlaceholder')}
              className={styles.searchInput}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className={styles.filterRow}>
            <FilterSelect 
              label="Genre" 
              options={genres} 
              value={selectedGenre}
              onChange={setSelectedGenre}
            />
            <FilterSelect 
              label="Mood" 
              options={moods} 
              value={selectedMood}
              onChange={setSelectedMood}
            />
            <FilterSelect 
              label="BPM" 
              options={bpmRanges} 
              value={selectedBpm}
              onChange={setSelectedBpm}
            />
            <FilterSelect 
              label="Price" 
              options={priceRanges} 
              value={selectedPrice}
              onChange={setSelectedPrice}
            />
          </div>
        </div>

        {/* Beat List */}
        <div className={styles.beatList}>
          {loading ? (
            <div className={styles.loading}>
              <Loader2 size={32} className={styles.spinner} />
            </div>
          ) : filteredBeats.length === 0 ? (
            <div className={styles.noResults}>
              <p>{t('noBeatsFound')}</p>
            </div>
          ) : (
            filteredBeats.map((beat, index) => (
            <div 
              key={beat.id} 
              className={`${styles.beatRow} ${currentBeat?.id === beat.id ? styles.active : ''}`}
            >
              <span className={styles.beatIndex}>{String(index + 1).padStart(2, '0')}</span>
              
              {/* Cover */}
              <div className={styles.beatCover}>
                {beat.coverUrl ? (
                  <img src={beat.coverUrl} alt={beat.title} />
                ) : (
                  <div className={styles.noCover} />
                )}
              </div>
              
              <button 
                className={styles.playBtn}
                onClick={() => play(beat)}
              >
                {currentBeat?.id === beat.id && isPlaying ? (
                  <Pause size={18} />
                ) : (
                  <Play size={18} />
                )}
              </button>
              
              <div className={styles.beatInfo}>
                <Link to={`/beat/${beat.id}`} className={styles.beatTitle}>
                  {beat.title}
                </Link>
                <span className={styles.beatProducer}>{beat.producer}</span>
              </div>
              
              <span className={styles.beatGenre}>{beat.genre}</span>
              <span className={styles.beatBpm}>{beat.bpm}</span>
              <span className={styles.beatPrice}>${beat.price}</span>
              
              {user && (
                <button 
                  className={`${styles.likeBtn} ${likedBeats.has(beat.id) ? styles.liked : ''}`}
                  onClick={(e) => toggleLike(beat.id, e)}
                >
                  <Heart size={18} fill={likedBeats.has(beat.id) ? 'currentColor' : 'none'} />
                </button>
              )}
              
              <Link to={`/beat/${beat.id}`} className="btn btn-secondary">
                {t('buy')}
              </Link>
            </div>
          ))
          )}
        </div>
      </div>
    </div>
  )
}

function FilterSelect({ label, options, value, onChange }) {
  return (
    <div className={styles.filterSelect}>
      <select 
        value={value} 
        onChange={(e) => onChange(e.target.value)}
        className={styles.select}
      >
        {options.map(option => (
          <option key={option} value={option}>
            {label}: {option}
          </option>
        ))}
      </select>
      <ChevronDown size={16} className={styles.selectIcon} />
    </div>
  )
}
