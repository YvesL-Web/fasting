import { Router } from 'express'
import { z } from 'zod'

import { appDataSource } from '../../infra/db'
import { FoodEntryEntity } from './food-entry.entity'
import { FastEntity } from '../fasts/fast.entity'
import { UserEntity } from '../users/user.entity'
import { FoodEntryService } from './food-entry.service'
import { createFoodEntrySchema, listFoodEntriesQuerySchema } from './food-entry.schemas'
import type { AuthRequest } from '../../middlewares/auth'
import { authMiddleware } from '../../middlewares/auth'
import { AppError, ERR } from '../../utils/error'

const foodRepo = appDataSource.getRepository(FoodEntryEntity)
const fastsRepo = appDataSource.getRepository(FastEntity)
const usersRepo = appDataSource.getRepository(UserEntity)

const foodService = new FoodEntryService(foodRepo, fastsRepo, usersRepo)

export const foodEntriesRouter = Router()

foodEntriesRouter.use(authMiddleware)

const toFoodEntryResponse = (entry: FoodEntryEntity) => ({
  id: entry.id,
  label: entry.label,
  calories: entry.calories,
  proteinGrams: entry.proteinGrams,
  carbsGrams: entry.carbsGrams,
  fatGrams: entry.fatGrams,
  loggedAt: entry.loggedAt,
  inEatingWindow: entry.inEatingWindow,
  fastId: entry.fast ? entry.fast.id : null,
  createdAt: entry.createdAt,
  updatedAt: entry.updatedAt
})

// POST /food-entries
foodEntriesRouter.post('/', async (req: AuthRequest, res, next) => {
  try {
    if (!req.userId) throw new AppError(ERR.UNAUTHORIZED)

    const parsed = createFoodEntrySchema.parse(req.body)

    const entry = await foodService.createEntry(req.userId, parsed)

    res.status(201).json({ entry: toFoodEntryResponse(entry) })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(AppError.fromZod(err))
    }
    return next(err)
  }
})

// GET /food-entries?day=YYYY-MM-DD
foodEntriesRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    if (!req.userId) throw new AppError(ERR.UNAUTHORIZED)

    const query = listFoodEntriesQuerySchema.parse(req.query)

    const entries = await foodService.listEntries(req.userId, query)

    res.status(200).json({
      entries: entries.map(toFoodEntryResponse)
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(AppError.fromZod(err))
    }
    return next(err)
  }
})
