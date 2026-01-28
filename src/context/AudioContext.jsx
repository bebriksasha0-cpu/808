import { createContext, useContext, useState, useRef } from 'react'
import { convertToDirectUrl } from '../utils/audioUrl'

const AudioContext = createContext()

export function AudioProvider({ children }) {
  const [currentBeat, setCurrentBeat] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const audioRef = useRef(null)

  const play = (beat) => {
    if (currentBeat?.id === beat.id) {
      if (isPlaying) {
        audioRef.current?.pause()
        setIsPlaying(false)
      } else {
        audioRef.current?.play()
        setIsPlaying(true)
      }
    } else {
      // Convert URL to direct playable URL
      const playableBeat = {
        ...beat,
        audioUrl: convertToDirectUrl(beat.audioUrl)
      }
      setCurrentBeat(playableBeat)
      setIsPlaying(true)
      setProgress(0)
    }
  }

  const pause = () => {
    audioRef.current?.pause()
    setIsPlaying(false)
  }

  const seek = (time) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time
      setProgress(time)
    }
  }

  return (
    <AudioContext.Provider value={{
      currentBeat,
      isPlaying,
      progress,
      duration,
      audioRef,
      play,
      pause,
      seek,
      setProgress,
      setDuration,
      setIsPlaying
    }}>
      {children}
    </AudioContext.Provider>
  )
}

export function useAudio() {
  const context = useContext(AudioContext)
  if (!context) {
    throw new Error('useAudio must be used within AudioProvider')
  }
  return context
}
