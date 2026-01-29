import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { Play, Pause, ArrowLeft, UserPlus, UserMinus, Loader2, Heart, Music } from 'lucide-react'
import { doc, getDoc, collection, query, where, getDocs, setDoc, deleteDoc, updateDoc, increment, orderBy } from 'firebase/firestore'
import { db } from '../config/firebase'
import { useAudio } from '../context/AudioContext'
import { useLanguage } from '../context/LanguageContext'
import { useAuth } from '../context/AuthContext'
import styles from './ProducerProfile.module.css'

export default function ProducerProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { currentBeat, isPlaying, play } = useAudio()
  const { t } = useLanguage()
  const { user } = useAuth()
  const [producer, setProducer] = useState(null)
  const [beats, setBeats] = useState([])
  const [loading, setLoading] = useState(true)
  const [isFollowing, setIsFollowing] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)
  const [likedBeats, setLikedBeats] = useState(new Set())

  // Load producer data
  useEffect(() => {
    const loadProducer = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', id))
        if (userDoc.exists()) {
          setProducer({
            id: userDoc.id,
            ...userDoc.data()
          })
        }
      } catch (err) {
        console.error('Error loading producer:', err)
      }
    }
    loadProducer()
  }, [id])

  // Load producer's beats
  useEffect(() => {
    const loadBeats = async () => {
      try {
        const beatsQuery = query(
          collection(db, 'beats'),
          where('producerId', '==', id),
          orderBy('createdAt', 'desc')
        )
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
  }, [id])

  // Check if current user follows this producer
  useEffect(() => {
    const checkFollow = async () => {
      if (!user?.id || user.id === id) return
      try {
        const followDoc = await getDoc(doc(db, 'users', user.id, 'following', id))
        setIsFollowing(followDoc.exists())
      } catch (err) {
        console.error('Error checking follow:', err)
      }
    }
    checkFollow()
  }, [user?.id, id])

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

  const toggleFollow = async () => {
    if (!user?.id) {
      navigate('/auth')
      return
    }
    if (user.id === id) return // Can't follow yourself

    setFollowLoading(true)
    try {
      const followingRef = doc(db, 'users', user.id, 'following', id)
      const followerRef = doc(db, 'users', id, 'followers', user.id)
      const producerRef = doc(db, 'users', id)

      if (isFollowing) {
        // Unfollow
        await deleteDoc(followingRef)
        await deleteDoc(followerRef)
        await updateDoc(producerRef, {
          followersCount: increment(-1)
        })
        setIsFollowing(false)
        setProducer(prev => ({
          ...prev,
          followersCount: Math.max(0, (prev.followersCount || 0) - 1)
        }))
      } else {
        // Follow
        await setDoc(followingRef, {
          producerId: id,
          followedAt: new Date()
        })
        await setDoc(followerRef, {
          userId: user.id,
          followedAt: new Date()
        })
        await updateDoc(producerRef, {
          followersCount: increment(1)
        })
        setIsFollowing(true)
        setProducer(prev => ({
          ...prev,
          followersCount: (prev.followersCount || 0) + 1
        }))
      }
    } catch (err) {
      console.error('Error toggling follow:', err)
    }
    setFollowLoading(false)
  }

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

  if (loading) {
    return (
      <div className={styles.loading}>
        <Loader2 size={32} className={styles.spinner} />
      </div>
    )
  }

  if (!producer) {
    return (
      <div className={styles.notFound}>
        <div className="container">
          <h1>{t('producerNotFound')}</h1>
          <Link to="/explore" className="btn btn-primary">
            {t('back')}
          </Link>
        </div>
      </div>
    )
  }

  const isOwnProfile = user?.id === id

  return (
    <div className={styles.producerPage}>
      <div className="container">
        <Link to="/explore" className={styles.backLink}>
          <ArrowLeft size={18} />
          {t('back')}
        </Link>

        {/* Producer Header */}
        <div className={styles.header}>
          <div className={styles.avatar}>
            {producer.avatar ? (
              <img src={producer.avatar} alt={producer.name} />
            ) : (
              <div className={styles.avatarPlaceholder}>
                {producer.name?.charAt(0)?.toUpperCase() || '?'}
              </div>
            )}
          </div>

          <div className={styles.info}>
            <h1 className={styles.name}>{producer.name}</h1>
            {producer.bio && (
              <p className={styles.bio}>{producer.bio}</p>
            )}
            <div className={styles.stats}>
              <span className={styles.stat}>
                <Music size={16} />
                {beats.length} {t('beatsCount')}
              </span>
              <span className={styles.stat}>
                <UserPlus size={16} />
                {producer.followersCount || 0} {t('followers')}
              </span>
            </div>
          </div>

          {!isOwnProfile && (
            <button
              className={`${styles.followBtn} ${isFollowing ? styles.following : ''}`}
              onClick={toggleFollow}
              disabled={followLoading}
            >
              {followLoading ? (
                <Loader2 size={18} className={styles.spinner} />
              ) : isFollowing ? (
                <>
                  <UserMinus size={18} />
                  {t('unfollow')}
                </>
              ) : (
                <>
                  <UserPlus size={18} />
                  {t('follow')}
                </>
              )}
            </button>
          )}
        </div>

        {/* Producer's Beats */}
        <div className={styles.beatsSection}>
          <h2 className={styles.sectionTitle}>{t('producerBeats')}</h2>

          {beats.length === 0 ? (
            <div className={styles.emptyBeats}>
              <Music size={48} />
              <p>{t('noBeatsYet')}</p>
            </div>
          ) : (
            <div className={styles.beatsList}>
              {beats.map(beat => {
                const isCurrentBeat = currentBeat?.id === beat.id
                return (
                  <Link
                    key={beat.id}
                    to={`/beat/${beat.id}`}
                    className={styles.beatRow}
                  >
                    <button
                      className={styles.playBtn}
                      onClick={(e) => {
                        e.preventDefault()
                        play(beat)
                      }}
                    >
                      {isCurrentBeat && isPlaying ? (
                        <Pause size={16} />
                      ) : (
                        <Play size={16} />
                      )}
                    </button>

                    <div className={styles.beatCover}>
                      {beat.coverUrl ? (
                        <img src={beat.coverUrl} alt={beat.title} />
                      ) : (
                        <div className={styles.noCover}>
                          <Music size={16} />
                        </div>
                      )}
                    </div>

                    <div className={styles.beatInfo}>
                      <span className={styles.beatTitle}>{beat.title}</span>
                      <span className={styles.beatMeta}>
                        {beat.genre} • {beat.bpm} BPM
                      </span>
                    </div>

                    <button
                      className={`${styles.likeBtn} ${likedBeats.has(beat.id) ? styles.liked : ''}`}
                      onClick={(e) => toggleLike(beat.id, e)}
                    >
                      <Heart size={16} fill={likedBeats.has(beat.id) ? 'currentColor' : 'none'} />
                    </button>

                    <span className={styles.beatPrice}>
                      ${beat.prices?.mp3 || beat.price || 29.99}
                    </span>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
