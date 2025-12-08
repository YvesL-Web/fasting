import { Router } from 'express'
import { z } from 'zod'

import { appDataSource } from '../../infra/db'
import { FastEntity } from '../fasts/fast.entity'
import { FoodEntryEntity } from '../food/entities/food-entry.entity'
import { UserEntity } from '../users/user.entity'
import { CoachService } from './coach.service'
import type { AuthRequest } from '../../middlewares/auth'
import { authMiddleware } from '../../middlewares/auth'
import { AppError, ERR } from '../../utils/error'
import { FastService } from '../fasts/fast.service'
import { FastCoachInput } from './coach.types'
import { differenceInHours, endOfDay, startOfDay, subDays } from 'date-fns'
import { FoodEntryService } from '../food/services/food-entry.service'
import { RecipeEntity } from '../recipes/recipe.entity'
import { requireSubscriptionPlan } from '../../middlewares/subscription'

const fastsRepo = appDataSource.getRepository(FastEntity)
const foodRepo = appDataSource.getRepository(FoodEntryEntity)
const usersRepo = appDataSource.getRepository(UserEntity)
const recipesRepo = appDataSource.getRepository(RecipeEntity)

const coachService = new CoachService()

const inputSchema = z.object({
  mood: z.string().max(200).optional(),
  notes: z.string().max(1000).optional(),
  mainGoal: z.enum(['weight_loss', 'energy', 'health', 'maintenance']).optional()
})

export const coachRouter = Router()

coachRouter.use(authMiddleware, requireSubscriptionPlan('PREMIUM_MONTHLY'))

// POST /coach/fast-feedback
coachRouter.post('/fast-feedback', async (req: AuthRequest, res, next) => {
  try {
    if (!req.userId) throw new AppError(ERR.UNAUTHORIZED)

    const body = inputSchema.parse(req.body)

    // Dernier jeûne de l'utilisateur
    const lastFast = await new FastService(fastsRepo, usersRepo).getLastFast(req.userId)

    let fastSummary: FastCoachInput['fast'] = null
    if (lastFast) {
      const end = lastFast.endAt ?? new Date()
      const actualHours = differenceInHours(end, lastFast.startAt)

      fastSummary = {
        type: lastFast.type,
        startedAt: lastFast.startAt.toISOString(),
        endedAt: lastFast.endAt ? lastFast.endAt.toISOString() : null,
        targetHours: lastFast.targetDurationHours ?? null,
        actualHours,
        eatingHours: null // ou déduit via un preset si tu veux aller plus loin
      }
    }

    // Stats alimentaires des 7 derniers jours
    const today = new Date()
    const from = startOfDay(subDays(today, 6))
    const to = endOfDay(today)

    const foodSummary = await new FoodEntryService(
      foodRepo,
      fastsRepo,
      usersRepo,
      recipesRepo
    ).getSummary(req.userId, {
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10)
    })

    const coachInput: FastCoachInput = {
      locale: 'fr', // plus tard, tu peux mettre user.locale
      fast: fastSummary,
      foodSummary,
      mood: body.mood,
      notes: body.notes,
      mainGoal: body.mainGoal ?? 'weight_loss'
    }

    const result = await coachService.getFastFeedback(coachInput)

    res.status(200).json({ message: result.message })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(AppError.fromZod(err))
    }
    return next(err)
  }
})
