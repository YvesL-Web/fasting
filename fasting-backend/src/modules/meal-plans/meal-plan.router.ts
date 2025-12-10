import { Router } from 'express'
import { z } from 'zod'

import { appDataSource } from '../../infra/db'
import type { AuthRequest } from '../../middlewares/auth'
import { authMiddleware } from '../../middlewares/auth'

import { UserEntity } from '../users/user.entity'
import { MealPlanService } from './meal-plan.service'
import { mealPlanGenerationInputSchema } from './meal-plan.schemas'
import { AppError } from '../../utils/error'
import { requireSubscriptionPlan } from '../../middlewares/subscription'

const usersRepo = appDataSource.getRepository(UserEntity)
const mealPlanService = new MealPlanService(usersRepo)

export const mealPlanRouter = Router()

mealPlanRouter.use(authMiddleware)

mealPlanRouter.post(
  '/generate',
  requireSubscriptionPlan('PREMIUM_MONTHLY'),
  async (req: AuthRequest, res, next) => {
    try {
      if (!req.userId) {
        throw new AppError(
          { status: 401, code: 'UNAUTHORIZED', message: 'Authentication required.' },
          { reason: 'MISSING_USER_ID' }
        )
      }

      const input = mealPlanGenerationInputSchema.parse(req.body)

      const plan = await mealPlanService.generate(req.userId, input)

      return res.status(200).json({ plan })
    } catch (err) {
      if (err instanceof z.ZodError) {
        return next(AppError.fromZod(err))
      }
      return next(err)
    }
  }
)
