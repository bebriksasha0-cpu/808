/**
 * Audio analyzer utility for detecting BPM and musical key
 */

// Musical notes for key detection
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

/**
 * Analyze audio file to detect BPM and key
 * @param {File} file - Audio file (MP3/WAV)
 * @returns {Promise<{bpm: number, key: string}>}
 */
export async function analyzeAudio(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = async (e) => {
      try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)()
        const arrayBuffer = e.target.result
        
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
        
        // Get audio data from first channel
        const channelData = audioBuffer.getChannelData(0)
        const sampleRate = audioBuffer.sampleRate
        
        // Detect BPM
        const bpm = detectBPM(channelData, sampleRate)
        
        // Detect Key
        const key = detectKey(channelData, sampleRate)
        
        audioContext.close()
        
        resolve({ bpm, key })
      } catch (err) {
        console.error('Audio analysis error:', err)
        resolve({ bpm: null, key: null })
      }
    }
    
    reader.onerror = () => {
      resolve({ bpm: null, key: null })
    }
    
    reader.readAsArrayBuffer(file)
  })
}

/**
 * Detect BPM using peak detection algorithm
 */
function detectBPM(channelData, sampleRate) {
  // Downsample for faster processing
  const downsampleFactor = 4
  const samples = []
  for (let i = 0; i < channelData.length; i += downsampleFactor) {
    samples.push(Math.abs(channelData[i]))
  }
  
  const effectiveSampleRate = sampleRate / downsampleFactor
  
  // Apply low-pass filter (simple moving average)
  const windowSize = Math.floor(effectiveSampleRate / 20) // ~50ms window
  const filtered = []
  for (let i = 0; i < samples.length; i++) {
    let sum = 0
    let count = 0
    for (let j = Math.max(0, i - windowSize); j <= Math.min(samples.length - 1, i + windowSize); j++) {
      sum += samples[j]
      count++
    }
    filtered.push(sum / count)
  }
  
  // Find peaks
  const threshold = Math.max(...filtered) * 0.3
  const minPeakDistance = Math.floor(effectiveSampleRate * 0.3) // Min 0.3s between peaks (~200 BPM max)
  
  const peaks = []
  for (let i = 1; i < filtered.length - 1; i++) {
    if (filtered[i] > threshold && 
        filtered[i] > filtered[i - 1] && 
        filtered[i] > filtered[i + 1]) {
      if (peaks.length === 0 || i - peaks[peaks.length - 1] >= minPeakDistance) {
        peaks.push(i)
      }
    }
  }
  
  if (peaks.length < 4) return null
  
  // Calculate intervals between peaks
  const intervals = []
  for (let i = 1; i < peaks.length; i++) {
    intervals.push(peaks[i] - peaks[i - 1])
  }
  
  // Find most common interval (mode)
  intervals.sort((a, b) => a - b)
  const medianInterval = intervals[Math.floor(intervals.length / 2)]
  
  // Convert to BPM
  const secondsPerBeat = medianInterval / effectiveSampleRate
  let bpm = Math.round(60 / secondsPerBeat)
  
  // Normalize BPM to reasonable range (60-200)
  while (bpm < 60) bpm *= 2
  while (bpm > 200) bpm /= 2
  
  return bpm
}

/**
 * Detect musical key using FFT and pitch class analysis
 */
function detectKey(channelData, sampleRate) {
  // Take a sample from the middle of the track
  const sampleLength = Math.min(channelData.length, sampleRate * 10) // 10 seconds max
  const startOffset = Math.floor((channelData.length - sampleLength) / 2)
  const samples = channelData.slice(startOffset, startOffset + sampleLength)
  
  // FFT size (power of 2)
  const fftSize = 8192
  
  // Accumulate pitch class energy
  const pitchClassEnergy = new Array(12).fill(0)
  
  // Process in chunks
  const hopSize = fftSize / 2
  const chunks = Math.floor((samples.length - fftSize) / hopSize)
  
  for (let chunk = 0; chunk < chunks; chunk++) {
    const start = chunk * hopSize
    const windowedSamples = new Float32Array(fftSize)
    
    // Apply Hann window
    for (let i = 0; i < fftSize; i++) {
      const hannWindow = 0.5 * (1 - Math.cos(2 * Math.PI * i / fftSize))
      windowedSamples[i] = samples[start + i] * hannWindow
    }
    
    // Simple DFT for relevant frequencies (we don't need full FFT)
    // Analyze frequencies from ~65Hz (C2) to ~1047Hz (C6)
    for (let note = 0; note < 12; note++) {
      let energy = 0
      
      // Check multiple octaves
      for (let octave = 2; octave <= 5; octave++) {
        const freq = 440 * Math.pow(2, (note - 9 + (octave - 4) * 12) / 12)
        const k = Math.round(freq * fftSize / sampleRate)
        
        if (k > 0 && k < fftSize / 2) {
          // Goertzel algorithm for single frequency
          let s0 = 0, s1 = 0, s2 = 0
          const coeff = 2 * Math.cos(2 * Math.PI * k / fftSize)
          
          for (let i = 0; i < fftSize; i++) {
            s0 = windowedSamples[i] + coeff * s1 - s2
            s2 = s1
            s1 = s0
          }
          
          const power = s1 * s1 + s2 * s2 - coeff * s1 * s2
          energy += Math.sqrt(Math.abs(power))
        }
      }
      
      pitchClassEnergy[note] += energy
    }
  }
  
  // Normalize
  const maxEnergy = Math.max(...pitchClassEnergy)
  if (maxEnergy === 0) return null
  
  const normalized = pitchClassEnergy.map(e => e / maxEnergy)
  
  // Major and minor key profiles (Krumhansl-Schmuckler)
  const majorProfile = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
  const minorProfile = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]
  
  let bestKey = null
  let bestCorr = -1
  
  // Try all 24 keys (12 major + 12 minor)
  for (let root = 0; root < 12; root++) {
    // Rotate profile to match root
    const rotatedMajor = [...majorProfile.slice(root), ...majorProfile.slice(0, root)]
    const rotatedMinor = [...minorProfile.slice(root), ...minorProfile.slice(0, root)]
    
    // Calculate correlation
    const corrMajor = correlation(normalized, rotatedMajor)
    const corrMinor = correlation(normalized, rotatedMinor)
    
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
}

/**
 * Calculate Pearson correlation coefficient
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
