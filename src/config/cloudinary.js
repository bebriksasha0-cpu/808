// Cloudinary configuration
export const cloudinaryConfig = {
  cloudName: 'dngqryxv0',
  uploadPreset: '808mysite', // Your upload preset
}

/**
 * Upload file to Cloudinary
 * @param {File} file - The file to upload
 * @param {string} resourceType - 'auto', 'image', 'video', 'raw'
 * @param {function} onProgress - Progress callback (0-100)
 * @returns {Promise<{url: string, publicId: string}>}
 */
export async function uploadToCloudinary(file, resourceType = 'auto', onProgress = null) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_preset', cloudinaryConfig.uploadPreset)
  formData.append('resource_type', resourceType)
  
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/${resourceType}/upload`)
    
    // Progress tracking
    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100)
          onProgress(percent)
        }
      }
    }
    
    xhr.onload = () => {
      if (xhr.status === 200) {
        const response = JSON.parse(xhr.responseText)
        resolve({
          url: response.secure_url,
          publicId: response.public_id,
          duration: response.duration, // for audio/video
          format: response.format
        })
      } else {
        reject(new Error('Upload failed: ' + xhr.statusText))
      }
    }
    
    xhr.onerror = () => reject(new Error('Upload failed'))
    xhr.send(formData)
  })
}
