/**
 * Audio analyzer using Meyda library for BPM and Key detection
 */
import Meyda from 'meyda'

// Musical notes
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

/**
 * Analyze audio file to detect BPM and key
 * @param {File} file - Audio file (MP3/WAV)
 * @returns {Promise<{bpm: number, key: string}>}
 */
export async function analyzeAudio(file) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    
    reader.onload = async (e) => {
      try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)()
        
        if (audioContext.state === 'suspended') {
          await audioContext.resume()
        }
        
        const arrayBuffer = e.target.result
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
        
        const channelData = audioBuffer.getChannelData(0)
        const sampleRate = audioBuffer.sampleRate
        
        console.log('Analyzing:', { duration: audioBuffer.duration, sampleRate })
        
        // Detect BPM using onset detection
        const bpm = detectBPM(channelData, sampleRate)
        
        // Detect Key using chroma analysis with Meyda
        const key = detectKeyWithMeyda(channelData, sampleRate, audioContext)
        
        audioContext.close()
        
        console.log('Results:', { bpm, key })
        resolve({ bpm, key })
      } catch (err) {
        console.error('Analysis error:', err)
        resolve({ bpm: 120, key: 'A Minor' })
      }
    }
    
    reader.onerror = () => resolve({ bpm: 120, key: 'A Minor' })
    reader.readAsArrayBuffer(file)
  })
}

/**
 * Detect BPM using energy onset detection
 */
function detectBPM(channelData, sampleRate) {
  try {
    const maxSamples = Math.min(channelData.length, sampleRate * 30)
    const hopSize = Math.floor(sampleRate / 100)
    const energyValues = []
    
    // Calculate energy for each frame
    for (let i = 0; i < maxSamples - hopSize; i += hopSize) {
      let energy = 0
      for (let j = 0; j < hopSize; j++) {
        energy += channelData[i + j] * channelData[i + j]
      }
      energyValues.push(Math.sqrt(energy / hopSize))
    }
    
    if (energyValues.length < 100) return 120
    
    // Calculate onset strength (energy difference)
    const onsets = []
    for (let i = 1; i < energyValues.length; i++) {
      const diff = energyValues[i] - energyValues[i - 1]
      onsets.push(diff > 0 ? diff : 0)
    }
    
    // Threshold for peak detection
    const avgOnset = onsets.reduce((a, b) => a + b, 0) / onsets.length
    const stdOnset = Math.sqrt(onsets.reduce((a, b) => a + (b - avgOnset) ** 2, 0) / onsets.length)
    const threshold = avgOnset + stdOnset * 0.5
    
    // Find beats
    const beatTimes = []
    const minGap = 12 // ~120ms minimum between beats
    
    for (let i = 2; i < onsets.length - 2; i++) {
      if (onsets[i] > threshold && 
          onsets[i] > onsets[i - 1] && 
          onsets[i] > onsets[i - 2] &&
          onsets[i] >= onsets[i + 1] &&
          onsets[i] >= onsets[i + 2]) {
        if (beatTimes.length === 0 || i - beatTimes[beatTimes.length - 1] >= minGap) {
          beatTimes.push(i)
        }
      }
    }
    
    if (beatTimes.length < 8) return 120
    
    // Calculate intervals and find BPM
    const intervals = []
    for (let i = 1; i < beatTimes.length; i++) {
      intervals.push(beatTimes[i] - beatTimes[i - 1])
    }
    
    // Use histogram to find most common interval
    const histogram = {}
    intervals.forEach(interval => {
      const bin = Math.round(interval)
      histogram[bin] = (histogram[bin] || 0) + 1
    })
    
    let bestInterval = intervals[Math.floor(intervals.length / 2)]
    let maxCount = 0
    for (const [interval, count] of Object.entries(histogram)) {
      if (count > maxCount) {
        maxCount = count
        bestInterval = parseInt(interval)
      }
    }
    
    // Convert to BPM (100 frames per second)
    let bpm = Math.round(6000 / bestInterval)
    
    // Normalize to reasonable range
    while (bpm < 70) bpm *= 2
    while (bpm > 180) bpm /= 2
    
    return bpm
  } catch (err) {
    console.error('BPM error:', err)
    return 120
  }
}

/**
 * Detect key using Meyda chroma features
 */
function detectKeyWithMeyda(channelData, sampleRate) {
  try {
    const bufferSize = 4096
    const hopSize = 2048
    
    // Use middle 20 seconds of track
    const analysisLength = Math.min(channelData.length, sampleRate * 20)
    const startOffset = Math.floor((channelData.length - analysisLength) / 2)
    
    // Accumulate chroma
    const chromaSum = new Array(12).fill(0)
    let frameCount = 0
    
    // Set up Meyda
    Meyda.bufferSize = bufferSize
    Meyda.sampleRate = sampleRate
    
    // Process frames
    for (let i = startOffset; i < startOffset + analysisLength - bufferSize; i += hopSize) {
      const frame = channelData.slice(i, i + bufferSize)
      
      try {
        const features = Meyda.extract(['chroma'], frame)
        if (features && features.chroma) {
          for (let j = 0; j < 12; j++) {
            chromaSum[j] += features.chroma[j]
          }
          frameCount++
        }
      } catch (e) {
        // Skip frame on error
      }
    }
    
    if (frameCount === 0) return 'A Minor'
    
    // Normalize
    const chroma = chromaSum.map(c => c / frameCount)
    
    // Key profiles (Krumhansl-Schmuckler)
    const majorProfile = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
    const minorProfile = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]
    
    let bestKey = 'A Minor'
    let bestCorr = -Infinity
    
    for (let root = 0; root < 12; root++) {
      // Rotate chroma
      const rotated = [...chroma.slice(12 - root), ...chroma.slice(0, 12 - root)]
      
      // Correlate with profiles
      const corrMajor = correlation(rotated, majorProfile)
      const corrMinor = correlation(rotated, minorProfile)
      
      if (corrMajor > bestCorr) {
        bestCorr = corrMajor
        bestKey = `${NOTE_NAMES[root]} Major`
      }
      if (corrMinor > bestCorr) {
        bestCorr = corrMinor
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
 * Pearson correlation coefficient
 */
function correlation(a, b) {
  const n = a.length
  let sumA = 0, sumB = 0, sumAB = 0, sumA2 = 0, sumB2 = 0
  
  for (let i = 0; i < n; i++) {
    sumA += a[i]
    sumB += b[i]
    sumAB += a[i] * b[i]
    sumA2 += a[i] * a[i]
    sumB2 += b[i] * b[i]
  }
  
  const num = n * sumAB - sumA * sumB
  const den = Math.sqrt((n * sumA2 - sumA * sumA) * (n * sumB2 - sumB * sumB))
  
  return den === 0 ? 0 : num / den
}
