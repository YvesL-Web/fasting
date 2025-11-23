import { Router } from 'express'
import multer from 'multer'
import type { AuthRequest } from '../../middlewares/auth'
import { authMiddleware } from '../../middlewares/auth'
import { appDataSource } from '../../infra/db'
import { UserEntity } from './user.entity'
import { AppError, ERR } from '../../utils/error'
import { cloudinary, deleteCloudinaryImage } from '../../config/cloudinary'
import { env } from '../../config/env'

export const usersRouter = Router()

const usersRepo = appDataSource.getRepository(UserEntity)

// Multer in-memory
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024 // 2 Mo max
  },
  fileFilter(_req, file, cb) {
    const mimetype = file.mimetype || ''
    const original = file.originalname || ''

    const isImageMimetype = mimetype.startsWith('image/')
    const isImageExt = /\.(png|jpe?g|webp|gif|svg|heic|heif)$/i.test(original)

    if (!isImageMimetype && !isImageExt) {
      console.warn('[avatar upload] rejected file', {
        mimetype,
        original
      })
      return cb(
        new AppError(
          { ...ERR.BAD_REQUEST, message: 'File must be an image.' },
          { reason: 'INVALID_AVATAR_FILE', mimetype, original }
        ) as any
      )
    }

    cb(null, true)
  }
})

usersRouter.post(
  '/me/avatar',
  authMiddleware,
  upload.single('avatar'),
  async (req: AuthRequest, res, next) => {
    try {
      if (!req.userId) throw new AppError(ERR.UNAUTHORIZED)
      if (!req.file) {
        throw new AppError({ ...ERR.BAD_REQUEST, message: 'No file uploaded.' })
      }

      const user = await usersRepo.findOne({ where: { id: req.userId } })
      if (!user) {
        throw new AppError(ERR.NOT_FOUND, 'User not found')
      }

      const buffer = req.file.buffer
      const folder = env.CLOUDINARY_UPLOAD_FOLDER ?? 'fasting/avatars'

      const uploadResult = await new Promise<{
        secure_url: string
        public_id: string
      }>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder,
            resource_type: 'image',
            transformation: [
              {
                width: 256,
                height: 256,
                crop: 'fill',
                gravity: 'face'
              }
            ]
          },
          (error, result) => {
            if (error || !result) {
              return reject(
                new AppError(
                  { ...ERR.SERVER_ERROR, message: 'Failed to upload avatar.' },
                  { reason: 'CLOUDINARY_UPLOAD_ERROR', error }
                )
              )
            }
            resolve({
              secure_url: result.secure_url,
              public_id: result.public_id
            })
          }
        )

        stream.end(buffer)
      })

      // supprimer l'ancien avatar si présent
      if (user.avatarPublicId) {
        await deleteCloudinaryImage(user.avatarPublicId)
      }

      user.avatarUrl = uploadResult.secure_url
      user.avatarPublicId = uploadResult.public_id
      await usersRepo.save(user)

      res.status(200).json({ avatarUrl: uploadResult.secure_url })
    } catch (err) {
      next(err)
    }
  }
)

usersRouter.delete('/me/avatar', authMiddleware, async (req: AuthRequest, res, next) => {
  try {
    if (!req.userId) throw new AppError(ERR.UNAUTHORIZED)

    const user = await usersRepo.findOne({ where: { id: req.userId } })
    if (!user) throw new AppError(ERR.NOT_FOUND, 'User not found')

    if (user.avatarPublicId) {
      await deleteCloudinaryImage(user.avatarPublicId)
    }

    user.avatarUrl = null
    user.avatarPublicId = null
    await usersRepo.save(user)

    res.status(204).send()
  } catch (err) {
    next(err)
  }
})
