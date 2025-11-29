import { Router } from 'express'
import { z } from 'zod'

import { appDataSource } from '../../infra/db'
import { FastEntity } from '../fasts/fast.entity'
import { FoodEntryEntity } from '../food/food-entry.entity'
import { UserEntity } from '../users/user.entity'
import { CoachService } from './coach.service'
import { fastFeedbackSchema } from './coach.schemas'
import type { AuthRequest } from '../../middlewares/auth'
import { authMiddleware } from '../../middlewares/auth'
import { AppError, ERR } from '../../utils/error'

const fastsRepo = appDataSource.getRepository(FastEntity)
const foodRepo = appDataSource.getRepository(FoodEntryEntity)
const usersRepo = appDataSource.getRepository(UserEntity)

const coachService = new CoachService(fastsRepo, foodRepo, usersRepo)

export const coachRouter = Router()

coachRouter.use(authMiddleware)

// POST /coach/fast-feedback
coachRouter.post('/fast-feedback', async (req: AuthRequest, res, next) => {
  try {
    if (!req.userId) {
      throw new AppError(ERR.UNAUTHORIZED)
    }

    const input = fastFeedbackSchema.parse(req.body)

    const feedback = await coachService.getFastFeedback(req.userId, input)

    res.status(200).json({ feedback })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(AppError.fromZod(err))
    }
    return next(err)
  }
})
