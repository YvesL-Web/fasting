import type { NextFunction, Response } from 'express'
import type { AuthRequest } from './auth'
import { appDataSource } from '../infra/db'
import { UserEntity } from '../modules/users/user.entity'
import { AppError, ERR } from '../utils/error'

type SubscriptionPlan = 'FREE' | 'PREMIUM_MONTHLY' | 'PREMIUM_YEARLY'

const usersRepo = appDataSource.getRepository(UserEntity)

export function requireSubscriptionPlan(allowedPlans: SubscriptionPlan[]) {
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
            { ...ERR.UNAUTHORIZED, message: 'User not found.' },
            { reason: 'USER_NOT_FOUND', userId: req.userId }
          )
        )
      }

      const plan = user.subscriptionPlan as SubscriptionPlan

      if (!allowedPlans.includes(plan)) {
        return next(
          new AppError(
            {
              ...ERR.FORBIDDEN,
              message: 'Premium subscription required for this feature.'
            },
            { reason: 'INSUFFICIENT_SUBSCRIPTION', required: allowedPlans, actual: plan }
          )
        )
      }

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

requireSubscriptionPlan(['PREMIUM_MONTHLY', 'PREMIUM_YEARLY'])
