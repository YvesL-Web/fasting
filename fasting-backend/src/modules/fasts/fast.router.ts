import { Router } from 'express'
import { z } from 'zod'
import { appDataSource } from '../../infra/db'
import { FastEntity } from './fast.entity'
import { UserEntity } from '../users/user.entity'
import { FastService } from './fast.service'
import { startFastSchema, stopFastSchema, listFastsQuerySchema } from './fast.schemas'
import type { AuthRequest } from '../../middlewares/auth'
import { authMiddleware } from '../../middlewares/auth'
import { AppError, ERR } from '../../utils/error'

const fastsRepo = appDataSource.getRepository(FastEntity)
const usersRepo = appDataSource.getRepository(UserEntity)
const fastService = new FastService(fastsRepo, usersRepo)

export const fastRouter = Router()

fastRouter.use(authMiddleware)

const toFastResponse = (fast: FastEntity) => {
  return {
    id: fast.id,
    type: fast.type,
    startAt: fast.startAt,
    endAt: fast.endAt,
    notes: fast.notes,
    createdAt: fast.createdAt,
    updatedAt: fast.updatedAt
  }
}

// POST /fasts/start
fastRouter.post('/start', async (req: AuthRequest, res, next) => {
  try {
    if (!req.userId) throw new AppError(ERR.UNAUTHORIZED)

    const input = startFastSchema.parse(req.body)
    const fast = await fastService.startFast(req.userId, input)

    res.status(201).json({ fast: toFastResponse(fast) })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(AppError.fromZod(err))
    }
    return next(err)
  }
})

// POST /fasts/stop
fastRouter.post('/stop', async (req: AuthRequest, res, next) => {
  try {
    if (!req.userId) throw new AppError(ERR.UNAUTHORIZED)

    const input = stopFastSchema.parse(req.body)
    const fast = await fastService.stopFast(req.userId, input)

    res.status(200).json({ fast: toFastResponse(fast) })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(AppError.fromZod(err))
    }
    return next(err)
  }
})

// GET /fasts
fastRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    if (!req.userId) throw new AppError(ERR.UNAUTHORIZED)

    const query = listFastsQuerySchema.parse(req.query)
    const fasts = await fastService.listFasts(req.userId, query)

    res.status(200).json({ fasts: fasts.map(toFastResponse) })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(AppError.fromZod(err))
    }
    return next(err)
  }
})

// GET /fasts/stats
fastRouter.get('/stats', async (req: AuthRequest, res, next) => {
  try {
    if (!req.userId) throw new AppError(ERR.UNAUTHORIZED)

    const stats = await fastService.getStats(req.userId)
    res.status(200).json({ stats })
  } catch (err) {
    return next(err)
  }
})
