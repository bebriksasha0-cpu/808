import { useState } from 'react'
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react'
import { useAudio } from '../context/AudioContext'
import styles from './GlobalPlayer.module.css'

export default function GlobalPlayer() {
  const { 
    currentBeat, 
    isPlaying, 
    progress, 
    duration, 
    audioRef,
    play,
    setProgress,
    setDuration,
    setIsPlaying
  } = useAudio()
  
  const [volume, setVolume] = useState(0.8)
  const [muted, setMuted] = useState(false)

  const formatTime = (time) => {
    if (!time || isNaN(time)) return '0:00'
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setProgress(audioRef.current.currentTime)
    }
  }

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration)
    }
  }

  const handleSeek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const percent = (e.clientX - rect.left) / rect.width
    const newTime = percent * duration
    if (audioRef.current) {
      audioRef.current.currentTime = newTime
      setProgress(newTime)
    }
  }

  const handleVolumeChange = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    setVolume(percent)
    if (audioRef.current) {
      audioRef.current.volume = percent
    }
    if (percent > 0) setMuted(false)
  }

  const toggleMute = () => {
    setMuted(!muted)
    if (audioRef.current) {
      audioRef.current.muted = !muted
    }
  }

  const progressPercent = duration ? (progress / duration) * 100 : 0

  return (
    <div className={styles.player}>
      <audio
        ref={audioRef}
        src={currentBeat?.audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        autoPlay
      />

      <div className={`container ${styles.container}`}>
        <div className={styles.beatInfo}>
          <div className={styles.beatCover}>
            <div className={styles.waveIcon}>
              <span></span><span></span><span></span><span></span>
            </div>
          </div>
          <div className={styles.beatMeta}>
            <span className={styles.beatTitle}>{currentBeat?.title}</span>
            <span className={styles.beatProducer}>{currentBeat?.producer}</span>
          </div>
        </div>

        <div className={styles.controls}>
          <div className={styles.buttons}>
            <button className={styles.controlBtn}>
              <SkipBack size={18} />
            </button>
            <button 
              className={styles.playBtn}
              onClick={() => play(currentBeat)}
            >
              {isPlaying ? <Pause size={20} /> : <Play size={20} />}
            </button>
            <button className={styles.controlBtn}>
              <SkipForward size={18} />
            </button>
          </div>

          <div className={styles.progress}>
            <span className={styles.time}>{formatTime(progress)}</span>
            <div className={styles.progressBar} onClick={handleSeek}>
              <div 
                className={styles.progressFill} 
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className={styles.time}>{formatTime(duration)}</span>
          </div>
        </div>

        <div className={styles.volume}>
          <button className={styles.volumeBtn} onClick={toggleMute}>
            {muted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          <div className={styles.volumeBar} onClick={handleVolumeChange}>
            <div className={styles.volumeFill} style={{ width: `${muted ? 0 : volume * 100}%` }} />
          </div>
        </div>
      </div>
    </div>
  )
}
