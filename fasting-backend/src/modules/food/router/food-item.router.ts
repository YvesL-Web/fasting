import { Router } from 'express'
import { z } from 'zod'
import { appDataSource } from '../../../infra/db'
import { FoodItemEntity } from '../entities/food-item.entity'
import { UserEntity } from '../../users/user.entity'
import { FoodItemService } from '../services/food-item.service'
import { authMiddleware, AuthRequest } from '../../../middlewares/auth'
import { AppError, ERR } from '../../../utils/error'
import { createFoodItemSchema, searchFoodItemsQuerySchema } from '../schemas/food-item.schemas'

const foodItemsRepo = appDataSource.getRepository(FoodItemEntity)
const usersRepo = appDataSource.getRepository(UserEntity)

const foodItemService = new FoodItemService(foodItemsRepo, usersRepo)

export const foodItemsRouter = Router()

foodItemsRouter.use(authMiddleware)

const toFoodItemResponse = (item: FoodItemEntity) => ({
  id: item.id,
  label: item.label,
  brand: item.brand,
  servingSize: item.servingSize,
  calories: item.calories,
  proteinGrams: item.proteinGrams,
  carbsGrams: item.carbsGrams,
  fatGrams: item.fatGrams,
  source: item.source,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt
})

// POST /foods  (création d'un aliment personnalisé)
foodItemsRouter.post('/', async (req: AuthRequest, res, next) => {
  try {
    if (!req.userId) throw new AppError(ERR.UNAUTHORIZED)

    const body = createFoodItemSchema.parse(req.body)
    const item = await foodItemService.createUserFood(req.userId, body)

    res.status(201).json({ item: toFoodItemResponse(item) })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(AppError.fromZod(err))
    }
    return next(err)
  }
})

// GET /foods/search?q=...&limit=...
foodItemsRouter.get('/search', async (req: AuthRequest, res, next) => {
  try {
    if (!req.userId) throw new AppError(ERR.UNAUTHORIZED)

    const query = searchFoodItemsQuerySchema.parse(req.query)
    const items = await foodItemService.searchFoods(req.userId, query)

    res.status(200).json({ items: items.map(toFoodItemResponse) })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(AppError.fromZod(err))
    }
    return next(err)
  }
})
