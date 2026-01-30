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
  return new Promise((resolve) => {
    const reader = new FileReader()
    
    reader.onload = async (e) => {
      try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)()
        
        // Resume AudioContext if suspended (required by browsers)
        if (audioContext.state === 'suspended') {
          await audioContext.resume()
        }
        
        const arrayBuffer = e.target.result
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
        
        // Get audio data from first channel
        const channelData = audioBuffer.getChannelData(0)
        const sampleRate = audioBuffer.sampleRate
        
        console.log('Analyzing audio:', { 
          duration: audioBuffer.duration, 
          sampleRate,
          samples: channelData.length 
        })
        
        // Detect BPM
        const bpm = detectBPM(channelData, sampleRate)
        console.log('Detected BPM:', bpm)
        
        // Detect Key
        const key = detectKey(channelData, sampleRate)
        console.log('Detected Key:', key)
        
        audioContext.close()
        
        resolve({ bpm, key })
      } catch (err) {
        console.error('Audio analysis error:', err)
        resolve({ bpm: null, key: null })
      }
    }
    
    reader.onerror = (err) => {
      console.error('File read error:', err)
      resolve({ bpm: null, key: null })
    }
    
    reader.readAsArrayBuffer(file)
  })
}

/**
 * Detect BPM using energy-based onset detection
 */
function detectBPM(channelData, sampleRate) {
  try {
    // Use only first 30 seconds for analysis
    const maxSamples = Math.min(channelData.length, sampleRate * 30)
    
    // Downsample heavily for beat detection
    const hopSize = Math.floor(sampleRate / 100) // 100 samples per second
    const energyValues = []
    
    for (let i = 0; i < maxSamples - hopSize; i += hopSize) {
      let energy = 0
      for (let j = 0; j < hopSize; j++) {
        energy += channelData[i + j] * channelData[i + j]
      }
      energyValues.push(Math.sqrt(energy / hopSize))
    }
    
    if (energyValues.length < 100) {
      console.log('Not enough energy values')
      return 120 // Default BPM
    }
    
    // Compute energy difference (onset detection)
    const onsets = []
    for (let i = 1; i < energyValues.length; i++) {
      const diff = energyValues[i] - energyValues[i - 1]
      onsets.push(diff > 0 ? diff : 0)
    }
    
    // Find average energy
    const avgOnset = onsets.reduce((a, b) => a + b, 0) / onsets.length
    const threshold = avgOnset * 1.5
    
    // Find peaks (beats)
    const beatTimes = []
    const minBeatGap = 15 // Minimum samples between beats (~150ms at 100 samples/sec = 400 BPM max)
    
    for (let i = 1; i < onsets.length - 1; i++) {
      if (onsets[i] > threshold && 
          onsets[i] > onsets[i - 1] && 
          onsets[i] >= onsets[i + 1]) {
        if (beatTimes.length === 0 || i - beatTimes[beatTimes.length - 1] >= minBeatGap) {
          beatTimes.push(i)
        }
      }
    }
    
    console.log('Found beats:', beatTimes.length)
    
    if (beatTimes.length < 4) {
      return 120 // Default BPM if not enough beats
    }
    
    // Calculate intervals
    const intervals = []
    for (let i = 1; i < beatTimes.length; i++) {
      intervals.push(beatTimes[i] - beatTimes[i - 1])
    }
    
    // Get median interval
    intervals.sort((a, b) => a - b)
    const medianInterval = intervals[Math.floor(intervals.length / 2)]
    
    // Convert to BPM (100 samples per second)
    let bpm = Math.round(6000 / medianInterval)
    
    // Normalize to common BPM range
    while (bpm < 70) bpm *= 2
    while (bpm > 180) bpm /= 2
    
    return bpm
  } catch (err) {
    console.error('BPM detection error:', err)
    return 120 // Default fallback
  }
}

/**
 * Detect musical key using chroma features
 */
function detectKey(channelData, sampleRate) {
  try {
    // Use middle section of track (10 seconds)
    const analysisDuration = 10 // seconds
    const numSamples = Math.min(channelData.length, sampleRate * analysisDuration)
    const startOffset = Math.floor((channelData.length - numSamples) / 2)
    
    // Initialize chroma bins (12 pitch classes)
    const chroma = new Array(12).fill(0)
    
    // Analyze using autocorrelation for fundamental frequency detection
    const frameSize = 4096
    const hopSize = 2048
    const numFrames = Math.floor((numSamples - frameSize) / hopSize)
    
    for (let frame = 0; frame < numFrames; frame++) {
      const start = startOffset + frame * hopSize
      
      // Extract frame
      const frameData = new Float32Array(frameSize)
      for (let i = 0; i < frameSize; i++) {
        // Apply Hann window
        const window = 0.5 * (1 - Math.cos(2 * Math.PI * i / frameSize))
        frameData[i] = channelData[start + i] * window
      }
      
      // Find dominant frequencies using zero-crossing and autocorrelation
      const frequencies = findDominantFrequencies(frameData, sampleRate)
      
      // Map frequencies to chroma bins
      for (const freq of frequencies) {
        if (freq > 60 && freq < 2000) {
          const noteNum = 12 * Math.log2(freq / 440) + 69 // MIDI note number
          const chromaBin = Math.round(noteNum) % 12
          if (chromaBin >= 0 && chromaBin < 12) {
            chroma[chromaBin] += 1
          }
        }
      }
    }
    
    // Normalize chroma
    const maxChroma = Math.max(...chroma)
    if (maxChroma === 0) {
      return 'C Minor' // Default
    }
    
    // Key profiles (simplified Krumhansl)
    const majorProfile = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
    const minorProfile = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]
    
    let bestKey = 'C Minor'
    let bestScore = -Infinity
    
    for (let root = 0; root < 12; root++) {
      // Rotate chroma to test each root
      const rotatedChroma = [...chroma.slice(root), ...chroma.slice(0, root)]
      
      // Test major
      let majorScore = 0
      let minorScore = 0
      
      for (let i = 0; i < 12; i++) {
        majorScore += rotatedChroma[i] * majorProfile[i]
        minorScore += rotatedChroma[i] * minorProfile[i]
      }
      
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
    return 'A Minor' // Default fallback
  }
}

/**
 * Find dominant frequencies in a frame using autocorrelation
 */
function findDominantFrequencies(frame, sampleRate) {
  const frequencies = []
  
  // Simple autocorrelation-based pitch detection
  const minLag = Math.floor(sampleRate / 2000) // Max 2000 Hz
  const maxLag = Math.floor(sampleRate / 60)   // Min 60 Hz
  
  let maxCorr = 0
  let bestLag = 0
  
  for (let lag = minLag; lag <= maxLag; lag++) {
    let correlation = 0
    for (let i = 0; i < frame.length - lag; i++) {
      correlation += frame[i] * frame[i + lag]
    }
    
    if (correlation > maxCorr) {
      maxCorr = correlation
      bestLag = lag
    }
  }
  
  if (bestLag > 0) {
    frequencies.push(sampleRate / bestLag)
  }
  
  return frequencies
}
