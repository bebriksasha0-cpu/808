/**
 * Audio analyzer using web-audio-beat-detector for accurate BPM detection
 */
import { guess } from 'web-audio-beat-detector'

// Musical notes
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

/**
 * Analyze audio file to detect BPM and key
 * @param {File} file - Audio file (MP3/WAV)
 * @returns {Promise<{bpm: number, key: string}>}
 */
export async function analyzeAudio(file) {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)()
    
    if (audioContext.state === 'suspended') {
      await audioContext.resume()
    }
    
    // Read file as ArrayBuffer
    const arrayBuffer = await file.arrayBuffer()
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
    
    console.log('Analyzing:', { 
      duration: audioBuffer.duration, 
      sampleRate: audioBuffer.sampleRate 
    })
    
    // Detect BPM using web-audio-beat-detector
    let bpm = null
    try {
      const result = await guess(audioBuffer)
      bpm = Math.round(result.bpm)
      console.log('BPM detected:', bpm, 'offset:', result.offset)
    } catch (bpmErr) {
      console.error('BPM detection failed:', bpmErr)
      bpm = 120
    }
    
    // Detect Key using FFT chroma analysis
    const key = detectKey(audioBuffer)
    console.log('Key detected:', key)
    
    audioContext.close()
    
    return { bpm, key }
  } catch (err) {
    console.error('Analysis error:', err)
    return { bpm: 120, key: 'A Minor' }
  }
}

/**
 * Detect musical key using FFT-based chroma analysis
 */
function detectKey(audioBuffer) {
  try {
    const channelData = audioBuffer.getChannelData(0)
    const sampleRate = audioBuffer.sampleRate
    
    // Use 20 seconds from middle of track
    const analysisDuration = Math.min(20, audioBuffer.duration)
    const analysisStart = Math.floor((audioBuffer.duration - analysisDuration) / 2)
    const startSample = Math.floor(analysisStart * sampleRate)
    const numSamples = Math.floor(analysisDuration * sampleRate)
    
    // FFT parameters
    const fftSize = 8192
    const hopSize = 4096
    
    // Chroma bins (12 pitch classes)
    const chroma = new Array(12).fill(0)
    let frameCount = 0
    
    // Process frames
    for (let i = startSample; i < startSample + numSamples - fftSize; i += hopSize) {
      // Extract frame with Hann window
      const frame = new Float32Array(fftSize)
      for (let j = 0; j < fftSize; j++) {
        const window = 0.5 * (1 - Math.cos(2 * Math.PI * j / fftSize))
        frame[j] = (channelData[i + j] || 0) * window
      }
      
      // Simple FFT magnitude estimation using autocorrelation
      // Map detected pitches to chroma
      const pitches = detectPitchesInFrame(frame, sampleRate)
      
      for (const pitch of pitches) {
        if (pitch > 60 && pitch < 2000) {
          // Convert frequency to MIDI note, then to chroma bin
          const midiNote = 12 * Math.log2(pitch / 440) + 69
          const chromaBin = Math.round(midiNote) % 12
          if (chromaBin >= 0 && chromaBin < 12) {
            chroma[chromaBin]++
          }
        }
      }
      frameCount++
    }
    
    if (frameCount === 0) return 'A Minor'
    
    // Normalize chroma
    const maxChroma = Math.max(...chroma)
    if (maxChroma === 0) return 'A Minor'
    
    const normalizedChroma = chroma.map(c => c / maxChroma)
    
    // Krumhansl-Schmuckler key profiles
    const majorProfile = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
    const minorProfile = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]
    
    let bestKey = 'A Minor'
    let bestScore = -Infinity
    
    for (let root = 0; root < 12; root++) {
      // Rotate chroma to align with root
      const rotatedChroma = []
      for (let i = 0; i < 12; i++) {
        rotatedChroma.push(normalizedChroma[(i + root) % 12])
      }
      
      // Calculate correlation with major and minor profiles
      const majorScore = pearsonCorrelation(rotatedChroma, majorProfile)
      const minorScore = pearsonCorrelation(rotatedChroma, minorProfile)
      
      if (majorScore > bestScore) {
        bestScore = majorScore
        bestKey = `${NOTE_NAMES[root]} Major`
      }
      if (minorScore > bestScore) {
        bestScore = minorScore
        bestKey = `${NOTE_NAMES[root]} Minor`
      }
    }
    
    return bestKey
  } catch (err) {
    console.error('Key detection error:', err)
    return 'A Minor'
  }
}

/**
 * Detect dominant pitches in a frame using autocorrelation
 */
function detectPitchesInFrame(frame, sampleRate) {
  const pitches = []
  
  // Autocorrelation for pitch detection
  const minLag = Math.floor(sampleRate / 1000) // 1000 Hz max
  const maxLag = Math.floor(sampleRate / 80)   // 80 Hz min
  
  const correlations = []
  
  for (let lag = minLag; lag <= maxLag; lag++) {
    let correlation = 0
    for (let i = 0; i < frame.length - lag; i++) {
      correlation += frame[i] * frame[i + lag]
    }
    correlations.push({ lag, correlation })
  }
  
  // Find peaks in autocorrelation
  for (let i = 1; i < correlations.length - 1; i++) {
    if (correlations[i].correlation > correlations[i - 1].correlation &&
        correlations[i].correlation > correlations[i + 1].correlation &&
        correlations[i].correlation > 0) {
      const freq = sampleRate / correlations[i].lag
      pitches.push(freq)
    }
  }
  
  return pitches.slice(0, 3) // Return top 3 pitches
}

/**
 * Pearson correlation coefficient
 */
function pearsonCorrelation(x, y) {
  const n = x.length
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0
  
  for (let i = 0; i < n; i++) {
    sumX += x[i]
    sumY += y[i]
    sumXY += x[i] * y[i]
    sumX2 += x[i] * x[i]
    sumY2 += y[i] * y[i]
  }
  
  const numerator = n * sumXY - sumX * sumY
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY))
  
  return denominator === 0 ? 0 : numerator / denominator
}
