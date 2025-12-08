import { NextFunction, Response } from 'express'
import { AuthRequest } from './auth'
import { appDataSource } from '../infra/db'
import { UserEntity } from '../modules/users/user.entity'
import { AppError, ERR } from '../utils/error'
import { SUBSCRIPTION_PLANS, SubscriptionPlan } from '../modules/users/user-schema'

const usersRepo = appDataSource.getRepository(UserEntity)

// FREE < PREMIUM_MONTHLY < PREMIUM_YEARLY
const PLAN_ORDER: SubscriptionPlan[] = [...SUBSCRIPTION_PLANS]

function hasAtLeastPlan(current: SubscriptionPlan, min: SubscriptionPlan): boolean {
  const currentIdx = PLAN_ORDER.indexOf(current)
  const minIdx = PLAN_ORDER.indexOf(min)
  if (currentIdx === -1 || minIdx === -1) return false
  return currentIdx >= minIdx
}

export function requireSubscriptionPlan(minPlan: SubscriptionPlan) {
  return async (req: AuthRequest, _res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return next(
          new AppError(
            { ...ERR.UNAUTHORIZED, message: 'Authentication required.' },
            { reason: 'MISSING_USER_ID' }
          )
        )
      }

      const user = await usersRepo.findOne({ where: { id: req.userId } })
      if (!user) {
        return next(
          new AppError(
            { ...ERR.NOT_FOUND, message: 'User not found.' },
            { reason: 'USER_NOT_FOUND', userId: req.userId }
          )
        )
      }

      if (!hasAtLeastPlan(user.subscriptionPlan, minPlan)) {
        return next(
          new AppError(
            {
              ...ERR.FORBIDDEN,
              message: 'This feature is only available to premium users.'
            },
            {
              reason: 'INSUFFICIENT_SUBSCRIPTION',
              required: minPlan,
              current: user.subscriptionPlan
            }
          )
        )
      }

      ;(req as any).subscriptionPlan = user.subscriptionPlan
      return next()
    } catch (error) {
      return next(
        new AppError(
          { ...ERR.SERVER_ERROR, message: 'Failed to check subscription.' },
          { reason: 'SUBSCRIPTION_CHECK_ERROR', error }
        )
      )
    }
  }
}
