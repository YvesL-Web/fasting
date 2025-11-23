import { v2 as cloudinary, UploadApiOptions } from 'cloudinary'
import { env } from './env'

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET
})

export { cloudinary }

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
