import { Router } from 'express'
import multer from 'multer'
import fs from 'fs/promises'
import path from 'path'

import type { AuthRequest } from '../../middlewares/auth'
import { authMiddleware } from '../../middlewares/auth'
import { AppError, ERR } from '../../utils/error'
import { appDataSource } from '../../infra/db'

import { UserEntity } from '../users/user.entity'

import { FoodScanService } from './food-scan.service'
import { FoodItemEntity } from '../food/entities/food-item.entity'
import { FoodItemService } from '../food/services/food-item.service'
import { requireSubscriptionPlan } from '../../middlewares/subscription'

// stockage temporaire sur disque (tu peux affiner plus tard)
const upload = multer({
  dest: path.join(process.cwd(), 'tmp', 'food-scans'),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5 MB
  },
  fileFilter(_req, file, cb) {
    if (!file.mimetype.startsWith('image/')) {
      return cb(
        new AppError(
          { ...ERR.BAD_REQUEST, message: 'File must be an image.' },
          { reason: 'INVALID_MIME_TYPE', mime: file.mimetype }
        ) as any
      )
    }
    cb(null, true)
  }
})

const foodItemsRepo = appDataSource.getRepository(FoodItemEntity)
const usersRepo = appDataSource.getRepository(UserEntity)
const foodItemService = new FoodItemService(foodItemsRepo, usersRepo)
const foodScanService = new FoodScanService(foodItemService)

export const foodScanRouter = Router()

foodScanRouter.use(authMiddleware, requireSubscriptionPlan('PREMIUM_MONTHLY'))

// POST /ai/scan-food
foodScanRouter.post('/scan-food', upload.single('image'), async (req: AuthRequest, res, next) => {
  const file = req.file

  try {
    if (!req.userId) {
      throw new AppError(ERR.UNAUTHORIZED)
    }

    if (!file) {
      throw new AppError(
        { ...ERR.BAD_REQUEST, message: 'Missing image file.' },
        { reason: 'MISSING_IMAGE' }
      )
    }

    // option: autoCreateItems=true
    const autoCreateItems = req.query.autoCreateItems === 'true'

    const result = await foodScanService.scanImageFile(req.userId, file.path, {
      autoCreateItems
    })

    // on supprime le fichier tmp après usage
    await fs.unlink(file.path).catch(() => {})

    return res.status(200).json({
      suggestions: result.suggestions,
      createdItemIds: result.createdItemIds ?? []
    })
  } catch (err) {
    // clean du fichier en cas d’erreur
    if (file) {
      await fs.unlink(file.path).catch(() => {})
    }
    return next(err)
  }
})
