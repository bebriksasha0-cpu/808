/**
 * Converts sharing URLs from various platforms to direct playable URLs
 */

export function convertToDirectUrl(url) {
  if (!url) return null
  
  // Google Drive
  // Format: https://drive.google.com/file/d/FILE_ID/view?usp=sharing
  // Or: https://drive.google.com/open?id=FILE_ID
  const driveMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/) ||
                     url.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/) ||
                     url.match(/drive\.google\.com.*[?&]id=([a-zA-Z0-9_-]+)/)
  
  if (driveMatch) {
    const fileId = driveMatch[1]
    // Use the streaming URL format
    return `https://drive.google.com/uc?export=download&id=${fileId}`
  }
  
  // Dropbox
  // Format: https://www.dropbox.com/s/xxx/file.mp3?dl=0
  if (url.includes('dropbox.com')) {
    return url.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace('?dl=0', '').replace('?dl=1', '')
  }
  
  // SoundCloud - can't directly play, return as-is (would need API)
  // YouTube - can't directly play audio
  
  // Direct audio URLs (already playable)
  if (url.match(/\.(mp3|wav|ogg|m4a|flac|aac)(\?.*)?$/i)) {
    return url
  }
  
  // Return original URL if no conversion needed
  return url
}

/**
 * Check if URL is from a supported platform for direct playback
 */
export function isPlayableUrl(url) {
  if (!url) return false
  
  // Google Drive
  if (url.includes('drive.google.com')) return true
  
  // Dropbox
  if (url.includes('dropbox.com')) return true
  
  // Direct audio file
  if (url.match(/\.(mp3|wav|ogg|m4a|flac|aac)(\?.*)?$/i)) return true
  
  return false
}

/**
 * Get platform name from URL for display
 */
export function getPlatformName(url) {
  if (!url) return null
  
  if (url.includes('drive.google.com')) return 'Google Drive'
  if (url.includes('dropbox.com')) return 'Dropbox'
  if (url.includes('soundcloud.com')) return 'SoundCloud'
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'YouTube'
  
  return 'Direct Link'
}

/**
 * Convert Cloudinary URL to force download
 * Adds fl_attachment to force browser download instead of opening
 */
export function getDownloadUrl(url, filename) {
  if (!url) return null
  
  // Cloudinary URLs
  if (url.includes('cloudinary.com') || url.includes('res.cloudinary.com')) {
    // Check if fl_attachment is already in URL
    if (url.includes('fl_attachment')) {
      return url
    }
    
    // For raw files (zip, rar)
    if (url.includes('/raw/upload/')) {
      // Check if there are already transformations (contains /upload/something/)
      const parts = url.split('/raw/upload/')
      if (parts.length === 2) {
        return parts[0] + '/raw/upload/fl_attachment/' + parts[1]
      }
    }
    
    // For video/audio files (mp3, wav uploaded as video)
    if (url.includes('/video/upload/')) {
      const parts = url.split('/video/upload/')
      if (parts.length === 2) {
        return parts[0] + '/video/upload/fl_attachment/' + parts[1]
      }
    }
    
    // For image files
    if (url.includes('/image/upload/')) {
      const parts = url.split('/image/upload/')
      if (parts.length === 2) {
        return parts[0] + '/image/upload/fl_attachment/' + parts[1]
      }
    }
  }
  
  // For other URLs, return as-is
  return url
}
