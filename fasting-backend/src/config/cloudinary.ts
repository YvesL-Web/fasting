import { v2 as cloudinary, UploadApiOptions } from 'cloudinary'
import { env } from './env'

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
  secure: true
})

export { cloudinary }

export type UploadedImage = {
  url: string
  publicId: string
}

export async function deleteCloudinaryImage(publicId: string) {
  if (!publicId) return
  try {
    await cloudinary.uploader.destroy(publicId, {
      resource_type: 'image',
      invalidate: true
    })
  } catch (err) {
    // on loggue seulement, pas besoin de planter la requête HTTP
    console.error('[cloudinary] delete error', err)
  }
}

export async function uploadRecipeImage(localPath: string): Promise<UploadedImage> {
  const res = await cloudinary.uploader.upload(localPath, {
    folder: 'fasting/recipes',
    resource_type: 'image',
    transformation: [
      { width: 1200, height: 1200, crop: 'limit' },
      { quality: 'auto', fetch_format: 'auto' }
    ]
  })

  return {
    url: res.secure_url,
    publicId: res.public_id
  }
}
