// src/modules/users/users.router.ts
import { Router } from 'express'
import multer from 'multer'
import type { AuthRequest } from '../../middlewares/auth'
import { authMiddleware } from '../../middlewares/auth'
import { appDataSource } from '../../infra/db'
import { UserEntity } from './user.entity'
import { AppError, ERR } from '../../utils/error'
import { cloudinary } from '../../config/cloudinary'
import { env } from '../../config/env'

export const usersRouter = Router()

const usersRepo = appDataSource.getRepository(UserEntity)

// Multer in-memory
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB
  },
  fileFilter(_req, file, cb) {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new AppError({ ...ERR.BAD_REQUEST, message: 'File must be an image.' }) as any)
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

      const folder = env.CLOUDINARY_AVATAR_FOLDER ?? 'fasting/avatars'

      const uploadResult = await new Promise<{ secure_url: string }>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder,
            resource_type: 'image'
            // optionnel: transformation par défaut
            // transformation: [{ width: 256, height: 256, crop: 'fill', gravity: 'face' }]
          },
          (error, result) => {
            if (error || !result) {
              return reject(
                new AppError(
                  { ...ERR.SERVER_ERROR, message: 'Failed to upload avatar.' },
                  { reason: 'CLOUDINARY_ERROR', error }
                )
              )
            }
            resolve({ secure_url: result.secure_url })
          }
        )

        stream.end(buffer)
      })

      user.avatarUrl = uploadResult.secure_url
      await usersRepo.save(user)

      res.status(200).json({ avatarUrl: uploadResult.secure_url })
    } catch (err) {
      next(err)
    }
  }
)

import { usersRouter } from './modules/users/users.router'

app.use('/users', usersRouter)

//  Dtont

// hooks/use-upload-avatar.ts
;('use client')

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '@/lib/api'

export function uploadAvatar(formData: FormData) {
  return fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/users/me/avatar`, {
    method: 'POST',
    body: formData,
    credentials: 'include'
  }).then(async (res) => {
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new ApiError(
        res.status,
        (json as any).error ?? null,
        (json as any).message ?? 'Error',
        (json as any).details
      )
    }
    return json as { avatarUrl: string }
  })
}

export function useUploadAvatar() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData()
      fd.append('avatar', file)
      return uploadAvatar(fd)
    },
    onSuccess: (data) => {
      // invalider /auth/me ou une query "current-user"
      qc.invalidateQueries({ queryKey: ['current-user'] })
    }
  })
}
